import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSettings } from "../src/config.ts";
import { createServer } from "../src/server.ts";
import { VERSION } from "../src/version.ts";
import { connectClient } from "./helpers.ts";

let client: Client;

beforeEach(async () => {
  client = await connectClient(createServer(loadSettings({ logLevel: "error" }, {})));
});

afterEach(async () => {
  await client.close();
});

describe("tools", () => {
  it("lists the example tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(["add", "greet"]);
  });

  it("greet returns a greeting", async () => {
    const result = await client.callTool({ name: "greet", arguments: { name: "Ada" } });
    expect(result.content).toEqual([{ type: "text", text: "Hello, Ada!" }]);
  });

  it("greet reports bad input as a tool error", async () => {
    const result = await client.callTool({ name: "greet", arguments: { name: " " } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "name must not be empty" }]);
  });

  it("add returns the sum", async () => {
    const result = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
    expect(result.content).toEqual([{ type: "text", text: "5" }]);
  });
});

describe("resources", () => {
  it("serves server info as JSON", async () => {
    const { contents } = await client.readResource({ uri: "info://server" });
    expect(contents).toEqual([
      expect.objectContaining({ text: JSON.stringify({ name: "xq-jewy", version: VERSION }) }),
    ]);
  });

  it("serves the greeting template", async () => {
    const { contents } = await client.readResource({ uri: "greeting://Ada" });
    expect(contents).toEqual([expect.objectContaining({ text: "Hello, Ada!" })]);
  });
});

describe("prompts", () => {
  it("fills in the default audience", async () => {
    const { messages } = await client.getPrompt({ name: "explain", arguments: { topic: "MCP" } });
    expect(messages[0]?.content).toMatchObject({
      text: expect.stringContaining("MCP to a beginner"),
    });
  });

  it("uses the given audience", async () => {
    const { messages } = await client.getPrompt({
      name: "explain",
      arguments: { topic: "MCP", audience: "a chef" },
    });
    expect(messages[0]?.content).toMatchObject({ text: expect.stringContaining("to a chef") });
  });
});
