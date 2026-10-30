import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FastMCP } from "fastmcp";
import { afterEach, describe, expect, it } from "vitest";
import { loadSettings } from "../src/config.ts";
import { createServer } from "../src/server.ts";
import { VERSION } from "../src/version.ts";
import { freePort } from "./helpers.ts";

let server: FastMCP | undefined;

async function startHttp(authToken?: string): Promise<string> {
  const port = await freePort();
  server = createServer(loadSettings({ logLevel: "error", authToken }, {}));
  await server.start({ transportType: "httpStream", httpStream: { host: "127.0.0.1", port } });
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

const initialize = (baseUrl: string, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "0" },
      },
    }),
  });

describe("http transport", () => {
  it("serves /health", async () => {
    const baseUrl = await startHttp();
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", version: VERSION });
  });

  it("works end to end with a real client", async () => {
    const baseUrl = await startHttp();
    const client = new Client({ name: "t", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
    const result = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
    expect(result.content).toEqual([{ type: "text", text: "5" }]);
    await client.close();
  });
});

describe("bearer auth", () => {
  it("keeps /health public", async () => {
    const baseUrl = await startHttp("s3cret");
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
  });

  it("rejects a missing token", async () => {
    const baseUrl = await startHttp("s3cret");
    expect((await initialize(baseUrl)).status).toBe(401);
  });

  it.each(["Bearer wrong", "Basic s3cret", "s3cret"])("rejects %j", async (authorization) => {
    const baseUrl = await startHttp("s3cret");
    expect((await initialize(baseUrl, { authorization })).status).toBe(401);
  });

  it("accepts the right token", async () => {
    const baseUrl = await startHttp("s3cret");
    const client = new Client({ name: "t", version: "0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { authorization: "Bearer s3cret" } },
    });
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(2);
    await client.close();
  });
});
