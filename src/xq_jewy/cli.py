"""Command-line entry point: ``xq-jewy [--transport stdio|http] [--host H] [--port P]``."""

import argparse
import logging
from collections.abc import Sequence
from typing import get_args

from xq_jewy import __version__
from xq_jewy.config import LogLevel, Settings, Transport, get_settings


def build_parser(settings: Settings) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="xq-jewy", description="Run the xq-jewy MCP server.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--transport", choices=get_args(Transport), default=settings.transport)
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--log-level", choices=get_args(LogLevel), default=settings.log_level)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser(get_settings()).parse_args(argv)
    logging.basicConfig(level=args.log_level)

    from xq_jewy.server import mcp

    if args.transport == "http":
        mcp.run(transport="http", host=args.host, port=args.port)
    else:
        mcp.run(transport="stdio", show_banner=False)
    return 0
