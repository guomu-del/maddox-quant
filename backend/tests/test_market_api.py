from app.core.ttl_cache import TtlCache
from app.services import market_service
from tests.test_market_service import FakeProvider


def test_market_overview_api(client, monkeypatch):
    market_service.reset_market_cache_for_tests(TtlCache(ttl_seconds=30))
    monkeypatch.setattr(market_service, "_provider", FakeProvider())
    response = client.get("/api/market/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["stats"]["up_count"] == 2
    assert body["indices"][0]["code"] == "000001"
    assert "as_of" in body


def test_market_stocks_api_search(client, monkeypatch):
    market_service.reset_market_cache_for_tests(TtlCache(ttl_seconds=30))
    monkeypatch.setattr(market_service, "_provider", FakeProvider())
    response = client.get("/api/market/stocks", params={"q": "宁德", "page_size": 10})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["code"] == "300750"


def test_market_boards_api(client, monkeypatch):
    market_service.reset_market_cache_for_tests(TtlCache(ttl_seconds=30))
    monkeypatch.setattr(market_service, "_provider", FakeProvider())
    response = client.get("/api/market/boards")
    assert response.status_code == 200
    assert response.json()["items"][0]["name"] == "银行"


def test_market_source_error_without_cache(client, monkeypatch):
    market_service.reset_market_cache_for_tests(TtlCache(ttl_seconds=30))
    provider = FakeProvider()
    provider.fail_stocks = True
    monkeypatch.setattr(market_service, "_provider", provider)
    response = client.get("/api/market/stocks")
    assert response.status_code == 502
    assert response.json()["code"] == "market_source_error"
