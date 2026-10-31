from xq_jewy.infrastructure.http_client import HttpClient


class RestService:
    def __init__(self, http: HttpClient | None = None) -> None:
        self._http = http or HttpClient()

    def send_request(
        self,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        body: dict | None = None,
    ) -> dict:
        resp = self._http.request(
            method=method.upper(), url=url, headers=headers, json_body=body
        )
        try:
            payload = resp.json()
        except ValueError:
            payload = resp.text
        return {
            "url": url,
            "method": method.upper(),
            "status_code": resp.status_code,
            "headers": dict(resp.headers),
            "body": payload,
        }

    def send_requests(self, requests: list[dict]) -> list[dict]:
        return [self.send_request(**req) for req in requests]
