import { describe, expect, it } from "vitest";

const unitSources = import.meta.glob("./**/*.test.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const helperSources = import.meta.glob("../helpers/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Matches fs / child_process imports, including /promises, dynamic import(), and bare import. */
const forbidden =
  /(?:\bfrom\s+|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)["'](?:node:)?(?:fs(?:\/promises)?|child_process)["']/;

const forbiddenSamples = [
  'import fs from "fs"',
  "import fs from 'node:fs'",
  'import { readFile } from "fs/promises"',
  'import { readFile } from "node:fs/promises"',
  'import "node:fs"',
  "import 'fs'",
  'await import("fs")',
  'await import("node:fs")',
  'await import("fs/promises")',
  'await import("node:fs/promises")',
  'const fs = require("fs")',
  'require("node:child_process")',
  'from "child_process"',
  'from "node:child_process"',
] as const;

/** System harness helpers may use fs/child_process; unit helpers must not. */
const systemHarnessHelpers = new Set(["spawn-bin.ts", "mcp-stdio-client.ts"]);

function assertNoForbiddenImports(
  entries: Record<string, unknown>,
  skipPaths: string[] = [],
): void {
  for (const [path, source] of Object.entries(entries)) {
    if (skipPaths.some((skip) => path.endsWith(skip))) {
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
}

describe("N-CI-01", () => {
  it("rejects unit tests that import fs or child_process", () => {
    assertNoForbiddenImports(unitSources, ["n-ci-01-unit-guard.test.ts"]);
  });

  it("rejects test helpers that import fs or child_process", () => {
    assertNoForbiddenImports(helperSources, [...systemHarnessHelpers]);
  });

  it("matches forbidden sample snippets (negative self-test)", () => {
    for (const sample of forbiddenSamples) {
      expect(forbidden.test(sample), sample).toBe(true);
    }
  });
});
