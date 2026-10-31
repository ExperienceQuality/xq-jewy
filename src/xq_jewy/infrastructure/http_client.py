import httpx


class HttpClient:
    """Lazy httpx wrapper. Connection pool created on first request."""

    def __init__(self, timeout: float = 30.0) -> None:
        self._timeout = timeout
        self._client: httpx.Client | None = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=self._timeout)
        return self._client

    def request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        json_body: object = None,
    ) -> httpx.Response:
        return self.client.request(
            method=method, url=url, headers=headers, json=json_body
        )

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
