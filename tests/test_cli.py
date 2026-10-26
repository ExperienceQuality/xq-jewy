from typing import Any

import pytest
from fastmcp import FastMCP

from xq_jewy import cli


@pytest.fixture
def run_calls(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(FastMCP, "run", lambda self, **kwargs: calls.append(kwargs))
    return calls


def test_default_runs_stdio(run_calls: list[dict[str, Any]]):
    assert cli.main([]) == 0
    assert run_calls == [{"transport": "stdio", "show_banner": False, "log_level": "INFO"}]


def test_http_transport(run_calls: list[dict[str, Any]]):
    cli.main(["--transport", "http", "--port", "9001", "--log-level", "ERROR"])
    assert run_calls == [
        {"transport": "http", "host": "127.0.0.1", "port": 9001, "log_level": "ERROR"}
    ]


def test_cli_flag_beats_env(monkeypatch: pytest.MonkeyPatch, run_calls: list[dict[str, Any]]):
    monkeypatch.setenv("XQ_JEWY_PORT", "0")  # invalid, but overridden by the flag
    cli.main(["--transport", "http", "--port", "9002"])
    assert run_calls[0]["port"] == 9002


@pytest.mark.parametrize("port", ["0", "70000"])
def test_rejects_out_of_range_port(port: str, capsys: pytest.CaptureFixture[str]):
    with pytest.raises(SystemExit) as exc:
        cli.main(["--port", port])
    assert exc.value.code == 2
    assert "port" in capsys.readouterr().err


def test_version_works_with_invalid_env(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
):
    monkeypatch.setenv("XQ_JEWY_PORT", "0")
    with pytest.raises(SystemExit):
        cli.main(["--version"])
    assert "xq-jewy" in capsys.readouterr().out


@pytest.mark.parametrize("host", ["0.0.0.0", "example.com"])
def test_warns_when_public_without_token(
    host: str, run_calls: list[dict[str, Any]], caplog: pytest.LogCaptureFixture
):
    cli.main(["--transport", "http", "--host", host])
    assert "without authentication" in caplog.text


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "::1"])
def test_no_warning_on_loopback(
    host: str, run_calls: list[dict[str, Any]], caplog: pytest.LogCaptureFixture
):
    cli.main(["--transport", "http", "--host", host])
    assert "without authentication" not in caplog.text


def test_no_warning_with_token(
    monkeypatch: pytest.MonkeyPatch,
    run_calls: list[dict[str, Any]],
    caplog: pytest.LogCaptureFixture,
):
    monkeypatch.setenv("XQ_JEWY_AUTH_TOKEN", "s3cret")
    cli.main(["--transport", "http", "--host", "0.0.0.0"])
    assert "without authentication" not in caplog.text
