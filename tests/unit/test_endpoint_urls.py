"""QA-UNIT-09 (URL layer) / #14 + #19.

Validation-only cases for SC-02b.
Required-vs-optional enforcement (ACC-10/11/12,
missing_env, loader/SYS) belongs to #16 —
deferred.
"""

from __future__ import annotations

import pytest

from xq_jewy.domain.endpoints import (
    EndpointConfiguration,
)
from xq_jewy.services.endpoint_urls import (
    ENV_API,
    ENV_WIREMOCK,
    EndpointUrlError,
    load_endpoint_urls,
)

_VALID = "http://127.0.0.1:8080"
_VALID_WM = "http://127.0.0.1:8081"


# --- QA-UNIT-09: absent → None ---


def test_qa_unit_09_absent_both_none() -> None:
    """QA-UNIT-09: unset vars become null."""
    cfg = load_endpoint_urls({})
    assert cfg == EndpointConfiguration(
        api_base_url=None,
        wiremock_base_url=None,
    )


def test_qa_unit_09_absent_one_other_valid() -> None:
    """QA-UNIT-09: each unset field is None."""
    cfg = load_endpoint_urls({ENV_API: _VALID})
    assert cfg.api_base_url == _VALID
    assert cfg.wiremock_base_url is None

    cfg2 = load_endpoint_urls({ENV_WIREMOCK: _VALID_WM})
    assert cfg2.api_base_url is None
    assert cfg2.wiremock_base_url == _VALID_WM


# --- QA-UNIT-09: empty → empty_env ---


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
@pytest.mark.parametrize(
    "env_name",
    [ENV_API, ENV_WIREMOCK],
)
def test_qa_unit_09_empty_is_empty_env(
    env_name: str,
    value: str,
) -> None:
    """QA-UNIT-09 / ACC-12 proxy: empty → empty_env."""
    with pytest.raises(EndpointUrlError) as exc:
        load_endpoint_urls({env_name: value})
    assert exc.value.code == "empty_env"
    assert env_name in str(exc.value)


# --- QA-UNIT-09: invalid → invalid_url ---


@pytest.mark.parametrize(
    "bad",
    [
        "not-a-url",
        "ftp://example.com",
        "example.com",
        "//example.com",
        "http://",
        "https://",
        "http:///path",
        "http://example.com?",
        "http://example.com?x=1",
        "http://example.com#",
        "http://example.com#frag",
        "http://user@example.com",
        "http://user:pass@example.com",
        "http://example.com/path with space",
        "http://example.com/path\\slash",
        "http://example.com/path%ZZ",
        "http://example.com/path%2",
        "http://example.com/path%",
        "http://example.com:0",
        "http://example.com:65536",
        "http://example.com:",
        "http://::1",
        "http://[::1",
        "http://exam ple.com",
        " http://example.com",
        "http://example.com ",
        "http://example.com\n",
    ],
    ids=[
        "bare",
        "ftp",
        "no-scheme",
        "scheme-relative",
        "http-empty-host",
        "https-empty-host",
        "empty-authority",
        "empty-query",
        "query",
        "empty-fragment",
        "fragment",
        "userinfo",
        "userinfo-pass",
        "unescaped-space",
        "backslash",
        "bad-percent-zz",
        "bad-percent-short",
        "bad-percent-lone",
        "port-zero",
        "port-too-high",
        "empty-port",
        "ipv6-unbracketed",
        "ipv6-unclosed",
        "host-space",
        "leading-space",
        "trailing-space",
        "control-newline",
    ],
)
def test_qa_unit_09_malformed_invalid_url(
    bad: str,
) -> None:
    """QA-UNIT-09 / ACC-12: malformed → invalid_url."""
    # Present URL always validated (even if unneeded).
    with pytest.raises(EndpointUrlError) as exc:
        load_endpoint_urls({ENV_API: bad})
    assert exc.value.code == "invalid_url"
    msg = str(exc.value)
    assert ENV_API in msg
    assert bad not in msg


def test_qa_unit_09_wiremock_redacted() -> None:
    """QA-UNIT-09: invalid_url message is redacted."""
    bad = "http://user:secret@evil.example/leak"
    with pytest.raises(EndpointUrlError) as exc:
        load_endpoint_urls(
            {ENV_API: _VALID, ENV_WIREMOCK: bad}
        )
    assert exc.value.code == "invalid_url"
    msg = str(exc.value)
    assert ENV_WIREMOCK in msg
    assert bad not in msg
    assert "secret" not in msg
    assert "evil.example" not in msg


# --- QA-UNIT-09: API before WireMock ---


def test_qa_unit_09_api_before_wiremock() -> None:
    """QA-UNIT-09: first error is API when both bad."""
    with pytest.raises(EndpointUrlError) as empty_both:
        load_endpoint_urls({ENV_API: "", ENV_WIREMOCK: ""})
    assert empty_both.value.code == "empty_env"
    assert ENV_API in str(empty_both.value)

    with pytest.raises(EndpointUrlError) as invalid_both:
        load_endpoint_urls(
            {
                ENV_API: "not-a-url",
                ENV_WIREMOCK: "also-bad",
            }
        )
    assert invalid_both.value.code == "invalid_url"
    assert ENV_API in str(invalid_both.value)
    assert "also-bad" not in str(invalid_both.value)

    with pytest.raises(
        EndpointUrlError
    ) as api_empty_wm_bad:
        load_endpoint_urls(
            {
                ENV_API: " ",
                ENV_WIREMOCK: "not-a-url",
            }
        )
    assert api_empty_wm_bad.value.code == "empty_env"
    assert ENV_API in str(api_empty_wm_bad.value)


# --- QA-UNIT-09: valid kept as-is ---


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost",
        "http://localhost:8080",
        "https://api.example.com",
        "https://api.example.com:443/v1",
        "http://127.0.0.1:8080",
        "http://192.168.0.1/path/",
        "http://[::1]",
        "http://[::1]:8080",
        "http://[2001:db8::1]:9/base/",
        "HTTP://Example.COM/Path",
        "https://example.com/a%20b/",
        "http://example.com/",
        "http://example.com/prefix/v2",
    ],
)
def test_qa_unit_09_valid_kept_verbatim(
    url: str,
) -> None:
    """QA-UNIT-09: valid http(s) kept unchanged."""
    cfg = load_endpoint_urls(
        {ENV_API: url, ENV_WIREMOCK: _VALID_WM}
    )
    assert cfg.api_base_url == url
    assert cfg.wiremock_base_url == _VALID_WM


def test_qa_unit_09_both_valid() -> None:
    """QA-UNIT-09: both valid → EndpointConfiguration."""
    cfg = load_endpoint_urls(
        {ENV_API: _VALID, ENV_WIREMOCK: _VALID_WM}
    )
    assert isinstance(cfg, EndpointConfiguration)
    assert cfg.api_base_url == _VALID
    assert cfg.wiremock_base_url == _VALID_WM


# --- Deferred: ACC-10/11/12 + SYS need #16 ---


def test_qa_acc_sys_deferred_note() -> None:
    """ACC/SYS full-loader cases deferred to #16."""
    assert True
