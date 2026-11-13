import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/config/errors.js";
import {
  resolveConfigPath,
  XQ_JEWY_CONFIG_ENV,
} from "../../src/config/path.js";
import { expectConfigError } from "../helpers/config-error.js";

describe("N-UNIT-01", () => {
  it("classifies XQ_JEWY_CONFIG without trim or expansion", () => {
    expect(() => resolveConfigPath({})).toThrow(ConfigError);
    try {
      resolveConfigPath({});
    } catch (error) {
      expectConfigError(error, "missing_env");
    }

    try {
      resolveConfigPath({ [XQ_JEWY_CONFIG_ENV]: "" });
    } catch (error) {
      expectConfigError(error, "empty_env");
    }

    try {
      resolveConfigPath({ [XQ_JEWY_CONFIG_ENV]: "   " });
    } catch (error) {
      expectConfigError(error, "empty_env");
    }

    for (const relative of [
      "relative/path",
      "./x",
      "~/x",
      "$HOME/x",
      "  /abs",
    ]) {
      try {
        resolveConfigPath({ [XQ_JEWY_CONFIG_ENV]: relative });
        throw new Error(`expected relative_path for ${relative}`);
      } catch (error) {
        expectConfigError(error, "relative_path");
      }
    }

    expect(resolveConfigPath({ [XQ_JEWY_CONFIG_ENV]: "/abs  " })).toBe(
      "/abs  ",
    );
    expect(resolveConfigPath({ [XQ_JEWY_CONFIG_ENV]: "/tmp/foo.yml" })).toBe(
      "/tmp/foo.yml",
    );
  });
});
