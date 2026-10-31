from fastmcp.tools import tool

from xq_jewy.services.rest_service import RestService

_service: RestService | None = None


def _rest() -> RestService:
    global _service
    if _service is None:
        _service = RestService()
    return _service


@tool(tags={"rest", "http"})
def send_request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: dict | None = None,
) -> dict:
    """Execute a single HTTP request.

    Args:
        url: Target endpoint.
        method: HTTP method (GET, POST, PUT, DELETE, ...).
        headers: Optional request headers.
        body: Optional JSON request body.
    """
    return _rest().send_request(url=url, method=method, headers=headers, body=body)


@tool(tags={"rest", "http"})
def send_requests(requests: list[dict]) -> list[dict]:
    """Execute multiple HTTP requests in order.

    Args:
        requests: List of request dicts with keys url, method, headers, body.
    """
    return _rest().send_requests(requests)
