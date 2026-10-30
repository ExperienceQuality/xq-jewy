import { z } from "zod";

export const TRANSPORTS = ["stdio", "http"] as const;
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Every setting, its type, its validation rule and its default — in one place. */
export const SettingsSchema = z.object({
  transport: z.enum(TRANSPORTS).default("stdio"),
  host: z.string().min(1).default("127.0.0.1"),
  port: z.coerce.number().int().min(1).max(65535).default(8000),
  logLevel: z.enum(LOG_LEVELS).default("info"),
  /** If set, http clients must send `Authorization: Bearer <token>`. */
  authToken: z.string().min(1).optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

/** Raw, not-yet-validated values (from env vars or CLI flags). */
export type RawSettings = Partial<Record<keyof Settings, string | undefined>>;

const ENV_VARS = {
  transport: "XQ_JEWY_TRANSPORT",
  host: "XQ_JEWY_HOST",
  port: "XQ_JEWY_PORT",
  logLevel: "XQ_JEWY_LOG_LEVEL",
  authToken: "XQ_JEWY_AUTH_TOKEN",
} as const satisfies Record<keyof Settings, string>;

/** Drop unset and empty values so they fall through to the next source. */
function compact(raw: RawSettings): RawSettings {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value));
}

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): RawSettings {
  return compact(
    Object.fromEntries(Object.entries(ENV_VARS).map(([key, name]) => [key, env[name]])),
  );
}

/**
 * Merge and validate settings. Precedence: `overrides` (CLI flags) → env vars / .env → defaults.
 * Throws a `z.ZodError` if the merged result is invalid.
 */
export function loadSettings(
  overrides: RawSettings = {},
  env: NodeJS.ProcessEnv = process.env,
): Settings {
  return SettingsSchema.parse({ ...settingsFromEnv(env), ...compact(overrides) });
}
