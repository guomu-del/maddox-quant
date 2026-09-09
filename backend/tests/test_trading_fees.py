from app.services.trading_fees import commission, stamp_tax


def test_commission_floor():
    assert commission(1000) == 5
    assert commission(100_000) == 30


def test_stamp_tax_sell_only():
    assert stamp_tax("buy", 10_000) == 0
    assert stamp_tax("sell", 10_000) == 5
