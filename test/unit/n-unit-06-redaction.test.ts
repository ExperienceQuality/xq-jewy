import { describe, expect, it } from "vitest";
import {
  formatConfigErrorLine,
  loadConfiguration,
  type ConfigErrorCode,
} from "../../src/config/index.js";
import {
  resolveEndpointUrls,
  XQ_JEWY_API_BASE_URL_ENV,
  XQ_JEWY_WIREMOCK_BASE_URL_ENV,
} from "../../src/config/endpoints.js";
import { XQ_JEWY_CONFIG_ENV } from "../../src/config/path.js";
import { validateConfigMapping } from "../../src/config/schema.js";
import { parseConfigYaml } from "../../src/config/yaml.js";
import { expectConfigError } from "../helpers/config-error.js";

const SECRET = "SECRET_MARKER_xq_jewy_redact";
/** Invalid grammar, but still embeds the secret marker. */
const SECRET_URL = `not-a-url://${SECRET}`;
const SECRET_PATH = `./${SECRET}/leaked.yaml`;
const SECRET_YAML_VALUE = `token-${SECRET}-value`;
/** Valid grammar placeholder so optional WM classification is not the failure. */
const VALID_WM_PLACEHOLDER = "http://127.0.0.1:8081";

function assertRedacted(error: unknown, code: ConfigErrorCode): void {
  const configError = expectConfigError(error, code);
  const line = formatConfigErrorLine(configError);
  for (const marker of [SECRET, SECRET_URL, SECRET_PATH, SECRET_YAML_VALUE]) {
    expect(configError.message).not.toContain(marker);
    expect(line).not.toContain(marker);
  }
  expect(line.split("\n")).toHaveLength(1);
}

describe("N-UNIT-06", () => {
  it("omits secret markers from path, URL, YAML, and schema diagnostics", async () => {
    // Path relative value via facade (no fs)
    try {
      await loadConfiguration({ [XQ_JEWY_CONFIG_ENV]: SECRET_PATH });
      throw new Error("expected relative_path");
    } catch (error) {
      assertRedacted(error, "relative_path");
    }

    // Endpoint invalid URL values
    try {
      resolveEndpointUrls(
        {
          [XQ_JEWY_API_BASE_URL_ENV]: SECRET_URL,
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: VALID_WM_PLACEHOLDER,
        },
        { stubs: true, rest: false, assertions: false, reporting: false },
      );
      throw new Error("expected invalid_url");
    } catch (error) {
      assertRedacted(error, "invalid_url");
    }

    try {
      resolveEndpointUrls(
        { [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: `ftp://${SECRET}.example` },
        { stubs: true, rest: false, assertions: false, reporting: false },
      );
      throw new Error("expected invalid_url");
    } catch (error) {
      assertRedacted(error, "invalid_url");
    }

    // YAML parse: duplicate key; secret appears only as a value (not in location)
    try {
      parseConfigYaml(
        [
          "capabilities:",
          "  stubs:",
          `    enabled: true`,
          `    enabled: false`,
          `secret: ${SECRET_YAML_VALUE}`,
          "enabled_tags:",
          "  - stub",
        ].join("\n"),
      );
      throw new Error("expected duplicate_key");
    } catch (error) {
      assertRedacted(error, "duplicate_key");
    }

    // Schema / Zod path — invalid boolean value must not leak into diagnostics
    try {
      validateConfigMapping({
        capabilities: {
          stubs: { enabled: SECRET_YAML_VALUE },
        },
        enabled_tags: ["stub"],
      });
      throw new Error("expected schema");
    } catch (error) {
      assertRedacted(error, "schema");
    }
  });
});
