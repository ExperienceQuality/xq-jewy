// Builds the FastMCP server from settings. No side effects until you call `start()`.
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { FastMCP } from "fastmcp";
import * as prompts from "./components/prompts.ts";
import * as resources from "./components/resources.ts";
import * as tools from "./components/tools.ts";
import { loadSettings, type Settings } from "./config.ts";
import { createLogger } from "./logger.ts";
import { VERSION } from "./version.ts";

export const SERVER_NAME = "xq-jewy";
const INSTRUCTIONS = "xq-jewy example server: greeting and math tools, server info resource.";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Accept only `Authorization: Bearer <token>`, compared in constant time. */
export function bearerAuth(token: string) {
  const expected = digest(token);
  return async (request: IncomingMessage): Promise<Record<string, unknown>> => {
    const header = request.headers.authorization ?? "";
    const [scheme, candidate = ""] = header.split(" ", 2);
    if (scheme?.toLowerCase() !== "bearer" || !timingSafeEqual(digest(candidate), expected)) {
      throw new Response(null, { status: 401, statusText: "Unauthorized" });
    }
    return {};
  };
}

export function createServer(settings: Settings = loadSettings()): FastMCP {
  const server = new FastMCP({
    name: SERVER_NAME,
    version: VERSION,
    instructions: INSTRUCTIONS,
    logger: createLogger(settings.logLevel),
    ...(settings.authToken ? { authenticate: bearerAuth(settings.authToken) } : {}),
  });

  tools.register(server);
  resources.register(server, SERVER_NAME);
  prompts.register(server);

  // Custom HTTP routes are public; handy for Docker / load-balancer health probes.
  server.getApp().get("/health", (c) => c.json({ status: "ok", version: VERSION }));

  return server;
}
