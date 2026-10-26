"""xq-jewy: a FastMCP server."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("xq-jewy")
except PackageNotFoundError:  # pragma: no cover - source tree not installed
    __version__ = "0.0.0"

__all__ = ["__version__"]
