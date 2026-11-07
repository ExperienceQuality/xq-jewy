"""QA-ACC-05..08, QA-ACC-10/11/12 for SC-02d (#16 / #21).

Call ``load_configuration`` only — compose path, file,
schema, required-set, URL env, and aggregate.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from xq_jewy.configuration import load_configuration
from xq_jewy.domain.config_type import (
    ConfigError,
    StartupConfiguration,
)
from xq_jewy.services.endpoint_urls import (
    ENV_API,
    ENV_WIREMOCK,
)

ENV_CONFIG = "XQ_JEWY_CONFIG"
_API = "http://127.0.0.1:8080"
_WM = "http://127.0.0.1:8081"

_CAPS = ("stubs", "rest", "assertions", "reporting")
_TAG = {
    "stubs": "stub",
    "rest": "rest",
    "assertions": "verification",
    "reporting": "reporting",
}


def _yaml(
    tmp_path: Path,
    *,
    stubs: bool = False,
    rest: bool = False,
    assertions: bool = False,
    reporting: bool = False,
    enabled_tags: list[str] | None = None,
    name: str = "xq.yaml",
) -> str:
    flags = {
        "stubs": stubs,
        "rest": rest,
        "assertions": assertions,
        "reporting": reporting,
    }
    if enabled_tags is None:
        enabled_tags = [_TAG[n] for n in _CAPS if flags[n]]
    lines = ["capabilities:"]
    for n in _CAPS:
        on = "true" if flags[n] else "false"
        lines.append(f"  {n}:")
        lines.append(f"    enabled: {on}")
    lines.append("")
    lines.append("enabled_tags:")
    for tag in enabled_tags:
        lines.append(f"  - {tag}")
    lines.append("")
    path = tmp_path / name
    path.write_text("\n".join(lines), encoding="utf-8")
    return str(path.resolve())


def _assert_one_config_error(
    exc_info: pytest.ExceptionInfo[BaseException],
    *,
    code: str,
    env_name: str | None = None,
    forbid: list[str] | None = None,
) -> ConfigError:
    err = exc_info.value
    assert type(err) is ConfigError
    assert exc_info.type is ConfigError
    assert err.code == code
    msg = str(err)
    if env_name is not None:
        assert env_name in msg
    for secret in forbid or []:
        assert secret not in msg
    assert "Traceback" not in msg
    return err


# --- QA-ACC-05: path stage first ---


def test_qa_acc_05_missing_config_path_is_first(
    tmp_path: Path,
) -> None:
    """QA-ACC-05: path missing beats later failures."""
    # No XQ_JEWY_CONFIG; also omit required URLs and
    # leave no file — path must win.
    with pytest.raises(ConfigError) as ei:
        load_configuration({})
    _assert_one_config_error(
        ei, code="missing_env", env_name=ENV_CONFIG
    )


def test_qa_acc_05_relative_path_before_file(
    tmp_path: Path,
) -> None:
    """QA-ACC-05: relative_path before file/parse."""
    (tmp_path / "xq.yaml").write_text(
        "not: valid\n", encoding="utf-8"
    )
    with pytest.raises(ConfigError) as ei:
        load_configuration({ENV_CONFIG: "xq.yaml"})
    _assert_one_config_error(ei, code="relative_path")


# --- QA-ACC-06: file/parse stage ---


def test_qa_acc_06_not_found_after_valid_path(
    tmp_path: Path,
) -> None:
    """QA-ACC-06: absolute missing file → not_found."""
    missing = str(tmp_path / "nope.yaml")
    with pytest.raises(ConfigError) as ei:
        load_configuration({ENV_CONFIG: missing})
    err = _assert_one_config_error(ei, code="not_found")
    assert missing not in str(err)


def test_qa_acc_06_yaml_syntax_before_schema(
    tmp_path: Path,
) -> None:
    """QA-ACC-06: yaml_syntax beats schema/URL errors."""
    bad = tmp_path / "bad.yaml"
    bad.write_text(":\n  - broken\n", encoding="utf-8")
    env = {
        ENV_CONFIG: str(bad.resolve()),
        ENV_API: "not-a-url",
    }
    with pytest.raises(ConfigError) as ei:
        load_configuration(env)
    _assert_one_config_error(
        ei, code="yaml_syntax", forbid=["not-a-url"]
    )


# --- QA-ACC-07: schema stage ---


def test_qa_acc_07_schema_before_url_and_aggregate(
    tmp_path: Path,
) -> None:
    """QA-ACC-07: schema beats URL missing/invalid."""
    path = tmp_path / "legacy.yaml"
    path.write_text(
        "tags: [stub]\n"
        "server:\n"
        "  api_url: http://localhost:8080\n"
        "  wiremock_url: http://localhost:8081\n",
        encoding="utf-8",
    )
    env = {
        ENV_CONFIG: str(path.resolve()),
        ENV_API: "not-a-url",
    }
    with pytest.raises(ConfigError) as ei:
        load_configuration(env)
    _assert_one_config_error(
        ei,
        code="schema",
        forbid=[
            "not-a-url",
            "http://localhost:8080",
            str(path.resolve()),
        ],
    )


def test_qa_acc_07_tag_coverage_is_schema(
    tmp_path: Path,
) -> None:
    """QA-ACC-07: uncovered enabled_tags → schema."""
    path = _yaml(
        tmp_path,
        stubs=True,
        enabled_tags=["stub", "rest"],
    )
    with pytest.raises(ConfigError) as ei:
        load_configuration(
            {ENV_CONFIG: path, ENV_WIREMOCK: _WM}
        )
    _assert_one_config_error(ei, code="schema")


# --- QA-ACC-08: happy path + first-error chain ---


def test_qa_acc_08_full_load_assertions(
    tmp_path: Path,
) -> None:
    """QA-ACC-08: successful StartupConfiguration."""
    path = _yaml(tmp_path, assertions=True)
    cfg = load_configuration(
        {
            ENV_CONFIG: path,
            ENV_API: _API,
            ENV_WIREMOCK: _WM,
        }
    )
    assert isinstance(cfg, StartupConfiguration)
    assert cfg.endpoints.api_base_url == _API
    assert cfg.endpoints.wiremock_base_url == _WM
    caps = cfg.capability_config.capabilities
    assert caps.assertions.enabled is True
    assert caps.stubs.enabled is False


def test_qa_acc_08_error_order_path_file_schema_urls(
    tmp_path: Path,
) -> None:
    """QA-ACC-08: earliest stage wins across the chain."""
    # 1) path
    with pytest.raises(ConfigError) as p:
        load_configuration({ENV_API: "bad"})
    assert p.value.code == "missing_env"
    assert ENV_CONFIG in str(p.value)

    # 2) file (path ok)
    missing = str(tmp_path / "gone.yaml")
    with pytest.raises(ConfigError) as f:
        load_configuration(
            {ENV_CONFIG: missing, ENV_API: "bad"}
        )
    assert f.value.code == "not_found"

    # 3) schema (path+file ok)
    legacy = tmp_path / "legacy.yaml"
    legacy.write_text("tags: [stub]\n", encoding="utf-8")
    with pytest.raises(ConfigError) as s:
        load_configuration(
            {
                ENV_CONFIG: str(legacy.resolve()),
                ENV_API: "bad",
            }
        )
    assert s.value.code == "schema"

    # 4/5) present API invalid before missing WireMock
    path = _yaml(tmp_path, assertions=True)
    with pytest.raises(ConfigError) as api:
        load_configuration(
            {ENV_CONFIG: path, ENV_API: "not-a-url"}
        )
    assert api.value.code == "invalid_url"
    assert ENV_API in str(api.value)
    assert "not-a-url" not in str(api.value)

    # 5/6) API missing before WireMock missing
    with pytest.raises(ConfigError) as miss:
        load_configuration({ENV_CONFIG: path})
    assert miss.value.code == "missing_env"
    assert ENV_API in str(miss.value)
    assert ENV_WIREMOCK not in str(miss.value)


# --- QA-ACC-10: API required / optional ---


def test_qa_acc_10_rest_missing_api(
    tmp_path: Path,
) -> None:
    """QA-ACC-10: rest needs API → missing_env."""
    path = _yaml(tmp_path, rest=True)
    with pytest.raises(ConfigError) as ei:
        load_configuration({ENV_CONFIG: path})
    _assert_one_config_error(
        ei, code="missing_env", env_name=ENV_API
    )


def test_qa_acc_10_rest_omits_wiremock_ok(
    tmp_path: Path,
) -> None:
    """QA-ACC-10: rest may omit WireMock."""
    path = _yaml(tmp_path, rest=True)
    cfg = load_configuration(
        {ENV_CONFIG: path, ENV_API: _API}
    )
    assert cfg.endpoints.api_base_url == _API
    assert cfg.endpoints.wiremock_base_url is None


# --- QA-ACC-11: WireMock required / optional ---


def test_qa_acc_11_stubs_missing_wiremock(
    tmp_path: Path,
) -> None:
    """QA-ACC-11: stubs needs WireMock → missing_env."""
    path = _yaml(tmp_path, stubs=True)
    with pytest.raises(ConfigError) as ei:
        load_configuration({ENV_CONFIG: path})
    _assert_one_config_error(
        ei, code="missing_env", env_name=ENV_WIREMOCK
    )


def test_qa_acc_11_stubs_omits_api_ok(
    tmp_path: Path,
) -> None:
    """QA-ACC-11: stubs may omit API."""
    path = _yaml(tmp_path, stubs=True)
    cfg = load_configuration(
        {ENV_CONFIG: path, ENV_WIREMOCK: _WM}
    )
    assert cfg.endpoints.wiremock_base_url == _WM
    assert cfg.endpoints.api_base_url is None


def test_qa_acc_11_reporting_needs_neither(
    tmp_path: Path,
) -> None:
    """QA-ACC-11: reporting needs neither URL."""
    path = _yaml(tmp_path, reporting=True)
    cfg = load_configuration({ENV_CONFIG: path})
    assert cfg.endpoints.api_base_url is None
    assert cfg.endpoints.wiremock_base_url is None


def test_qa_acc_11_assertions_needs_both(
    tmp_path: Path,
) -> None:
    """QA-ACC-11: assertions missing WireMock after API."""
    path = _yaml(tmp_path, assertions=True)
    with pytest.raises(ConfigError) as only_api:
        load_configuration(
            {ENV_CONFIG: path, ENV_API: _API}
        )
    _assert_one_config_error(
        only_api,
        code="missing_env",
        env_name=ENV_WIREMOCK,
    )


# --- QA-ACC-12: invalid present URLs ---


def test_qa_acc_12_invalid_api_even_when_optional(
    tmp_path: Path,
) -> None:
    """QA-ACC-12: invalid present API always fails."""
    path = _yaml(tmp_path, stubs=True)
    bad = "http://user:secret@evil.example/leak"
    with pytest.raises(ConfigError) as ei:
        load_configuration(
            {
                ENV_CONFIG: path,
                ENV_API: bad,
                ENV_WIREMOCK: _WM,
            }
        )
    _assert_one_config_error(
        ei,
        code="invalid_url",
        env_name=ENV_API,
        forbid=[bad, "secret", "evil.example"],
    )


def test_qa_acc_12_invalid_wiremock_when_required(
    tmp_path: Path,
) -> None:
    """QA-ACC-12: invalid WireMock when required."""
    path = _yaml(tmp_path, stubs=True)
    bad = "not-a-url"
    with pytest.raises(ConfigError) as ei:
        load_configuration(
            {ENV_CONFIG: path, ENV_WIREMOCK: bad}
        )
    _assert_one_config_error(
        ei,
        code="invalid_url",
        env_name=ENV_WIREMOCK,
        forbid=[bad],
    )


def test_qa_acc_12_empty_api_before_wiremock(
    tmp_path: Path,
) -> None:
    """QA-ACC-12: empty API wins over bad WireMock."""
    path = _yaml(tmp_path, reporting=True)
    with pytest.raises(ConfigError) as ei:
        load_configuration(
            {
                ENV_CONFIG: path,
                ENV_API: " ",
                ENV_WIREMOCK: "also-bad",
            }
        )
    _assert_one_config_error(
        ei,
        code="empty_env",
        env_name=ENV_API,
        forbid=["also-bad"],
    )


# --- Capability matrix (union) ---


@pytest.mark.parametrize(
    ("flags", "need_api", "need_wm"),
    [
        ({"stubs": True}, False, True),
        ({"rest": True}, True, False),
        ({"assertions": True}, True, True),
        ({"reporting": True}, False, False),
        (
            {"stubs": True, "rest": True},
            True,
            True,
        ),
    ],
    ids=[
        "stubs",
        "rest",
        "assertions",
        "reporting",
        "stubs+rest",
    ],
)
def test_capability_matrix_missing_required(
    tmp_path: Path,
    flags: dict[str, bool],
    need_api: bool,
    need_wm: bool,
) -> None:
    """Matrix: each required endpoint missing errors."""
    path = _yaml(
        tmp_path,
        stubs=flags.get("stubs", False),
        rest=flags.get("rest", False),
        assertions=flags.get("assertions", False),
        reporting=flags.get("reporting", False),
    )
    env: dict[str, str] = {ENV_CONFIG: path}
    if need_api and need_wm:
        with pytest.raises(ConfigError) as ei:
            load_configuration(env)
        _assert_one_config_error(
            ei, code="missing_env", env_name=ENV_API
        )
        env[ENV_API] = _API
        with pytest.raises(ConfigError) as ei2:
            load_configuration(env)
        _assert_one_config_error(
            ei2, code="missing_env", env_name=ENV_WIREMOCK
        )
        env[ENV_WIREMOCK] = _WM
        cfg = load_configuration(env)
        assert cfg.endpoints.api_base_url == _API
        assert cfg.endpoints.wiremock_base_url == _WM
    elif need_api:
        with pytest.raises(ConfigError) as ei:
            load_configuration(env)
        _assert_one_config_error(
            ei, code="missing_env", env_name=ENV_API
        )
        env[ENV_API] = _API
        cfg = load_configuration(env)
        assert cfg.endpoints.wiremock_base_url is None
    elif need_wm:
        with pytest.raises(ConfigError) as ei:
            load_configuration(env)
        _assert_one_config_error(
            ei, code="missing_env", env_name=ENV_WIREMOCK
        )
        env[ENV_WIREMOCK] = _WM
        cfg = load_configuration(env)
        assert cfg.endpoints.api_base_url is None
    else:
        cfg = load_configuration(env)
        assert cfg.endpoints.api_base_url is None
        assert cfg.endpoints.wiremock_base_url is None
