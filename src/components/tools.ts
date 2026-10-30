// Tools: functions the LLM can call.
import { type FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import * as core from "../core.ts";

export function register(server: FastMCP): void {
  server.addTool({
    name: "greet",
    description: "Greet someone by name.",
    parameters: z.object({ name: z.string().describe("Who to greet") }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: async ({ name }, { log }) => {
      log.info("greet called", { name });
      try {
        return core.greet(name);
      } catch (error) {
        // UserError = "show this message to the user", not a server crash.
        throw new UserError((error as Error).message);
      }
    },
  });

  server.addTool({
    name: "add",
    description: "Add two numbers.",
    parameters: z.object({ a: z.number(), b: z.number() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: async ({ a, b }) => String(core.add(a, b)),
  });
}
