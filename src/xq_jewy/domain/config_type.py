"""Configuration domain types (legacy + startup)."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from xq_jewy.domain.capabilities import CapabilityConfig
from xq_jewy.domain.endpoints import (
    Endpoint,
    EndpointConfiguration,
)


class ConfigError(Exception):
    """Typed, redacted startup configuration failure."""

    def __init__(
        self, code: str, message: str = ""
    ) -> None:
        self.code = code
        super().__init__(message or code)


class StartupConfiguration(BaseModel):
    """Validated startup aggregate for the MCP server.

    ``EndpointConfiguration`` fields stay nullable;
    construction via ``configuration.load_configuration``
    (or ``StartupConfiguration.from_parts``) enforces
    that every required endpoint is present.
    """

    model_config = ConfigDict(extra="forbid")

    capability_config: CapabilityConfig
    endpoints: EndpointConfiguration

    @classmethod
    def from_parts(
        cls,
        *,
        capability_config: CapabilityConfig,
        endpoints: EndpointConfiguration,
        required: frozenset[Endpoint],
    ) -> StartupConfiguration:
        """Aggregate invariant: required URLs present."""
        if (
            Endpoint.API in required
            and endpoints.api_base_url is None
        ):
            raise ConfigError(
                "missing_env",
                "XQ_JEWY_API_BASE_URL is not set; "
                "provide an API base URL",
            )
        if (
            Endpoint.WIREMOCK in required
            and endpoints.wiremock_base_url is None
        ):
            raise ConfigError(
                "missing_env",
                "XQ_JEWY_WIREMOCK_BASE_URL is not set; "
                "provide a WireMock base URL",
            )
        return cls(
            capability_config=capability_config,
            endpoints=endpoints,
        )


# --- Legacy models kept for testbed until #11 ---


class ToolTag(StrEnum):
    """
    Tags for categorizing tools in the MCP server.
    Including domain tools and utility tools.
    """

    STUB = "stub"
    VERIFICATION = "verification"
    ROUTINE_SERVICE = "routine-service"
    EXERCISE_SERVICE = "exercise-service"
    FITNESS_BFF = "fitness-bff"


class ServerConfig(BaseModel):
    """
    Configuration for the MCP server.
    """

    api_url: str
    wiremock_url: str


class Configuration(BaseModel):
    tags: list[ToolTag]
    server: ServerConfig
