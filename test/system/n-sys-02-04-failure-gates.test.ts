import { describe, expect, it } from "vitest";

import {
  assertFailureGate,
  baseSpawnEnv,
  isPidAlive,
  spawnBin,
} from "../helpers/spawn-bin.js";

describe("N-SYS-02", () => {
  it("failure gates: exit 1, 0 stdout bytes, one stderr line, no stack", async () => {
    const result = await spawnBin({
      env: baseSpawnEnv({}),
    });
    const line = assertFailureGate(result, "missing_env");
    expect(line).toBe("missing_env XQ_JEWY_CONFIG");
    if (result.pid !== undefined) {
      expect(isPidAlive(result.pid)).toBe(false);
    }
  });
});

describe("N-SYS-04", () => {
  it("on config failure never speaks JSON-RPC on stdout", async () => {
    const result = await spawnBin({
      env: baseSpawnEnv({
        XQ_JEWY_CONFIG: "./relative.yaml",
      }),
    });
    assertFailureGate(result, "relative_path");
    expect(result.stdout.byteLength).toBe(0);
    const stdoutText = result.stdout.toString("utf8");
    expect(stdoutText).not.toMatch(/jsonrpc/i);
    expect(stdoutText).not.toMatch(/"method"/);
    expect(stdoutText).not.toMatch(/initialize/);
  });
});
