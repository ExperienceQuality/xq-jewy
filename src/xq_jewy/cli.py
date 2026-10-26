"""Command-line entry point: ``xq-jewy [--transport stdio|http] [--host H] [--port P]``."""

import argparse
import ipaddress
import logging
from collections.abc import Sequence
from typing import get_args

from pydantic import ValidationError

from xq_jewy import __version__
from xq_jewy.config import LogLevel, Settings, Transport
from xq_jewy.server import create_server

logger = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    """Flags default to None so unset ones fall back to env vars / .env / config defaults."""
    parser = argparse.ArgumentParser(prog="xq-jewy", description="Run the xq-jewy MCP server.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--transport", choices=get_args(Transport))
    parser.add_argument("--host")
    parser.add_argument("--port", type=int)
    parser.add_argument("--log-level", choices=get_args(LogLevel))
    return parser


def load_settings(parser: argparse.ArgumentParser, args: argparse.Namespace) -> Settings:
    overrides = {key: value for key, value in vars(args).items() if value is not None}
    try:
        return Settings(**overrides)
    except ValidationError as exc:
        parser.error(str(exc))


def _is_loopback(host: str) -> bool:
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    settings = load_settings(parser, parser.parse_args(argv))
    logging.basicConfig(level=settings.log_level)

    mcp = create_server(settings)
    if settings.transport == "http":
        if settings.auth_token is None and not _is_loopback(settings.host):
            logger.warning(
                "Serving on %s without authentication; set XQ_JEWY_AUTH_TOKEN.", settings.host
            )
        mcp.run(
            transport="http",
            host=settings.host,
            port=settings.port,
            log_level=settings.log_level,
        )
    else:
        mcp.run(transport="stdio", show_banner=False, log_level=settings.log_level)
    return 0
