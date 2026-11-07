"""Read and validate endpoint base URL env vars (SC-02b)."""

from __future__ import annotations

import ipaddress
import os
import re
from collections.abc import Mapping

from xq_jewy.domain.endpoints import EndpointConfiguration

ENV_API = "XQ_JEWY_API_BASE_URL"
ENV_WIREMOCK = "XQ_JEWY_WIREMOCK_BASE_URL"

_HEX = frozenset("0123456789abcdefABCDEF")
_DNS_LABEL = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$"
)


class EndpointUrlError(Exception):
    """Endpoint URL failure with stable ``code``."""

    def __init__(
        self, code: str, message: str = ""
    ) -> None:
        self.code = code
        super().__init__(message or code)


def load_endpoint_urls(
    environ: Mapping[str, str] | None = None,
) -> EndpointConfiguration:
    """Load nullable API / WireMock base URLs from env.

    Absent → None. Present empty/whitespace →
    ``empty_env``. Present malformed →
    ``invalid_url`` (message redacted). Validates
    API before WireMock. No defaults, YAML, or DNS.
    """
    env = os.environ if environ is None else environ
    api = _read_one(env, ENV_API)
    wiremock = _read_one(env, ENV_WIREMOCK)
    return EndpointConfiguration(
        api_base_url=api,
        wiremock_base_url=wiremock,
    )


def _read_one(
    env: Mapping[str, str], name: str
) -> str | None:
    if name not in env:
        return None
    value = env[name]
    if value == "" or value.strip() == "":
        raise EndpointUrlError(
            "empty_env",
            f"{name} is empty",
        )
    if not _is_valid_base_url(value):
        raise EndpointUrlError(
            "invalid_url",
            f"{name} is not a valid base URL",
        )
    return value


def _is_valid_base_url(value: str) -> bool:
    if _has_forbidden_chars(value):
        return False
    if not _percent_escapes_ok(value):
        return False

    lower = value.lower()
    if lower.startswith("https://"):
        rest = value[8:]
    elif lower.startswith("http://"):
        rest = value[7:]
    else:
        return False

    if not rest:
        return False

    slash = rest.find("/")
    authority = rest if slash < 0 else rest[:slash]
    if not authority or "@" in authority:
        return False

    return _authority_ok(authority)


def _has_forbidden_chars(value: str) -> bool:
    for ch in value:
        o = ord(ch)
        if o < 0x20 or o == 0x7F:
            return True
        if ch.isspace() or ch in "?#\\":
            return True
    return False


def _percent_escapes_ok(value: str) -> bool:
    i = 0
    n = len(value)
    while i < n:
        if value[i] != "%":
            i += 1
            continue
        if i + 2 >= n:
            return False
        if (
            value[i + 1] not in _HEX
            or value[i + 2] not in _HEX
        ):
            return False
        i += 3
    return True


def _authority_ok(authority: str) -> bool:
    if authority.startswith("["):
        close = authority.find("]")
        if close < 1:
            return False
        literal = authority[1:close]
        after = authority[close + 1 :]
        try:
            ipaddress.IPv6Address(literal)
        except ValueError:
            return False
        return _port_suffix_ok(after)

    if ":" in authority:
        host, port_str = authority.rsplit(":", 1)
        if not host or ":" in host:
            return False
        if not _port_str_ok(port_str):
            return False
    else:
        host = authority

    return _host_ok(host)


def _port_suffix_ok(after: str) -> bool:
    if after == "":
        return True
    if not after.startswith(":"):
        return False
    return _port_str_ok(after[1:])


def _port_str_ok(port_str: str) -> bool:
    if not port_str or not port_str.isdigit():
        return False
    port = int(port_str)
    return 1 <= port <= 65535


def _host_ok(host: str) -> bool:
    if not host:
        return False
    try:
        ipaddress.IPv4Address(host)
        return True
    except ValueError:
        pass
    return _dns_name_ok(host)


def _dns_name_ok(host: str) -> bool:
    name = host[:-1] if host.endswith(".") else host
    if not name or len(name) > 253:
        return False
    labels = name.split(".")
    if any(not label for label in labels):
        return False
    return all(_DNS_LABEL.match(label) for label in labels)
