from __future__ import annotations

import threading
import time
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


class TtlCache:
    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._store: dict[str, tuple[float, Any]] = {}
        self._inflight: dict[str, threading.Event] = {}
        self._inflight_error: dict[str, BaseException] = {}

    def get(self, key: str) -> Any | None:
        with self._lock:
            return self._fresh_unlocked(key)

    def get_stale(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            return None if entry is None else entry[1]

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.monotonic() + self._ttl, value)

    def get_or_load(self, key: str, loader: Callable[[], T]) -> tuple[T, bool]:
        with self._lock:
            fresh = self._fresh_unlocked(key)
            if fresh is not None:
                return fresh, False
            event = self._inflight.get(key)
            is_waiter = event is not None
            if event is None:
                event = threading.Event()
                self._inflight[key] = event

        if is_waiter:
            event.wait(timeout=max(self._ttl, 120))
            fresh = self.get(key)
            if fresh is not None:
                return fresh, False
            stale = self.get_stale(key)
            if stale is not None:
                return stale, True
            error = self._inflight_error.get(key)
            if error is not None:
                raise error
            raise RuntimeError(f"cache load did not complete for {key}")

        try:
            value = loader()
            self.set(key, value)
            return value, False
        except BaseException as exc:
            stale = self.get_stale(key)
            if stale is not None:
                return stale, True
            self._inflight_error[key] = exc
            raise
        finally:
            with self._lock:
                self._inflight.pop(key, None)
            event.set()

    def _fresh_unlocked(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            return None
        return value
