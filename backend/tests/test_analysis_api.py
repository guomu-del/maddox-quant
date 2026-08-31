import json

import pytest

from app.core.config import settings
from app.schemas.analysis import AnalysisOutput


def _import_parsed_report(client, sample_pdf_bytes) -> int:
    response = client.post(
        "/api/reports/import",
        data={"title": "分析测试报告", "industries": "新能源"},
        files={"file": ("report.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 201
    report_id = response.json()["id"]
    report = client.get(f"/api/reports/{report_id}").json()
    assert report["status"] == "parsed"
    return report_id


def test_analyze_requires_llm_key(client, sample_pdf_bytes, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "")
    report_id = _import_parsed_report(client, sample_pdf_bytes)
    response = client.post(f"/api/reports/{report_id}/analyze")
    assert response.status_code == 503


def test_start_analysis_creates_job(client, sample_pdf_bytes, monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    async def fake_analyze(report):
        output = AnalysisOutput(
            summary="测试摘要",
            sentiment="neutral",
            investment_thesis="中性看待",
            metrics=[],
            factors=[],
            risks=["测试风险"],
        )
        return output, output.model_dump()

    monkeypatch.setattr("app.tasks.analyze_report.analyze_report", fake_analyze)

    report_id = _import_parsed_report(client, sample_pdf_bytes)
    response = client.post(f"/api/reports/{report_id}/analyze")
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    job = client.get(f"/api/analysis/jobs/{job_id}").json()
    assert job["status"] == "done"

    analysis = client.get(f"/api/reports/{report_id}/analysis").json()
    assert analysis["sentiment"] == "neutral"
    assert analysis["investment_thesis"] == "中性看待"
