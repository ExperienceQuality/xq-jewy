import { describe, expect, it } from "vitest";
import type { ConfigErrorCode } from "../../src/config/errors.js";
import {
  CONFIG_YAML_PARSER_OPTIONS,
  parseConfigYaml,
} from "../../src/config/yaml.js";
import { expectConfigError } from "../helpers/config-error.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("N-UNIT-11", () => {
  it("freezes parser options", () => {
    expect(CONFIG_YAML_PARSER_OPTIONS.version).toBe("1.2");
    expect(CONFIG_YAML_PARSER_OPTIONS.schema).toBe("core");
    expect(CONFIG_YAML_PARSER_OPTIONS.uniqueKeys).toBe(true);
    expect(CONFIG_YAML_PARSER_OPTIONS.merge).toBe(false);
    expect(CONFIG_YAML_PARSER_OPTIONS.maxAliasCount).toBe(0);
    expect(Object.isFrozen(CONFIG_YAML_PARSER_OPTIONS)).toBe(true);
  });
});

describe("N-UNIT-03", () => {
  const cases: Array<{ yaml: string; code: ConfigErrorCode }> = [
    { yaml: "a: [", code: "yaml_syntax" },
    { yaml: "a: 1\n---\nb: 2\n", code: "multiple_documents" },
    { yaml: "", code: "not_a_mapping" },
    { yaml: "null\n", code: "not_a_mapping" },
    { yaml: "- a\n", code: "not_a_mapping" },
    {
      yaml: "anchors:\n  base: &a\n  use: *a\n",
      code: "unsafe_yaml",
    },
    {
      yaml: "merge:\n  x: &a\n  y:\n    <<: *a\n",
      code: "unsafe_yaml",
    },
    { yaml: "%YAML 1.1\n---\na: 1\n", code: "unsafe_yaml" },
    { yaml: "%TAG ! tag:example.com,0:\n---\na: 1\n", code: "unsafe_yaml" },
    {
      yaml: "capabilities:\n  stubs:\n    enabled: true\n    enabled: false\nenabled_tags:\n  - stub\n",
      code: "duplicate_key",
    },
  ];

  it.each(cases)("maps $code", ({ yaml, code }) => {
    try {
      parseConfigYaml(yaml);
      throw new Error(`expected ${code}`);
    } catch (error) {
      const configError = expectConfigError(error, code);
      expect(configError.location.kind).toBe("line");
    }
  });
});

describe("N-UNIT-04", () => {
  it("keeps D1 string booleans and 1.1-only literals", () => {
    const root = parseConfigYaml(
      [
        "capabilities:",
        "  stubs:",
        "    enabled: yes",
        "enabled_tags:",
        "  - stub",
        "literal: '1:20'",
        "flags:",
        "  a: true",
        "  b: True",
        "  c: FALSE",
      ].join("\n"),
    );
    const capsValue = root["capabilities"];
    expect(isRecord(capsValue)).toBe(true);
    if (!isRecord(capsValue)) {
      return;
    }
    const stubsValue = capsValue["stubs"];
    expect(isRecord(stubsValue)).toBe(true);
    if (!isRecord(stubsValue)) {
      return;
    }
    expect(stubsValue["enabled"]).toBe("yes");

    const flagsValue = root["flags"];
    expect(isRecord(flagsValue)).toBe(true);
    if (!isRecord(flagsValue)) {
      return;
    }
    expect(flagsValue["a"]).toBe(true);
    expect(flagsValue["b"]).toBe(true);
    expect(flagsValue["c"]).toBe(false);
    expect(root["literal"]).toBe("1:20");
  });
});
