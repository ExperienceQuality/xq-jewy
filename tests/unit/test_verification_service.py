from xq_jewy.services.verification_service import VerificationService


def _response() -> dict:
    return {
        "status_code": 200,
        "headers": {"Content-Type": "application/json"},
        "body": {"id": 1, "name": "david"},
    }


def test_verify_status_pass():
    svc = VerificationService()
    result = svc.verify_status(_response(), 200)
    assert result.passed


def test_verify_status_fail():
    svc = VerificationService()
    result = svc.verify_status(_response(), 404)
    assert not result.passed
    assert result.actual == 200


def test_verify_headers_case_insensitive():
    svc = VerificationService()
    result = svc.verify_headers(_response(), {"content-type": "application/json"})
    assert result.passed


def test_verify_body_mismatch_reports_diff():
    svc = VerificationService()
    result = svc.verify_body(_response(), {"name": "other"})
    assert not result.passed
    assert result.detail["mismatched"]["name"]["actual"] == "david"


def test_verify_schema_missing_field():
    svc = VerificationService()
    result = svc.verify_schema(_response(), ["id", "missing_field"])
    assert not result.passed
    assert result.detail["missing_fields"] == ["missing_field"]
