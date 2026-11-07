"""Bounded config file reader and safe YAML."""

from __future__ import annotations

import os
import stat
from typing import Any

import yaml
from yaml.composer import ComposerError
from yaml.constructor import ConstructorError
from yaml.parser import ParserError
from yaml.scanner import ScannerError

MAX_CONFIG_BYTES = 1_048_576

_OPEN_FLAGS = os.O_RDONLY | os.O_CLOEXEC | os.O_NONBLOCK


class ConfigFileError(Exception):
    """File/YAML failure with stable ``code``."""

    def __init__(
        self, code: str, message: str = ""
    ) -> None:
        self.code = code
        super().__init__(message or code)


class _RestrictedSafeLoader(yaml.SafeLoader):
    """SafeLoader that forbids unsafe YAML."""

    def compose_node(  # type: ignore[no-untyped-def]
        self, parent, index
    ):
        if self.check_event(yaml.AliasEvent):
            raise ConfigFileError(
                "unsafe_yaml",
                "YAML aliases are not allowed",
            )
        return super().compose_node(parent, index)

    def flatten_mapping(  # type: ignore[no-untyped-def]
        self, node
    ) -> None:
        merge = "tag:yaml.org,2002:merge"
        for key_node, _value_node in node.value:
            if key_node.tag == merge:
                raise ConfigFileError(
                    "unsafe_yaml",
                    "YAML merge keys are not allowed",
                )
        super().flatten_mapping(node)

    def construct_mapping(  # type: ignore[no-untyped-def]
        self, node, deep=False
    ):
        if not isinstance(node, yaml.nodes.MappingNode):
            raise ConstructorError(
                None,
                None,
                "expected a mapping node",
                node.start_mark,
            )
        self.flatten_mapping(node)
        mapping: dict[Any, Any] = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if key in mapping:
                raise ConfigFileError(
                    "duplicate_key",
                    f"duplicate key: {key!r}",
                )
            mapping[key] = self.construct_object(
                value_node, deep=deep
            )
        return mapping


def load_config_file(path: str) -> dict[Any, Any]:
    """Read ``path`` and return a plain mapping.

    ``path`` must already be resolved; this does
    not read ``XQ_JEWY_CONFIG`` or expand paths.
    """
    raw = _read_bounded_bytes(path)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ConfigFileError(
            "decode_error",
            "config file is not valid UTF-8",
        ) from exc
    return _parse_restricted_yaml(text)


def _read_bounded_bytes(path: str) -> bytes:
    try:
        fd = os.open(path, _OPEN_FLAGS)
    except FileNotFoundError as exc:
        raise ConfigFileError(
            "not_found",
            f"config file not found: {path}",
        ) from exc
    except PermissionError as exc:
        raise ConfigFileError(
            "unreadable",
            f"config file unreadable: {path}",
        ) from exc
    except OSError as exc:
        if exc.errno == getattr(os, "ENOENT", 2):
            raise ConfigFileError(
                "not_found",
                f"config file not found: {path}",
            ) from exc
        raise ConfigFileError(
            "unreadable",
            f"config file unreadable: {path}",
        ) from exc

    try:
        mode = os.fstat(fd).st_mode
        if not stat.S_ISREG(mode):
            raise ConfigFileError(
                "not_a_file",
                "config path is not a regular file",
            )
        size = os.fstat(fd).st_size
        if size > MAX_CONFIG_BYTES:
            raise ConfigFileError(
                "too_large",
                "config file exceeds 1 MiB limit",
            )
        data = os.read(fd, MAX_CONFIG_BYTES + 1)
        if len(data) > MAX_CONFIG_BYTES:
            raise ConfigFileError(
                "too_large",
                "config file exceeds 1 MiB limit",
            )
        return data
    finally:
        os.close(fd)


def _parse_restricted_yaml(
    text: str,
) -> dict[Any, Any]:
    loader = _RestrictedSafeLoader(text)
    try:
        try:
            data = loader.get_single_data()
        except ConfigFileError:
            raise
        except ComposerError as exc:
            raise ConfigFileError(
                "multiple_documents",
                "config must be a single YAML document",
            ) from exc
        except ConstructorError as exc:
            raise ConfigFileError(
                "unsafe_yaml",
                "config YAML uses unsafe constructs",
            ) from exc
        except (ParserError, ScannerError) as exc:
            raise ConfigFileError(
                "yaml_syntax",
                "config YAML is invalid",
            ) from exc
        except yaml.YAMLError as exc:
            raise ConfigFileError(
                "yaml_syntax",
                "config YAML is invalid",
            ) from exc
    finally:
        loader.dispose()

    if not isinstance(data, dict):
        raise ConfigFileError(
            "not_a_mapping",
            "config root must be a mapping",
        )
    return data
