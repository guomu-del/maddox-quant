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
