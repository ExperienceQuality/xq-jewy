import json

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from mcp.types import TextContent, TextResourceContents


async def test_lists_expected_tools(client: Client):
    names = {tool.name for tool in await client.list_tools()}
    assert names == {"greet", "add"}


async def test_greet_tool(client: Client):
    result = await client.call_tool("greet", {"name": "World"})
    assert result.data == "Hello, World!"


async def test_greet_tool_rejects_empty_name(client: Client):
    with pytest.raises(ToolError, match="must not be empty"):
        await client.call_tool("greet", {"name": ""})


async def test_add_tool(client: Client):
    result = await client.call_tool("add", {"a": 2, "b": 3})
    assert result.data == 5


async def test_server_info_resource(client: Client):
    [content] = await client.read_resource("info://server")
    assert isinstance(content, TextResourceContents)
    assert json.loads(content.text)["name"] == "xq-jewy"


async def test_greeting_resource_template(client: Client):
    [content] = await client.read_resource("greeting://Ada")
    assert isinstance(content, TextResourceContents)
    assert content.text == "Hello, Ada!"


async def test_explain_prompt(client: Client):
    result = await client.get_prompt("explain", {"topic": "MCP"})
    [message] = result.messages
    assert isinstance(message.content, TextContent)
    assert "MCP" in message.content.text
