"""QA SC-03 startup wiring / stdio system tests.

IDs: QA-ACC-01, QA-SYS-01..06. Paired with #11.
"""

from __future__ import annotations

import os

import pytest

from tests.system import harness


def test_qa_acc_01_harness_spawns_xq_jewy():
    """Harness spawns installed xq-jewy; captures I/O."""
    cmd = harness.resolve_xq_jewy_command()
    assert cmd, "expected a spawn command"
    # No XQ_JEWY_* → config failure exits promptly.
    result = harness.run_xq_jewy(timeout=5.0)
    assert not result.timed_out, (
        "expected prompt config-failure exit"
    )
    assert result.exit_code is not None
    assert isinstance(result.stdout, bytes)
    assert isinstance(result.stderr, bytes)


def test_harness_fixture_paths_are_absolute():
    """Fixtures are absolute paths for XQ_JEWY_CONFIG."""
    path = harness.fixture_path("valid_minimal.yaml")
    assert path.is_absolute()
    assert path.is_file()
    assert os.path.isabs(str(path))


def test_qa_sys_01_missing_config_env():
    """Missing XQ_JEWY_CONFIG → failure contract."""
    env = harness.base_env(clear_xq=True)
    result = harness.run_xq_jewy(env=env, timeout=5.0)
    harness.assert_config_failure_contract(result)


def test_qa_sys_02_relative_config_path():
    """Relative XQ_JEWY_CONFIG is rejected."""
    env = harness.base_env(clear_xq=True)
    env["XQ_JEWY_CONFIG"] = (
        "tests/fixtures/startup/valid_minimal.yaml"
    )
    result = harness.run_xq_jewy(env=env, timeout=5.0)
    harness.assert_config_failure_contract(result)


def test_qa_sys_03_missing_config_file():
    """Missing absolute config path → failure."""
    missing = (
        harness.FIXTURES_STARTUP / "does-not-exist.yaml"
    )
    assert not missing.exists()
    env = harness.base_env(clear_xq=True)
    env["XQ_JEWY_CONFIG"] = str(missing.resolve())
    result = harness.run_xq_jewy(env=env, timeout=5.0)
    harness.assert_config_failure_contract(result)


@pytest.mark.parametrize(
    "fixture_name",
    [
        "invalid_yaml.yaml",
        "invalid_schema.yaml",
        "invalid_unknown_keys.yaml",
    ],
)
def test_qa_sys_04_invalid_config_contents(
    fixture_name: str,
):
    """Invalid YAML/schema → failure contract."""
    path = harness.fixture_path(fixture_name)
    assert path.is_file()
    env = harness.base_env(clear_xq=True)
    env["XQ_JEWY_CONFIG"] = str(path)
    result = harness.run_xq_jewy(env=env, timeout=5.0)
    harness.assert_config_failure_contract(result)


def test_qa_sys_05_valid_config_reaches_mcp_initialize():
    """Valid config: MCP initialize; keeps serving."""
    path = harness.fixture_path("valid_minimal.yaml")
    env = harness.base_env(clear_xq=True)
    env["XQ_JEWY_CONFIG"] = str(path)
    # stubs-only requires WireMock URL (grammar only).
    env["XQ_JEWY_WIREMOCK_BASE_URL"] = (
        "http://127.0.0.1:8081"
    )
    result, parsed = harness.speak_mcp_initialize(
        env=env, timeout=5.0
    )
    assert not result.timed_out, (
        "no initialize response on stdout"
    )
    assert parsed is not None
    assert parsed.get("jsonrpc") == "2.0"
    assert "result" in parsed
    # exit 0 = stub/no-server; not keeping serving.
    assert result.exit_code != 0


def test_qa_sys_06_no_banners_or_startup_network():
    """
    No import stdout; no banner before initialize;
    stubs-only must not hang on network.
    """
    import_result = harness.run_python_import(
        "xq_jewy.server", timeout=5.0
    )
    assert not import_result.timed_out
    assert import_result.exit_code == 0
    assert import_result.stdout == b"", import_result.stdout

    path = harness.fixture_path("valid_minimal.yaml")
    env = harness.base_env(clear_xq=True)
    env["XQ_JEWY_CONFIG"] = str(path)
    # Unreachable if startup wrongly dials out.
    # Valid unused URL grammar; stubs-only must not connect.
    env["XQ_JEWY_API_BASE_URL"] = "http://127.0.0.1:9"
    env["XQ_JEWY_WIREMOCK_BASE_URL"] = "http://127.0.0.1:9"

    result, parsed = harness.speak_mcp_initialize(
        env=env, timeout=3.0
    )
    assert not result.timed_out, (
        "startup hung (possible network dial?)"
    )
    assert parsed is not None
    assert "result" in parsed
    first = result.stdout.lstrip()[:1]
    preview = result.stdout[:80]
    assert first == b"{", (
        f"stdout banner before JSON: {preview!r}"
    )
