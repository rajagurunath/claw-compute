from fastapi.testclient import TestClient

from claw_api.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
