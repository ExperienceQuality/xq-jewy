"""Capability tag mapping and endpoint requirements."""

from __future__ import annotations

from xq_jewy.domain.capabilities import Capabilities
from xq_jewy.domain.endpoints import Endpoint

# Re-export for callers that import Endpoint here.
__all__ = [
    "CAPABILITY_TAGS",
    "ENDPOINT_REQUIREMENTS",
    "Endpoint",
    "required_endpoints",
]

CAPABILITY_TAGS: dict[str, str] = {
    "stubs": "stub",
    "rest": "rest",
    "assertions": "verification",
    "reporting": "reporting",
}

# Explicit row per capability — missing never means "none".
# reporting's empty frozenset is an intentional "neither".
ENDPOINT_REQUIREMENTS: dict[str, frozenset[Endpoint]] = {
    "stubs": frozenset({Endpoint.WIREMOCK}),
    "rest": frozenset({Endpoint.API}),
    "assertions": frozenset(
        {Endpoint.API, Endpoint.WIREMOCK}
    ),
    "reporting": frozenset(),
}


def required_endpoints(
    capabilities: Capabilities,
) -> frozenset[Endpoint]:
    """Union of endpoint needs over enabled capabilities.

    Independent of ``enabled_tags``.
    """
    flags = {
        "stubs": capabilities.stubs.enabled,
        "rest": capabilities.rest.enabled,
        "assertions": capabilities.assertions.enabled,
        "reporting": capabilities.reporting.enabled,
    }
    needed: set[Endpoint] = set()
    for name, enabled in flags.items():
        if not enabled:
            continue
        if name not in ENDPOINT_REQUIREMENTS:
            raise KeyError(
                f"missing endpoint requirement row: {name}"
            )
        needed |= ENDPOINT_REQUIREMENTS[name]
    return frozenset(needed)
