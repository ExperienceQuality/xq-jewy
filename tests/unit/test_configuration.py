"""StartupConfiguration aggregate invariants (#16)."""

from __future__ import annotations

import pytest

from xq_jewy.domain.capabilities import (
    CapabilityConfig,
    parse_capability_config,
)
from xq_jewy.domain.config_type import (
    ConfigError,
    StartupConfiguration,
)
from xq_jewy.domain.endpoints import (
    Endpoint,
    EndpointConfiguration,
)
from xq_jewy.services.capability_registry import (
    required_endpoints,
)
from xq_jewy.services.endpoint_urls import (
    ENV_API,
    ENV_WIREMOCK,
)

_API = "http://127.0.0.1:8080"
_WM = "http://127.0.0.1:8081"


def _caps(
    *,
    stubs: bool = False,
    rest: bool = False,
    assertions: bool = False,
    reporting: bool = False,
) -> CapabilityConfig:
    tags: list[str] = []
    if stubs:
        tags.append("stub")
    if rest:
        tags.append("rest")
    if assertions:
        tags.append("verification")
    if reporting:
        tags.append("reporting")
    return parse_capability_config(
        {
            "capabilities": {
                "stubs": {"enabled": stubs},
                "rest": {"enabled": rest},
                "assertions": {"enabled": assertions},
                "reporting": {"enabled": reporting},
            },
            "enabled_tags": tags,
        }
    )


def test_startup_accepts_required_endpoints() -> None:
    cap = _caps(assertions=True)
    needed = required_endpoints(cap.capabilities)
    assert needed == frozenset(
        {Endpoint.API, Endpoint.WIREMOCK}
    )
    cfg = StartupConfiguration.from_parts(
        capability_config=cap,
        endpoints=EndpointConfiguration(
            api_base_url=_API,
            wiremock_base_url=_WM,
        ),
        required=needed,
    )
    assert cfg.endpoints.api_base_url == _API
    assert cfg.endpoints.wiremock_base_url == _WM


def test_startup_rejects_missing_api() -> None:
    cap = _caps(rest=True)
    needed = required_endpoints(cap.capabilities)
    with pytest.raises(ConfigError) as ei:
        StartupConfiguration.from_parts(
            capability_config=cap,
            endpoints=EndpointConfiguration(
                api_base_url=None,
                wiremock_base_url=None,
            ),
            required=needed,
        )
    assert ei.value.code == "missing_env"
    assert ENV_API in str(ei.value)


def test_startup_rejects_missing_wiremock() -> None:
    cap = _caps(stubs=True)
    needed = required_endpoints(cap.capabilities)
    with pytest.raises(ConfigError) as ei:
        StartupConfiguration.from_parts(
            capability_config=cap,
            endpoints=EndpointConfiguration(
                api_base_url=None,
                wiremock_base_url=None,
            ),
            required=needed,
        )
    assert ei.value.code == "missing_env"
    assert ENV_WIREMOCK in str(ei.value)


def test_startup_reporting_allows_null_urls() -> None:
    cap = _caps(reporting=True)
    needed = required_endpoints(cap.capabilities)
    assert needed == frozenset()
    cfg = StartupConfiguration.from_parts(
        capability_config=cap,
        endpoints=EndpointConfiguration(
            api_base_url=None,
            wiremock_base_url=None,
        ),
        required=needed,
    )
    assert cfg.endpoints.api_base_url is None
    assert cfg.endpoints.wiremock_base_url is None


def test_config_error_has_stable_code() -> None:
    err = ConfigError("schema", "schema validation failed")
    assert err.code == "schema"
    assert "schema validation failed" in str(err)
