"""QA-SYS-07: docs/examples for SC-04 (#12).

Loader-backed acceptance waits on #16. Until then:
fixture labels, secrets scan, YAML/mcp.json shape.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]

CAPABILITY_TO_TAG = {
    "stubs": "stub",
    "rest": "rest",
    "assertions": "verification",
    "reporting": "reporting",
}
CAPABILITY_TO_ENDPOINTS = {
    "stubs": frozenset({"wiremock"}),
    "rest": frozenset({"api"}),
    "assertions": frozenset({"api", "wiremock"}),
    "reporting": frozenset(),
}
KNOWN_TAGS = frozenset(CAPABILITY_TO_TAG.values())
CANONICAL_CAPABILITIES = frozenset(CAPABILITY_TO_TAG)

ENV_CONFIG = "XQ_JEWY_CONFIG"
ENV_API = "XQ_JEWY_API_BASE_URL"
ENV_WIREMOCK = "XQ_JEWY_WIREMOCK_BASE_URL"
ALLOWED_ENV_KEYS = frozenset(
    {ENV_CONFIG, ENV_API, ENV_WIREMOCK}
)

MODE_TO_CAPABILITY = {
    "stubs-only": "stubs",
    "rest-only": "rest",
    "assertions-only": "assertions",
    "reporting-only": "reporting",
}

DOCS_CONFIG = REPO_ROOT / "docs" / "config"
INVALID_FIXTURE = (
    REPO_ROOT / "src" / "xq_jewy" / "config_example.yaml"
)
ROOT_EXAMPLE = REPO_ROOT / "config.example.yaml"
README = REPO_ROOT / "README.md"
CONTRIBUTING = REPO_ROOT / "CONTRIBUTING.md"

SECRET_PATTERNS = (
    re.compile(
        r"(?i)(api[_-]?key|secret[_-]?key|password)"
        r"\s*[:=]"
    ),
    re.compile(r"(?i)authorization\s*:\s*bearer\s+\S+"),
    re.compile(
        r"(?i)-----BEGIN "
        r"(RSA |EC |OPENSSH )?PRIVATE KEY-----"
    ),
    re.compile(
        r"(?i)\b(sk|rk|ghp|glpat)-[A-Za-z0-9_-]{8,}\b"
    ),
    re.compile(
        r"(?i)(aws_secret_access_key|client_secret)"
        r"\s*[:=]\s*\S+"
    ),
)

URL_KEY_PATTERN = re.compile(
    r"(?i)(url|uri|endpoint|base_url|"
    r"api_url|wiremock)"
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _enabled_capabilities(data: dict) -> set[str]:
    caps = data.get("capabilities")
    assert isinstance(caps, dict)
    return {
        name
        for name, body in caps.items()
        if isinstance(body, dict)
        and body.get("enabled") is True
    }


def _required_endpoints(
    enabled: set[str],
) -> frozenset[str]:
    needed: set[str] = set()
    for name in enabled:
        needed |= CAPABILITY_TO_ENDPOINTS[name]
    return frozenset(needed)


def _assert_canonical_yaml(
    data: object,
    *,
    path: Path,
) -> None:
    assert isinstance(data, dict), (
        f"{path}: root must be a mapping"
    )
    assert "tags" not in data, (
        f"{path}: legacy tags key rejected"
    )
    assert "server" not in data, (
        f"{path}: legacy server key rejected"
    )
    assert "server_wrong" not in data, (
        f"{path}: legacy server_wrong key rejected"
    )
    caps = data.get("capabilities")
    tags = data.get("enabled_tags")
    assert isinstance(caps, dict), (
        f"{path}: capabilities required"
    )
    assert isinstance(tags, list) and tags, (
        f"{path}: enabled_tags must be non-empty list"
    )
    unknown = set(caps) - CANONICAL_CAPABILITIES
    assert not unknown, (
        f"{path}: unknown capability keys {unknown}"
    )
    for name, body in caps.items():
        assert isinstance(body, dict), (
            f"{path}: {name} must be mapping"
        )
        assert set(body) == {"enabled"}, (
            f"{path}: {name} may only declare enabled"
        )
        assert isinstance(body["enabled"], bool), (
            f"{path}: {name}.enabled must be bool"
        )
    for key in data:
        if URL_KEY_PATTERN.search(str(key)):
            raise AssertionError(
                f"{path}: YAML must not hold URL "
                f"fields ({key})"
            )
        value = data[key]
        if not isinstance(value, dict):
            continue
        for nested in value:
            if key == "capabilities":
                continue
            if URL_KEY_PATTERN.search(str(nested)):
                raise AssertionError(
                    f"{path}: YAML must not hold URL "
                    f"fields ({nested})"
                )

    enabled = _enabled_capabilities(data)
    covered = {CAPABILITY_TO_TAG[c] for c in enabled}
    for tag in tags:
        assert tag in KNOWN_TAGS, (
            f"{path}: unknown tag {tag!r}"
        )
        assert tag in covered, (
            f"{path}: tag {tag!r} not covered by "
            "enabled capabilities"
        )


def _mode_env_expectation(mode: str) -> set[str]:
    capability = MODE_TO_CAPABILITY[mode]
    endpoints = CAPABILITY_TO_ENDPOINTS[capability]
    keys = {ENV_CONFIG}
    if "api" in endpoints:
        keys.add(ENV_API)
    if "wiremock" in endpoints:
        keys.add(ENV_WIREMOCK)
    return keys


def test_invalid_packaged_fixture_is_labeled() -> None:
    text = _read(INVALID_FIXTURE)
    assert re.search(r"(?i)\binvalid\b", text), (
        "packaged config_example.yaml must be "
        "labeled invalid"
    )
    data = yaml.safe_load(text)
    assert isinstance(data, dict)
    legacy = (
        "tags" in data
        or "server_wrong" in data
        or "server" in data
    )
    assert legacy, (
        "invalid fixture should keep legacy shape "
        "for negative tests"
    )


def test_no_secrets_in_docs_and_examples() -> None:
    paths = [
        README,
        CONTRIBUTING,
        ROOT_EXAMPLE,
        INVALID_FIXTURE,
        *DOCS_CONFIG.rglob("*"),
    ]
    offenders: list[str] = []
    for path in paths:
        if not path.is_file():
            continue
        if path.name.startswith("."):
            continue
        text = _read(path)
        rel = path.relative_to(REPO_ROOT)
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                offenders.append(
                    f"{rel}: {pattern.pattern}"
                )
    assert not offenders, "secrets found:\n" + "\n".join(
        offenders
    )


@pytest.mark.parametrize(
    "mode",
    sorted(MODE_TO_CAPABILITY),
)
def test_docs_config_yaml_examples_match_shape(
    mode: str,
) -> None:
    path = DOCS_CONFIG / f"xq.{mode}.yaml"
    rel = path.relative_to(REPO_ROOT)
    assert path.is_file(), f"missing {rel}"
    data = yaml.safe_load(_read(path))
    _assert_canonical_yaml(data, path=path)
    enabled = _enabled_capabilities(data)
    expected = {MODE_TO_CAPABILITY[mode]}
    assert enabled == expected, (
        f"{path}: expected only "
        f"{MODE_TO_CAPABILITY[mode]} enabled"
    )


@pytest.mark.parametrize(
    "mode",
    sorted(MODE_TO_CAPABILITY),
)
def test_docs_config_mcp_env_only_required_vars(
    mode: str,
) -> None:
    path = DOCS_CONFIG / f"mcp.{mode}.json"
    rel = path.relative_to(REPO_ROOT)
    assert path.is_file(), f"missing {rel}"
    payload = json.loads(_read(path))
    env = payload["mcpServers"]["xq-jewy"]["env"]
    assert isinstance(env, dict)
    assert set(env) == _mode_env_expectation(mode)
    assert set(env) <= ALLOWED_ENV_KEYS
    assert Path(env[ENV_CONFIG]).is_absolute()
    if ENV_API in env:
        assert env[ENV_API].startswith("http")
    if ENV_WIREMOCK in env:
        assert env[ENV_WIREMOCK].startswith("http")


def test_root_config_example_is_canonical() -> None:
    data = yaml.safe_load(_read(ROOT_EXAMPLE))
    _assert_canonical_yaml(data, path=ROOT_EXAMPLE)
    enabled = _enabled_capabilities(data)
    assert enabled == CANONICAL_CAPABILITIES


def test_readme_documents_mcp_env_and_url_vars() -> None:
    text = _read(README)
    for name in (ENV_CONFIG, ENV_API, ENV_WIREMOCK):
        assert name in text, f"README missing {name}"
    assert '"env"' in text or "`env`" in text
    assert "/absolute/" in text


def test_contributing_capabilities_schema() -> None:
    text = _read(CONTRIBUTING)
    assert "capabilities" in text
    assert "enabled_tags" in text
    for capability in CANONICAL_CAPABILITIES:
        assert capability in text
    for tag in KNOWN_TAGS:
        assert tag in text
    assert "legacy" in text.lower() or "`tags`" in text
    assert "XQ_JEWY_API_BASE_URL" in text
    assert "XQ_JEWY_WIREMOCK_BASE_URL" in text


def test_docs_config_matrix_union_error_order() -> None:
    overview = _read(DOCS_CONFIG / "README.md")
    for capability, tag in CAPABILITY_TO_TAG.items():
        assert capability in overview
        assert tag in overview
    lower = overview.lower()
    compact = re.sub(r"\s+", " ", lower)
    assert "wiremock" in lower
    assert "union" in lower
    for stage in (
        "path",
        "file/parse",
        "schema/tag coverage",
        "required-set derivation",
        "API",
        "WireMock",
        "aggregate invariant",
        "server construction",
    ):
        assert stage in overview
    assert "even when" in compact
    assert (
        "does not need" in compact
        or "not needed" in compact
    )


def test_capability_endpoint_union_rule() -> None:
    """Single-capability modes match endpoint union."""
    for mode, capability in MODE_TO_CAPABILITY.items():
        data = yaml.safe_load(
            _read(DOCS_CONFIG / f"xq.{mode}.yaml")
        )
        enabled = _enabled_capabilities(data)
        assert (
            _required_endpoints(enabled)
            == (CAPABILITY_TO_ENDPOINTS[capability])
        )


def test_examples_load_via_facade_when_ready() -> None:
    """Full QA-SYS-07 loader path; waits on #16."""
    configuration = pytest.importorskip(
        "xq_jewy.configuration",
        reason="load_configuration facade pending #16",
    )
    load = getattr(
        configuration,
        "load_configuration",
        None,
    )
    if load is None:
        pytest.xfail(
            "load_configuration missing; blocked on #16"
        )

    for mode in MODE_TO_CAPABILITY:
        yaml_path = DOCS_CONFIG / f"xq.{mode}.yaml"
        mcp_path = DOCS_CONFIG / f"mcp.{mode}.json"
        mcp = json.loads(_read(mcp_path))
        env = dict(mcp["mcpServers"]["xq-jewy"]["env"])
        env[ENV_CONFIG] = str(yaml_path.resolve())
        load(env)
