"""Prompts: reusable message templates the user can pick in their client."""

from fastmcp import FastMCP


def register(mcp: FastMCP) -> None:
    @mcp.prompt
    def explain(topic: str, audience: str = "a beginner") -> str:
        """Ask the model to explain a topic for a given audience."""
        return f"Explain {topic} to {audience}. Use short paragraphs and one concrete example."
