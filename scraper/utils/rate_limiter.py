"""Rate-limiting utilities for scraper sources."""

from __future__ import annotations

import threading
import time
from typing import Dict, Optional

from scraper.config import RATE_LIMITS

# Module-level singleton registry
_limiters: Dict[str, "RateLimiter"] = {}
_lock: threading.Lock = threading.Lock()


class RateLimiter:
    """Simple token-bucket-style rate limiter for a named source."""

    def __init__(self, source: str, requests_per_second: float) -> None:
        self.source = source
        self.requests_per_second = requests_per_second
        self._min_interval = 1.0 / requests_per_second if requests_per_second > 0 else 0.0
        self._last_call: Optional[float] = None
        self._lock = threading.Lock()

    def wait(self) -> None:
        """Block until the next request is allowed, then record the call time."""
        with self._lock:
            now = time.time()
            if self._last_call is not None:
                elapsed = now - self._last_call
                remaining = self._min_interval - elapsed
                if remaining > 0:
                    time.sleep(remaining)
            self._last_call = time.time()


def get_limiter(source: str) -> RateLimiter:
    """Return the singleton RateLimiter for *source*, creating it if needed.

    Configuration is read from ``scraper.config.RATE_LIMITS``.
    """
    with _lock:
        if source not in _limiters:
            config = RATE_LIMITS.get(source, {})
            rps = config.get("requests_per_second", 1.0)
            _limiters[source] = RateLimiter(source, rps)
        return _limiters[source]
