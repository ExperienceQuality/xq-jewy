from fastmcp.tools import tool

from xq_jewy.services.verification_service import VerificationService

_service: VerificationService | None = None


def _verify() -> VerificationService:
    global _service
    if _service is None:
        _service = VerificationService()
    return _service


@tool(tags={"verification", "schema"})
def verify_schema(response: dict, required_fields: list[str]) -> dict:
    """Assert a captured response body contains all required fields.

    Args:
        response: Response dict as returned by send_request.
        required_fields: Field names that must be present in the body.
    """
    return _verify().verify_schema(response, required_fields).model_dump()
