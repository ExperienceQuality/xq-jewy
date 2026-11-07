"""QA-UNIT-05 / QA-UNIT-09 (registry part)."""

from __future__ import annotations

from itertools import product

import pytest

from xq_jewy.domain.capabilities import (
    SchemaError,
    parse_capability_config,
)
from xq_jewy.services.capability_registry import (
    CAPABILITY_TAGS,
    ENDPOINT_REQUIREMENTS,
    Endpoint,
    required_endpoints,
)

_CAPS = ("stubs", "rest", "assertions", "reporting")


def _cfg(
    *,
    stubs: bool = True,
    rest: bool = True,
    assertions: bool = True,
    reporting: bool = True,
    enabled_tags: list[str] | None = None,
) -> dict:
    caps = {
        "stubs": {"enabled": stubs},
        "rest": {"enabled": rest},
        "assertions": {"enabled": assertions},
        "reporting": {"enabled": reporting},
    }
    if enabled_tags is None:
        enabled_tags = [
            CAPABILITY_TAGS[name]
            for name in _CAPS
            if caps[name]["enabled"]
        ]
    return {
        "capabilities": caps,
        "enabled_tags": enabled_tags,
    }


# --- QA-UNIT-05: schema rejections and tag coverage ---


def test_qa_unit_05_unknown_top_level_key_rejected():
    data = _cfg()
    data["extra"] = True
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(data)
    assert exc.value.code == "schema"


def test_qa_unit_05_unknown_capability_key_rejected():
    data = _cfg()
    data["capabilities"]["graphql"] = {"enabled": True}
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(data)
    assert exc.value.code == "schema"


def test_qa_unit_05_unknown_toggle_key_rejected():
    data = _cfg()
    data["capabilities"]["stubs"] = {
        "enabled": True,
        "debug": False,
    }
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(data)
    assert exc.value.code == "schema"


@pytest.mark.parametrize("legacy_key", ["tags", "server"])
def test_qa_unit_05_legacy_format_rejected(legacy_key: str):
    data = _cfg()
    if legacy_key == "tags":
        data["tags"] = ["stub"]
    else:
        data["server"] = {
            "api_url": "http://localhost:8080",
            "wiremock_url": "http://localhost:8081",
        }
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(data)
    assert exc.value.code == "schema"


@pytest.mark.parametrize(
    "payload",
    [
        {"url": "http://example.com"},
        {"url": "https://example.com/path"},
        {
            "capabilities": {
                "stubs": {"enabled": "http://x"},
                "rest": {"enabled": True},
                "assertions": {"enabled": True},
                "reporting": {"enabled": True},
            },
            "enabled_tags": ["stub"],
        },
        {
            "capabilities": {
                "stubs": {"enabled": True},
                "rest": {"enabled": True},
                "assertions": {"enabled": True},
                "reporting": {"enabled": True},
            },
            "enabled_tags": ["https://evil.example/tag"],
        },
    ],
)
def test_qa_unit_05_urls_rejected_as_schema(payload: dict):
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(payload)
    assert exc.value.code == "schema"


def test_qa_unit_05_enabled_tags_must_be_non_empty():
    data = _cfg(enabled_tags=[])
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(data)
    assert exc.value.code == "schema"


@pytest.mark.parametrize(
    ("disabled", "tag"),
    [
        ("stubs", "stub"),
        ("rest", "rest"),
        ("assertions", "verification"),
        ("reporting", "reporting"),
    ],
)
def test_qa_unit_05_enabled_tags_must_be_covered(
    disabled: str, tag: str
):
    flags = {name: True for name in _CAPS}
    flags[disabled] = False
    # Keep another tag so emptiness is not the failure.
    others = [
        CAPABILITY_TAGS[n] for n in _CAPS if n != disabled
    ]
    data = _cfg(**flags, enabled_tags=[tag, others[0]])
    with pytest.raises(SchemaError) as exc:
        parse_capability_config(data)
    assert exc.value.code == "schema"


