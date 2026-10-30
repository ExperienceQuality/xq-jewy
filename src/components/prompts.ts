// Prompts: reusable message templates the user can pick in their client.
import type { FastMCP } from "fastmcp";

export function register(server: FastMCP): void {
  server.addPrompt({
    name: "explain",
    description: "Ask the model to explain a topic for a given audience.",
    arguments: [
      { name: "topic", description: "What to explain", required: true },
      { name: "audience", description: 'Who it is for (default: "a beginner")' },
    ],
    load: async ({ topic, audience }) =>
      `Explain ${topic} to ${audience || "a beginner"}. Use short paragraphs and one concrete example.`,
  });
}
