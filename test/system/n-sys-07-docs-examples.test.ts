import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  closeMcpSession,
  connectMcpSession,
} from "../helpers/mcp-stdio-client.js";
import { distIndexPath, repoRoot } from "../helpers/spawn-bin.js";

const CONFIG_PLACEHOLDER = "/absolute/path/to/xq.yaml";
const DIST_PLACEHOLDER = "/absolute/path/to/xq-jewy/dist/index.js";

const MODES = [
  "stubs-only",
  "rest-only",
  "assertions-only",
  "reporting-only",
] as const;

type McpServerEntry = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

type McpJsonDoc = {
  mcpServers: {
    "xq-jewy": McpServerEntry;
  };
};

const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "uvx", pattern: /\buvx\b/i },
  { name: "FastMCP", pattern: /\bFastMCP\b/ },
  { name: "pytest", pattern: /\bpytest\b/i },
  { name: "pyproject", pattern: /\bpyproject\b/i },
  { name: "make ci", pattern: /\bmake\s+ci\b/i },
  { name: "Python toolchain", pattern: /\bPython\b/ },
  { name: ".py tool path", pattern: /\b[\w./-]+\.py\b/ },
  { name: "ruff", pattern: /\bruff\b/i },
  { name: "server.py", pattern: /\bserver\.py\b/ },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every((v) => typeof v === "string");
}

function parseMcpDoc(raw: unknown): McpJsonDoc {
  if (!isPlainObject(raw)) {
    throw new Error("mcp.json root must be an object");
  }
  const servers = raw["mcpServers"];
  if (!isPlainObject(servers)) {
    throw new Error("mcp.json mcpServers must be an object");
  }
  const entry = servers["xq-jewy"];
  if (!isPlainObject(entry)) {
    throw new Error("mcp.json mcpServers.xq-jewy must be an object");
  }
  const command = entry["command"];
  const args = entry["args"];
  const env = entry["env"];
  if (typeof command !== "string") {
    throw new Error("mcp.json command must be a string");
  }
  if (
    !Array.isArray(args) ||
    !args.every((a): a is string => typeof a === "string")
  ) {
    throw new Error("mcp.json args must be a string array");
  }
  if (!isStringRecord(env)) {
    throw new Error("mcp.json env must be a string record");
  }
  return {
    mcpServers: {
      "xq-jewy": { command, args, env },
    },
  };
}

function readMcpDoc(mode: (typeof MODES)[number]): McpJsonDoc {
  const path = join(repoRoot(), "docs", "config", `mcp.${mode}.json`);
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return parseMcpDoc(raw);
}

function yamlPathForMode(mode: (typeof MODES)[number]): string {
  return join(repoRoot(), "docs", "config", `xq.${mode}.yaml`);
}

function collectOwnedDocPaths(): string[] {
  const root = repoRoot();
  const paths = [
    join(root, "README.md"),
    join(root, "CONTRIBUTING.md"),
    join(root, "config.example.yaml"),
  ];
  const configDir = join(root, "docs", "config");
  for (const name of readdirSync(configDir)) {
    paths.push(join(configDir, name));
  }
  return paths;
}

describe("N-SYS-07", () => {
  it.each(MODES)(
    "documented mcp.%s.json + YAML pair starts with only listed env keys",
    async (mode) => {
      const doc = readMcpDoc(mode);
      const entry = doc.mcpServers["xq-jewy"];

      expect(entry.command).toBe("node");
      expect(entry.args).toEqual([DIST_PLACEHOLDER]);
      expect(entry.env["XQ_JEWY_CONFIG"]).toBe(CONFIG_PLACEHOLDER);

      const xqEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry.env)) {
        xqEnv[key] =
          key === "XQ_JEWY_CONFIG" && value === CONFIG_PLACEHOLDER
            ? yamlPathForMode(mode)
            : value;
      }

      // Prove the documented launch target is the built dist entry.
      expect(distIndexPath()).toBe(join(repoRoot(), "dist", "index.js"));

      const session = await connectMcpSession({ xqEnv });
      try {
        expect(session.client.getServerVersion()?.name).toBe("xq-jewy");
        const listed = await session.client.listTools();
        expect(Array.isArray(listed.tools)).toBe(true);
      } finally {
        await closeMcpSession(session);
      }
    },
  );

  it("owned docs contain no uvx / Python / legacy toolchain leftovers", () => {
    const hits: string[] = [];
    for (const path of collectOwnedDocPaths()) {
      const text = readFileSync(path, "utf8");
      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
          hits.push(`${path}: ${name}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
