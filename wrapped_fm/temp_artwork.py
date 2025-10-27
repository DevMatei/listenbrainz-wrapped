"""Temporary custom artwork storage."""

from __future__ import annotations

import threading
import time
from secrets import token_urlsafe
from typing import Dict, Tuple

from .config import TEMP_ARTWORK_TTL_SECONDS


class ArtworkMissingError(Exception):
    """Raised when a requested artwork token does not exist."""


class ArtworkExpiredError(Exception):
    """Raised when a requested artwork has expired."""


_temp_artworks_lock = threading.Lock()
_temp_artworks: Dict[str, Tuple[float, bytes, str]] = {}


def _cleanup_locked() -> None:
    cutoff = time.time() - TEMP_ARTWORK_TTL_SECONDS
    expired = [
        token
        for token, (stored_at, _, _) in _temp_artworks.items()
        if stored_at < cutoff
    ]
    for token in expired:
        _temp_artworks.pop(token, None)


def store_artwork(data: bytes, content_type: str) -> str:
    """Persist temporary artwork bytes and return a retrieval token."""
    now = time.time()
    token = token_urlsafe(12)
    with _temp_artworks_lock:
        _cleanup_locked()
        _temp_artworks[token] = (now, data, content_type)
    return token


def fetch_artwork(token: str) -> Tuple[bytes, str]:
    """Return artwork bytes and mime type or raise if unavailable."""
    with _temp_artworks_lock:
        _cleanup_locked()
        entry = _temp_artworks.get(token)
        if not entry:
            raise ArtworkMissingError
        stored_at, data, content_type = entry
        if time.time() - stored_at > TEMP_ARTWORK_TTL_SECONDS:
            _temp_artworks.pop(token, None)
            raise ArtworkExpiredError
    return data, content_type
