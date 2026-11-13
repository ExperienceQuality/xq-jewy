import { describe, expect, it } from "vitest";
import {
  formatConfigErrorLine,
  type ConfigErrorCode,
} from "../../src/config/errors.js";
import { resolveConfigPath } from "../../src/config/path.js";
import { expectConfigError } from "../helpers/config-error.js";

describe("N-ACC-09", () => {
  it("renders each failure as one code + safe location line", () => {
    const cases: Array<{ run: () => never; code: string; line: string }> = [
      {
        run: () => resolveConfigPath({}),
        code: "missing_env",
        line: "missing_env XQ_JEWY_CONFIG",
      },
      {
        run: () => resolveConfigPath({ XQ_JEWY_CONFIG: "" }),
        code: "empty_env",
        line: "empty_env XQ_JEWY_CONFIG",
      },
      {
        run: () => resolveConfigPath({ XQ_JEWY_CONFIG: "./rel" }),
        code: "relative_path",
        line: "relative_path XQ_JEWY_CONFIG",
      },
    ];

    for (const { run, code, line } of cases) {
      try {
        run();
        throw new Error("expected throw");
      } catch (error) {
        const configError = expectConfigError(error, code as ConfigErrorCode);
        expect(formatConfigErrorLine(configError)).toBe(line);
        expect(formatConfigErrorLine(configError).split("\n")).toHaveLength(1);
      }
    }
  });
});
