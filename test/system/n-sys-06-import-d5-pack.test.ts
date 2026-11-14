import { access } from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

import {
  assertFailureGate,
  baseSpawnEnv,
  CLEANUP_TIMEOUT_MS,
  distIndexPath,
  ensureChildGone,
  reportingOnlyConfigPath,
  repoRoot,
  spawnBin,
  STARTUP_TIMEOUT_MS,
} from "../helpers/spawn-bin.js";

const execFileAsync = promisify(execFile);

describe("N-SYS-06", () => {
  it("(a) importing config/index and server exports without throwing", async () => {
    const configMod = await import("../../src/config/index.js");
    const serverMod = await import("../../src/server.js");

    expect(typeof configMod.loadConfiguration).toBe("function");
    expect(typeof configMod.ConfigError).toBe("function");
    expect(typeof configMod.formatConfigErrorLine).toBe("function");
    expect(typeof serverMod.startServer).toBe("function");
  });

  it("(b) D5: injected unhandled rejection → exit 1, empty stdout, fixed stderr", async () => {
    const result = await spawnBin({
      env: baseSpawnEnv({
        XQ_JEWY_TEST_INJECT_REJECTION: "1",
        XQ_JEWY_CONFIG: reportingOnlyConfigPath(),
      }),
    });
    expect(assertFailureGate(result, "xq-jewy: internal error")).toBe(
      "xq-jewy: internal error",
    );
  });

  it("(c) installed bin from npm pack completes initialize handshake", async () => {
    distIndexPath();
    const root = repoRoot();
    const packDir = await mkdtemp(join(tmpdir(), "xq-jewy-pack-"));
    const installDir = await mkdtemp(join(tmpdir(), "xq-jewy-install-"));

    try {
      const { stdout: packOut } = await execFileAsync(
        "npm",
        ["pack", "--pack-destination", packDir],
        { cwd: root },
      );
      const tgzName = packOut.trim().split("\n").at(-1)?.trim();
      expect(tgzName).toMatch(/\.tgz$/);
      const tgzPath = join(packDir, tgzName!);

      await writeFile(
        join(installDir, "package.json"),
        JSON.stringify({ name: "xq-jewy-pack-smoke", private: true }),
      );

      const installArgs = [
        "install",
        tgzPath,
        "--ignore-scripts",
        "--no-save",
        "--no-package-lock",
      ];
      try {
        await execFileAsync("npm", [...installArgs, "--offline"], {
          cwd: installDir,
        });
      } catch {
        await execFileAsync("npm", installArgs, { cwd: installDir });
      }

      const binPath = join(
        installDir,
        "node_modules",
        "xq-jewy",
        "dist",
        "index.js",
      );
      await access(binPath);

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [binPath],
        env: {
          ...getDefaultEnvironment(),
          XQ_JEWY_CONFIG: reportingOnlyConfigPath(),
        },
        stderr: "pipe",
        cwd: installDir,
      });
      const client = new Client({ name: "pack-smoke", version: "0.0.0" });
      const outcome = await Promise.race([
        client.connect(transport).then(() => "ok" as const),
        new Promise<"timeout">((resolve) => {
          setTimeout(() => resolve("timeout"), STARTUP_TIMEOUT_MS);
        }),
      ]);
      expect(outcome).toBe("ok");
      try {
        expect(client.getServerVersion()?.name).toBe("xq-jewy");
        const tools = await client.listTools();
        expect(tools.tools).toEqual([]);
      } finally {
        await client.close().catch(() => undefined);
        await transport.close().catch(() => undefined);
        if (transport.pid !== null) {
          await ensureChildGone({ pid: transport.pid }, CLEANUP_TIMEOUT_MS);
        }
      }
    } finally {
      await rm(packDir, { recursive: true, force: true });
      await rm(installDir, { recursive: true, force: true });
    }
  }, 60_000);
});
