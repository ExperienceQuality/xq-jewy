"""Subprocess harness for ``xq-jewy`` SC-03 tests."""

from __future__ import annotations

import contextlib
import json
import os
import selectors
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

WORKTREE_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_STARTUP = (
    WORKTREE_ROOT / "tests" / "fixtures" / "startup"
)

# Newline-delimited JSON-RPC (mcp.server.stdio).
_DEFAULT_PROTOCOL_VERSION = "2024-11-05"


@dataclass(frozen=True)
class ProcResult:
    """Captured subprocess outcome."""

    exit_code: int | None
    stdout: bytes
    stderr: bytes
    timed_out: bool = False


def fixture_path(name: str) -> Path:
    """Absolute path under fixtures/startup."""
    path = (FIXTURES_STARTUP / name).resolve()
    root = FIXTURES_STARTUP.resolve()
    if not path.is_relative_to(root):
        raise ValueError(
            f"fixture escapes startup dir: {name}"
        )
    return path


def resolve_xq_jewy_command() -> list[str]:
    """Prefer uv run; else PATH console script."""
    uv = shutil.which("uv")
    if uv is not None:
        return [
            uv,
            "run",
            "--project",
            str(WORKTREE_ROOT),
            "xq-jewy",
        ]
    script = shutil.which("xq-jewy")
    if script is not None:
        return [script]
    raise RuntimeError(
        "neither uv nor xq-jewy found on PATH"
    )


def base_env(*, clear_xq: bool = True) -> dict[str, str]:
    """Copy env; optionally strip XQ_JEWY_*."""
    env = dict(os.environ)
    if clear_xq:
        for key in list(env):
            if key.startswith("XQ_JEWY_"):
                del env[key]
    return env


def run_xq_jewy(
    *,
    env: dict[str, str] | None = None,
    stdin_bytes: bytes | None = None,
    timeout: float = 5.0,
    cwd: str | Path | None = None,
) -> ProcResult:
    """Spawn xq-jewy; capture stdout/stderr/exit."""
    cmd = resolve_xq_jewy_command()
    run_cwd = (
        str(cwd) if cwd is not None else str(WORKTREE_ROOT)
    )
    try:
        completed = subprocess.run(
            cmd,
            input=stdin_bytes,
            capture_output=True,
            env=env if env is not None else base_env(),
            cwd=run_cwd,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return ProcResult(
            exit_code=None,
            stdout=exc.stdout or b"",
            stderr=exc.stderr or b"",
            timed_out=True,
        )
    return ProcResult(
        exit_code=completed.returncode,
        stdout=completed.stdout or b"",
        stderr=completed.stderr or b"",
        timed_out=False,
    )


def mcp_initialize_message(
    *,
    protocol_version: str = _DEFAULT_PROTOCOL_VERSION,
    request_id: int = 1,
) -> bytes:
    """One NDJSON JSON-RPC initialize request."""
    payload = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "initialize",
        "params": {
            "protocolVersion": protocol_version,
            "capabilities": {},
            "clientInfo": {
                "name": "xq-jewy-system-test",
                "version": "0.0.0",
            },
        },
    }
    body = json.dumps(payload, separators=(",", ":"))
    return (body + "\n").encode("utf-8")


