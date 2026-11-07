"""SC-02c config file unit tests (#15 / #20)."""

from __future__ import annotations

import os
import stat
import time
from pathlib import Path

import pytest

from xq_jewy.services.config_file import (
    MAX_CONFIG_BYTES,
    ConfigFileError,
    load_config_file,
)

BOM = b"\xef\xbb\xbf"


def _fd_count() -> int:
    try:
        return len(os.listdir(f"/proc/{os.getpid()}/fd"))
    except FileNotFoundError:
        return len(os.listdir("/dev/fd"))


def _write(path: Path, data: bytes) -> str:
    path.write_bytes(data)
    return str(path)


def test_qa_unit_02_exact_1mib_without_bom_ok(
    tmp_path: Path,
) -> None:
    """QA-UNIT-02: exactly 1 MiB raw bytes OK."""
    prefix = b"k: "
    body = b"x" * (MAX_CONFIG_BYTES - len(prefix))
    data = prefix + body
    assert len(data) == MAX_CONFIG_BYTES
    path = _write(tmp_path / "ok.yaml", data)
    result = load_config_file(path)
    assert result == {"k": "x" * len(body)}


def test_qa_unit_02_one_over_1mib_without_bom(
    tmp_path: Path,
) -> None:
    """QA-UNIT-02: 1 MiB + 1 -> too_large."""
    data = b"k: " + b"x" * (MAX_CONFIG_BYTES - 3 + 1)
    assert len(data) == MAX_CONFIG_BYTES + 1
    path = _write(tmp_path / "big.yaml", data)
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(path)
    assert ei.value.code == "too_large"


def test_qa_unit_02_exact_1mib_with_bom_ok(
    tmp_path: Path,
) -> None:
    """QA-UNIT-02: BOM counts; total 1 MiB OK."""
    prefix = BOM + b"k: "
    body = b"x" * (MAX_CONFIG_BYTES - len(prefix))
    data = prefix + body
    assert len(data) == MAX_CONFIG_BYTES
    path = _write(tmp_path / "bom.yaml", data)
    result = load_config_file(path)
    assert result == {"k": "x" * len(body)}


def test_qa_unit_02_one_over_1mib_with_bom(
    tmp_path: Path,
) -> None:
    """QA-UNIT-02: BOM + content > 1 MiB."""
    prefix = BOM + b"k: "
    body = b"x" * (MAX_CONFIG_BYTES - len(prefix) + 1)
    data = prefix + body
    assert len(data) == MAX_CONFIG_BYTES + 1
    path = _write(tmp_path / "bom_big.yaml", data)
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(path)
    assert ei.value.code == "too_large"


def test_qa_unit_03_directory_rejected_no_read(
    tmp_path: Path,
) -> None:
    """QA-UNIT-03: directory -> not_a_file."""
    before = _fd_count()
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(str(tmp_path))
    assert ei.value.code == "not_a_file"
    assert _fd_count() <= before


def test_qa_unit_03_fifo_rejected_without_read(
    tmp_path: Path,
) -> None:
    """QA-UNIT-03: FIFO -> not_a_file, no hang."""
    fifo = tmp_path / "pipe"
    os.mkfifo(fifo)
    before = _fd_count()
    t0 = time.monotonic()
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(str(fifo))
    elapsed = time.monotonic() - t0
    assert ei.value.code == "not_a_file"
    assert elapsed < 1.0
    assert _fd_count() <= before


def test_qa_unit_03_device_rejected_without_read() -> None:
    """QA-UNIT-03: char device -> not_a_file."""
    before = _fd_count()
    with pytest.raises(ConfigFileError) as ei:
        load_config_file("/dev/null")
    assert ei.value.code == "not_a_file"
    assert _fd_count() <= before


def test_qa_unit_03_fd_closed_on_success(
    tmp_path: Path,
) -> None:
    """QA-UNIT-03: success path closes descriptor."""
    path = _write(tmp_path / "ok.yaml", b"a: 1\n")
    before = _fd_count()
    assert load_config_file(path) == {"a": 1}
    assert _fd_count() <= before


def test_qa_unit_04_utf8_with_bom(
    tmp_path: Path,
) -> None:
    """QA-UNIT-04: UTF-8 with optional BOM."""
    path = _write(
        tmp_path / "bom.yaml",
        BOM + "你好: 世界\n".encode(),
    )
    assert load_config_file(path) == {"你好": "世界"}


def test_qa_unit_04_utf8_without_bom(
    tmp_path: Path,
) -> None:
    """QA-UNIT-04: plain UTF-8 mapping."""
    path = _write(
        tmp_path / "utf8.yaml",
        "café: crème\n".encode(),
    )
    assert load_config_file(path) == {"café": "crème"}


def test_qa_unit_04_decode_error(
    tmp_path: Path,
) -> None:
    """QA-UNIT-04: invalid UTF-8 -> decode_error."""
    path = _write(
        tmp_path / "bad.yaml",
        b"a: \xff\xfe\n",
    )
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(path)
    assert ei.value.code == "decode_error"


@pytest.mark.parametrize(
    ("content", "code"),
    [
        (b"a: !custom 1\n", "unsafe_yaml"),
        (b"a: &x 1\nb: *x\n", "unsafe_yaml"),
        (
            b"a:\n  <<: {k: 1}\n  m: 2\n",
            "unsafe_yaml",
        ),
        (b"a: 1\na: 2\n", "duplicate_key"),
        (
            b"a: 1\n---\nb: 2\n",
            "multiple_documents",
        ),
        (b"- 1\n- 2\n", "not_a_mapping"),
        (b"hello\n", "not_a_mapping"),
        (b"", "not_a_mapping"),
        (b"[:}\n", "yaml_syntax"),
    ],
    ids=[
        "custom_tag",
        "alias",
        "merge_key",
        "duplicate_key",
        "multiple_documents",
        "list_root",
        "scalar_root",
        "empty_root",
        "yaml_syntax",
    ],
)
def test_qa_unit_06_07_restricted_yaml(
    tmp_path: Path,
    content: bytes,
    code: str,
) -> None:
    """QA-UNIT-06/07: restricted YAML codes."""
    path = _write(tmp_path / "c.yaml", content)
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(path)
    assert ei.value.code == code


def test_not_found(tmp_path: Path) -> None:
    missing = tmp_path / "missing.yaml"
    with pytest.raises(ConfigFileError) as ei:
        load_config_file(str(missing))
    assert ei.value.code == "not_found"


def test_unreadable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = _write(tmp_path / "x.yaml", b"a: 1\n")
    os.chmod(path, 0)

    def _deny(*_a: object, **_k: object) -> int:
        raise PermissionError("denied")

    monkeypatch.setattr(os, "open", _deny)
    try:
        with pytest.raises(ConfigFileError) as ei:
            load_config_file(str(path))
        assert ei.value.code == "unreadable"
    finally:
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
