import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";
import {
  loadConfiguration,
  type StartupConfiguration,
} from "../../src/config/index.js";
import {
  XQ_JEWY_API_BASE_URL_ENV,
  XQ_JEWY_WIREMOCK_BASE_URL_ENV,
} from "../../src/config/endpoints.js";
import { XQ_JEWY_CONFIG_ENV } from "../../src/config/path.js";
import { expectConfigError } from "../helpers/config-error.js";

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

const ASSERTIONS_ONLY = `capabilities:
  stubs:
    enabled: false
  rest:
    enabled: false
  assertions:
    enabled: true
  reporting:
    enabled: false
enabled_tags:
  - verification
`;

const REPORTING_ONLY = `capabilities:
  stubs:
    enabled: false
  rest:
    enabled: false
  assertions:
    enabled: false
  reporting:
    enabled: true
enabled_tags:
  - reporting
`;

const VALID_WM = "http://127.0.0.1:8081";

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "xq-jewy-load-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeYaml(
  dir: string,
  name: string,
  body: string,
): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, body);
  return path;
}

describe("N-INT-02", () => {
  it("applies first-error order across adjacent pairs", async () => {
    await withDir(async (dir) => {
      // 1. bad path + bad YAML: write unparseable YAML on disk, but feed a
      // relative env path so path classification wins before file/parse.
      await writeYaml(dir, "broken.yaml", "a: [");
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: "relative/broken.yaml",
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
        });
        throw new Error("expected relative_path");
      } catch (error) {
        expectConfigError(error, "relative_path");
      }

      // 2. FIFO + bad URL → not_a_file (file stage before endpoints)
      const fifo = join(dir, "pipe.yaml");
      await promisify(execFile)("mkfifo", [fifo]);
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: fifo,
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
        });
        throw new Error("expected not_a_file");
      } catch (error) {
        expectConfigError(error, "not_a_file");
      }

      // 3. duplicate key wins over schema-invalid content
      const dup = await writeYaml(
        dir,
        "dup.yaml",
        [
          "capabilities:",
          "  stubs:",
          "    enabled: true",
          "    enabled: false",
          "enabled_tags:",
          "  - rest",
        ].join("\n"),
      );
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: dup,
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: VALID_WM,
        });
        throw new Error("expected duplicate_key");
      } catch (error) {
        expectConfigError(error, "duplicate_key");
      }

      // 4. schema wins over missing URL
      const schemaBad = await writeYaml(
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
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: schemaBad,
        });
        throw new Error("expected schema");
      } catch (error) {
        expectConfigError(error, "schema");
      }
    });
  });

  it("applies endpoint precedence pairs through the loader", async () => {
    await withDir(async (dir) => {
      const stubsPath = await writeYaml(dir, "stubs.yaml", STUBS_ONLY);
      const restPath = await writeYaml(dir, "rest.yaml", REST_ONLY);
      const assertionsPath = await writeYaml(
        dir,
        "assertions.yaml",
        ASSERTIONS_ONLY,
      );
      const reportingPath = await writeYaml(
        dir,
        "reporting.yaml",
        REPORTING_ONLY,
      );

      // stubs-only + invalid optional API + valid WM → invalid_url on API
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: stubsPath,
          [XQ_JEWY_API_BASE_URL_ENV]: "not-a-url",
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: VALID_WM,
        });
        throw new Error("expected invalid_url API");
      } catch (error) {
        const configError = expectConfigError(error, "invalid_url");
        expect(configError.location).toEqual({
          kind: "env",
          name: XQ_JEWY_API_BASE_URL_ENV,
        });
      }

      // rest-only + API error + invalid WM → API error wins
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: restPath,
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
        });
        throw new Error("expected missing_env API");
      } catch (error) {
        const configError = expectConfigError(error, "missing_env");
        expect(configError.location).toEqual({
          kind: "env",
          name: XQ_JEWY_API_BASE_URL_ENV,
        });
      }

      // assertions + both pending errors → API
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: assertionsPath,
          [XQ_JEWY_API_BASE_URL_ENV]: "",
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url",
        });
        throw new Error("expected API empty_env");
      } catch (error) {
        const configError = expectConfigError(error, "empty_env");
        expect(configError.location).toEqual({
          kind: "env",
          name: XQ_JEWY_API_BASE_URL_ENV,
        });
      }

      // reporting-only + both invalid_url → API invalid_url
      try {
        await loadConfiguration({
          [XQ_JEWY_CONFIG_ENV]: reportingPath,
          [XQ_JEWY_API_BASE_URL_ENV]: "not-a-url",
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "also-bad",
        });
        throw new Error("expected invalid_url API");
      } catch (error) {
        const configError = expectConfigError(error, "invalid_url");
        expect(configError.location).toEqual({
          kind: "env",
          name: XQ_JEWY_API_BASE_URL_ENV,
        });
      }
    });
  });

  it("covers N-ACC-02/03/04 path failures via loadConfiguration", async () => {
    // N-ACC-02: missing_env
    try {
      await loadConfiguration({});
      throw new Error("expected missing_env");
    } catch (error) {
      expectConfigError(error, "missing_env");
    }

    // N-ACC-02: empty_env
    try {
      await loadConfiguration({ [XQ_JEWY_CONFIG_ENV]: "" });
      throw new Error("expected empty_env");
    } catch (error) {
      expectConfigError(error, "empty_env");
    }

    // N-ACC-03: relative_path
    try {
      await loadConfiguration({ [XQ_JEWY_CONFIG_ENV]: "./relative.yaml" });
      throw new Error("expected relative_path");
    } catch (error) {
      expectConfigError(error, "relative_path");
    }

    // N-ACC-04: not_found
    await withDir(async (dir) => {
      const missing = join(dir, "does-not-exist.yaml");
      try {
        await loadConfiguration({ [XQ_JEWY_CONFIG_ENV]: missing });
        throw new Error("expected not_found");
      } catch (error) {
        expectConfigError(error, "not_found");
      }
    });
  });

  it("returns StartupConfiguration on stubs-only happy path", async () => {
    await withDir(async (dir) => {
      const path = await writeYaml(dir, "happy.yaml", STUBS_ONLY);
      const config: StartupConfiguration = await loadConfiguration({
        [XQ_JEWY_CONFIG_ENV]: path,
        [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: VALID_WM,
      });
      expect(config.configPath).toBe(path);
      expect(config.capabilities.stubs).toBe(true);
      expect(config.enabledTags).toEqual(["stub"]);
      expect(config.apiBaseUrl).toBeNull();
      expect(config.wiremockBaseUrl).toBe(VALID_WM);
      expect(
        typeof config.apiBaseUrl === "string" || config.apiBaseUrl === null,
      ).toBe(true);
      expect(
        typeof config.wiremockBaseUrl === "string" ||
          config.wiremockBaseUrl === null,
      ).toBe(true);
    });
  });
});
