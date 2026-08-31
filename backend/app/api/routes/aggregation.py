from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.aggregation import (
    IndustryAnalysisResponse,
    OverviewResponse,
    StockAnalysisResponse,
)
from app.services.aggregation import (
    get_industry_analysis,
    get_overview,
    get_stock_analysis,
)

router = APIRouter(prefix="/api/analysis", tags=["aggregation"])


@router.get("/overview", response_model=OverviewResponse)
def analysis_overview(db: Session = Depends(get_db)):
    return get_overview(db)


@router.get("/industry/{code}", response_model=IndustryAnalysisResponse)
def analysis_by_industry(code: str, db: Session = Depends(get_db)):
    return get_industry_analysis(db, code)


@router.get("/stock/{code}", response_model=StockAnalysisResponse)
def analysis_by_stock(code: str, db: Session = Depends(get_db)):
    return get_stock_analysis(db, code)
