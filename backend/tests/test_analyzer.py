import json

import pytest

from app.models.report import Report
from app.schemas.analysis import AnalysisOutput
from app.services.analyzer import analyze_report


SAMPLE_LLM_JSON = {
    "summary": "新能源行业维持高景气，龙头盈利能力强。",
    "sentiment": "bullish",
    "investment_thesis": "政策支持下需求持续释放，龙头市占率提升。",
    "metrics": [{"name": "PE", "value": "25x", "context": "2025E"}],
    "factors": [
        {
            "name": "政策利好",
            "direction": "positive",
            "description": "补贴政策延续",
        }
    ],
    "risks": ["原材料价格波动", "竞争加剧"],
}


@pytest.mark.asyncio
async def test_analyze_report_parses_llm_output(monkeypatch):
    report = Report(
        title="新能源深度报告",
        full_text="行业维持高景气，龙头公司业绩超预期。",
        status="parsed",
    )

    async def fake_chat_completion(messages, json_mode=True):
        return json.dumps(SAMPLE_LLM_JSON)

    monkeypatch.setattr("app.services.analyzer.chat_completion", fake_chat_completion)

    output, raw = await analyze_report(report)
    assert isinstance(output, AnalysisOutput)
    assert output.sentiment == "bullish"
    assert len(output.metrics) == 1
    assert raw["summary"] == SAMPLE_LLM_JSON["summary"]


@pytest.mark.asyncio
async def test_analyze_report_requires_text():
    report = Report(title="空报告", status="parsed")
    with pytest.raises(ValueError, match="no text content"):
        await analyze_report(report)
