"""SC-02d load_configuration facade."""

from __future__ import annotations

import os
from collections.abc import Mapping

from xq_jewy.domain.capabilities import (
    SchemaError,
    parse_capability_config,
)
from xq_jewy.domain.config_type import (
    ConfigError,
    StartupConfiguration,
)
from xq_jewy.services.capability_registry import (
    required_endpoints,
)
from xq_jewy.services.config_file import (
    ConfigFileError,
    load_config_file,
)
from xq_jewy.services.config_path import (
    ConfigPathError,
    resolve_config_path,
)
from xq_jewy.services.endpoint_urls import (
    EndpointUrlError,
    load_endpoint_urls,
)

# File codes whose lower-layer messages may include paths.
_REDACT_FILE_MSG = {
    "not_found": "config file not found",
    "unreadable": "config file unreadable",
    "not_a_file": "config path is not a regular file",
    "too_large": "config file exceeds 1 MiB limit",
    "decode_error": "config file is not valid UTF-8",
    "yaml_syntax": "config YAML is invalid",
    "unsafe_yaml": "config YAML uses unsafe constructs",
    "duplicate_key": "config YAML has a duplicate key",
    "multiple_documents": (
        "config must be a single YAML document"
    ),
    "not_a_mapping": "config root must be a mapping",
}


def load_configuration(
    environ: Mapping[str, str] | None = None,
) -> StartupConfiguration:
    """Compose path → file → schema → URLs → aggregate.

    First-error order; exactly one redacted ConfigError.
    """
    env: Mapping[str, str] = (
        os.environ if environ is None else environ
    )

    try:
        path = resolve_config_path(env)
    except ConfigPathError as exc:
        raise ConfigError(
            exc.code, str(exc) or exc.code
        ) from None

    try:
        raw = load_config_file(path)
    except ConfigFileError as exc:
        raise ConfigError(
            exc.code,
            _REDACT_FILE_MSG.get(
                exc.code, str(exc) or exc.code
            ),
        ) from None

    try:
        capability_config = parse_capability_config(raw)
    except SchemaError as exc:
        raise ConfigError(
            "schema", str(exc) or "schema"
        ) from None

    needed = required_endpoints(
        capability_config.capabilities
    )

    try:
        endpoints = load_endpoint_urls(env)
    except EndpointUrlError as exc:
        raise ConfigError(
            exc.code, str(exc) or exc.code
        ) from None

    return StartupConfiguration.from_parts(
        capability_config=capability_config,
        endpoints=endpoints,
        required=needed,
    )


__all__ = ["load_configuration", "ConfigError"]
