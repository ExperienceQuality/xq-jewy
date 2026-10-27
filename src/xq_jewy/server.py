"""Builds the FastMCP server. ``mcp`` is the object the ``fastmcp`` CLI picks up."""

import hmac
from typing import Any

from fastmcp import FastMCP
from fastmcp.server.auth.providers.debug import DebugTokenVerifier
from starlette.requests import Request
from starlette.responses import JSONResponse

from xq_jewy import __version__
from xq_jewy.components import prompts, resources, tools
from xq_jewy.config import Settings

INSTRUCTIONS = "xq-jewy example server: greeting and math tools, server info resource."


def _bearer_auth(token: str) -> DebugTokenVerifier:
    return DebugTokenVerifier(validate=lambda candidate: hmac.compare_digest(candidate, token))


def create_server(settings: Settings | None = None) -> FastMCP:
    settings = settings or Settings()
    token = settings.auth_token.get_secret_value() if settings.auth_token else None
    mcp = FastMCP(
        name="xq-jewy",
        instructions=INSTRUCTIONS,
        version=__version__,
        auth=_bearer_auth(token) if token else None,
    )

    tools.register(mcp)
    resources.register(mcp)
    prompts.register(mcp)

    @mcp.custom_route("/health", methods=["GET"])
    async def health(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "version": __version__})

    return mcp


def __getattr__(name: str) -> Any:
    # Lazy ``mcp`` so importing this module never reads/validates env vars by itself.
    if name == "mcp":
        globals()["mcp"] = server = create_server()
        return server
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
