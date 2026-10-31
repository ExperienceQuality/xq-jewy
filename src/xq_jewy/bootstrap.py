import sys
import time
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server.providers import FileSystemProvider

from xq_jewy.configuration import ServerConfig


def create_server(config: ServerConfig, tools_root: Path) -> FastMCP:
    """Build the MCP server: capability discovery + tag visibility."""
    start = time.monotonic()

    enabled = config.enabled_capabilities()
    if not enabled:
        msg = "no capabilities enabled"
        raise ValueError(msg)

    providers = []
    for name in enabled:
        directory = tools_root / name
        if not directory.is_dir():
            msg = f"capability directory missing: {directory}"
            raise FileNotFoundError(msg)
        providers.append(FileSystemProvider(root=directory, reload=False))

    mcp = FastMCP("XQ-Jewy", providers=providers)
    mcp.enable(tags=config.enabled_tags, components={"tool"}, only=True)

    elapsed_ms = (time.monotonic() - start) * 1000
    print(
        f"xq-jewy: {len(enabled)} capabilities, {elapsed_ms:.1f}ms startup",
        file=sys.stderr,
    )
    return mcp
