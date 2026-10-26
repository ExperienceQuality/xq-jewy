from typing import Any

import pytest

from xq_jewy import cli
from xq_jewy.server import mcp


@pytest.fixture
def run_calls(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(mcp, "run", lambda **kwargs: calls.append(kwargs))
    return calls


def test_default_runs_stdio(run_calls: list[dict[str, Any]]):
    assert cli.main([]) == 0
    assert run_calls == [{"transport": "stdio", "show_banner": False}]


def test_http_transport(run_calls: list[dict[str, Any]]):
    cli.main(["--transport", "http", "--host", "0.0.0.0", "--port", "9001"])
    assert run_calls == [{"transport": "http", "host": "0.0.0.0", "port": 9001}]


def test_version_flag(capsys: pytest.CaptureFixture[str]):
    with pytest.raises(SystemExit):
        cli.main(["--version"])
    assert "xq-jewy" in capsys.readouterr().out
