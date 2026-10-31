import asyncio
from pathlib import Path

import pytest
from fastmcp.server.providers import FileSystemProvider

from xq_jewy.bootstrap import create_server
from xq_jewy.configuration import ServerConfig

TOOLS_ROOT = Path(__file__).parents[2] / "src" / "xq_jewy" / "tools"


def _config(capabilities: list[str], tags: list[str]) -> ServerConfig:
    return ServerConfig.model_validate(
        {
            "capabilities": {c: {"enabled": True} for c in capabilities},
            "enabled_tags": tags,
        }
    )


def _tool_names(mcp) -> set[str]:
    return {t.name for t in asyncio.run(mcp.list_tools())}


def test_discovers_all_tools_from_enabled_capabilities():
    mcp = create_server(
        _config(
            ["stubs", "rest", "assertions", "reporting"],
            ["stub", "rest", "verification", "reporting"],
        ),
        TOOLS_ROOT,
    )
    assert _tool_names(mcp) == {
        "create_stub",
        "update_stub",
        "reset_stubs",
        "verify_stub",
        "send_request",
        "send_requests",
        "verify_status",
        "verify_body",
        "verify_headers",
        "verify_schema",
        "report_test_result",
        "get_test_result",
        "report_step_result",
        "get_step_result",
    }


def test_disabled_capability_tools_absent():
    mcp = create_server(_config(["rest"], ["rest"]), TOOLS_ROOT)
    assert _tool_names(mcp) == {"send_request", "send_requests"}


def test_tag_allowlist_hides_non_matching():
    mcp = create_server(
        _config(["stubs", "rest", "assertions", "reporting"], ["rest"]),
        TOOLS_ROOT,
    )
    assert _tool_names(mcp) == {"send_request", "send_requests"}


def test_tools_carry_tags():
    mcp = create_server(_config(["rest"], ["rest"]), TOOLS_ROOT)
    tools = asyncio.run(mcp.list_tools())
    for t in tools:
        assert "rest" in t.tags


def test_untagged_tool_hidden_in_allowlist_mode(tmp_path):
    (tmp_path / "loose.py").write_text(
        "from fastmcp.tools import tool\n\n"
        "@tool\n"
        "def untagged() -> str:\n"
        "    return 'x'\n"
    )
    from fastmcp import FastMCP

    mcp = FastMCP("t", providers=[FileSystemProvider(root=tmp_path, reload=False)])
    mcp.enable(tags={"rest"}, components={"tool"}, only=True)
    assert _tool_names(mcp) == set()


def test_missing_capability_directory_fails(tmp_path):
    cfg = _config(["rest"], ["rest"])
    with pytest.raises(FileNotFoundError):
        create_server(cfg, tmp_path)


def test_tool_execution_invokes_service():
    mcp = create_server(_config(["rest"], ["rest"]), TOOLS_ROOT)
    tools = asyncio.run(mcp.list_tools())
    send = next(t for t in tools if t.name == "send_request")
    assert send is not None
    assert send.tags == {"rest", "http"}
