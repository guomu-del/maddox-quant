from sqlalchemy import func, select

from app.models.reference import ReferenceItem


def test_seed_inserts_reference_items(db_session):
    from scripts.seed import seed

    inserted = seed(db_session)
    assert inserted >= 10

    total = db_session.scalar(select(func.count()).select_from(ReferenceItem)) or 0
    industries = db_session.scalar(
        select(func.count()).select_from(ReferenceItem).where(ReferenceItem.item_type == "industry")
    ) or 0
    stocks = db_session.scalar(
        select(func.count()).select_from(ReferenceItem).where(ReferenceItem.item_type == "stock")
    ) or 0
    assert total >= 10
    assert industries >= 5
    assert stocks >= 5

    second_run = seed(db_session)
    assert second_run == 0
