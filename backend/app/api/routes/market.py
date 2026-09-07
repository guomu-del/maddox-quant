from fastapi import APIRouter, Query

from app.schemas.market import BoardListResponse, MarketOverviewResponse, StockListResponse
from app.services import market_service

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/overview", response_model=MarketOverviewResponse)
def market_overview():
    return market_service.get_overview()


@router.get("/stocks", response_model=StockListResponse)
def market_stocks(
    q: str | None = None,
    sort: str = Query("change_pct"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    return market_service.get_stocks(q=q, sort=sort, order=order, page=page, page_size=page_size)


@router.get("/boards", response_model=BoardListResponse)
def market_boards(type: str = Query("industry")):
    if type != "industry":
        from app.core.errors import AppError

        raise AppError("暂仅支持行业板块", code="invalid_board_type", status_code=400)
    return market_service.get_boards()
