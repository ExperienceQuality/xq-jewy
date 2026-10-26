"""Builds the FastMCP server. ``mcp`` is the object the ``fastmcp`` CLI picks up."""

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

from xq_jewy import __version__
from xq_jewy.components import prompts, resources, tools

INSTRUCTIONS = "xq-jewy example server: greeting and math tools, server info resource."


def create_server() -> FastMCP:
    mcp = FastMCP(name="xq-jewy", instructions=INSTRUCTIONS, version=__version__)

    tools.register(mcp)
    resources.register(mcp)
    prompts.register(mcp)

    @mcp.custom_route("/health", methods=["GET"])
    async def health(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "version": __version__})

    return mcp


mcp = create_server()
