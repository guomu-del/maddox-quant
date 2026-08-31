from app.core.config import settings


def test_overview_returns_counts(client):
    response = client.get("/api/analysis/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_reports" in data
    assert "analyzed_count" in data
    assert "sentiment_distribution" in data
    assert "top_industries" in data
    assert "top_factors" in data
    assert "report_trend" in data


def test_overview_with_data(client, sample_pdf_bytes, db_session, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    client.post(
        "/api/reports/import",
        data={"title": "新能源行业报告", "industries": "新能源"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )

    overview = client.get("/api/analysis/overview").json()
    assert overview["total_reports"] >= 1
    assert any(item["name"] == "新能源" for item in overview["top_industries"])


def test_industry_analysis(client, sample_pdf_bytes):
    client.post(
        "/api/reports/import",
        data={"title": "半导体深度", "industries": "半导体", "stocks": "688981"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )

    response = client.get("/api/analysis/industry/半导体")
    assert response.status_code == 200
    data = response.json()
    assert data["industry"] == "半导体"
    assert data["total_reports"] >= 1
    assert len(data["reports"]) >= 1


def test_stock_analysis(client, sample_pdf_bytes):
    client.post(
        "/api/reports/import",
        data={"title": "宁德时代研究", "industries": "新能源", "stocks": "300750"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )

    response = client.get("/api/analysis/stock/300750")
    assert response.status_code == 200
    data = response.json()
    assert data["stock"] == "300750"
    assert data["total_reports"] >= 1
