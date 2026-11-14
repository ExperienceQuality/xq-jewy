import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  closeMcpSession,
  connectMcpSession,
} from "../helpers/mcp-stdio-client.js";
import {
  assertFailureGate,
  baseSpawnEnv,
  reportingOnlyConfigPath,
  spawnBin,
} from "../helpers/spawn-bin.js";

describe("N-SYS-05", () => {
  it("same absolute XQ_JEWY_CONFIG succeeds from two different cwd values", async () => {
    const cfg = reportingOnlyConfigPath();
    const dirA = await mkdtemp(join(tmpdir(), "xq-jewy-cwd-a-"));
    const dirB = await mkdtemp(join(tmpdir(), "xq-jewy-cwd-b-"));

    try {
      const sessionA = await connectMcpSession({
        xqEnv: { XQ_JEWY_CONFIG: cfg },
        cwd: dirA,
      });
      try {
        expect(sessionA.client.getServerVersion()?.name).toBe("xq-jewy");
        const toolsA = await sessionA.client.listTools();
        expect(toolsA.tools).toEqual([]);
      } finally {
        await closeMcpSession(sessionA);
      }

      const sessionB = await connectMcpSession({
        xqEnv: { XQ_JEWY_CONFIG: cfg },
        cwd: dirB,
      });
      try {
        expect(sessionB.client.getServerVersion()?.name).toBe("xq-jewy");
        const toolsB = await sessionB.client.listTools();
        expect(toolsB.tools).toEqual([]);
      } finally {
        await closeMcpSession(sessionB);
      }
    } finally {
      await rm(dirA, { recursive: true, force: true });
      await rm(dirB, { recursive: true, force: true });
    }
  });

  it("same absolute missing path fails identically from two cwd values", async () => {
    const missing = join(tmpdir(), "xq-jewy-missing-config-n-sys-05.yaml");
    const dirA = await mkdtemp(join(tmpdir(), "xq-jewy-cwd-fail-a-"));
    const dirB = await mkdtemp(join(tmpdir(), "xq-jewy-cwd-fail-b-"));

    try {
      const a = await spawnBin({
        env: baseSpawnEnv({ XQ_JEWY_CONFIG: missing }),
        cwd: dirA,
      });
      const b = await spawnBin({
        env: baseSpawnEnv({ XQ_JEWY_CONFIG: missing }),
        cwd: dirB,
      });
      const lineA = assertFailureGate(a, "not_found");
      const lineB = assertFailureGate(b, "not_found");
      expect(lineA).toBe(lineB);
      expect(lineA).toBe(`not_found ${missing}`);
    } finally {
      await rm(dirA, { recursive: true, force: true });
      await rm(dirB, { recursive: true, force: true });
    }
  });
});
