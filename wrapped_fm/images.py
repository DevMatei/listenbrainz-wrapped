"""Artist and cover artwork helpers."""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from .config import (
    COVER_ART_API,
    COVER_ART_LOOKUP_LIMIT,
    IMAGE_CONCURRENCY,
    IMAGE_QUEUE_LIMIT,
    IMAGE_QUEUE_TIMEOUT,
    LASTFM_API,
    LASTFM_API_KEY,
)
from .http import (
    cover_art_session,
    image_session,
    lastfm_session,
    request_with_handling,
)
from .listenbrainz import (
    get_top_artists_payload,
    get_top_releases_payload,
    get_top_tracks_payload,
    normalise_count,
)
from .musicbrainz import (
    extract_artist_mbid,
    extract_wikidata_qid,
    fetch_artist_details,
    lookup_wikidata_image,
    normalise_image_resource,
)

logger = logging.getLogger("wrapped_fm")


class ImageQueueFullError(Exception):
    """Raised when the download queue is at capacity."""


class ImageQueueBusyError(Exception):
    """Raised when no worker is available within timeout."""


class ImageUnavailableError(Exception):
    """Raised when artwork cannot be located."""


@dataclass
class ImageResult:
    content_type: str
    content: bytes
    queue_position: int


image_queue_lock = threading.Lock()
image_queue_size = 0
image_download_semaphore = threading.BoundedSemaphore(max(1, IMAGE_CONCURRENCY))


def _enter_image_queue() -> Optional[int]:
    global image_queue_size
    with image_queue_lock:
        if image_queue_size >= IMAGE_QUEUE_LIMIT:
            return None
        image_queue_size += 1
        return image_queue_size


def _leave_image_queue() -> None:
    global image_queue_size
    with image_queue_lock:
        image_queue_size = max(0, image_queue_size - 1)


def _fetch_binary_image(url: str) -> Optional[Tuple[str, bytes]]:
    response = request_with_handling(image_session, url)
    if response.status_code == 404 or response.status_code >= 500:
        return None
    if not response.ok:
        return None
    content_type = response.headers.get("Content-Type", "")
    if "image" not in content_type.lower():
        return None
    content = response.content
    if not content:
        return None
    return content_type, content


def _artist_image_candidates(artist_mbid: str) -> List[str]:
    details = fetch_artist_details(artist_mbid)
    relations = details.get("relations") or []
    candidates: List[str] = []

    for relation in relations:
        if relation.get("type") != "image":
            continue
        resource = relation.get("url", {}).get("resource")
        candidate = normalise_image_resource(resource or "")
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    if not candidates:
        qid = extract_wikidata_qid(relations)
        wikidata_candidate = lookup_wikidata_image(qid or "")
        if wikidata_candidate:
            candidates.append(wikidata_candidate)

    return candidates


@lru_cache(maxsize=256)
def _download_artist_image(artist_mbid: str) -> Optional[Tuple[str, bytes]]:
    for candidate in _artist_image_candidates(artist_mbid):
        art = _fetch_binary_image(candidate)
        if art:
            return art
    return None


def _is_lastfm_placeholder(url: str) -> bool:
    lowered = url.lower()
    from .config import LASTFM_PLACEHOLDER_HASHES

    return any(placeholder in lowered for placeholder in LASTFM_PLACEHOLDER_HASHES)


def _select_lastfm_image(images: List[Dict]) -> Optional[str]:
    if not images:
        return None
    size_order = {"mega": 6, "extralarge": 5, "large": 4, "medium": 3, "small": 2}
    candidates: List[Tuple[int, str]] = []
    for image in images:
        url = image.get("#text", "")
        if not url or _is_lastfm_placeholder(url):
            continue
        size_rank = size_order.get(image.get("size", "").lower(), 0)
        candidates.append((size_rank, url))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _fetch_lastfm_payload(
    method: str,
    *,
    artist_name: Optional[str] = None,
    artist_mbid: Optional[str] = None,
    extra_params: Optional[Dict[str, str]] = None,
) -> Dict:
    if not LASTFM_API_KEY:
        return {}
    params: Dict[str, str] = {
        "method": method,
        "api_key": LASTFM_API_KEY,
        "format": "json",
        "autocorrect": "1",
    }
    if artist_name:
        params["artist"] = artist_name
    if artist_mbid:
        params["mbid"] = artist_mbid
    if extra_params:
        params.update(extra_params)
    response = request_with_handling(lastfm_session, LASTFM_API, params=params)
    if response.status_code == 404 or not response.ok:
        logger.debug("Last.fm returned %s for %s", response.status_code, method)
        return {}
    try:
        payload = response.json()
    except ValueError:
        return {}
    if isinstance(payload, dict) and payload.get("error"):
        logger.debug(
            "Last.fm error for %s: %s",
            method,
            payload.get("message") or payload.get("error"),
        )
        return {}
    return payload


def _lookup_lastfm_album_image(artist_name: str, artist_mbid: Optional[str]) -> Optional[str]:
    payload = _fetch_lastfm_payload(
        "artist.gettopalbums",
        artist_name=artist_name,
        artist_mbid=artist_mbid,
        extra_params={"limit": "5"},
    )
    top_albums = (payload.get("topalbums") or {}).get("album") or []
    for album in top_albums:
        image_url = _select_lastfm_image(album.get("image") or [])
        if image_url:
            return image_url
    return None


