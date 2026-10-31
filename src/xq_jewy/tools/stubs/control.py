from fastmcp.tools import tool

from xq_jewy.services.stub_service import StubService

_service: StubService | None = None


def _stubs() -> StubService:
    global _service
    if _service is None:
        _service = StubService()
    return _service


@tool(tags={"stub", "control"})
def create_stub(service: str, endpoint: str, response_body: dict) -> dict:
    """Create a test stub on the stub server.

    Args:
        service: Target service name.
        endpoint: Endpoint to stub.
        response_body: Response the stub should return.
    """
    return _stubs().create_stub(service, endpoint, response_body)


@tool(tags={"stub", "control"})
def update_stub(service: str, endpoint: str, response_body: dict) -> dict:
    """Update an existing test stub.

    Args:
        service: Target service name.
        endpoint: Endpoint to update.
        response_body: New response the stub should return.
    """
    return _stubs().update_stub(service, endpoint, response_body)


@tool(tags={"stub", "control"})
def reset_stubs(service: str) -> dict:
    """Reset all stubs for a service.

    Args:
        service: Target service name.
    """
    return _stubs().reset_stubs(service)
