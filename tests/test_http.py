import httpx

from xq_jewy.server import create_server


async def test_health_endpoint():
    app = create_server().http_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        response = await http.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
