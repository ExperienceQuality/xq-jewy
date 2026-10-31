from fastmcp.tools import tool

from xq_jewy.services.verification_service import VerificationService

_service: VerificationService | None = None


def _verify() -> VerificationService:
    global _service
    if _service is None:
        _service = VerificationService()
    return _service


@tool(tags={"verification", "assertion"})
def verify_status(response: dict, expected: int) -> dict:
    """Assert a captured response has the expected status code.

    Args:
        response: Response dict as returned by send_request.
        expected: Expected HTTP status code.
    """
    return _verify().verify_status(response, expected).model_dump()


@tool(tags={"verification", "assertion"})
def verify_headers(response: dict, expected: dict[str, str]) -> dict:
    """Assert a captured response contains expected headers.

    Args:
        response: Response dict as returned by send_request.
        expected: Header names and values that must match.
    """
    return _verify().verify_headers(response, expected).model_dump()


@tool(tags={"verification", "assertion"})
def verify_body(response: dict, expected: dict) -> dict:
    """Assert a captured response body contains expected field values.

    Args:
        response: Response dict as returned by send_request.
        expected: Field names and values that must match.
    """
    return _verify().verify_body(response, expected).model_dump()
