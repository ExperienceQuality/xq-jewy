import {
  chmod,
  mkdir,
  mkdtemp,
  open,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";
import {
  CONFIG_FILE_MAX_BYTES,
  readConfigFile,
} from "../../src/config/read.js";
import { expectConfigError } from "../helpers/config-error.js";

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "xq-jewy-read-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("N-INT-03", () => {
  it("handles files, symlinks, and special nodes", async () => {
    await withDir(async (dir) => {
      const file = join(dir, "cfg.yaml");
      await writeFile(file, "capabilities:\n  stubs:\n    enabled: true\n");
      const text = await readConfigFile(file);
      expect(text).toContain("capabilities");

      const linkPath = join(dir, "via-link.yaml");
      await symlink(file, linkPath);
      await expect(readConfigFile(linkPath)).resolves.toContain("capabilities");

      const dangling = join(dir, "missing.yaml");
      await symlink(join(dir, "nope"), dangling);
      try {
        await readConfigFile(dangling);
        throw new Error("expected not_found");
      } catch (error) {
        expectConfigError(error, "not_found");
      }

      const sub = join(dir, "nested");
      await mkdir(sub);
      try {
        await readConfigFile(sub);
        throw new Error("expected not_a_file");
      } catch (error) {
        expectConfigError(error, "not_a_file");
      }

      if (process.getuid?.() === 0) {
        throw new Error("unreadable permission test refuses to run as root");
      }

      const locked = join(dir, "locked.yaml");
      await writeFile(locked, "x");
      await chmod(locked, 0o000);
      try {
        await readConfigFile(locked);
        throw new Error("expected unreadable");
      } catch (error) {
        expectConfigError(error, "unreadable");
      } finally {
        await chmod(locked, 0o600);
      }

      const huge = join(dir, "huge.yaml");
      const handle = await open(huge, "w");
      await handle.write(Buffer.alloc(CONFIG_FILE_MAX_BYTES + 2, 0x61));
      await handle.close();
      try {
        await readConfigFile(huge);
        throw new Error("expected too_large");
      } catch (error) {
        expectConfigError(error, "too_large");
      }
    });
  });

  it("returns not_a_file for FIFO within 2s", async () => {
    await withDir(async (dir) => {
      const fifo = join(dir, "pipe");
      const run = promisify(execFile);
      await run("mkfifo", [fifo]);

      const started = Date.now();
      try {
        await readConfigFile(fifo);
        throw new Error("expected not_a_file");
      } catch (error) {
        expectConfigError(error, "not_a_file");
      }
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });
});
