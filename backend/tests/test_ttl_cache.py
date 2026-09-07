import threading
import time

from app.core.ttl_cache import TtlCache


def test_miss_returns_none():
    cache = TtlCache(ttl_seconds=10)
    assert cache.get("missing") is None


def test_hit_returns_fresh_value():
    cache = TtlCache(ttl_seconds=10)
    cache.set("k", 42)
    assert cache.get("k") == 42


def test_expired_get_is_none_but_stale_remains():
    cache = TtlCache(ttl_seconds=0.05)
    cache.set("k", "old")
    time.sleep(0.08)
    assert cache.get("k") is None
    assert cache.get_stale("k") == "old"


def test_get_or_load_calls_loader_once():
    cache = TtlCache(ttl_seconds=10)
    calls = {"n": 0}

    def loader():
        calls["n"] += 1
        return "value"

    first, stale1 = cache.get_or_load("k", loader)
    second, stale2 = cache.get_or_load("k", loader)
    assert first == "value" and second == "value"
    assert stale1 is False and stale2 is False
    assert calls["n"] == 1


def test_get_or_load_returns_stale_when_loader_fails():
    cache = TtlCache(ttl_seconds=0.05)
    cache.set("k", "cached")
    time.sleep(0.08)

    def loader():
        raise RuntimeError("source down")

    value, stale = cache.get_or_load("k", loader)
    assert value == "cached"
    assert stale is True


def test_get_or_load_raises_when_no_stale_and_loader_fails():
    cache = TtlCache(ttl_seconds=10)

    def loader():
        raise RuntimeError("source down")

    try:
        cache.get_or_load("k", loader)
        raise AssertionError("expected RuntimeError")
    except RuntimeError as exc:
        assert "source down" in str(exc)


def test_single_flight_only_one_loader_call():
    cache = TtlCache(ttl_seconds=10)
    calls = {"n": 0}
    started = threading.Event()
    release = threading.Event()

    def loader():
        calls["n"] += 1
        started.set()
        release.wait(timeout=2)
        return "shared"

    results: list[tuple[str, bool]] = []

    def worker():
        results.append(cache.get_or_load("k", loader))

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start()
    assert started.wait(timeout=2)
    t2.start()
    time.sleep(0.05)
    release.set()
    t1.join(timeout=2)
    t2.join(timeout=2)
    assert calls["n"] == 1
    assert results == [("shared", False), ("shared", False)]
