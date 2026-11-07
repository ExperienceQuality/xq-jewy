"""Resolve config path from XQ_JEWY_CONFIG."""

from __future__ import annotations

import os
from collections.abc import Mapping

ENV_VAR = "XQ_JEWY_CONFIG"


class ConfigPathError(Exception):
    """Path failure with stable ``code``."""

    def __init__(
        self, code: str, message: str = ""
    ) -> None:
        self.code = code
        super().__init__(message or code)


def resolve_config_path(
    environ: Mapping[str, str] | None = None,
) -> str:
    """Return raw absolute path from env.

    Uses the value as-is: no trimming, no ``~``
    or ``$VAR`` expansion, no CWD or default
    lookup. Rejects missing, empty/whitespace,
    and relative values before any file I/O.
    """
    env = os.environ if environ is None else environ
    if ENV_VAR not in env:
        raise ConfigPathError(
            "missing_env",
            f"{ENV_VAR} is not set; provide an "
            "absolute config path",
        )

    value = env[ENV_VAR]
    if value == "" or value.strip() == "":
        raise ConfigPathError(
            "empty_env",
            f"{ENV_VAR} is empty; provide an "
            "absolute config path",
        )

    if not os.path.isabs(value):
        raise ConfigPathError(
            "relative_path",
            f"{ENV_VAR} must be an absolute path "
            "(no ~ or $VAR expansion)",
        )

    return value
