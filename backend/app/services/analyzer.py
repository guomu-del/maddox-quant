import json

from app.models.report import Report
from app.schemas.analysis import AnalysisOutput
from app.services.llm_client import chat_completion

SYSTEM_PROMPT = (
    "你是一位专业证券分析师。请阅读研报内容，输出严格 JSON，字段包括："
    "summary(200字以内摘要), sentiment(bullish|neutral|bearish), "
    "investment_thesis(核心投资逻辑), metrics(数组，元素含 name/value/context), "
    "factors(数组，元素含 name/direction(positive|negative|neutral)/description), "
    "risks(字符串数组)。不要输出 JSON 以外的任何文字。"
)

MAX_INPUT_CHARS = 12000
MAX_VALIDATION_RETRIES = 2


def _build_user_prompt(report: Report) -> str:
    body = report.full_text or report.summary or ""
    if len(body) > MAX_INPUT_CHARS:
        body = body[:MAX_INPUT_CHARS]
    return f"标题：{report.title}\n\n正文：\n{body}"


async def analyze_report(report: Report) -> tuple[AnalysisOutput, dict]:
    if not report.full_text and not report.summary:
        raise ValueError("Report has no text content to analyze")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(report)},
    ]

    last_error: Exception | None = None
    for _ in range(MAX_VALIDATION_RETRIES + 1):
        raw = await chat_completion(messages, json_mode=True)
        try:
            parsed = json.loads(raw)
            output = AnalysisOutput.model_validate(parsed)
            return output, parsed
        except Exception as exc:
            last_error = exc
            messages.append({"role": "assistant", "content": raw})
            messages.append(
                {
                    "role": "user",
                    "content": "输出格式无效，请仅返回符合 schema 的 JSON。",
                }
            )

    raise ValueError(f"Failed to parse LLM output: {last_error}")
