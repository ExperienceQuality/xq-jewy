import { describe, expect, it } from "vitest";
import {
  CONFIG_ERROR_CODES,
  ConfigError,
  formatConfigErrorLine,
  type ConfigErrorCode,
} from "../../src/config/errors.js";
import {
  resolveConfigPath,
  XQ_JEWY_CONFIG_ENV,
} from "../../src/config/path.js";
import { expectConfigError } from "../helpers/config-error.js";

/** Env/config values fed into real failure paths — must never appear in message or format line. */
const SECRET_URL = "https://evil.example/secret";
const SECRET_PATH = "~/secrets/leaked.yaml";

describe("N-UNIT-08", () => {
  it("defines exactly the 15 approved codes in order", () => {
    expect(CONFIG_ERROR_CODES).toEqual([
      "missing_env",
      "empty_env",
      "relative_path",
      "not_found",
      "not_a_file",
      "unreadable",
      "too_large",
      "decode_error",
      "yaml_syntax",
      "unsafe_yaml",
      "duplicate_key",
      "multiple_documents",
      "not_a_mapping",
      "schema",
      "invalid_url",
    ]);
    expect(CONFIG_ERROR_CODES).toHaveLength(15);
    expect(new Set(CONFIG_ERROR_CODES).size).toBe(15);
  });

  it("redacts values fed through real path failures", () => {
    expect(ConfigError.length).toBe(2);

    for (const value of [
      SECRET_URL,
      SECRET_PATH,
      `./${SECRET_PATH}`,
      `  ${SECRET_PATH}`,
    ]) {
      try {
        resolveConfigPath({ [XQ_JEWY_CONFIG_ENV]: value });
        throw new Error(`expected relative_path for ${value}`);
      } catch (error) {
        const configError = expectConfigError(error, "relative_path");
        expect(configError.message).not.toContain(SECRET_URL);
        expect(configError.message).not.toContain(SECRET_PATH);
        expect(configError.message).not.toContain(value.trim());
        const line = formatConfigErrorLine(configError);
        expect(line).toBe("relative_path XQ_JEWY_CONFIG");
        expect(line).not.toContain(SECRET_URL);
        expect(line).not.toContain(SECRET_PATH);
        expect(line).not.toContain(value.trim());
        expect(line.split("\n")).toHaveLength(1);
      }
    }

    // @ts-expect-error — free-form message arg removed; only code + location
    const leaked = new ConfigError(
      "relative_path",
      { kind: "env", name: "XQ_JEWY_CONFIG" },
      `config=${SECRET_PATH} url=${SECRET_URL}`,
    );
    expect(leaked.message).not.toContain(SECRET_PATH);
    expect(leaked.message).not.toContain(SECRET_URL);
    expect(formatConfigErrorLine(leaked)).not.toContain(SECRET_PATH);
    expect(formatConfigErrorLine(leaked)).not.toContain(SECRET_URL);

    // Path locations intentionally surface the path string (not an env value).
    const pathError = new ConfigError("not_found", {
      kind: "path",
      path: "/etc/xq.yaml",
    });
    expect(formatConfigErrorLine(pathError)).toBe("not_found /etc/xq.yaml");
    expect(pathError.message).not.toContain(SECRET_URL);
  });

  it("allows only env, path, or line:col locations", () => {
    const envError = new ConfigError("not_found", {
      kind: "env",
      name: "XQ_JEWY_CONFIG",
    });
    expect(envError.location).toEqual({ kind: "env", name: "XQ_JEWY_CONFIG" });

    const pathError = new ConfigError("schema", {
      kind: "path",
      path: "/etc/xq.yaml",
    });
    expect(pathError.location.kind).toBe("path");

    const lineError = new ConfigError("yaml_syntax", {
      kind: "line",
      line: 2,
      column: 1,
    });
    expect(formatConfigErrorLine(lineError)).toBe("yaml_syntax 2:1");
  });

  it("types codes as the enumerated set", () => {
    const codes: ConfigErrorCode[] = [...CONFIG_ERROR_CODES];
    expect(codes).toEqual([...CONFIG_ERROR_CODES]);
  });
});
