from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import check_database_connection

app = FastAPI(title="Maddox Quant API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    db_ok = check_database_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "error",
    }
