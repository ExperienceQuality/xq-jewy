from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx
import pytest
from pydantic import SecretStr

from xq_jewy.config import Settings
from xq_jewy.server import create_server

MCP_HEADERS = {"Accept": "application/json, text/event-stream"}
INITIALIZE = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "test", "version": "0"},
    },
}


@asynccontextmanager
async def http_client(settings: Settings) -> AsyncGenerator[httpx.AsyncClient]:
    # Not a fixture: the app lifespan must enter and exit in the same task.
    app = create_server(settings).http_app()
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            yield http


def secured() -> Settings:
    return Settings(_env_file=None, auth_token=SecretStr("s3cret"))


async def test_health_endpoint():
    async with http_client(Settings(_env_file=None)) as http:
        response = await http.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_health_is_public_when_auth_enabled():
    async with http_client(secured()) as http:
        assert (await http.get("/health")).status_code == 200


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"}])
async def test_mcp_rejects_missing_or_wrong_token(headers: dict[str, str]):
    async with http_client(secured()) as http:
        response = await http.post("/mcp", headers={**MCP_HEADERS, **headers}, json=INITIALIZE)
    assert response.status_code == 401


async def test_mcp_accepts_correct_token():
    headers = {**MCP_HEADERS, "Authorization": "Bearer s3cret"}
    async with http_client(secured()) as http:
        response = await http.post("/mcp", headers=headers, json=INITIALIZE)
    assert response.status_code == 200


def test_module_level_mcp_is_lazy_and_cached():
    import xq_jewy.server as server

    assert server.mcp is server.mcp
    with pytest.raises(AttributeError):
        _ = server.does_not_exist