@lru_cache(maxsize=256)
def _download_lastfm_artist_image(artist_name: str, artist_mbid: Optional[str]) -> Optional[Tuple[str, bytes]]:
    if not LASTFM_API_KEY or not artist_name:
        return None

    payload = _fetch_lastfm_payload(
        "artist.getinfo",
        artist_name=artist_name,
        artist_mbid=artist_mbid,
    )
    artist_info = (payload or {}).get("artist") or {}
    image_url = _select_lastfm_image(artist_info.get("image") or [])
    if not image_url and artist_name:
        image_url = _lookup_lastfm_album_image(artist_name, artist_mbid)
    if not image_url:
        return None

    art = _fetch_binary_image(image_url)
    if art:
        return art
    return None


def _collect_artist_candidates(username: str) -> List[Tuple[str, Optional[str]]]:
    artists = get_top_artists_payload(username, COVER_ART_LOOKUP_LIMIT)
    candidates: List[Tuple[str, Optional[str]]] = []
    for artist in artists:
        name = artist.get("artist_name") or artist.get("name")
        artist_mbid = extract_artist_mbid(artist)
        if name:
            candidates.append((name, artist_mbid))
    return candidates


def _collect_cover_candidates(username: str) -> List[Tuple[str, Optional[str]]]:
    weighted_candidates: Dict[Tuple[str, Optional[str]], int] = {}

    def add_candidate(
        release_mbid: Optional[str],
        caa_release_mbid: Optional[str],
        listen_count: int,
    ) -> None:
        if not release_mbid:
            return
        key = (release_mbid, caa_release_mbid)
        weight = max(listen_count, 1)
        current = weighted_candidates.get(key, 0)
        if weight > current:
            weighted_candidates[key] = weight

    releases = get_top_releases_payload(username, COVER_ART_LOOKUP_LIMIT)
    for release in releases:
        listen_count = normalise_count(release.get("listen_count", 0))
        add_candidate(release.get("caa_release_mbid"), release.get("caa_release_mbid"), listen_count)
        add_candidate(release.get("release_mbid"), release.get("caa_release_mbid"), listen_count)

    recordings = get_top_tracks_payload(username, COVER_ART_LOOKUP_LIMIT)
    for recording in recordings:
        listen_count = normalise_count(recording.get("listen_count", 0))
        add_candidate(recording.get("caa_release_mbid"), recording.get("caa_release_mbid"), listen_count)
        add_candidate(recording.get("release_mbid"), recording.get("caa_release_mbid"), listen_count)

    if not weighted_candidates:
        return []

    sorted_candidates = sorted(
        weighted_candidates.items(),
        key=lambda item: item[1],
        reverse=True,
    )
    trimmed = [pair for pair, _ in sorted_candidates[:COVER_ART_LOOKUP_LIMIT]]
    return trimmed


@lru_cache(maxsize=256)
def _download_cover_art(release_mbid: str, caa_release_mbid: Optional[str]) -> Optional[Tuple[str, bytes]]:
    if not release_mbid:
        return None

    release_identifier = caa_release_mbid or release_mbid
    endpoints = [
        f"{COVER_ART_API}/{release_identifier}/front-1200",
        f"{COVER_ART_API}/{release_identifier}/front-1000",
        f"{COVER_ART_API}/{release_identifier}/front-800",
        f"{COVER_ART_API}/{release_identifier}/front-500",
        f"{COVER_ART_API}/{release_identifier}/front-250",
        f"{COVER_ART_API}/{release_identifier}/front",
    ]

    for url in endpoints:
        response = request_with_handling(cover_art_session, url)
        if response.status_code in (301, 302, 303, 307, 308):
            redirect_url = response.headers.get("Location")
            if not redirect_url:
                continue
            response = request_with_handling(cover_art_session, redirect_url)

        if response.status_code == 404 or response.status_code >= 500:
            continue
        if not response.ok:
            continue

        content_type = response.headers.get("Content-Type", "")
        if "image" not in content_type.lower():
            continue
        content = response.content
        if not content:
            continue
        return content_type, content

    return None


def fetch_top_artist_image(username: str) -> ImageResult:
    queue_position = _enter_image_queue()
    if queue_position is None:
        raise ImageQueueFullError
    acquired = image_download_semaphore.acquire(timeout=IMAGE_QUEUE_TIMEOUT)
    if not acquired:
        _leave_image_queue()
        raise ImageQueueBusyError

    try:
        artist_candidates = _collect_artist_candidates(username)
        for artist_name, artist_mbid in artist_candidates:
            art = _download_lastfm_artist_image(artist_name, artist_mbid)
            if art:
                content_type, content = art
                return ImageResult(content_type or "image/jpeg", content, max(queue_position - 1, 0))

        for _, artist_mbid in artist_candidates:
            if not artist_mbid:
                continue
            art = _download_artist_image(artist_mbid)
            if art:
                content_type, content = art
                return ImageResult(content_type or "image/jpeg", content, max(queue_position - 1, 0))

        for release_mbid, caa_release_mbid in _collect_cover_candidates(username):
            art = _download_cover_art(release_mbid, caa_release_mbid)
            if art:
                content_type, content = art
                return ImageResult(content_type or "image/jpeg", content, max(queue_position - 1, 0))
    finally:
        image_download_semaphore.release()
        _leave_image_queue()

    raise ImageUnavailableError
