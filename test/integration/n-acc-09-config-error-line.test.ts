import { describe, expect, it } from "vitest";
import {
  ConfigError,
  formatConfigErrorLine,
  type ConfigErrorCode,
  type ConfigErrorLocation,
} from "../../src/config/errors.js";
import {
  resolveEndpointUrls,
  XQ_JEWY_API_BASE_URL_ENV,
  XQ_JEWY_WIREMOCK_BASE_URL_ENV,
} from "../../src/config/endpoints.js";
import { resolveConfigPath } from "../../src/config/path.js";
import { expectConfigError } from "../helpers/config-error.js";

/** Values fed into real failures — must never appear in formatted lines. */
const SECRET_URL = "https://evil.example/secret";
const SECRET_PATH = "~/secrets/leaked.yaml";
const BAD_URL = "not-a-url://evil.example/leak";

function assertSafeLine(
  error: ConfigError,
  expected: string,
  forbidden: string[],
): void {
  const formatted = formatConfigErrorLine(error);
  expect(formatted).toBe(expected);
  expect(formatted.split("\n")).toHaveLength(1);
  for (const value of forbidden) {
    expect(formatted).not.toContain(value);
    expect(error.message).not.toContain(value);
  }
}

describe("N-ACC-09", () => {
  it("renders path failures with value-bearing inputs as one safe line", () => {
    const cases: Array<{
      run: () => never;
      code: ConfigErrorCode;
      line: string;
      forbidden: string[];
    }> = [
      {
        run: () => resolveConfigPath({}),
        code: "missing_env",
        line: "missing_env XQ_JEWY_CONFIG",
        forbidden: [SECRET_URL, SECRET_PATH],
      },
      {
        run: () => resolveConfigPath({ XQ_JEWY_CONFIG: "" }),
        code: "empty_env",
        line: "empty_env XQ_JEWY_CONFIG",
        forbidden: [SECRET_URL, SECRET_PATH],
      },
      {
        run: () => resolveConfigPath({ XQ_JEWY_CONFIG: SECRET_URL }),
        code: "relative_path",
        line: "relative_path XQ_JEWY_CONFIG",
        forbidden: [SECRET_URL, SECRET_PATH],
      },
      {
        run: () => resolveConfigPath({ XQ_JEWY_CONFIG: SECRET_PATH }),
        code: "relative_path",
        line: "relative_path XQ_JEWY_CONFIG",
        forbidden: [SECRET_URL, SECRET_PATH],
      },
      {
        run: () => resolveConfigPath({ XQ_JEWY_CONFIG: `  ${SECRET_PATH}` }),
        code: "relative_path",
        line: "relative_path XQ_JEWY_CONFIG",
        forbidden: [SECRET_URL, SECRET_PATH],
      },
    ];

    for (const { run, code, line, forbidden } of cases) {
      try {
        run();
        throw new Error(`expected ${code}`);
      } catch (error) {
        const configError = expectConfigError(error, code);
        assertSafeLine(configError, line, forbidden);
      }
    }
  });

  it("renders invalid_url without echoing the raw URL value", () => {
    try {
      resolveEndpointUrls(
        {
          [XQ_JEWY_API_BASE_URL_ENV]: BAD_URL,
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "http://127.0.0.1:8081",
        },
        { stubs: true, rest: false, assertions: false, reporting: false },
      );
      throw new Error("expected invalid_url");
    } catch (error) {
      const configError = expectConfigError(error, "invalid_url");
      assertSafeLine(configError, `invalid_url ${XQ_JEWY_API_BASE_URL_ENV}`, [
        BAD_URL,
        SECRET_URL,
        SECRET_PATH,
      ]);
    }
  });

  it("formats all 15 codes as one line with safe location only", () => {
    const cases: Array<{
      code: ConfigErrorCode;
      location: ConfigErrorLocation;
      line: string;
    }> = [
      {
        code: "missing_env",
        location: { kind: "env", name: "XQ_JEWY_CONFIG" },
        line: "missing_env XQ_JEWY_CONFIG",
      },
      {
        code: "empty_env",
        location: { kind: "env", name: "XQ_JEWY_CONFIG" },
        line: "empty_env XQ_JEWY_CONFIG",
      },
      {
        code: "relative_path",
        location: { kind: "env", name: "XQ_JEWY_CONFIG" },
        line: "relative_path XQ_JEWY_CONFIG",
      },
      {
        code: "not_found",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "not_found /etc/xq.yaml",
      },
      {
        code: "not_a_file",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "not_a_file /etc/xq.yaml",
      },
      {
        code: "unreadable",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "unreadable /etc/xq.yaml",
      },
      {
        code: "too_large",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "too_large /etc/xq.yaml",
      },
      {
        code: "decode_error",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "decode_error /etc/xq.yaml",
      },
      {
        code: "yaml_syntax",
        location: { kind: "line", line: 3, column: 2 },
        line: "yaml_syntax 3:2",
      },
      {
        code: "unsafe_yaml",
        location: { kind: "line", line: 1, column: 0 },
        line: "unsafe_yaml 1:0",
      },
      {
        code: "duplicate_key",
        location: { kind: "line", line: 4, column: 1 },
        line: "duplicate_key 4:1",
      },
      {
        code: "multiple_documents",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "multiple_documents /etc/xq.yaml",
      },
      {
        code: "not_a_mapping",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "not_a_mapping /etc/xq.yaml",
      },
      {
        code: "schema",
        location: { kind: "path", path: "/etc/xq.yaml" },
        line: "schema /etc/xq.yaml",
      },
      {
        code: "invalid_url",
        location: { kind: "env", name: XQ_JEWY_API_BASE_URL_ENV },
        line: `invalid_url ${XQ_JEWY_API_BASE_URL_ENV}`,
      },
    ];

    expect(cases).toHaveLength(15);

    for (const { code, location, line } of cases) {
      const error = new ConfigError(code, location);
      assertSafeLine(error, line, [SECRET_URL, SECRET_PATH, BAD_URL]);
    }
  });
});
