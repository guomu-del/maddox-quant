from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.watchlist import Watchlist
from app.schemas.watchlist import WatchlistCreate, WatchlistResponse

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("", response_model=list[WatchlistResponse])
def list_watchlist(db: Session = Depends(get_db)):
    items = db.scalars(select(Watchlist).order_by(Watchlist.created_at.desc())).all()
    return items


@router.post("", response_model=WatchlistResponse, status_code=201)
def add_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db)):
    item = Watchlist(
        target_type=payload.target_type,
        target_code=payload.target_code,
        target_name=payload.target_name or payload.target_code,
        note=payload.note,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Already watching this target")
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def remove_watchlist(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Watchlist, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    db.delete(item)
    db.commit()
