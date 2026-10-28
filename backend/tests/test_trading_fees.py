from app.services.trading_fees import commission, stamp_tax


def test_commission_floor():
    assert commission(1000) == 5
    assert commission(100_000) == 30


def test_stamp_tax_sell_only():
    assert stamp_tax("buy", 10_000) == 0
    assert stamp_tax("sell", 10_000) == 5


def test_commission_uses_custom_rate_and_minimum():
    assert commission(100_000, rate=0.001, minimum=0) == 100
    assert commission(1_000, rate=0.0003, minimum=8) == 8
    assert commission(100_000, rate=0, minimum=0) == 0


def test_stamp_tax_uses_custom_rate():
    assert stamp_tax("sell", 10_000, rate=0.001) == 10
    assert stamp_tax("buy", 10_000, rate=0.001) == 0
    assert stamp_tax("sell", 10_000, rate=0) == 0
