import pytest

from app.schemas.market import StockQuote
from app.services import paper_broker as paper_broker_module


def _quote(code: str) -> StockQuote:
    return StockQuote(code=code, name="测试", last=100.0)


@pytest.fixture(autouse=True)
def mock_quote_getter(monkeypatch):
    monkeypatch.setattr(paper_broker_module.broker, "_get_quote", _quote)


def test_post_market_buy_returns_filled_order(client):
    response = client.post(
        "/api/paper/orders",
        json={
            "code": "600519",
            "side": "buy",
            "order_type": "market",
            "price": None,
            "quantity": 100,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "filled"


def test_post_limit_order_then_cancel(client):
    created = client.post(
        "/api/paper/orders",
        json={
            "code": "600519",
            "side": "buy",
            "order_type": "limit",
            "price": 90,
            "quantity": 100,
        },
    )

    assert created.status_code == 200
    assert created.json()["status"] == "pending"
    cancelled = client.post(
        f"/api/paper/orders/{created.json()['id']}/cancel"
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_get_positions_orders_trades_and_account(client):
    client.post(
        "/api/paper/orders",
        json={
            "code": "600519",
            "side": "buy",
            "order_type": "market",
            "price": None,
            "quantity": 100,
        },
    )

    positions = client.get("/api/paper/positions")
    orders = client.get("/api/paper/orders?status=filled&code=600519")
    trades = client.get("/api/paper/trades?code=600519")
    account = client.get("/api/paper/account")

    assert positions.status_code == 200
    assert positions.json()[0]["quantity"] == 100
    assert len(orders.json()) == 1
    assert len(trades.json()) == 1
    assert account.json()["equity"] == 999_995


def test_reset_restores_starting_cash(client):
    client.post(
        "/api/paper/orders",
        json={
            "code": "600519",
            "side": "buy",
            "order_type": "market",
            "price": None,
            "quantity": 100,
        },
    )

    response = client.post("/api/paper/account/reset")

    assert response.status_code == 200
    assert response.json()["cash"] == 1_000_000
    assert response.json()["frozen"] == 0
    assert client.get("/api/paper/positions").json() == []
