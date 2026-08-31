def test_add_watchlist(client):
    response = client.post(
        "/api/watchlist",
        json={
            "target_type": "industry",
            "target_code": "new_energy",
            "target_name": "新能源",
            "note": "重点关注",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["target_code"] == "new_energy"
    assert data["target_name"] == "新能源"


def test_add_duplicate_watchlist_returns_409(client):
    payload = {
        "target_type": "industry",
        "target_code": "semiconductor",
        "target_name": "半导体",
    }
    assert client.post("/api/watchlist", json=payload).status_code == 201
    assert client.post("/api/watchlist", json=payload).status_code == 409


def test_list_and_delete_watchlist(client):
    created = client.post(
        "/api/watchlist",
        json={"target_type": "stock", "target_code": "300750", "target_name": "宁德时代"},
    ).json()

    items = client.get("/api/watchlist").json()
    assert any(item["id"] == created["id"] for item in items)

    assert client.delete(f"/api/watchlist/{created['id']}").status_code == 204
    items_after = client.get("/api/watchlist").json()
    assert all(item["id"] != created["id"] for item in items_after)


def test_new_report_triggers_notification(client, sample_pdf_bytes):
    client.post(
        "/api/watchlist",
        json={"target_type": "industry", "target_code": "新能源", "target_name": "新能源"},
    )
    client.post(
        "/api/reports/import",
        data={"title": "新能源周报", "industries": "新能源"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )

    unread = client.get("/api/notifications/unread-count").json()
    assert unread["count"] >= 1

    notifications = client.get("/api/notifications").json()
    assert notifications["total"] >= 1
    assert notifications["items"][0]["event"]["event_type"] == "new_report"


def test_mark_notification_read(client, sample_pdf_bytes):
    client.post(
        "/api/watchlist",
        json={"target_type": "stock", "target_code": "600519", "target_name": "贵州茅台"},
    )
    client.post(
        "/api/reports/import",
        data={"title": "白酒行业跟踪", "stocks": "600519"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )

    notification = client.get("/api/notifications").json()["items"][0]
    updated = client.patch(f"/api/notifications/{notification['id']}/read").json()
    assert updated["is_read"] is True

    assert client.patch("/api/notifications/read-all").status_code == 200
