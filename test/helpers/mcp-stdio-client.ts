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

function isConnectionClosed(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("message" in error && error.message === "Connection closed") {
    return true;
  }
  if ("code" in error && error.code === "CONNECTION_CLOSED") {
    return true;
  }
  return false;
}

class McpConnectError extends Error {
  readonly stderr: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { stderr: string; retryable: boolean; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : {});
    this.name = "McpConnectError";
    this.stderr = options.stderr;
    this.retryable = options.retryable;
  }
}

async function connectMcpSessionOnce(options: {
  xqEnv: Record<string, string>;
  cwd?: string;
  extraEnv?: Record<string, string>;
}): Promise<McpSession> {
  const env: Record<string, string> = {
    ...getDefaultEnvironment(),
    NODE_NO_WARNINGS: "1",
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
  const session: McpSession = {
    client,
    transport,
    stderr: "",
    pid: null,
  };

  try {
    const connectPromise = client.connect(transport);
    const timed = await Promise.race([
      connectPromise.then(
        () => "ok" as const,
        (error: unknown) => {
          throw error;
        },
      ),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), STARTUP_TIMEOUT_MS);
      }),
    ]);

    session.stderr = stderr;
    session.pid = transport.pid;

    if (timed === "timeout") {
      await closeMcpSession(session);
      throw new McpConnectError(
        `MCP connect timed out after ${String(STARTUP_TIMEOUT_MS)}ms; stderr=${stderr}`,
        { stderr, retryable: false },
      );
    }

    return session;
  } catch (error: unknown) {
    session.stderr = stderr;
    await closeMcpSession(session);
    if (error instanceof McpConnectError) {
      throw error;
    }
    if (isConnectionClosed(error)) {
      // Empty stderr → likely stdio race; stderr with content → real child failure.
      throw new McpConnectError(
        `MCP connect failed: Connection closed; stderr=${JSON.stringify(stderr)}`,
        {
          stderr,
          retryable: stderr.trim().length === 0,
          cause: error,
        },
      );
    }
    throw error;
  }
}

/**
 * Connect via StdioClientTransport to built dist/index.js.
 * Env is getDefaultEnvironment() merged with explicit XQ_JEWY_* (and only those extras).
 * Retries once on empty-stderr Connection closed (stdio race under parallel load).
 */
export async function connectMcpSession(options: {
  xqEnv: Record<string, string>;
  cwd?: string;
  /** Extra non-XQ keys merged after defaults (for harness probes). */
  extraEnv?: Record<string, string>;
}): Promise<McpSession> {
  const attempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await connectMcpSessionOnce(options);
    } catch (error: unknown) {
      lastError = error;
      const retryable =
        error instanceof McpConnectError ? error.retryable : false;
      if (!retryable || attempt === attempts) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw lastError;
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
