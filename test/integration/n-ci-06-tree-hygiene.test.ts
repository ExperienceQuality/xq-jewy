import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackageJson(raw: string): {
  type: string;
  enginesNode: string;
  binXqJewy: string;
  prepare: string;
} {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new TypeError("package.json root must be an object");
  }
  const type = parsed["type"];
  const engines = parsed["engines"];
  const bin = parsed["bin"];
  const scripts = parsed["scripts"];
  if (typeof type !== "string") {
    throw new TypeError("package.json type must be a string");
  }
  if (!isRecord(engines) || typeof engines["node"] !== "string") {
    throw new TypeError("package.json engines.node must be a string");
  }
  if (!isRecord(bin) || typeof bin["xq-jewy"] !== "string") {
    throw new TypeError("package.json bin.xq-jewy must be a string");
  }
  if (!isRecord(scripts) || typeof scripts["prepare"] !== "string") {
    throw new TypeError("package.json scripts.prepare must be a string");
  }
  return {
    type,
    enginesNode: engines["node"],
    binXqJewy: bin["xq-jewy"],
    prepare: scripts["prepare"],
  };
}

describe("N-CI-06", () => {
  it("keeps tree hygiene and emits shebang + declarations", async () => {
    const removed = [
      ".python-version",
      "pyproject.toml",
      "uv.lock",
      "Makefile",
      "src/xq_jewy",
      "tests",
    ];
    for (const path of removed) {
      expect(await exists(path), `${path} must be removed`).toBe(false);
    }

    for (const path of [".cursor", ".squad", "AGENTS.md", ".nvmrc"]) {
      expect(await exists(path), `${path} must remain`).toBe(true);
    }

    const packageJson = readPackageJson(
      await readFile(join(root, "package.json"), "utf8"),
    );
    expect(packageJson.type).toBe("module");
    expect(packageJson.enginesNode).toBe(">=24.22.1");
    expect(packageJson.binXqJewy).toBe("./dist/index.js");
    expect(packageJson.prepare).toContain("build");

    const indexJs = await readFile(join(root, "dist/index.js"), "utf8");
    expect(indexJs.startsWith("#!/usr/bin/env node")).toBe(true);

    expect(await exists("dist/index.d.ts")).toBe(true);
  });
});
