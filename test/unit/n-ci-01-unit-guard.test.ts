import { describe, expect, it } from "vitest";

const unitSources = import.meta.glob("./**/*.test.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const forbidden =
  /\bfrom\s+["'](?:node:)?(?:fs|child_process)["']|\brequire\s*\(\s*["'](?:node:)?(?:fs|child_process)["']\s*\)/;

describe("N-CI-01", () => {
  it("rejects unit tests that import fs or child_process", () => {
    for (const [path, source] of Object.entries(unitSources)) {
      if (path.endsWith("n-ci-01-unit-guard.test.ts")) {
        continue;
      }
      if (typeof source !== "string") {
        throw new TypeError(`expected raw source for ${path}`);
      }
      expect(
        forbidden.test(source),
        `${path} must not use fs or child_process`,
      ).toBe(false);
    }
  });
});
