def test_import_and_preview_when_disk_is_read_only(client, sample_pdf_bytes, monkeypatch):
    from app.api.routes import reports as reports_routes

    def persist_without_disk(content: bytes, storage_path: str):
        from app.services.pdf_parser import compute_file_hash

        digest = compute_file_hash(content)
        return f"{digest}.pdf", digest, content

    monkeypatch.setattr(reports_routes, "persist_pdf", persist_without_disk)
    created = client.post(
        "/api/reports/import",
        data={"title": "只读磁盘导入"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
        headers={"Origin": "https://maddox-quant.vercel.app"},
    )
    assert created.status_code == 201, created.text
    report_id = created.json()["id"]
    response = client.get(
        f"/api/reports/{report_id}/file",
        headers={"Origin": "https://maddox-quant.vercel.app"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert "inline" in response.headers.get("content-disposition", "").lower()
    assert response.content[:4] == b"%PDF"


def test_report_file_is_served_inline(client, sample_pdf_bytes):
    created = client.post(
        "/api/reports/import",
        data={"title": "预览测试报告"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    ).json()

    response = client.get(f"/api/reports/{created['id']}/file")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    disposition = response.headers.get("content-disposition", "")
    assert "inline" in disposition.lower()
    assert "attachment" not in disposition.lower()
    assert response.content[:4] == b"%PDF"
