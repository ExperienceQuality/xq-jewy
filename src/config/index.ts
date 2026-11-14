import {
  capabilityUnionTruth,
  resolveEndpointUrls,
  validateHttpBaseUrl,
  XQ_JEWY_API_BASE_URL_ENV,
  XQ_JEWY_WIREMOCK_BASE_URL_ENV,
} from "./endpoints.js";
import { ConfigError, formatConfigErrorLine } from "./errors.js";
import { resolveConfigPath } from "./path.js";
import { readConfigFile } from "./read.js";
import type { EnabledTag, ValidatedCapabilities } from "./schema.js";
import { validateConfigMapping } from "./schema.js";
import { parseConfigYaml } from "./yaml.js";

export { ConfigError, formatConfigErrorLine };
export type { ConfigErrorCode, ConfigErrorLocation } from "./errors.js";
export type { EnabledTag, ValidatedCapabilities } from "./schema.js";

export type StartupConfiguration = {
  readonly configPath: string;
  readonly capabilities: ValidatedCapabilities;
  readonly enabledTags: EnabledTag[];
  readonly apiBaseUrl: string | null;
  readonly wiremockBaseUrl: string | null;
};

function assertValidatedUrl(
  raw: string,
  envName: string,
  fieldName: string,
): void {
  try {
    validateHttpBaseUrl(raw, envName);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new TypeError(`${fieldName} is not a valid HTTP base URL`, {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * Aggregate invariant factory. Violations throw TypeError, never ConfigError.
 */
export function createStartupConfiguration(parts: {
  configPath: string;
  capabilities: ValidatedCapabilities;
  enabledTags: EnabledTag[];
  apiBaseUrl: string | null;
  wiremockBaseUrl: string | null;
}): StartupConfiguration {
  const required = capabilityUnionTruth(parts.capabilities);

  if (required.api && parts.apiBaseUrl === null) {
    throw new TypeError(
      "apiBaseUrl is required when rest or assertions is enabled",
    );
  }
  if (required.wiremock && parts.wiremockBaseUrl === null) {
    throw new TypeError(
      "wiremockBaseUrl is required when stubs or assertions is enabled",
    );
  }

  if (parts.apiBaseUrl !== null) {
    assertValidatedUrl(
      parts.apiBaseUrl,
      XQ_JEWY_API_BASE_URL_ENV,
      "apiBaseUrl",
    );
  }
  if (parts.wiremockBaseUrl !== null) {
    assertValidatedUrl(
      parts.wiremockBaseUrl,
      XQ_JEWY_WIREMOCK_BASE_URL_ENV,
      "wiremockBaseUrl",
    );
  }

  const enabledTags: EnabledTag[] = [...parts.enabledTags];
  Object.freeze(enabledTags);

  return Object.freeze({
    configPath: parts.configPath,
    capabilities: Object.freeze({ ...parts.capabilities }),
    enabledTags,
    apiBaseUrl: parts.apiBaseUrl,
    wiremockBaseUrl: parts.wiremockBaseUrl,
  });
}

/**
 * Compose path → file/parse → schema/coverage → union → API → WireMock →
 * aggregate (first-error). Import-time pure: no I/O, env, or network until
 * this function runs. Server construction is J1-T9.
 */
export async function loadConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): Promise<StartupConfiguration> {
  const configPath = resolveConfigPath(env);
  const text = await readConfigFile(configPath);
  const root = parseConfigYaml(text);
  const { capabilities, enabledTags } = validateConfigMapping(root);
  const { apiBaseUrl, wiremockBaseUrl } = resolveEndpointUrls(
    env,
    capabilities,
  );
  return createStartupConfiguration({
    configPath,
    capabilities,
    enabledTags,
    apiBaseUrl,
    wiremockBaseUrl,
  });
}
