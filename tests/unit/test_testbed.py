import pytest

import xq_jewy.testbed as testbed


def _bad_yaml() -> dict:
    return {
        "tags": ["stub"],
        "server_wrong": {
            "api_url": "http://localhost:8080",
            "wiremock_url": "http://localhost:8081",
        },
    }


def _good_yaml() -> dict:
    return {
        "tags": ["stub"],
        "server": {
            "api_url": "http://localhost:8080",
            "wiremock_url": "http://localhost:8081",
        },
    }


def test_bad_schema_exits_1(monkeypatch, capsys):
    monkeypatch.setattr(
        testbed,
        "load_from_file",
        lambda _: _bad_yaml(),
    )
    with pytest.raises(SystemExit) as exc:
        testbed.main()
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert "Error parsing configuration" in out


def test_good_schema_does_not_exit(monkeypatch, capsys):
    monkeypatch.setattr(
        testbed,
        "load_from_file",
        lambda _: _good_yaml(),
    )
    testbed.main()
    out = capsys.readouterr().out
    assert "server=" in out
