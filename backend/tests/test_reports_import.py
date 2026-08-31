def test_import_report_success(client, sample_pdf_bytes):
    response = client.post(
        "/api/reports/import",
        data={
            "title": "新能源行业深度报告",
            "source": "测试券商",
            "author": "分析师A",
            "industries": "新能源,电力",
            "stocks": "300750",
        },
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "新能源行业深度报告"
    assert data["status"] in {"pending", "parsed"}


def test_import_duplicate_returns_409(client, sample_pdf_bytes):
    payload = {
        "data": {"title": "第一份报告"},
        "files": {"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    }
    first = client.post("/api/reports/import", **payload)
    assert first.status_code == 201

    second = client.post(
        "/api/reports/import",
        data={"title": "重复报告"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert second.status_code == 409
    body = second.json()["detail"]
    assert body["existing_report_id"] == first.json()["id"]


def test_list_reports(client, sample_pdf_bytes):
    client.post(
        "/api/reports/import",
        data={"title": "列表测试报告", "industries": "半导体"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )
    response = client.get("/api/reports")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


def test_get_report_detail(client, sample_pdf_bytes):
    created = client.post(
        "/api/reports/import",
        data={"title": "详情测试报告"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    ).json()

    response = client.get(f"/api/reports/{created['id']}")
    assert response.status_code == 200
    assert response.json()["title"] == "详情测试报告"


def test_search_reports_by_keyword(client, sample_pdf_bytes):
    client.post(
        "/api/reports/import",
        data={"title": "UniqueKeywordXYZ123 报告"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )
    response = client.get("/api/reports", params={"q": "UniqueKeywordXYZ123"})
    assert response.status_code == 200
    assert response.json()["total"] >= 1
