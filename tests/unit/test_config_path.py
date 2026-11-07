"""SC-01 config path unit tests (#9 / #17)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from xq_jewy.services.config_path import (
    ConfigPathError,
    resolve_config_path,
)

ENV = "XQ_JEWY_CONFIG"


def test_qa_unit_01_returns_raw_absolute_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """QA-UNIT-01: absolute value returned raw."""
    path = "/var/xq/configs/custom-name.yml"
    monkeypatch.setenv(ENV, path)
    assert resolve_config_path() == path


def test_qa_acc_02_missing_env_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """QA-ACC-02: absent env -> missing_env."""
    monkeypatch.delenv(ENV, raising=False)
    with pytest.raises(ConfigPathError) as exc_info:
        resolve_config_path()
    assert exc_info.value.code == "missing_env"


@pytest.mark.parametrize(
    "value",
    ["", " ", "\t", "  \n", "\n\t  "],
    ids=[
        "empty",
        "space",
        "tab",
        "spaces-newline",
        "mixed-ws",
    ],
)
def test_qa_acc_03_empty_or_whitespace_env_rejected(
    monkeypatch: pytest.MonkeyPatch,
    value: str,
) -> None:
    """QA-ACC-03: empty/whitespace -> empty_env."""
    monkeypatch.setenv(ENV, value)
    with pytest.raises(ConfigPathError) as exc_info:
        resolve_config_path()
    assert exc_info.value.code == "empty_env"


@pytest.mark.parametrize(
    "value",
    [
        "xq.yaml",
        "relative/path.yaml",
        "~/xq.yaml",
        "$HOME/xq.yaml",
        " /tmp/leading-space.yaml",
        "./config.yaml",
    ],
    ids=[
        "bare-name",
        "relative",
        "tilde",
        "dollar-var",
        "leading-space",
        "dot-relative",
    ],
)
def test_qa_acc_04_relative_and_unexpanded_rejected(
    monkeypatch: pytest.MonkeyPatch,
    value: str,
) -> None:
    """QA-ACC-04: relative/~/$VAR -> relative_path."""
    monkeypatch.setenv(ENV, value)
    with pytest.raises(ConfigPathError) as exc_info:
        resolve_config_path()
    assert exc_info.value.code == "relative_path"


def test_qa_acc_09_spaces_unicode_and_arbitrary_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """QA-ACC-09: spaces/Unicode/odd names work."""
    path = "/tmp/my configs/配置 file.custom.yaml"
    monkeypatch.setenv(ENV, path)
    assert resolve_config_path() == path


def test_qa_sys_05_no_cwd_default_or_file_io(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """QA-SYS-05: no CWD/default; no file I/O."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv(ENV, raising=False)

    # Relative must not use CWD even if file exists.
    (tmp_path / "xq.yaml").write_text(
        "tags: []\n", encoding="utf-8"
    )
    monkeypatch.setenv(ENV, "xq.yaml")
    with pytest.raises(ConfigPathError) as rel:
        resolve_config_path()
    assert rel.value.code == "relative_path"

    # Missing absolute path still accepted (no I/O).
    missing = str(
        tmp_path / "does-not-exist" / "other-name.yaml"
    )
    assert not os.path.exists(missing)
    monkeypatch.setenv(ENV, missing)
    assert resolve_config_path() == missing

    # Trailing whitespace kept (no trimming).
    raw = "/tmp/keep-trailing.yaml "
    monkeypatch.setenv(ENV, raw)
    assert resolve_config_path() == raw
