import { describe, expect, it } from "vitest";
import {
  CONFIG_ERROR_CODES,
  ConfigError,
  formatConfigErrorLine,
  type ConfigErrorCode,
} from "../../src/config/errors.js";

describe("N-UNIT-08", () => {
  it("defines exactly 15 approved codes", () => {
    expect(CONFIG_ERROR_CODES).toHaveLength(15);
    expect(new Set(CONFIG_ERROR_CODES).size).toBe(15);
  });

  it("redacts values from message and format line", () => {
    const secretPath = "~/my/secrets.yaml";
    const error = new ConfigError("relative_path", {
      kind: "env",
      name: "XQ_JEWY_CONFIG",
    });
    expect(error.message).not.toContain(secretPath);
    expect(error.message).not.toContain("http://");
    expect(error.stack).toBeDefined();

    const line = formatConfigErrorLine(error);
    expect(line).toBe("relative_path XQ_JEWY_CONFIG");
    expect(line).not.toContain(secretPath);
    expect(line.split("\n")).toHaveLength(1);
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
