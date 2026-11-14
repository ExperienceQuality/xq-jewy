import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";

import {
  CLEANUP_TIMEOUT_MS,
  distIndexPath,
  ensureChildGone,
  STARTUP_TIMEOUT_MS,
} from "./spawn-bin.js";

export type McpSession = {
  client: Client;
  transport: StdioClientTransport;
  stderr: string;
  pid: number | null;
};

/**
 * Connect via StdioClientTransport to built dist/index.js.
 * Env is getDefaultEnvironment() merged with explicit XQ_JEWY_* (and only those extras).
 */
export async function connectMcpSession(options: {
  xqEnv: Record<string, string>;
  cwd?: string;
  /** Extra non-XQ keys merged after defaults (for harness probes). */
  extraEnv?: Record<string, string>;
}): Promise<McpSession> {
  const env: Record<string, string> = {
    ...getDefaultEnvironment(),
    ...options.extraEnv,
    ...options.xqEnv,
  };

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [distIndexPath()],
    env,
    stderr: "pipe",
    cwd: options.cwd,
  });

  let stderr = "";
  transport.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  });

  const client = new Client({ name: "xq-jewy-system-test", version: "0.0.0" });

  const connectPromise = client.connect(transport);
  const timed = await Promise.race([
    connectPromise.then(() => "ok" as const),
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), STARTUP_TIMEOUT_MS);
    }),
  ]);

  if (timed === "timeout") {
    await closeMcpSession({ client, transport, stderr, pid: transport.pid });
    throw new Error(
      `MCP connect timed out after ${String(STARTUP_TIMEOUT_MS)}ms; stderr=${stderr}`,
    );
  }

  return {
    client,
    transport,
    stderr,
    pid: transport.pid,
  };
}

export async function closeMcpSession(session: McpSession): Promise<void> {
  const pid = session.transport.pid ?? session.pid;
  try {
    await session.client.close();
  } catch {
    // ignore close races after failure
  }
  try {
    await session.transport.close();
  } catch {
    // ignore
  }
  if (pid !== null && pid !== undefined) {
    await ensureChildGone({ pid }, CLEANUP_TIMEOUT_MS);
  }
}

export { getDefaultEnvironment };
