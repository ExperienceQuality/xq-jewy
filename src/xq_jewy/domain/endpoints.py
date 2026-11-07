"""Endpoint kinds and nullable URL configuration."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class Endpoint(StrEnum):
    """External endpoints a capability may need."""

    API = "API"
    WIREMOCK = "WireMock"


class EndpointConfiguration(BaseModel):
    """Validated endpoint URLs from env; None if unset.

    Required-vs-optional enforcement is SC-02d
    (#16), not here.
    """

    model_config = ConfigDict(extra="forbid")

    api_base_url: str | None
    wiremock_base_url: str | None
