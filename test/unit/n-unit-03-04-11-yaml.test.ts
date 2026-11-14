import { describe, expect, it } from "vitest";
import {
  CONFIG_YAML_PARSER_OPTIONS,
  parseConfigYaml,
} from "../../src/config/yaml.js";
import { expectConfigError } from "../helpers/config-error.js";

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
  const cases: Array<{ yaml: string; code: string }> = [
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
      expectConfigError(error, code as never);
      expect((error as { location: { kind: string } }).location.kind).toBe(
        "line",
      );
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
    const caps = root["capabilities"] as Record<string, { enabled: unknown }>;
    expect(caps["stubs"]?.enabled).toBe("yes");
    const flags = root["flags"] as Record<string, unknown>;
    expect(flags["a"]).toBe(true);
    expect(flags["b"]).toBe(true);
    expect(flags["c"]).toBe(false);
    expect(root["literal"]).toBe("1:20");
  });
});
