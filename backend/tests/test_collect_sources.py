from app.services.collectors.base import CollectedItem


def test_create_collect_source(client):
    response = client.post(
        "/api/admin/sources",
        json={
            "name": "测试 RSS 源",
            "source_type": "rss",
            "url": "https://example.com/feed.xml",
            "cron_expr": "0 8 * * *",
            "parser": "rss",
            "is_enabled": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "测试 RSS 源"
    assert data["parser"] == "rss"


def test_list_update_delete_collect_source(client):
    created = client.post(
        "/api/admin/sources",
        json={
            "name": "源 A",
            "url": "https://example.com/a.xml",
        },
    ).json()

    items = client.get("/api/admin/sources").json()
    assert any(item["id"] == created["id"] for item in items)

    updated = client.put(
        f"/api/admin/sources/{created['id']}",
        json={"name": "源 A 更新", "is_enabled": False},
    ).json()
    assert updated["name"] == "源 A 更新"
    assert updated["is_enabled"] is False

    assert client.delete(f"/api/admin/sources/{created['id']}").status_code == 204
    items_after = client.get("/api/admin/sources").json()
    assert all(item["id"] != created["id"] for item in items_after)


def test_run_collect_source_imports_pdf(client, sample_pdf_bytes, monkeypatch, tmp_path):
    from app.services import report_importer
    from app.services.collectors import rss_collector

    monkeypatch.setattr(report_importer.settings, "storage_path", str(tmp_path))

    def mock_fetch(self):
        return [
            CollectedItem(
                title="自动采集研报",
                pdf_url="https://example.com/report.pdf",
                source=self.source_name,
            )
        ]

    monkeypatch.setattr(rss_collector.RssCollector, "fetch", mock_fetch)
    monkeypatch.setattr("app.services.collector_runner.download_pdf", lambda _url: sample_pdf_bytes)
    monkeypatch.setattr("app.services.collector_runner.parse_report_task", lambda _id: None)

    source = client.post(
        "/api/admin/sources",
        json={"name": "PoC RSS", "url": "https://example.com/feed.xml"},
    ).json()

    result = client.post(f"/api/admin/sources/{source['id']}/run?sync=true").json()
    assert result["status"] == "success"
    assert result["items_found"] == 1
    assert result["items_new"] == 1

    reports = client.get("/api/reports").json()
    assert reports["total"] >= 1
    assert any(r["title"] == "自动采集研报" for r in reports["items"])

    logs = client.get(f"/api/admin/sources/{source['id']}/logs").json()
    assert len(logs) >= 1
    assert logs[0]["status"] == "success"


def test_collect_deduplicates_existing_pdf(client, sample_pdf_bytes, monkeypatch, tmp_path):
    from app.services import report_importer
    from app.services.collectors import rss_collector

    monkeypatch.setattr(report_importer.settings, "storage_path", str(tmp_path))

    def mock_fetch(self):
        return [
            CollectedItem(
                title="重复研报",
                pdf_url="https://example.com/report.pdf",
                source=self.source_name,
            )
        ]

    monkeypatch.setattr(rss_collector.RssCollector, "fetch", mock_fetch)
    monkeypatch.setattr("app.services.collector_runner.download_pdf", lambda _url: sample_pdf_bytes)
    monkeypatch.setattr("app.services.collector_runner.parse_report_task", lambda _id: None)

    source = client.post(
        "/api/admin/sources",
        json={"name": "Dedup RSS", "url": "https://example.com/feed.xml"},
    ).json()

    first = client.post(f"/api/admin/sources/{source['id']}/run?sync=true").json()
    second = client.post(f"/api/admin/sources/{source['id']}/run?sync=true").json()

    assert first["items_new"] == 1
    assert second["items_new"] == 0
