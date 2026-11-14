import { z } from "zod";

import { ConfigError } from "./errors.js";

export const CAPABILITY_NAMES = [
  "stubs",
  "rest",
  "assertions",
  "reporting",
] as const;

export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

export const ENABLED_TAG_VALUES = [
  "stub",
  "rest",
  "verification",
  "reporting",
] as const;

export type EnabledTag = (typeof ENABLED_TAG_VALUES)[number];

export const CAPABILITY_TO_TAG: Record<CapabilityName, EnabledTag> = {
  stubs: "stub",
  rest: "rest",
  assertions: "verification",
  reporting: "reporting",
};

const capabilityBlockSchema = z.strictObject({
  enabled: z.boolean(),
});

const capabilitiesSchema = z
  .strictObject({
    stubs: capabilityBlockSchema.optional(),
    rest: capabilityBlockSchema.optional(),
    assertions: capabilityBlockSchema.optional(),
    reporting: capabilityBlockSchema.optional(),
  })
  .strict();

const rootSchema = z
  .strictObject({
    capabilities: capabilitiesSchema,
    enabled_tags: z
      .array(z.enum(ENABLED_TAG_VALUES))
      .min(1)
      .superRefine((tags, context) => {
        if (new Set(tags).size !== tags.length) {
          context.addIssue({
            code: "custom",
            message: "enabled_tags must be unique",
            path: ["enabled_tags"],
          });
        }
      }),
  })
  .strict();

export type ValidatedCapabilities = Record<CapabilityName, boolean>;

export type ValidatedConfig = {
  capabilities: ValidatedCapabilities;
  enabledTags: EnabledTag[];
};

function schemaError(path: string): never {
  throw new ConfigError("schema", { kind: "path", path });
}

function enabledFlags(
  capabilities: z.infer<typeof capabilitiesSchema>,
): ValidatedCapabilities {
  return {
    stubs: capabilities.stubs?.enabled === true,
    rest: capabilities.rest?.enabled === true,
    assertions: capabilities.assertions?.enabled === true,
    reporting: capabilities.reporting?.enabled === true,
  };
}

function tagsForEnabled(
  flags: ValidatedCapabilities,
  tags: EnabledTag[],
): void {
  const allowed = new Set<EnabledTag>();
  for (const name of CAPABILITY_NAMES) {
    if (flags[name]) {
      allowed.add(CAPABILITY_TO_TAG[name]);
    }
  }
  for (const tag of tags) {
    if (!allowed.has(tag)) {
      schemaError("enabled_tags");
    }
  }
}

function coversAllEnabledTags(
  flags: ValidatedCapabilities,
  tags: EnabledTag[],
): void {
  const selected = new Set(tags);
  for (const name of CAPABILITY_NAMES) {
    if (!flags[name]) {
      continue;
    }
    const tag = CAPABILITY_TO_TAG[name];
    if (!selected.has(tag)) {
      schemaError("enabled_tags");
    }
  }
}

/** Validate parsed YAML mapping (J1-T6). */
export function validateConfigMapping(root: unknown): ValidatedConfig {
  const parsed = rootSchema.safeParse(root);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "capabilities";
    schemaError(path);
  }

  const flags = enabledFlags(parsed.data.capabilities);
  const hasAny = CAPABILITY_NAMES.some((name) => flags[name]);
  if (!hasAny) {
    schemaError("capabilities");
  }

  tagsForEnabled(flags, parsed.data.enabled_tags);
  coversAllEnabledTags(flags, parsed.data.enabled_tags);

  return {
    capabilities: flags,
    enabledTags: [...parsed.data.enabled_tags],
  };
}
