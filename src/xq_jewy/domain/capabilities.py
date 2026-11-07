"""Canonical capabilities schema (no file I/O)."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
)

_NO_URLS = "URLs are not allowed in schema"


class SchemaError(Exception):
    """Schema failure with stable ``code``."""

    def __init__(self, message: str = "schema") -> None:
        super().__init__(message)
        self.code = "schema"


class CapabilityTag(StrEnum):
    STUB = "stub"
    REST = "rest"
    VERIFICATION = "verification"
    REPORTING = "reporting"


class CapabilityToggle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool


class Capabilities(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stubs: CapabilityToggle
    rest: CapabilityToggle
    assertions: CapabilityToggle
    reporting: CapabilityToggle


class CapabilityConfig(BaseModel):
    """Parsed capabilities + enabled_tags mapping."""

    model_config = ConfigDict(extra="forbid")

    capabilities: Capabilities
    enabled_tags: list[CapabilityTag] = Field(min_length=1)


_URL_MARKERS = ("://",)


def _looks_like_url(value: str) -> bool:
    lowered = value.strip().lower()
    if any(m in lowered for m in _URL_MARKERS):
        return True
    return lowered.startswith(("http:", "https:"))


def _reject_urls(node: Any) -> None:
    if isinstance(node, str):
        if _looks_like_url(node):
            raise SchemaError(_NO_URLS)
        return
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(key, str) and _looks_like_url(
                key
            ):
                raise SchemaError(_NO_URLS)
            _reject_urls(value)
        return
    if isinstance(node, list | tuple):
        for item in node:
            _reject_urls(item)


def _reject_legacy(data: dict[str, Any]) -> None:
    if "tags" in data or "server" in data:
        raise SchemaError(
            "legacy tags/server format is not allowed"
        )


def _tag_for_capability(name: str) -> CapabilityTag:
    # Local mapping mirror — registry is authoritative for
    # endpoint needs; keep schema coverage aligned with the
    # four-way tag table without importing services.
    mapping = {
        "stubs": CapabilityTag.STUB,
        "rest": CapabilityTag.REST,
        "assertions": CapabilityTag.VERIFICATION,
        "reporting": CapabilityTag.REPORTING,
    }
    return mapping[name]


def _enabled_capability_tags(
    capabilities: Capabilities,
) -> set[CapabilityTag]:
    pairs = (
        ("stubs", capabilities.stubs.enabled),
        ("rest", capabilities.rest.enabled),
        ("assertions", capabilities.assertions.enabled),
        ("reporting", capabilities.reporting.enabled),
    )
    return {
        _tag_for_capability(name)
        for name, on in pairs
        if on
    }


def _check_tag_coverage(cfg: CapabilityConfig) -> None:
    allowed = _enabled_capability_tags(cfg.capabilities)
    for tag in cfg.enabled_tags:
        if tag not in allowed:
            raise SchemaError(
                "enabled_tags must be covered by "
                "enabled capabilities"
            )


def parse_capability_config(
    data: Any,
) -> CapabilityConfig:
    """Validate an already-parsed mapping; no file I/O."""
    if not isinstance(data, dict):
        raise SchemaError("root must be a mapping")
    _reject_urls(data)
    _reject_legacy(data)
    try:
        cfg = CapabilityConfig.model_validate(data)
    except ValidationError as exc:
        raise SchemaError(
            "schema validation failed"
        ) from exc
    _check_tag_coverage(cfg)
    return cfg
