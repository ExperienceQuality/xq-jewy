import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_INDEX = join(REPO_ROOT, "dist", "index.js");

/** Default harness limits (tests only — not product SLAs). */
export const STARTUP_TIMEOUT_MS = 10_000;
export const CLEANUP_TIMEOUT_MS = 5_000;

export type SpawnBinResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
  pid: number | undefined;
};

export function repoRoot(): string {
  return REPO_ROOT;
}

/** Absolute path to built `dist/index.js`. Throws if missing (run `npm run build`). */
export function distIndexPath(): string {
  try {
    accessSync(DIST_INDEX, constants.R_OK);
  } catch {
    throw new Error(
      `missing ${DIST_INDEX}; run \`npm run build\` before system tests`,
    );
  }
  return DIST_INDEX;
}

export function reportingOnlyConfigPath(): string {
  return join(REPO_ROOT, "docs", "config", "xq.reporting-only.yaml");
}

/** True when `pid` still exists (and is killable by this process). */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Force-kill a child and wait until it is gone (or cleanup timeout).
 * Safe to call when the process already exited.
 */
export async function ensureChildGone(
  child: ChildProcessWithoutNullStreams | { pid?: number | null },
  timeoutMs: number = CLEANUP_TIMEOUT_MS,
): Promise<void> {
  const pid = child.pid ?? undefined;
  if (pid === undefined) {
    return;
  }
  if (!isPidAlive(pid)) {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  if (isPidAlive(pid)) {
    throw new Error(`child pid ${String(pid)} still alive after cleanup`);
  }
}

/**
 * Spawn built `dist/index.js` with an explicit env object (no parent env leak).
 * Collects stdout/stderr until exit or startup timeout (then SIGKILL).
 */
export async function spawnBin(options: {
  env: NodeJS.ProcessEnv;
  cwd?: string;
  timeoutMs?: number;
}): Promise<SpawnBinResult> {
  const index = distIndexPath();
  const timeoutMs = options.timeoutMs ?? STARTUP_TIMEOUT_MS;
  const child = spawn(process.execPath, [index], {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void ensureChildGone(child);
  }, timeoutMs);

  try {
    const exit = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => {
        resolveExit({ code, signal });
      });
    });

    if (timedOut) {
      throw new Error(
        `spawnBin timed out after ${String(timeoutMs)}ms (pid=${String(child.pid)})`,
      );
    }

    return {
      exitCode: exit.code,
      signal: exit.signal,
      stdout: Buffer.concat(stdoutChunks),
      stderr: Buffer.concat(stderrChunks),
      pid: child.pid,
    };
  } finally {
    clearTimeout(timer);
    await ensureChildGone(child);
  }
}

/** Minimal PATH-bearing env for raw spawns (no inherited XQ_JEWY_*). */
export function baseSpawnEnv(
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env["PATH"] ?? "/usr/bin:/bin",
    HOME: process.env["HOME"] ?? "/tmp",
    ...extra,
  };
}

/** Assert failure-gate shape: exit 1, empty stdout, one complete stderr line, no stack. */
export function assertFailureGate(
  result: SpawnBinResult,
  expectedCodePrefix: string,
): string {
  expect(result.exitCode).toBe(1);
  expect(result.stdout.byteLength).toBe(0);
  const stderrText = result.stderr.toString("utf8");
  expect(stderrText.endsWith("\n")).toBe(true);
  const lines = stderrText.split("\n").filter((line) => line.length > 0);
  expect(lines).toHaveLength(1);
  const line = lines[0] ?? "";
  expect(line.startsWith(expectedCodePrefix)).toBe(true);
  expect(line).not.toMatch(/\bat\s+/);
  expect(line).not.toMatch(/Error:/);
  return line;
}
