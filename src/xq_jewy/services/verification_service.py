import json
from typing import Any

from xq_jewy.domain.models.assertion import AssertionResult


class VerificationService:
    """Pure verification logic on captured response dicts. No HTTP here."""

    def verify_status(self, response: dict, expected: int) -> AssertionResult:
        actual = response.get("status_code")
        return AssertionResult(
            check="status",
            passed=actual == expected,
            expected=expected,
            actual=actual,
        )

    def verify_headers(
        self, response: dict, expected: dict[str, str]
    ) -> AssertionResult:
        headers = {k.lower(): v for k, v in (response.get("headers") or {}).items()}
        missing = {k: v for k, v in expected.items() if headers.get(k.lower()) != v}
        return AssertionResult(
            check="headers",
            passed=not missing,
            expected=expected,
            actual=response.get("headers"),
            detail={"mismatched": missing},
        )

    def verify_body(self, response: dict, expected: dict[str, Any]) -> AssertionResult:
        body = response.get("body") or {}
        mismatched = {
            k: {"expected": v, "actual": body.get(k)}
            for k, v in expected.items()
            if not isinstance(body, dict) or body.get(k) != v
        }
        return AssertionResult(
            check="body",
            passed=not mismatched,
            expected=expected,
            actual=body,
            detail={"mismatched": mismatched},
        )

    def verify_schema(
        self, response: dict, required_fields: list[str]
    ) -> AssertionResult:
        body = response.get("body")
        missing = [
            f for f in required_fields if not isinstance(body, dict) or f not in body
        ]
        return AssertionResult(
            check="schema",
            passed=not missing,
            expected=required_fields,
            actual=list(body.keys()) if isinstance(body, dict) else body,
            detail={"missing_fields": missing},
        )

    @staticmethod
    def _as_json(value: Any) -> str:
        return json.dumps(value, sort_keys=True, default=str)
