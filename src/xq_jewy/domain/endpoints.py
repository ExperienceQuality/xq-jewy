"""Endpoint base-URL configuration (nullable fields)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class EndpointConfiguration(BaseModel):
    """Validated endpoint URLs from env; None if unset.

    Required-vs-optional enforcement is SC-02d
    (#16), not here.
    """

    model_config = ConfigDict(extra="forbid")

    api_base_url: str | None
    wiremock_base_url: str | None
