import pytest
from pydantic import ValidationError

from xq_jewy.cli import build_parser
from xq_jewy.config import Settings


def test_defaults():
    settings = Settings(_env_file=None)
    assert settings.transport == "stdio"
    assert settings.port == 8000


def test_reads_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("XQ_JEWY_TRANSPORT", "http")
    monkeypatch.setenv("XQ_JEWY_PORT", "9000")
    settings = Settings(_env_file=None)
    assert settings.transport == "http"
    assert settings.port == 9000


def test_rejects_bad_port(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("XQ_JEWY_PORT", "0")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_cli_flags_override_settings():
    args = build_parser(Settings(_env_file=None)).parse_args(
        ["--transport", "http", "--port", "1234"]
    )
    assert args.transport == "http"
    assert args.port == 1234
