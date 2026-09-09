import pytest
from sqlalchemy import event

from app.core.errors import AppError
from app.models.paper import PaperAccount
from app.schemas.market import StockQuote
from app.services.paper_broker import PaperBroker


def _quote(code: str) -> StockQuote:
    last = {"600519": 100.0, "000001": 10.0}.get(code)
    return StockQuote(code=code, name="测试", last=last)


def test_market_buy_fills_and_debits(db_session):
    pb = PaperBroker(get_quote=_quote)

    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="market",
        price=None,
        quantity=100,
    )

    assert order.status == "filled"
    assert db_session.get(PaperAccount, 1).cash == 989_995
    position = pb.list_positions(db_session)[0]
    assert position.quantity == 100
    assert position.cost_amount == 10_000


def test_limit_buy_stays_pending_and_freezes_cash(db_session):
    pb = PaperBroker(get_quote=_quote)

    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="limit",
        price=90,
        quantity=100,
    )

    account = db_session.get(PaperAccount, 1)
    assert order.status == "pending"
    assert account.cash == 991_000
    assert account.frozen == 9_000


def test_limit_buy_fills_when_last_crosses(db_session):
    prices = {"600519": 100.0}

    def quote(code: str) -> StockQuote:
        return StockQuote(code=code, name="测试", last=prices[code])

    pb = PaperBroker(get_quote=quote)
    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="limit",
        price=90,
        quantity=100,
    )

    prices["600519"] = 89
    pb.match_pending(db_session)
    db_session.refresh(order)

    assert order.status == "filled"
    account = db_session.get(PaperAccount, 1)
    assert account.cash == 991_095
    assert account.frozen == 0


def test_cancel_releases_frozen(db_session):
    pb = PaperBroker(get_quote=_quote)
    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="limit",
        price=90,
        quantity=100,
    )

    pb.cancel_order(db_session, order.id)

    account = db_session.get(PaperAccount, 1)
    assert order.status == "cancelled"
    assert account.cash == 1_000_000
    assert account.frozen == 0


def test_buy_lot_must_be_100(db_session):
    pb = PaperBroker(get_quote=_quote)

    with pytest.raises(AppError) as exc_info:
        pb.place_order(
            db_session,
            code="600519",
            side="buy",
            order_type="market",
            price=None,
            quantity=50,
        )

    assert exc_info.value.code == "invalid_lot"


def test_sell_reduces_position_and_charges_sell_fees(db_session):
    pb = PaperBroker(get_quote=_quote)
    pb.place_order(
        db_session,
        code="000001",
        side="buy",
        order_type="market",
        price=None,
        quantity=200,
    )

    order = pb.place_order(
        db_session,
        code="000001",
        side="sell",
        order_type="market",
        price=None,
        quantity=50,
    )

    assert order.status == "filled"
    position = pb.list_positions(db_session)[0]
    assert position.quantity == 150
    assert position.cost_amount == 1_500
    assert db_session.get(PaperAccount, 1).cash == 998_489.75


def test_market_order_without_last_is_rejected_without_freeze(db_session):
    pb = PaperBroker(
        get_quote=lambda code: StockQuote(code=code, name="测试", last=None)
    )

    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="market",
        price=None,
        quantity=100,
    )

    assert order.status == "rejected"
    assert order.reject_reason
    account = db_session.get(PaperAccount, 1)
    assert account.cash == 1_000_000
    assert account.frozen == 0


def test_account_lists_and_reset(db_session):
    pb = PaperBroker(get_quote=_quote)
    order = pb.place_order(
        db_session,
        code="000001",
        side="buy",
        order_type="market",
        price=None,
        quantity=100,
    )

    account = pb.get_account(db_session)
    assert account.equity == 999_995
    assert [item.id for item in pb.list_orders(db_session)] == [order.id]
    assert len(pb.list_trades(db_session)) == 1

    reset = pb.reset_account(db_session)
    assert reset.cash == 1_000_000
    assert reset.frozen == 0
    assert pb.list_positions(db_session) == []
    assert pb.list_orders(db_session) == []
    assert pb.list_trades(db_session) == []


def test_filled_order_cannot_be_cancelled(db_session):
    pb = PaperBroker(get_quote=_quote)
    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="market",
        price=None,
        quantity=100,
    )

    with pytest.raises(AppError) as exc_info:
        pb.cancel_order(db_session, order.id)

    assert exc_info.value.code == "order_not_cancellable"
    assert exc_info.value.status_code == 409


def test_sell_cannot_exceed_position(db_session):
    pb = PaperBroker(get_quote=_quote)

    with pytest.raises(AppError) as exc_info:
        pb.place_order(
            db_session,
            code="000001",
            side="sell",
            order_type="market",
            price=None,
            quantity=1,
        )

    assert exc_info.value.code == "insufficient_position"


def test_pending_sell_reserves_position_quantity(db_session):
    pb = PaperBroker(get_quote=_quote)
    pb.place_order(
        db_session,
        code="000001",
        side="buy",
        order_type="market",
        price=None,
        quantity=100,
    )

    first_sell = pb.place_order(
        db_session,
        code="000001",
        side="sell",
        order_type="limit",
        price=11,
        quantity=100,
    )

    assert first_sell.status == "pending"
    with pytest.raises(AppError) as exc_info:
        pb.place_order(
            db_session,
            code="000001",
            side="sell",
            order_type="limit",
            price=11,
            quantity=100,
        )

    assert exc_info.value.code == "insufficient_position"


def test_account_and_pending_orders_are_locked_for_mutation(db_session):
    prices = {"600519": 100.0}
    pb = PaperBroker(
        get_quote=lambda code: StockQuote(
            code=code, name="测试", last=prices[code]
        )
    )
    order = pb.place_order(
        db_session,
        code="600519",
        side="buy",
        order_type="limit",
        price=90,
        quantity=100,
    )
    prices["600519"] = 89
    statements: list[str] = []

    def capture_statement(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(db_session.bind, "before_cursor_execute", capture_statement)
    try:
        pb.match_pending(db_session)
    finally:
        event.remove(db_session.bind, "before_cursor_execute", capture_statement)

    assert order.status == "filled"
    account_selects = [
        sql for sql in statements if "FROM paper_accounts" in sql
    ]
    pending_selects = [
        sql
        for sql in statements
        if "FROM paper_orders" in sql and "paper_orders.status" in sql
    ]
    assert any("FOR UPDATE" in sql for sql in account_selects)
    assert any("FOR UPDATE SKIP LOCKED" in sql for sql in pending_selects)


def test_account_marking_only_swallows_market_errors(db_session):
    PaperBroker(get_quote=_quote).place_order(
        db_session,
        code="000001",
        side="buy",
        order_type="market",
        price=None,
        quantity=100,
    )

    def unexpected_failure(code: str) -> StockQuote:
        raise RuntimeError("unexpected bug")

    with pytest.raises(RuntimeError, match="unexpected bug"):
        PaperBroker(get_quote=unexpected_failure).get_account(db_session)
