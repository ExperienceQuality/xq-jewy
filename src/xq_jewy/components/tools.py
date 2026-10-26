"""Tools: functions the LLM can call."""

import logging

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

from xq_jewy import core

logger = logging.getLogger(__name__)


def register(mcp: FastMCP) -> None:
    @mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True})
    def greet(name: str) -> str:
        """Greet someone by name."""
        logger.info("greet called with name=%r", name)
        try:
            return core.greet(name)
        except ValueError as exc:
            raise ToolError(str(exc)) from exc

    @mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True})
    def add(a: float, b: float) -> float:
        """Add two numbers."""
        return core.add(a, b)
