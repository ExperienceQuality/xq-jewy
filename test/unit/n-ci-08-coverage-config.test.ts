import { describe, expect, it } from "vitest";

import vitestConfig from "../../vitest.config.ts";

const packageSources = import.meta.glob("../../package.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readScripts(raw: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new TypeError("package.json root must be an object");
  }
  const scriptsValue = parsed["scripts"];
  if (!isRecord(scriptsValue)) {
    throw new TypeError("package.json scripts must be an object");
  }
  const scripts: Record<string, string> = {};
  for (const [key, value] of Object.entries(scriptsValue)) {
    if (typeof value !== "string") {
      throw new TypeError(`package.json scripts.${key} must be a string`);
    }
    scripts[key] = value;
  }
  return scripts;
}

describe("N-CI-08", () => {
  it("configures coverage-v8 for unit+integration only, no thresholds", () => {
    const coverage = vitestConfig.test?.coverage;
    expect(coverage?.provider).toBe("v8");
    expect(coverage?.autoAttachSubprocess).toBe(false);
    expect(coverage?.thresholds).toBeUndefined();

    const packagePath = Object.keys(packageSources)[0];
    const raw =
      packagePath === undefined ? undefined : packageSources[packagePath];
    if (typeof raw !== "string") {
      throw new TypeError("expected raw package.json");
    }
    const scripts = readScripts(raw);
    const testScript = scripts["test"];
    expect(testScript).toBeDefined();
    if (testScript === undefined) {
      return;
    }

    const segments = testScript.split("&&").map((part) => part.trim());
    const coverageSeg = segments.find((part) => part.includes("--coverage"));
    const systemSeg = segments.find((part) =>
      /(?:^|\s)--project\s+system(?:\s|$)/.test(part),
    );
    expect(coverageSeg).toBeDefined();
    expect(coverageSeg).toMatch(/--project unit/);
    expect(coverageSeg).toMatch(/--project integration/);
    expect(coverageSeg).not.toMatch(/(?:^|\s)--project\s+system(?:\s|$)/);
    expect(systemSeg).toBeDefined();
    expect(systemSeg).not.toMatch(/--coverage/);
  });
});
