import os

from xq_jewy.infrastructure.http_client import HttpClient

STUB_BASE_URL_ENV = "XQ_JEWY_STUB_BASE_URL"


class StubClient:
    """Client for an external stub/mock control server.

    Base URL comes from XQ_JEWY_STUB_BASE_URL at call time, never from
    consumer YAML (no credentials or endpoints in config files).
    """

    def __init__(self, http: HttpClient | None = None) -> None:
        self._http = http or HttpClient()

    @staticmethod
    def _base_url() -> str:
        base = os.environ.get(STUB_BASE_URL_ENV)
        if not base:
            msg = f"{STUB_BASE_URL_ENV} is not set"
            raise RuntimeError(msg)
        return base.rstrip("/")

    def create_stub(self, service: str, endpoint: str, response_body: dict) -> dict:
        resp = self._http.request(
            "POST",
            f"{self._base_url()}/stubs",
            json_body={
                "service": service,
                "endpoint": endpoint,
                "response": response_body,
            },
        )
        return {"status_code": resp.status_code, "body": resp.json()}

    def reset_stubs(self, service: str) -> dict:
        resp = self._http.request("DELETE", f"{self._base_url()}/stubs/{service}")
        return {"status_code": resp.status_code}

    def get_stub_calls(self, service: str, endpoint: str) -> dict:
        resp = self._http.request(
            "GET",
            f"{self._base_url()}/stubs/{service}/calls",
            headers=None,
        )
        return {
            "status_code": resp.status_code,
            "endpoint": endpoint,
            "calls": resp.json(),
        }
