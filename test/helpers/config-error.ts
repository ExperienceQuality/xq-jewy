import { expect } from "vitest";
import { ConfigError } from "../../src/config/errors.js";

export function expectConfigError(
  error: unknown,
  code: ConfigError["code"],
): ConfigError {
  expect(error).toBeInstanceOf(ConfigError);
  if (!(error instanceof ConfigError)) {
    throw new TypeError("expected ConfigError");
  }
  expect(error.code).toBe(code);
  return error;
}
