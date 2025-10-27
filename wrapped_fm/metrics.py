"""Wrapped counter persistence helpers."""

from __future__ import annotations

import threading
from pathlib import Path

from .config import WRAPPED_COUNT_FILE

wrapped_count_lock = threading.Lock()


def _ensure_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("0")


def _read_wrapped_count_unlocked() -> int:
    try:
        return int(WRAPPED_COUNT_FILE.read_text().strip() or "0")
    except FileNotFoundError:
        _ensure_file(WRAPPED_COUNT_FILE)
        return 0
    except ValueError:
        WRAPPED_COUNT_FILE.write_text("0")
        return 0


def read_wrapped_count() -> int:
    with wrapped_count_lock:
        return _read_wrapped_count_unlocked()


def increment_wrapped_count(delta: int = 1) -> int:
    with wrapped_count_lock:
        count = _read_wrapped_count_unlocked() + max(delta, 0)
        WRAPPED_COUNT_FILE.write_text(str(count))
        return count
