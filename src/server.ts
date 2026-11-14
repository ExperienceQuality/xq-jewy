import { McpServer } from "@modelcontextprotocol/server";
import {
  serveStdio,
  type StdioServerHandle,
} from "@modelcontextprotocol/server/stdio";

import type { StartupConfiguration } from "./config/index.js";

/**
 * Construct and serve the MCP server over stdio.
 * Call only after a successful `loadConfiguration`.
 * Import-time pure: no fs/env/network until this function runs.
 */
export function startServer(_config: StartupConfiguration): StdioServerHandle {
  return serveStdio(() => {
    const server = new McpServer(
      { name: "xq-jewy", version: "0.2.0" },
      { capabilities: { tools: {} } },
    );
    return server;
  });
}
