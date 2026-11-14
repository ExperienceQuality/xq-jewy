/** Approved startup configuration error codes (exactly 15; no extensions). */
export const CONFIG_ERROR_CODES = [
  "missing_env",
  "empty_env",
  "relative_path",
  "not_found",
  "not_a_file",
  "unreadable",
  "too_large",
  "decode_error",
  "yaml_syntax",
  "unsafe_yaml",
  "duplicate_key",
  "multiple_documents",
  "not_a_mapping",
  "schema",
  "invalid_url",
] as const;

export type ConfigErrorCode = (typeof CONFIG_ERROR_CODES)[number];

export type ConfigErrorLocation =
  | { kind: "env"; name: string }
  | { kind: "path"; path: string }
  | { kind: "line"; line: number; column: number };

function assertNever(value: never): never {
  throw new Error(`unexpected location: ${String(value)}`);
}

function formatLocation(location: ConfigErrorLocation): string {
  switch (location.kind) {
    case "env":
      return location.name;
    case "path":
      return location.path;
    case "line":
      return `${String(location.line)}:${String(location.column)}`;
    default:
      return assertNever(location);
  }
}

function defaultMessage(
  code: ConfigErrorCode,
  location: ConfigErrorLocation,
): string {
  const where = formatLocation(location);
  switch (code) {
    case "missing_env":
      return `${where} is not set`;
    case "empty_env":
      return `${where} is empty`;
    case "relative_path":
      return `${where} must be an absolute path`;
    default:
      return `${code} at ${where}`;
  }
}

/** Typed, redacted configuration failure (no secrets or raw URLs in message). */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly code: ConfigErrorCode;
  readonly location: ConfigErrorLocation;

  constructor(code: ConfigErrorCode, location: ConfigErrorLocation) {
    super(defaultMessage(code, location));
    this.code = code;
    this.location = location;
  }
}

/** Single-line stderr rendering: `code` + safe location (N-ACC-09). */
export function formatConfigErrorLine(error: ConfigError): string {
  return `${error.code} ${formatLocation(error.location)}`;
}
