def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert body["database"] == "ok"


def test_stats(client):
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "active_connections",
        "unique_destinations",
        "countries_connected",
        "total_connections",
    ):
        assert key in body


def test_config(client):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    body = resp.json()
    assert "map_style_url" in body
    assert "origin" in body
    assert "latitude" in body["origin"]


def test_connection_filter_validation(client):
    # min_risk out of range should be rejected.
    resp = client.get("/api/connections", params={"min_risk": 9999})
    assert resp.status_code == 422
    # invalid sort field rejected
    resp = client.get("/api/connections", params={"sort_by": "nonsense"})
    assert resp.status_code == 422


def test_connections_pagination_shape(client):
    resp = client.get("/api/connections", params={"limit": 5, "offset": 0})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}


def test_settings_roundtrip(client):
    resp = client.patch("/api/settings", json={"settings": {"theme": "dark"}})
    assert resp.status_code == 200
    assert resp.json().get("theme") == "dark"
    resp = client.get("/api/settings")
    assert resp.json().get("theme") == "dark"


def test_alerts_export(client):
    resp = client.get("/api/export/alerts.csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
