from pathlib import Path

import yaml
from pydantic import BaseModel, Field, model_validator

CAPABILITY_TAGS: dict[str, set[str]] = {
    "stubs": {"stub", "control", "verification"},
    "rest": {"rest", "http"},
    "assertions": {"verification", "assertion", "schema"},
    "reporting": {"reporting", "test-result", "test-step"},
}


class CapabilityConfig(BaseModel):
    enabled: bool = False


class ServerConfig(BaseModel):
    capabilities: dict[str, CapabilityConfig]
    enabled_tags: set[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate(self) -> "ServerConfig":
        unknown = set(self.capabilities) - set(CAPABILITY_TAGS)
        if unknown:
            msg = f"unknown capabilities: {sorted(unknown)}"
            raise ValueError(msg)

        allowed = set().union(
            *(
                CAPABILITY_TAGS[name]
                for name, cap in self.capabilities.items()
                if cap.enabled
            )
        )
        bad = self.enabled_tags - allowed
        if bad:
            msg = f"enabled_tags not provided by enabled capabilities: {sorted(bad)}"
            raise ValueError(msg)
        return self

    def enabled_capabilities(self) -> list[str]:
        return [name for name, cap in self.capabilities.items() if cap.enabled]


def load_config(path: Path) -> ServerConfig:
    if not path.is_file():
        msg = f"config file not found: {path}"
        raise FileNotFoundError(msg)

    raw = yaml.safe_load(path.read_text()) or {}
    return ServerConfig.model_validate(raw)
