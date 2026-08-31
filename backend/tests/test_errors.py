def test_error_response_format(client):
    response = client.post(
        "/api/reports/import",
        data={"title": "bad"},
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert response.status_code == 400
    body = response.json()
    assert "detail" in body
    assert "code" in body
    assert body["code"] == "invalid_file_type"


def test_file_size_limit(client, monkeypatch, sample_pdf_bytes):
    from app.api.routes import reports as reports_routes

    monkeypatch.setattr(reports_routes.settings, "max_upload_mb", 0)

    response = client.post(
        "/api/reports/import",
        data={"title": "too large"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 413
    body = response.json()
    assert body["code"] == "file_too_large"
    assert "detail" in body


def test_duplicate_report_error_includes_existing_id(client, sample_pdf_bytes):
    payload = {
        "title": "Dup test",
        "files": {"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    }
    assert client.post("/api/reports/import", data={"title": payload["title"]}, files=payload["files"]).status_code == 201

    response = client.post("/api/reports/import", data={"title": "Dup test 2"}, files=payload["files"])
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "duplicate_report"
    assert "existing_report_id" in body
