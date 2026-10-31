import pytest
from pydantic import ValidationError

from xq_jewy.domain import Configuration


def _valid() -> dict:
    return {
        "tags": ["stub", "verification"],
        "server": {
            "api_url": "http://localhost:8080",
            "wiremock_url": "http://localhost:8081",
        },
    }


def test_valid_config_parses():
    cfg = Configuration.model_validate(_valid())
    assert len(cfg.tags) == 2
    assert cfg.server.api_url == "http://localhost:8080"


def test_missing_server_fails():
    data = _valid()
    del data["server"]
    with pytest.raises(ValidationError, match="server"):
        Configuration.model_validate(data)


def test_misspelled_server_key_fails():
    data = _valid()
    data["server_wrong"] = data.pop("server")
    with pytest.raises(ValidationError, match="server"):
        Configuration.model_validate(data)


def test_unknown_tag_value_fails():
    data = _valid()
    data["tags"] = ["not-a-real-tag"]
    with pytest.raises(ValidationError, match="tags"):
        Configuration.model_validate(data)


def test_tags_not_a_list_fails():
    data = _valid()
    data["tags"] = "stub"
    with pytest.raises(ValidationError, match="tags"):
        Configuration.model_validate(data)


def test_server_missing_url_fails():
    data = _valid()
    del data["server"]["wiremock_url"]
    with pytest.raises(ValidationError, match="wiremock_url"):
        Configuration.model_validate(data)