def test_qa_unit_05_valid_mapping_parses():
    data = _cfg(
        stubs=True,
        rest=False,
        assertions=True,
        reporting=False,
        enabled_tags=["stub", "verification"],
    )
    cfg = parse_capability_config(data)
    assert cfg.capabilities.stubs.enabled is True
    assert cfg.capabilities.rest.enabled is False
    assert cfg.enabled_tags == [
        "stub",
        "verification",
    ]


def test_qa_unit_05_four_way_tag_mapping():
    assert CAPABILITY_TAGS == {
        "stubs": "stub",
        "rest": "rest",
        "assertions": "verification",
        "reporting": "reporting",
    }


# --- QA-UNIT-09 (registry): endpoint needs + union ---


def test_qa_unit_09_endpoint_requirements_table():
    assert ENDPOINT_REQUIREMENTS["stubs"] == frozenset(
        {Endpoint.WIREMOCK}
    )
    assert ENDPOINT_REQUIREMENTS["rest"] == frozenset(
        {Endpoint.API}
    )
    assert ENDPOINT_REQUIREMENTS["assertions"] == frozenset(
        {Endpoint.API, Endpoint.WIREMOCK}
    )
    assert ENDPOINT_REQUIREMENTS["reporting"] == frozenset()
    assert set(ENDPOINT_REQUIREMENTS) == set(_CAPS)


@pytest.mark.parametrize(
    "flags",
    list(product([False, True], repeat=4)),
)
def test_qa_unit_09_required_endpoints_union_over_enabled(
    flags: tuple[bool, bool, bool, bool],
):
    stubs, rest, assertions, reporting = flags
    data = _cfg(
        stubs=stubs,
        rest=rest,
        assertions=assertions,
        reporting=reporting,
    )
    # All-disabled cannot parse (empty tags); build toggles
    # directly. required_endpoints ignores enabled_tags.
    expected: set[Endpoint] = set()
    if stubs:
        expected |= {Endpoint.WIREMOCK}
    if rest:
        expected |= {Endpoint.API}
    if assertions:
        expected |= {Endpoint.API, Endpoint.WIREMOCK}
    # reporting adds nothing

    if any(flags):
        cfg = parse_capability_config(data)
        assert required_endpoints(
            cfg.capabilities
        ) == frozenset(expected)
    else:
        # Derive from toggles without tag coverage.
        from xq_jewy.domain.capabilities import (
            Capabilities,
            CapabilityToggle,
        )

        caps = Capabilities(
            stubs=CapabilityToggle(enabled=False),
            rest=CapabilityToggle(enabled=False),
            assertions=CapabilityToggle(enabled=False),
            reporting=CapabilityToggle(enabled=False),
        )
        assert required_endpoints(caps) == frozenset()


@pytest.mark.parametrize(
    "flags",
    [
        (True, True, True, True),
        (True, False, True, False),
        (False, True, False, True),
        (True, True, False, False),
    ],
)
def test_qa_unit_09_independent_of_enabled_tags(
    flags: tuple[bool, bool, bool, bool],
):
    stubs, rest, assertions, reporting = flags
    covered = [
        CAPABILITY_TAGS[name]
        for name, on in zip(_CAPS, flags, strict=True)
        if on
    ]
    # Minimal vs maximal enabled_tags among covered tags.
    minimal = [covered[0]]
    maximal = list(covered)
    cfg_min = parse_capability_config(
        _cfg(
            stubs=stubs,
            rest=rest,
            assertions=assertions,
            reporting=reporting,
            enabled_tags=minimal,
        )
    )
    cfg_max = parse_capability_config(
        _cfg(
            stubs=stubs,
            rest=rest,
            assertions=assertions,
            reporting=reporting,
            enabled_tags=maximal,
        )
    )
    assert required_endpoints(
        cfg_min.capabilities
    ) == required_endpoints(cfg_max.capabilities)
