import { describe, expect, it } from "vitest";
import {
  CAPABILITY_NAMES,
  CAPABILITY_TO_TAG,
  validateConfigMapping,
} from "../../src/config/schema.js";
import { parseConfigYaml } from "../../src/config/yaml.js";
import { expectConfigError } from "../helpers/config-error.js";

const fixtureYaml = import.meta.glob("../../docs/config/xq.*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("N-UNIT-05", () => {
  it("maps capability registry exactly", () => {
    expect(CAPABILITY_TO_TAG).toEqual({
      stubs: "stub",
      rest: "rest",
      assertions: "verification",
      reporting: "reporting",
    });
  });

  it("accepts canonical single-mode fixtures", () => {
    for (const text of Object.values(fixtureYaml)) {
      if (typeof text !== "string") {
        throw new TypeError("expected raw fixture");
      }
      const root = parseConfigYaml(text);
      expect(validateConfigMapping(root).enabledTags.length).toBeGreaterThan(0);
    }
  });

  it("rejects disabled-capability tags and yes booleans", () => {
    try {
      validateConfigMapping({
        capabilities: {
          stubs: { enabled: true },
          rest: { enabled: false },
        },
        enabled_tags: ["rest"],
      });
      throw new Error("expected schema");
    } catch (error) {
      expectConfigError(error, "schema");
    }

    try {
      validateConfigMapping({
        capabilities: { stubs: { enabled: "yes" } },
        enabled_tags: ["stub"],
      });
      throw new Error("expected schema");
    } catch (error) {
      expectConfigError(error, "schema");
    }
  });

  it("accepts all 15 nonempty capability subsets with valid tags", () => {
    let count = 0;
    for (let mask = 1; mask < 1 << CAPABILITY_NAMES.length; mask++) {
      const capabilities = Object.fromEntries(
        CAPABILITY_NAMES.map((name, index) => [
          name,
          { enabled: (mask & (1 << index)) !== 0 },
        ]),
      );
      const tags = CAPABILITY_NAMES.filter(
        (_, index) => (mask & (1 << index)) !== 0,
      ).map((name) => CAPABILITY_TO_TAG[name]);
      validateConfigMapping({ capabilities, enabled_tags: tags });
      count += 1;
    }
    expect(count).toBe(15);
  });
});
