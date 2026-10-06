from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin_sources import router as admin_sources_router
from app.api.routes.aggregation import router as aggregation_router
from app.api.routes.analysis import router as analysis_router
from app.api.routes.market import router as market_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.paper import router as paper_router
from app.api.routes.quant import router as quant_router
from app.api.routes.reports import router as reports_router
from app.api.routes.watchlist import router as watchlist_router
from app.core.config import settings
from app.core.database import check_database_connection
from app.core.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.runtime import scheduler_enabled

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.tasks.event_detector import run_event_detection
    from app.tasks.scheduler import reload_collect_schedules, scheduler

    started = False
    if scheduler is not None:
        try:
            scheduler.add_job(
                run_event_detection,
                "interval",
                minutes=5,
                id="event_detection",
                replace_existing=True,
            )
            scheduler.start()
            started = True
            reload_collect_schedules()
        except Exception:
            logger.exception("Background scheduler failed to start")
    try:
        yield
    finally:
        if started and scheduler is not None:
            try:
                scheduler.shutdown(wait=False)
            except Exception:
                logger.exception("Background scheduler failed to stop")


_app_kwargs: dict = {"title": "Maddox Quant API", "version": "1.0.0"}
if scheduler_enabled():
    _app_kwargs["lifespan"] = lifespan

app = FastAPI(**_app_kwargs)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

_cors_origins = [
    origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()
]
_production_frontend = "https://maddox-quant.vercel.app"
if _production_frontend not in _cors_origins:
    _cors_origins.append(_production_frontend)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports_router)
app.include_router(market_router)
app.include_router(analysis_router)
app.include_router(aggregation_router)
app.include_router(watchlist_router)
app.include_router(notifications_router)
app.include_router(admin_sources_router)
app.include_router(paper_router)
app.include_router(quant_router)


@app.get("/health")
def health():
    try:
        db_ok = check_database_connection()
    except Exception:
        logger.exception("Health check could not reach the database")
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "error",
    }
