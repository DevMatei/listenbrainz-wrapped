"""Last.fm statistics helpers."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from flask import abort

from .config import (
    AVERAGE_TRACK_LENGTH_MINUTES,
    IGNORED_TAGS,
    LASTFM_API,
    LASTFM_API_KEY,
    POPULAR_GENRES,
)
from .http import lastfm_session, request_with_handling

LASTFM_PERIOD = "12month"
SECONDS_PER_YEAR = 31_557_600  # 365.25 days
MAX_DURATION_TRACKS = 200
MAX_TAG_RESULTS = 25


def _ensure_lastfm_ready() -> None:
    if not LASTFM_API_KEY:
        abort(503, description="Last.fm support is not configured on this server.")


def _call_lastfm(method: str, params: Optional[Dict[str, str]] = None) -> Dict:
    _ensure_lastfm_ready()
    query = {
        "method": method,
        "api_key": LASTFM_API_KEY,
        "format": "json",
    }
    if params:
        query.update({k: v for k, v in params.items() if v is not None})
    response = request_with_handling(lastfm_session, LASTFM_API, params=query)
    try:
        data = response.json()
    except ValueError:
        abort(502, description="Invalid response from Last.fm")
    error_code = data.get("error")
    if error_code:
        message = data.get("message", "Last.fm request failed")
        if error_code in {6, 7, 29}:
            abort(404, description=message)
        abort(502, description=message)
    return data


def _extract_names(payload: Dict, path: Sequence[str]) -> List[str]:
    node: Iterable = payload
    for key in path:
        if isinstance(node, dict):
            node = node.get(key) or []
        else:
            return []
    if not isinstance(node, list):
        return []
    names: List[str] = []
    for entry in node:
        if isinstance(entry, dict):
            value = entry.get("name")
            if isinstance(value, str) and value.strip():
                names.append(value.strip())
    return names


def get_lastfm_top_artists(username: str, limit: int) -> List[str]:
    payload = _call_lastfm(
        "user.gettopartists",
        {
            "user": username,
            "period": LASTFM_PERIOD,
            "limit": str(limit),
        },
    )
    names = _extract_names(payload, ("topartists", "artist"))
    return names[:limit]


def get_lastfm_top_tracks(username: str, limit: int) -> List[str]:
    payload = _call_lastfm(
        "user.gettoptracks",
        {
            "user": username,
            "period": LASTFM_PERIOD,
            "limit": str(limit),
        },
    )
    names = _extract_names(payload, ("toptracks", "track"))
    return names[:limit]


def get_lastfm_top_albums(username: str, limit: int) -> List[str]:
    payload = _call_lastfm(
        "user.gettopalbums",
        {
            "user": username,
            "period": LASTFM_PERIOD,
            "limit": str(limit),
        },
    )
    names = _extract_names(payload, ("topalbums", "album"))
    return names[:limit]


def _normalise_duration(value: Optional[str]) -> int:
    if not value:
        return int(AVERAGE_TRACK_LENGTH_MINUTES * 60000)
    try:
        duration = int(value)
        if duration <= 0:
            raise ValueError
        # Last.fm track.getInfo returns milliseconds.
        if duration < 1000:
            duration *= 1000
    except (TypeError, ValueError):
        duration = int(AVERAGE_TRACK_LENGTH_MINUTES * 60000)
    return duration


@lru_cache(maxsize=1024)
def _fetch_track_duration(artist_name: str, track_name: str) -> int:
    payload = _call_lastfm(
        "track.getInfo",
        {
            "artist": artist_name,
            "track": track_name,
        },
    )
    track_info = payload.get("track") if isinstance(payload, dict) else None
    duration = None
    if isinstance(track_info, dict):
        duration = track_info.get("duration")
    return _normalise_duration(duration if isinstance(duration, str) else str(duration or ""))


def estimate_lastfm_listen_minutes(username: str) -> str:
    now = int(time.time())
    start = now - SECONDS_PER_YEAR
    payload = _call_lastfm(
        "user.getweeklytrackchart",
        {
            "user": username,
            "from": str(start),
            "to": str(now),
        },
    )
    chart = payload.get("weeklytrackchart", {})
    tracks = chart.get("track") or []
    if not isinstance(tracks, list):
        return "0"

    track_entries: List[Tuple[str, str, int]] = []
    for entry in tracks[:MAX_DURATION_TRACKS]:
        if not isinstance(entry, dict):
            continue
        playcount = entry.get("playcount")
        try:
            plays = int(playcount)
        except (TypeError, ValueError):
            continue
        if plays <= 0:
            continue
        artist_info = entry.get("artist") or {}
        artist_name = None
        if isinstance(artist_info, dict):
            artist_name = artist_info.get("#text") or artist_info.get("name")
        track_name = entry.get("name")
        if not artist_name or not track_name:
            continue
        track_entries.append((artist_name, track_name, plays))

    if not track_entries:
        return "0"

    durations: Dict[Tuple[str, str], int] = {}
    keys = [(artist, track) for artist, track, _ in track_entries]
    unique_keys: List[Tuple[str, str]] = []
    seen = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        unique_keys.append(key)

    def _lookup(args: Tuple[str, str]) -> int:
        return _fetch_track_duration(args[0], args[1])

    with ThreadPoolExecutor(max_workers=6) as pool:
        for key, duration in zip(unique_keys, pool.map(_lookup, unique_keys)):
            durations[key] = duration

    total_ms = 0
    for artist_name, track_name, plays in track_entries:
        duration = durations.get((artist_name, track_name))
        if not duration:
            duration = int(AVERAGE_TRACK_LENGTH_MINUTES * 60000)
        total_ms += plays * duration

    if total_ms <= 0:
        return "0"
    minutes = max(0, int(total_ms / 60000))
    return f"{minutes:,}"


def _normalise_tag(name: str) -> str:
    normalised = name.strip().lower()
    if not normalised:
        return ""
    return normalised


def get_lastfm_top_genre(username: str) -> str:
    payload = _call_lastfm("user.getTopTags", {"user": username})
    tags = payload.get("toptags", {}).get("tag") or []
    if not isinstance(tags, list):
        return "No genre"
    for tag in tags[:MAX_TAG_RESULTS]:
        if not isinstance(tag, dict):
            continue
        name = tag.get("name")
        if not isinstance(name, str):
            continue
        normalised = _normalise_tag(name)
        if not normalised or normalised in IGNORED_TAGS:
            continue
        title = normalised.title()
        if POPULAR_GENRES and normalised in POPULAR_GENRES:
            return title
        if title:
            return title
    return "No genre"


def get_lastfm_artist_genre(artist_name: str) -> str:
    payload = _call_lastfm(
        "artist.getTopTags",
        {
            "artist": artist_name,
        },
    )
    tags = payload.get("toptags", {}).get("tag") or []
    if not isinstance(tags, list):
        return "No genre"
    for tag in tags[:MAX_TAG_RESULTS]:
        if not isinstance(tag, dict):
            continue
        name = tag.get("name")
        if not isinstance(name, str):
            continue
        normalised = _normalise_tag(name)
        if not normalised or normalised in IGNORED_TAGS:
            continue
        return normalised.title()
    return "No genre"
