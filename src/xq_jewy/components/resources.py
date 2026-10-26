"""Resources: read-only data the client can load into context."""

from fastmcp import FastMCP

from xq_jewy import __version__


def register(mcp: FastMCP) -> None:
    @mcp.resource("info://server", mime_type="application/json")
    def server_info() -> dict[str, str]:
        """Basic information about this server."""
        return {"name": mcp.name, "version": __version__}

    @mcp.resource("greeting://{name}")
    def greeting(name: str) -> str:
        """A personalised greeting (resource template)."""
        return f"Hello, {name}!"
