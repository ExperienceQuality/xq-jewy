from fastmcp.tools import tool

from xq_jewy.services.stub_service import StubService

_service: StubService | None = None


def _stubs() -> StubService:
    global _service
    if _service is None:
        _service = StubService()
    return _service


@tool(tags={"stub", "verification"})
def verify_stub(service: str, endpoint: str) -> dict:
    """Verify a stub endpoint received calls.

    Args:
        service: Target service name.
        endpoint: Endpoint to check for recorded calls.
    """
    return _stubs().verify_stub(service, endpoint)
