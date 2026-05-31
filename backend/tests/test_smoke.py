"""Smoke tests that exercise the app end to end against a local SQLite database.

Using TestClient as a context manager runs the FastAPI lifespan, so this also
covers table creation and scheduler startup, not just route handlers.
"""

from fastapi.testclient import TestClient

from app.main import app


def test_health_check_reports_healthy():
    with TestClient(app) as client:
        resp = client.get("/api/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["service"] == "diatrack-api"


def test_device_types_enum():
    with TestClient(app) as client:
        resp = client.get("/api/enums/device-types")

    assert resp.status_code == 200
    values = {item["value"] for item in resp.json()}
    assert {"sensor", "catheter"} <= values


def test_body_locations_enum_is_non_empty():
    with TestClient(app) as client:
        resp = client.get("/api/enums/body-locations")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"value", "label"} <= set(data[0].keys())


def test_unknown_api_route_is_not_swallowed_by_frontend():
    with TestClient(app) as client:
        resp = client.get("/api/does-not-exist")

    # API paths must not fall through to the SPA catch-all.
    assert resp.json() == {"detail": "Not Found"}
