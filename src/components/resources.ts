// Resources: read-only data the client can load into context.
import type { FastMCP } from "fastmcp";
import * as core from "../core.ts";
import { VERSION } from "../version.ts";

export function register(server: FastMCP, serverName: string): void {
  server.addResource({
    uri: "info://server",
    name: "Server info",
    description: "Basic information about this server.",
    mimeType: "application/json",
    load: async () => ({ text: JSON.stringify({ name: serverName, version: VERSION }) }),
  });

  server.addResourceTemplate({
    uriTemplate: "greeting://{name}",
    name: "Greeting",
    description: "A personalised greeting (resource template).",
    mimeType: "text/plain",
    arguments: [{ name: "name", description: "Who to greet", required: true }],
    load: async ({ name }) => ({ text: core.greet(name) }),
  });
}
