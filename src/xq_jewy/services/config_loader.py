"""Compatibility loader for testbed until #11."""

from __future__ import annotations

from typing import Any

from xq_jewy.services.config_file import load_config_file


def load_from_file(file_path: str) -> dict[Any, Any]:
    """Read YAML via the bounded safe config reader."""
    return load_config_file(file_path)
