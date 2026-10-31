from xq_jewy.infrastructure.stub_client import StubClient


class StubService:
    def __init__(self, client: StubClient | None = None) -> None:
        self._client = client or StubClient()

    def create_stub(self, service: str, endpoint: str, response_body: dict) -> dict:
        result = self._client.create_stub(service, endpoint, response_body)
        return {
            "service": service,
            "endpoint": endpoint,
            "status": "created" if result["status_code"] < 400 else "failed",
            "upstream": result,
        }

    def update_stub(self, service: str, endpoint: str, response_body: dict) -> dict:
        result = self.create_stub(service, endpoint, response_body)
        result["status"] = "updated" if result["status"] == "created" else "failed"
        return result

    def reset_stubs(self, service: str) -> dict:
        result = self._client.reset_stubs(service)
        return {
            "service": service,
            "status": "reset" if result["status_code"] < 400 else "failed",
        }

    def verify_stub(self, service: str, endpoint: str) -> dict:
        result = self._client.get_stub_calls(service, endpoint)
        calls = result.get("calls", [])
        return {
            "service": service,
            "endpoint": endpoint,
            "called": bool(calls),
            "call_count": len(calls) if isinstance(calls, list) else 0,
            "status_code": result["status_code"],
        }
