import { parseAllDocuments, YAMLParseError, YAMLWarning } from "yaml";

import { ConfigError } from "./errors.js";

/** Frozen parser contract (D1 / N-UNIT-11). */
export const CONFIG_YAML_PARSER_OPTIONS = Object.freeze({
  version: "1.2" as const,
  schema: "core" as const,
  uniqueKeys: true,
  merge: false,
  maxAliasCount: 0,
  logLevel: "error" as const,
});

function lineLocation(line: number, column: number): ConfigError["location"] {
  return { kind: "line", line: line + 1, column: column + 1 };
}

function yamlErrorLocation(error: YAMLParseError | YAMLWarning): ConfigError {
  const line = error.linePos?.[0];
  if (line) {
    return new ConfigError("yaml_syntax", lineLocation(line.line, line.col));
  }
  return new ConfigError("yaml_syntax", { kind: "line", line: 1, column: 1 });
}

function scanUnsafeConstructs(text: string): ConfigError | undefined {
  const patterns: RegExp[] = [/&\S/u, /\*\S/u, /<<\s*:/u, /!!\w/u, /!\S+:/u];
  const lines = text.split(/\n/u);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match && match.index !== undefined) {
        return new ConfigError(
          "unsafe_yaml",
          lineLocation(lineIndex, match.index),
        );
      }
    }
  }
  return undefined;
}

function scanUnsafeDirectives(text: string): ConfigError | undefined {
  let lineNumber = 0;
  for (const line of text.split(/\n/u)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("%YAML 1.2")) {
      lineNumber += 1;
      continue;
    }
    if (trimmed.startsWith("%YAML") || trimmed.startsWith("%TAG")) {
      return new ConfigError("unsafe_yaml", lineLocation(lineNumber, 0));
    }
    lineNumber += 1;
  }
  return undefined;
}

function isMappingRoot(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Parse YAML text to a plain mapping (J1-T5). */
export function parseConfigYaml(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (
    trimmed === "" ||
    trimmed === "\u{feff}" ||
    trimmed === "null" ||
    trimmed === "~"
  ) {
    throw new ConfigError("not_a_mapping", {
      kind: "line",
      line: 1,
      column: 1,
    });
  }

  const directiveError = scanUnsafeDirectives(text);
  if (directiveError) {
    throw directiveError;
  }

  const constructError = scanUnsafeConstructs(text);
  if (constructError) {
    throw constructError;
  }

  let documents;
  try {
    documents = parseAllDocuments(text, CONFIG_YAML_PARSER_OPTIONS);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("alias")
    ) {
      throw new ConfigError("unsafe_yaml", {
        kind: "line",
        line: 1,
        column: 1,
      });
    }
    if (error instanceof YAMLParseError) {
      const message = error.message.toLowerCase();
      const loc = error.linePos?.[0];
      const line = loc?.line ?? 0;
      const col = loc?.col ?? 0;
      if (message.includes("duplicated") || message.includes("duplicate")) {
        throw new ConfigError("duplicate_key", lineLocation(line, col));
      }
      if (
        message.includes("alias") ||
        message.includes("anchor") ||
        message.includes("merge") ||
        message.includes("tag")
      ) {
        throw new ConfigError("unsafe_yaml", lineLocation(line, col));
      }
      throw yamlErrorLocation(error);
    }
    throw error;
  }

  if (documents.length !== 1) {
    throw new ConfigError("multiple_documents", {
      kind: "line",
      line: 1,
      column: 1,
    });
  }

  const document = documents[0];
  if (document === undefined) {
    throw new ConfigError("not_a_mapping", {
      kind: "line",
      line: 1,
      column: 1,
    });
  }

  if (document.errors.length > 0) {
    const first = document.errors[0];
    if (first instanceof YAMLParseError || first instanceof YAMLWarning) {
      const message = first.message.toLowerCase();
      const loc = first.linePos?.[0];
      const line = loc?.line ?? 0;
      const col = loc?.col ?? 0;
      if (
        first.code === "DUPLICATE_KEY" ||
        message.includes("duplicated") ||
        message.includes("duplicate")
      ) {
        throw new ConfigError("duplicate_key", lineLocation(line, col));
      }
      if (
        message.includes("alias") ||
        message.includes("anchor") ||
        message.includes("merge") ||
        message.includes("tag")
      ) {
        throw new ConfigError("unsafe_yaml", lineLocation(line, col));
      }
      throw yamlErrorLocation(first);
    }
  }

  const root = document.toJSON();
  if (!isMappingRoot(root)) {
    throw new ConfigError("not_a_mapping", {
      kind: "line",
      line: 1,
      column: 1,
    });
  }

  return root;
}
