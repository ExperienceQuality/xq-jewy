import pytest
from pydantic import ValidationError

from xq_jewy.configuration import ServerConfig, load_config


def _base() -> dict:
    return {
        "capabilities": {
            "stubs": {"enabled": True},
            "rest": {"enabled": True},
            "assertions": {"enabled": True},
            "reporting": {"enabled": True},
        },
        "enabled_tags": ["stub", "rest", "verification", "reporting"],
    }


def test_valid_config():
    cfg = ServerConfig.model_validate(_base())
    assert cfg.enabled_capabilities() == [
        "stubs",
        "rest",
        "assertions",
        "reporting",
    ]


def test_unknown_capability_fails():
    data = _base()
    data["capabilities"]["mobile"] = {"enabled": True}
    with pytest.raises(ValidationError, match="unknown capabilities"):
        ServerConfig.model_validate(data)


def test_empty_enabled_tags_fails():
    data = _base()
    data["enabled_tags"] = []
    with pytest.raises(ValidationError):
        ServerConfig.model_validate(data)


def test_tag_from_disabled_capability_fails():
    data = _base()
    data["capabilities"]["stubs"]["enabled"] = False
    with pytest.raises(ValidationError, match="enabled_tags"):
        ServerConfig.model_validate(data)


def test_tag_not_in_universe_fails():
    data = _base()
    data["enabled_tags"] = ["nonexistent"]
    with pytest.raises(ValidationError, match="enabled_tags"):
        ServerConfig.model_validate(data)


def test_missing_config_file_fails(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_config(tmp_path / "nope.yaml")


def test_load_config_from_yaml(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text(
        "capabilities:\n  rest:\n    enabled: true\nenabled_tags:\n  - rest\n"
    )
    cfg = load_config(path)
    assert cfg.enabled_capabilities() == ["rest"]
    assert cfg.enabled_tags == {"rest"}
