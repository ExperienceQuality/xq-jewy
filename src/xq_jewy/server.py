"""SC-03 stdio MCP server entrypoint."""

from __future__ import annotations

import sys
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.server.providers import FileSystemProvider

from xq_jewy.configuration import (
    ConfigError,
    load_configuration,
)


def main() -> None:
    try:
        config = load_configuration()
    except ConfigError as exc:
        print(f"XQ_JEWY_CONFIG: {exc}", file=sys.stderr)
        raise SystemExit(1) from None

    mcp = FastMCP(
        "xq-jewy",
        providers=[
            FileSystemProvider(
                Path(__file__).resolve().parent / "tools"
            )
        ],
    )
    mcp.enable(
        tags=set(config.capability_config.enabled_tags),
        only=True,
    )
    mcp.run(transport="stdio", show_banner=False)


if __name__ == "__main__":
    main()
