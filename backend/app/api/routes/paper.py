from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.paper import (
    PaperAccountResponse,
    PaperOrderCreate,
    PaperOrderResponse,
    PaperPositionResponse,
    PaperTradeResponse,
)
from app.services.paper_broker import broker

router = APIRouter(prefix="/api/paper", tags=["paper"])


@router.get("/account", response_model=PaperAccountResponse)
def get_account(db: Session = Depends(get_db)):
    broker.match_pending(db)
    return broker.get_account(db)


@router.post("/account/reset", response_model=PaperAccountResponse)
def reset_account(db: Session = Depends(get_db)):
    return broker.reset_account(db)


@router.get("/positions", response_model=list[PaperPositionResponse])
def list_positions(db: Session = Depends(get_db)):
    broker.match_pending(db)
    return broker.list_positions(db)


@router.get("/orders", response_model=list[PaperOrderResponse])
def list_orders(
    status: str | None = None,
    code: str | None = None,
    db: Session = Depends(get_db),
):
    broker.match_pending(db)
    return broker.list_orders(db, status=status, code=code)


@router.get("/trades", response_model=list[PaperTradeResponse])
def list_trades(code: str | None = None, db: Session = Depends(get_db)):
    return broker.list_trades(db, code=code)


@router.post("/orders", response_model=PaperOrderResponse)
def place_order(payload: PaperOrderCreate, db: Session = Depends(get_db)):
    return broker.place_order(
        db,
        code=payload.code,
        side=payload.side,
        order_type=payload.order_type,
        price=payload.price,
        quantity=payload.quantity,
    )


@router.post("/orders/{order_id}/cancel", response_model=PaperOrderResponse)
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    return broker.cancel_order(db, order_id)
