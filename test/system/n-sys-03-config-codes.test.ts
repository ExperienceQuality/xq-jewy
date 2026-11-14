import { chmod, mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  XQ_JEWY_API_BASE_URL_ENV,
  XQ_JEWY_WIREMOCK_BASE_URL_ENV,
} from "../../src/config/endpoints.js";
import { XQ_JEWY_CONFIG_ENV } from "../../src/config/path.js";
import { CONFIG_FILE_MAX_BYTES } from "../../src/config/read.js";
import {
  assertFailureGate,
  baseSpawnEnv,
  spawnBin,
} from "../helpers/spawn-bin.js";

const STUBS_ONLY = `capabilities:
  stubs:
    enabled: true
  rest:
    enabled: false
  assertions:
    enabled: false
  reporting:
    enabled: false
enabled_tags:
  - stub
`;

const REST_ONLY = `capabilities:
  stubs:
    enabled: false
  rest:
    enabled: true
  assertions:
    enabled: false
  reporting:
    enabled: false
enabled_tags:
  - rest
`;

const VALID_WM = "http://127.0.0.1:8081";

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "xq-jewy-sys03-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeYaml(
  dir: string,
  name: string,
  body: string | Uint8Array,
): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, body);
  return path;
}

describe("N-SYS-03", () => {
  it("reaches each of the 15 ConfigError codes through the built bin", async () => {
    await withDir(async (dir) => {
      // missing_env
      {
        const result = await spawnBin({ env: baseSpawnEnv({}) });
        expect(assertFailureGate(result, "missing_env")).toBe(
          "missing_env XQ_JEWY_CONFIG",
        );
      }

      // empty_env
      {
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: "" }),
        });
        expect(assertFailureGate(result, "empty_env")).toBe(
          "empty_env XQ_JEWY_CONFIG",
        );
      }

      // relative_path
      {
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: "relative.yaml" }),
        });
        expect(assertFailureGate(result, "relative_path")).toBe(
          "relative_path XQ_JEWY_CONFIG",
        );
      }

      // not_found
      {
        const missing = join(dir, "does-not-exist.yaml");
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: missing }),
        });
        expect(assertFailureGate(result, "not_found")).toBe(
          `not_found ${missing}`,
        );
      }

      // not_a_file (directory)
      {
        const sub = join(dir, "nested-dir");
        await mkdir(sub);
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: sub }),
        });
        expect(assertFailureGate(result, "not_a_file")).toBe(
          `not_a_file ${sub}`,
        );
      }

      // unreadable
      if (process.getuid?.() === 0) {
        throw new Error("unreadable fixture refuses to run as root");
      }
      {
        const locked = await writeYaml(dir, "locked.yaml", "x: 1\n");
        await chmod(locked, 0o000);
        try {
          const result = await spawnBin({
            env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: locked }),
          });
          expect(assertFailureGate(result, "unreadable")).toBe(
            `unreadable ${locked}`,
          );
        } finally {
          await chmod(locked, 0o600);
        }
      }

      // too_large
      {
        const huge = join(dir, "huge.yaml");
        const handle = await open(huge, "w");
        await handle.write(Buffer.alloc(CONFIG_FILE_MAX_BYTES + 2, 0x61));
        await handle.close();
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: huge }),
        });
        expect(assertFailureGate(result, "too_large")).toBe(
          `too_large ${huge}`,
        );
      }

      // decode_error
      {
        const bad = await writeYaml(
          dir,
          "bad-utf8.yaml",
          new Uint8Array([0xff]),
        );
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: bad }),
        });
        expect(assertFailureGate(result, "decode_error")).toBe(
          `decode_error ${bad}`,
        );
      }

      // yaml_syntax
      {
        const path = await writeYaml(dir, "syntax.yaml", "a: [\n");
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: path }),
        });
        const line = assertFailureGate(result, "yaml_syntax");
        expect(line.startsWith("yaml_syntax ")).toBe(true);
      }

      // unsafe_yaml
      {
        const path = await writeYaml(
          dir,
          "unsafe.yaml",
          "anchors:\n  base: &a\n  use: *a\n",
        );
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: path }),
        });
        const line = assertFailureGate(result, "unsafe_yaml");
        expect(line.startsWith("unsafe_yaml ")).toBe(true);
      }

      // duplicate_key
      {
        const path = await writeYaml(
          dir,
          "dup.yaml",
          [
            "capabilities:",
            "  stubs:",
            "    enabled: true",
            "    enabled: false",
            "enabled_tags:",
            "  - stub",
          ].join("\n"),
        );
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: path }),
        });
        const line = assertFailureGate(result, "duplicate_key");
        expect(line.startsWith("duplicate_key ")).toBe(true);
      }

      // multiple_documents
      {
        const path = await writeYaml(dir, "multi.yaml", "a: 1\n---\nb: 2\n");
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: path }),
        });
        const line = assertFailureGate(result, "multiple_documents");
        expect(line.startsWith("multiple_documents ")).toBe(true);
      }

      // not_a_mapping
      {
        const path = await writeYaml(dir, "list.yaml", "- a\n");
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: path }),
        });
        const line = assertFailureGate(result, "not_a_mapping");
        expect(line.startsWith("not_a_mapping ")).toBe(true);
      }

      // schema
      {
        const path = await writeYaml(
          dir,
          "schema-bad.yaml",
          [
            "capabilities:",
            "  stubs:",
            "    enabled: true",
            "enabled_tags:",
            "  - rest",
          ].join("\n"),
        );
        const result = await spawnBin({
          env: baseSpawnEnv({ [XQ_JEWY_CONFIG_ENV]: path }),
        });
        const line = assertFailureGate(result, "schema");
        expect(line.startsWith("schema ")).toBe(true);
      }

      // invalid_url (stubs-only requires WM; invalid WM)
      {
        const path = await writeYaml(dir, "stubs.yaml", STUBS_ONLY);
        const result = await spawnBin({
          env: baseSpawnEnv({
            [XQ_JEWY_CONFIG_ENV]: path,
            [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
          }),
        });
        expect(assertFailureGate(result, "invalid_url")).toBe(
          `invalid_url ${XQ_JEWY_WIREMOCK_BASE_URL_ENV}`,
        );
      }
    });
  });

  it("applies two precedence pairs through the built bin", async () => {
    await withDir(async (dir) => {
      // Pair 1: relative path wins over unparseable YAML on disk (path before read).
      await writeYaml(dir, "broken.yaml", "a: [\n");
      {
        const result = await spawnBin({
          env: baseSpawnEnv({
            [XQ_JEWY_CONFIG_ENV]: "relative/broken.yaml",
            [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
          }),
        });
        expect(assertFailureGate(result, "relative_path")).toBe(
          "relative_path XQ_JEWY_CONFIG",
        );
      }

      // Pair 2: FIFO (not_a_file) wins over invalid URL (file stage before endpoints).
      const fifo = join(dir, "pipe.yaml");
      await promisify(execFile)("mkfifo", [fifo]);
      {
        const result = await spawnBin({
          env: baseSpawnEnv({
            [XQ_JEWY_CONFIG_ENV]: fifo,
            [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
          }),
        });
        expect(assertFailureGate(result, "not_a_file")).toBe(
          `not_a_file ${fifo}`,
        );
      }

      // Bonus endpoint precedence (same as n-int-02): rest-only + missing API + invalid WM → API.
      const restPath = await writeYaml(dir, "rest.yaml", REST_ONLY);
      {
        const result = await spawnBin({
          env: baseSpawnEnv({
            [XQ_JEWY_CONFIG_ENV]: restPath,
            [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
          }),
        });
        expect(assertFailureGate(result, "missing_env")).toBe(
          `missing_env ${XQ_JEWY_API_BASE_URL_ENV}`,
        );
      }

      // Stubs-only + invalid optional API + valid WM → invalid_url on API
      const stubsPath = await writeYaml(dir, "stubs2.yaml", STUBS_ONLY);
      {
        const result = await spawnBin({
          env: baseSpawnEnv({
            [XQ_JEWY_CONFIG_ENV]: stubsPath,
            [XQ_JEWY_API_BASE_URL_ENV]: "not-a-url",
            [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: VALID_WM,
          }),
        });
        expect(assertFailureGate(result, "invalid_url")).toBe(
          `invalid_url ${XQ_JEWY_API_BASE_URL_ENV}`,
        );
      }
    });
  });
});
