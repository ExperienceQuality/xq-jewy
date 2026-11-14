import { ConfigError } from "./errors.js";
import type { ValidatedCapabilities } from "./schema.js";

export const XQ_JEWY_API_BASE_URL_ENV = "XQ_JEWY_API_BASE_URL";
export const XQ_JEWY_WIREMOCK_BASE_URL_ENV = "XQ_JEWY_WIREMOCK_BASE_URL";

export type StringEnv = Readonly<Record<string, string | undefined>>;

export type EndpointUrls = {
  apiBaseUrl: string | null;
  wiremockBaseUrl: string | null;
};

function envLocation(name: string): ConfigError["location"] {
  return { kind: "env", name };
}

function missing(name: string): never {
  throw new ConfigError("missing_env", envLocation(name));
}

function invalidUrl(name: string): never {
  throw new ConfigError("invalid_url", envLocation(name));
}

function requiresApi(flags: ValidatedCapabilities): boolean {
  return flags.rest || flags.assertions;
}

function requiresWiremock(flags: ValidatedCapabilities): boolean {
  return flags.stubs || flags.assertions;
}

function isPresent(env: StringEnv, name: string): boolean {
  return Object.hasOwn(env, name) && env[name] !== undefined;
}

function rawEnv(env: StringEnv, name: string): string | undefined {
  if (!isPresent(env, name)) {
    return undefined;
  }
  return env[name];
}

/** Raw-string URL grammar before WHATWG normalization (J1-T7 / N-UNIT-07). */
export function validateHttpBaseUrl(raw: string, envName: string): string {
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f || ch === "\\") {
      invalidUrl(envName);
    }
    if (ch === " " || ch === "\t") {
      invalidUrl(envName);
    }
  }

  if (raw.includes("?") || raw.includes("#")) {
    invalidUrl(envName);
  }

  const match = /^(https?):\/\/([^/?#]*)(.*)$/u.exec(raw);
  if (!match) {
    invalidUrl(envName);
  }

  const authority = match[2] ?? "";
  const path = match[3] ?? "";
  if (authority.includes("@")) {
    invalidUrl(envName);
  }

  if (authority.length === 0) {
    invalidUrl(envName);
  }

  let hostPort = authority;
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    if (close === -1) {
      invalidUrl(envName);
    }
    hostPort = authority.slice(close + 1);
    const host = authority.slice(1, close);
    if (host.length === 0) {
      invalidUrl(envName);
    }
  } else {
    const colon = authority.indexOf(":");
    if (colon !== -1) {
      hostPort = authority.slice(colon);
      const host = authority.slice(0, colon);
      if (host.length === 0) {
        invalidUrl(envName);
      }
    }
  }

  if (hostPort.startsWith(":")) {
    if (hostPort === ":") {
      invalidUrl(envName);
    }
    const portText = hostPort.slice(1);
    if (!/^\d+$/u.test(portText)) {
      invalidUrl(envName);
    }
    const port = Number(portText);
    if (port < 1 || port > 65535) {
      invalidUrl(envName);
    }
  }

  for (const ch of path) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      code < 0x20 ||
      code === 0x7f ||
      ch === "\\" ||
      ch === "?" ||
      ch === "#"
    ) {
      invalidUrl(envName);
    }
  }

  let index = raw.indexOf("%");
  while (index !== -1) {
    const seq = raw.slice(index, index + 3);
    if (!/^%[0-9a-fA-F]{2}$/u.test(seq)) {
      invalidUrl(envName);
    }
    index = raw.indexOf("%", index + 1);
  }

  return raw;
}

type PendingEnvError = {
  code: ConfigError["code"];
  name: string;
  required: boolean;
};

function classifyEnv(
  env: StringEnv,
  name: string,
  required: boolean,
): PendingEnvError | { value: string | null } {
  const raw = rawEnv(env, name);
  if (raw === undefined) {
    if (required) {
      return { code: "missing_env", name, required };
    }
    return { value: null };
  }
  if (raw === "" || raw.trim() === "") {
    return { code: "empty_env", name, required };
  }
  try {
    validateHttpBaseUrl(raw, name);
    return { value: raw };
  } catch (error) {
    if (error instanceof ConfigError && error.code === "invalid_url") {
      return { code: "invalid_url", name, required };
    }
    throw error;
  }
}

function pickEndpointError(
  flags: ValidatedCapabilities,
  pending: PendingEnvError[],
): never {
  const api = pending.find((item) => item.name === XQ_JEWY_API_BASE_URL_ENV);
  const wm = pending.find(
    (item) => item.name === XQ_JEWY_WIREMOCK_BASE_URL_ENV,
  );
  const reportingOnly =
    flags.reporting && !flags.stubs && !flags.rest && !flags.assertions;

  if (flags.stubs && api?.code === "invalid_url" && wm) {
    throw new ConfigError(api.code, envLocation(api.name));
  }

  if (flags.rest && api && wm?.code === "invalid_url") {
    throw new ConfigError(api.code, envLocation(api.name));
  }

  if (flags.assertions && api && wm) {
    throw new ConfigError(api.code, envLocation(api.name));
  }

  if (
    reportingOnly &&
    api?.code === "invalid_url" &&
    wm?.code === "invalid_url"
  ) {
    throw new ConfigError(api.code, envLocation(api.name));
  }

  const first = pending[0];
  if (first) {
    throw new ConfigError(first.code, envLocation(first.name));
  }
  missing(XQ_JEWY_API_BASE_URL_ENV);
}

/** Resolve endpoint URLs from env and enabled capabilities (J1-T7). */
export function resolveEndpointUrls(
  env: StringEnv,
  capabilities: ValidatedCapabilities,
): EndpointUrls {
  const apiRequired = requiresApi(capabilities);
  const wmRequired = requiresWiremock(capabilities);

  const api = classifyEnv(env, XQ_JEWY_API_BASE_URL_ENV, apiRequired);
  const wm = classifyEnv(env, XQ_JEWY_WIREMOCK_BASE_URL_ENV, wmRequired);

  const errors: PendingEnvError[] = [];
  if ("code" in api) {
    errors.push(api);
  }
  if ("code" in wm) {
    errors.push(wm);
  }

  if (errors.length > 0) {
    pickEndpointError(capabilities, errors);
  }

  return {
    apiBaseUrl: "value" in api ? api.value : null,
    wiremockBaseUrl: "value" in wm ? wm.value : null,
  };
}

export function capabilityUnionTruth(flags: ValidatedCapabilities): {
  api: boolean;
  wiremock: boolean;
} {
  return {
    api: requiresApi(flags),
    wiremock: requiresWiremock(flags),
  };
}
