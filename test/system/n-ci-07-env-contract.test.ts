import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  closeMcpSession,
  connectMcpSession,
  getDefaultEnvironment,
} from "../helpers/mcp-stdio-client.js";
import {
  assertFailureGate,
  baseSpawnEnv,
  CLEANUP_TIMEOUT_MS,
  ensureChildGone,
  reportingOnlyConfigPath,
  spawnBin,
  STARTUP_TIMEOUT_MS,
} from "../helpers/spawn-bin.js";

const POISON_KEY = "XQ_JEWY_POISON";
const POISON_VALUE = "leaked-from-parent";

describe("N-CI-07", () => {
  it("StdioClientTransport child sees only default allowlist + explicit XQ_JEWY_*", async () => {
    const previousPoison = process.env[POISON_KEY];
    const previousConfig = process.env["XQ_JEWY_CONFIG"];
    process.env[POISON_KEY] = POISON_VALUE;
    process.env["XQ_JEWY_CONFIG"] = "./poison-relative.yaml";

    try {
      const defaults = getDefaultEnvironment();
      expect(defaults[POISON_KEY]).toBeUndefined();
      expect(defaults["XQ_JEWY_CONFIG"]).toBeUndefined();

      // Probe: same env construction as StdioClientTransport — child must not see poison.
      const childEnv = {
        ...defaults,
        XQ_JEWY_CONFIG: reportingOnlyConfigPath(),
      };
      expect(childEnv[POISON_KEY]).toBeUndefined();
      expect(Object.hasOwn(childEnv, POISON_KEY)).toBe(false);

      const probe = await new Promise<{
        code: number | null;
        stdout: string;
      }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "-e",
            `process.stdout.write(JSON.stringify({poison:process.env[${JSON.stringify(POISON_KEY)}]??null,config:process.env.XQ_JEWY_CONFIG??null}))`,
          ],
          {
            env: childEnv,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "";
        child.stdout.on("data", (c: Buffer) => {
          stdout += c.toString("utf8");
        });
        const timer = setTimeout(() => {
          void ensureChildGone(child, CLEANUP_TIMEOUT_MS);
          reject(new Error("env probe timed out"));
        }, STARTUP_TIMEOUT_MS);
        child.once("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          resolve({ code, stdout });
        });
      });
      expect(probe.code).toBe(0);
      const parsed: unknown = JSON.parse(probe.stdout);
      expect(parsed).toEqual({
        poison: null,
        config: reportingOnlyConfigPath(),
      });

      // Real server handshake still works with explicit env while parent is poisoned.
      const session = await connectMcpSession({
        xqEnv: { XQ_JEWY_CONFIG: reportingOnlyConfigPath() },
      });
      try {
        expect(session.client.getServerVersion()?.name).toBe("xq-jewy");
      } finally {
        await closeMcpSession(session);
      }
    } finally {
      if (previousPoison === undefined) {
        delete process.env[POISON_KEY];
      } else {
        process.env[POISON_KEY] = previousPoison;
      }
      if (previousConfig === undefined) {
        delete process.env["XQ_JEWY_CONFIG"];
      } else {
        process.env["XQ_JEWY_CONFIG"] = previousConfig;
      }
    }
  });

  it("raw spawn uses process.execPath with an explicit env object (no poison leak)", async () => {
    process.env[POISON_KEY] = POISON_VALUE;
    try {
      const result = await spawnBin({
        env: baseSpawnEnv({
          XQ_JEWY_CONFIG: "./still-relative.yaml",
        }),
      });
      // Explicit env omitted poison; relative config fails as expected.
      assertFailureGate(result, "relative_path");
      expect(result.stderr.toString("utf8")).not.toContain(POISON_VALUE);
      expect(result.stdout.byteLength).toBe(0);
    } finally {
      delete process.env[POISON_KEY];
    }
  });
});
