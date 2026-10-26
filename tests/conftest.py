from collections.abc import AsyncIterator

import pytest
from fastmcp import Client

from xq_jewy.server import create_server


@pytest.fixture
async def client() -> AsyncIterator[Client]:
    """An MCP client talking to a fresh server in memory (no network, no subprocess)."""
    async with Client(create_server()) as c:
        yield c
