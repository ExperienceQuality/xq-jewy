import { ConfigError } from "./errors.js";

export const XQ_JEWY_CONFIG_ENV = "XQ_JEWY_CONFIG";

export type StringEnv = Readonly<Record<string, string | undefined>>;

/**
 * Resolve the raw absolute config path from `XQ_JEWY_CONFIG`.
 * No trim, expand, default, or search — fails before any file I/O.
 */
export function resolveConfigPath(env: StringEnv): string {
  if (!Object.hasOwn(env, XQ_JEWY_CONFIG_ENV)) {
    throw new ConfigError("missing_env", {
      kind: "env",
      name: XQ_JEWY_CONFIG_ENV,
    });
  }

  const value = env[XQ_JEWY_CONFIG_ENV];
  if (value === undefined) {
    throw new ConfigError("missing_env", {
      kind: "env",
      name: XQ_JEWY_CONFIG_ENV,
    });
  }

  if (value === "" || value.trim() === "") {
    throw new ConfigError("empty_env", {
      kind: "env",
      name: XQ_JEWY_CONFIG_ENV,
    });
  }

  if (!value.startsWith("/")) {
    throw new ConfigError("relative_path", {
      kind: "env",
      name: XQ_JEWY_CONFIG_ENV,
    });
  }

  return value;
}