def speak_mcp_initialize(
    *,
    env: dict[str, str] | None = None,
    timeout: float = 5.0,
    cwd: str | Path | None = None,
) -> tuple[ProcResult, dict | None]:
    """
    Spawn xq-jewy, send initialize, read one line.

    Keeps the process until timeout or exit, then
    terminates. Returns (ProcResult, parsed result).
    """
    cmd = resolve_xq_jewy_command()
    run_cwd = (
        str(cwd) if cwd is not None else str(WORKTREE_ROOT)
    )
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env if env is not None else base_env(),
        cwd=run_cwd,
        bufsize=0,
    )
    assert proc.stdin is not None
    assert proc.stdout is not None
    assert proc.stderr is not None

    parsed: dict | None = None
    stdout_buf = bytearray()
    timed_out = False
    try:
        proc.stdin.write(mcp_initialize_message())
        proc.stdin.flush()
        # Keep stdin open (EOF can stop stdio servers).
        line = _readline_with_timeout(proc.stdout, timeout)
        if line is None:
            timed_out = True
        else:
            stdout_buf.extend(line)
            text = line.decode(
                "utf-8", errors="replace"
            ).strip()
            if text:
                parsed = json.loads(text)
            initialized = {
                "jsonrpc": "2.0",
                "method": ("notifications/initialized"),
                "params": {},
            }
            note = json.dumps(
                initialized, separators=(",", ":")
            )
            proc.stdin.write((note + "\n").encode("utf-8"))
            proc.stdin.flush()
            # Brief grace: should still be serving.
            with contextlib.suppress(
                subprocess.TimeoutExpired
            ):
                proc.wait(timeout=0.2)
    finally:
        _terminate(proc)

    stderr = proc.stderr.read() if proc.stderr else b""
    remainder = proc.stdout.read() if proc.stdout else b""
    stdout_buf.extend(remainder)
    return (
        ProcResult(
            exit_code=proc.returncode,
            stdout=bytes(stdout_buf),
            stderr=stderr or b"",
            timed_out=timed_out,
        ),
        parsed,
    )


def run_python_import(
    module: str,
    *,
    timeout: float = 5.0,
) -> ProcResult:
    """Import module in a fresh interpreter."""
    cmd = [sys.executable, "-c", f"import {module}"]
    # Prefer uv so the worktree package is used.
    uv = shutil.which("uv")
    if uv is not None:
        cmd = [
            uv,
            "run",
            "--project",
            str(WORKTREE_ROOT),
            "python",
            "-c",
            f"import {module}",
        ]
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            env=base_env(),
            cwd=str(WORKTREE_ROOT),
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return ProcResult(
            exit_code=None,
            stdout=exc.stdout or b"",
            stderr=exc.stderr or b"",
            timed_out=True,
        )
    return ProcResult(
        exit_code=completed.returncode,
        stdout=completed.stdout or b"",
        stderr=completed.stderr or b"",
        timed_out=False,
    )


def assert_config_failure_contract(
    result: ProcResult,
) -> None:
    """
    Config failure contract (#11 / #22):

    exit 1, zero stdout, one stderr line naming
    XQ_JEWY_CONFIG, no traceback.
    """
    assert not result.timed_out, (
        "timed out; expected fast config exit"
    )
    assert result.exit_code == 1, (
        f"exit_code={result.exit_code!r}"
    )
    assert result.stdout == b"", (
        f"stdout not empty: {result.stdout!r}"
    )
    stderr_text = result.stderr.decode(
        "utf-8", errors="replace"
    )
    assert "Traceback" not in stderr_text, stderr_text
    lines = [
        ln for ln in stderr_text.splitlines() if ln.strip()
    ]
    assert len(lines) == 1, (
        f"expected one stderr line, got {lines!r}"
    )
    assert "XQ_JEWY_CONFIG" in lines[0], lines[0]


def _readline_with_timeout(
    stream, timeout: float
) -> bytes | None:
    """Read one line with a wall-clock timeout."""
    sel = selectors.DefaultSelector()
    sel.register(stream, selectors.EVENT_READ)
    deadline = time.monotonic() + timeout
    buf = bytearray()
    try:
        while time.monotonic() < deadline:
            wait = max(0.0, deadline - time.monotonic())
            events = sel.select(wait)
            if not events:
                continue
            chunk = stream.read(1)
            if chunk == b"":
                break
            buf.extend(chunk)
            if chunk == b"\n":
                return bytes(buf)
        return None if not buf else bytes(buf)
    finally:
        sel.close()


def _terminate(proc: subprocess.Popen[bytes]) -> None:
    if proc.poll() is not None:
        return
    try:
        proc.send_signal(signal.SIGTERM)
        with contextlib.suppress(subprocess.TimeoutExpired):
            proc.wait(timeout=1.0)
            return
        proc.kill()
        proc.wait(timeout=1.0)
    except ProcessLookupError:
        pass
