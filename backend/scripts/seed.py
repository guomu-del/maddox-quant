#!/usr/bin/env python3
"""Load industry and stock reference dictionaries from CSV into PostgreSQL."""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal  # noqa: E402
from app.models.reference import ReferenceItem  # noqa: E402

DATA_DIR = ROOT / "data"


def _load_csv(path: Path, item_type: str) -> list[ReferenceItem]:
    items: list[ReferenceItem] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            code = (row.get("code") or "").strip()
            name = (row.get("name") or "").strip()
            if not code or not name:
                continue
            items.append(ReferenceItem(item_type=item_type, code=code, name=name))
    return items


def seed(db=None) -> int:
    industries = _load_csv(DATA_DIR / "industries.csv", "industry")
    stocks = _load_csv(DATA_DIR / "stocks.csv", "stock")
    all_items = industries + stocks

    owns_session = db is None
    db = db or SessionLocal()
    inserted = 0
    try:
        for item in all_items:
            existing = db.scalar(
                select(ReferenceItem.id).where(
                    ReferenceItem.item_type == item.item_type,
                    ReferenceItem.code == item.code,
                )
            )
            if existing:
                continue
            db.add(item)
            inserted += 1
        db.commit()
    finally:
        if owns_session:
            db.close()

    return inserted


def main() -> None:
    count = seed()
    print(f"Seed complete: {count} new reference items inserted.")


if __name__ == "__main__":
    main()
