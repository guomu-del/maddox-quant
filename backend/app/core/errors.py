from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        detail: str,
        code: str = "app_error",
        status_code: int = 400,
        extra: dict | None = None,
    ):
        self.detail = detail
        self.code = code
        self.status_code = status_code
        self.extra = extra or {}
        super().__init__(detail)


def error_response(
    *,
    status_code: int,
    detail: str,
    code: str,
    extra: dict | None = None,
) -> JSONResponse:
    content: dict[str, object] = {"detail": detail, "code": code}
    if extra:
        content.update(extra)
    return JSONResponse(status_code=status_code, content=content)


def _normalize_detail(detail: object) -> tuple[str, str, dict]:
    if isinstance(detail, dict):
        message = str(detail.get("detail") or detail.get("message") or "Request failed")
        code = str(detail.get("code") or "http_error")
        extra = {k: v for k, v in detail.items() if k not in {"detail", "code", "message"}}
        return message, code, extra
    return str(detail), "http_error", {}


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return error_response(
        status_code=exc.status_code,
        detail=exc.detail,
        code=exc.code,
        extra=exc.extra or None,
    )


async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail, code, extra = _normalize_detail(exc.detail)
    return error_response(status_code=exc.status_code, detail=detail, code=code, extra=extra or None)


async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    messages = []
    for err in exc.errors():
        loc = ".".join(str(part) for part in err.get("loc", []) if part != "body")
        messages.append(f"{loc}: {err.get('msg')}" if loc else str(err.get("msg")))
    detail = "; ".join(messages) or "Validation failed"
    return error_response(status_code=422, detail=detail, code="validation_error")


async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return error_response(
        status_code=500,
        detail="Internal server error",
        code="internal_error",
    )
