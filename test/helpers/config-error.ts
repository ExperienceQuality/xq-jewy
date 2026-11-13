import { expect } from "vitest";
import { ConfigError } from "../../src/config/errors.js";

export function expectConfigError(
  error: unknown,
  code: ConfigError["code"],
): ConfigError {
  expect(error).toBeInstanceOf(ConfigError);
  const configError = error as ConfigError;
  expect(configError.code).toBe(code);
  return configError;
}
