import os
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote

import requests
from flask import Flask, Response, abort, jsonify
from requests import Response as RequestsResponse
from requests.adapters import HTTPAdapter
from requests.exceptions import RequestException
from urllib3.util.retry import Retry

try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
except ImportError:  # pragma: no cover - optional dependency documented in requirements
    Limiter = None  # type: ignore
    get_remote_address = None  # type: ignore

LISTENBRAINZ_API = os.getenv("LISTENBRAINZ_API", "https://api.listenbrainz.org/1")
MUSICBRAINZ_API = os.getenv("MUSICBRAINZ_API", "https://musicbrainz.org/ws/2")
COVER_ART_API = os.getenv("COVER_ART_API", "https://coverartarchive.org/release")
LISTEN_RANGE = os.getenv("LISTENBRAINZ_RANGE", "year")
AVERAGE_TRACK_LENGTH_MINUTES = float(os.getenv("AVERAGE_TRACK_LENGTH_MINUTES", "3.5"))
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "10"))
COVER_ART_LOOKUP_LIMIT = int(os.getenv("COVER_ART_LOOKUP_LIMIT", "15"))
AVERAGE_TRACK_SAMPLE_LIMIT = int(os.getenv("AVERAGE_TRACK_SAMPLE_LIMIT", "50"))
WIKIDATA_ENTITY_API = os.getenv(
    "WIKIDATA_ENTITY_API",
    "https://www.wikidata.org/wiki/Special:EntityData",
)
LISTENBRAINZ_CACHE_TTL = int(os.getenv("LISTENBRAINZ_CACHE_TTL", "60"))
LISTENBRAINZ_CACHE_SIZE = int(os.getenv("LISTENBRAINZ_CACHE_SIZE", "256"))
LASTFM_API = os.getenv("LASTFM_API", "https://ws.audioscrobbler.com/2.0/")
LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")
LASTFM_USER_AGENT = os.getenv(
    "LASTFM_USER_AGENT",
    "spotify-wrapped-listenbrainz/1.0 (+https://github.com/devmatei/spotify-wrapped)",
)
DEFAULT_RATE_LIMIT = os.getenv("APP_RATE_LIMIT", "90 per minute")
STATS_RATE_LIMIT = os.getenv("APP_STATS_RATE_LIMIT", "45 per minute")
IMAGE_RATE_LIMIT = os.getenv("APP_IMAGE_RATE_LIMIT", "15 per minute")
RATE_LIMIT_STORAGE = os.getenv("RATE_LIMIT_STORAGE", "memory://")

LISTENBRAINZ_USER_AGENT = os.getenv(
    "LISTENBRAINZ_USER_AGENT",
    "spotify-wrapped-listenbrainz/1.0 (+https://github.com/devmatei/spotify-wrapped)",
)
MUSICBRAINZ_USER_AGENT = os.getenv(
    "MUSICBRAINZ_USER_AGENT",
    "spotify-wrapped-listenbrainz/1.0 (+https://github.com/devmatei/spotify-wrapped)",
)

IGNORED_TAGS = {"seen live", "favorites", "favourites", "favorite", "ireland"}
POPULAR_GENRES = {
    "pop",
    "rock",
    "hip hop",
    "rap",
    "electronic",
    "edm",
    "indie",
    "metal",
    "jazz",
    "folk",
    "country",
    "r&b",
    "soul",
    "classical",
    "blues",
    "house",
    "techno",
    "ambient",
    "punk",
    "k-pop",
    "latin",
    "dance",
    "lo-fi",
}


def _configure_session(session: requests.Session, retries: int = 3) -> None:
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        status=retries,
        backoff_factor=0.5,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

listenbrainz_session = requests.Session()
listenbrainz_session.headers.update(
    {"User-Agent": LISTENBRAINZ_USER_AGENT, "Accept": "application/json"}
)
_configure_session(listenbrainz_session)

musicbrainz_session = requests.Session()
musicbrainz_session.headers.update(
    {"User-Agent": MUSICBRAINZ_USER_AGENT, "Accept": "application/json"}
)
_configure_session(musicbrainz_session)

cover_art_session = requests.Session()
cover_art_session.headers.update({"User-Agent": LISTENBRAINZ_USER_AGENT})
_configure_session(cover_art_session)

wikidata_session = requests.Session()
wikidata_session.headers.update(
    {"User-Agent": LISTENBRAINZ_USER_AGENT, "Accept": "application/json"}
)
_configure_session(wikidata_session)

image_session = requests.Session()
image_session.headers.update(
    {"User-Agent": LISTENBRAINZ_USER_AGENT, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}
)
_configure_session(image_session)

lastfm_session = requests.Session()
lastfm_session.headers.update(
    {"User-Agent": LASTFM_USER_AGENT, "Accept": "application/json"}
)
_configure_session(lastfm_session)

app = Flask(__name__, static_url_path="")

if Limiter and get_remote_address:
    limiter: Optional[Limiter] = Limiter(
        key_func=get_remote_address,
        default_limits=[DEFAULT_RATE_LIMIT],
        storage_uri=RATE_LIMIT_STORAGE,
    )
    limiter.init_app(app)
else:  # pragma: no cover - only when limiter is missing
    limiter = None

listenbrainz_cache: Dict[Tuple[str, Tuple[Tuple[str, str], ...]], Tuple[float, Dict]] = {}


def rate_limit(limit_value: str):
    def decorator(func):
        if limiter:
            return limiter.limit(limit_value)(func)
        return func

    return decorator


@app.route("/")
def root() -> Response:
    return app.send_static_file("index.html")


def _request_with_handling(
    session: requests.Session, url: str, *, params: Optional[Dict[str, str]] = None
) -> RequestsResponse:
    last_exc: Optional[Exception] = None
    for attempt in range(3):
        try:
            response = session.get(url, params=params, timeout=HTTP_TIMEOUT)
            return response
        except RequestException as exc:  # pragma: no cover - network failure
            last_exc = exc
            time.sleep(0.3 * (attempt + 1))
    abort(502, description=f"Upstream request failed: {last_exc}")


def _fetch_listenbrainz(path: str, params: Optional[Dict[str, str]] = None) -> Dict:
    url = f"{LISTENBRAINZ_API}{path}"
    param_items: Tuple[Tuple[str, str], ...] = tuple(sorted((params or {}).items()))
    cache_key = (path, param_items)
    now = time.time()
    cached = listenbrainz_cache.get(cache_key)
    if cached and now - cached[0] < LISTENBRAINZ_CACHE_TTL:
        return cached[1]

    response = _request_with_handling(listenbrainz_session, url, params=params)

    if response.status_code == 404:
        abort(404, description="ListenBrainz user not found")
    if response.status_code >= 500:
        abort(503, description="ListenBrainz service unavailable")
    if not response.ok:
        abort(response.status_code, description="ListenBrainz request failed")

    content = response.content
    if not content.strip():
        return {}

    content_type = response.headers.get("Content-Type", "")
    if "application/json" not in content_type:
        snippet = content.decode("utf-8", "replace").strip()
        snippet = snippet[:200] + ("..." if len(snippet) > 200 else "")
        abort(
            502,
            description=(
                "Unexpected response from ListenBrainz "
                f"(status {response.status_code}, content-type {content_type}): {snippet or 'empty body'}"
            ),
        )

    try:
        data = response.json()
    except ValueError:  # pragma: no cover - malformed payload
        snippet = content.decode("utf-8", "replace").strip()
        snippet = snippet[:200] + ("..." if len(snippet) > 200 else "")
        abort(
            502,
            description=(
                "Unable to decode ListenBrainz response as JSON "
                f"(status {response.status_code}): {snippet or 'empty body'}"
            ),
        )

    payload = data.get("payload") if isinstance(data, dict) else None
    if payload is None:
        abort(502, description="Missing payload in ListenBrainz response")
    listenbrainz_cache[cache_key] = (now, payload)
    if len(listenbrainz_cache) > LISTENBRAINZ_CACHE_SIZE:
        oldest_key = min(listenbrainz_cache.items(), key=lambda item: item[1][0])[0]
        listenbrainz_cache.pop(oldest_key, None)
    return payload


def _fetch_musicbrainz(path: str, params: Optional[Dict[str, str]] = None) -> Dict:
    url = f"{MUSICBRAINZ_API}{path}"
    response = _request_with_handling(musicbrainz_session, url, params=params)

    if response.status_code == 404:
        return {}
    if response.status_code == 503:  # MusicBrainz rate limiting
        time.sleep(1.0)
        response = _request_with_handling(musicbrainz_session, url, params=params)
    if not response.ok:
        return {}
    try:
        return response.json()
    except ValueError:
        return {}


def _normalise_count(value: int) -> int:
    return max(int(value), 0)


def _fetch_stat_payload(
    username: str, endpoint: str, key: str, *, count: Optional[int] = None
) -> Dict:
    ranges = [LISTEN_RANGE]
    if LISTEN_RANGE != "all_time":
        ranges.append("all_time")

    last_payload: Dict = {}
    for stat_range in ranges:
        params: Dict[str, str] = {"range": stat_range}
        if count is not None:
            params["count"] = str(count)
        payload = _fetch_listenbrainz(f"/stats/user/{username}/{endpoint}", params)
        last_payload = payload
        if payload.get(key):
            return payload
    return last_payload


def _get_top_artists_payload(username: str, count: int) -> List[Dict]:
    payload = _fetch_stat_payload(
        username,
        "artists",
        "artists",
        count=count,
    )
    return payload.get("artists", [])


def _get_top_tracks_payload(username: str, count: int) -> List[Dict]:
    payload = _fetch_stat_payload(
        username,
        "recordings",
        "recordings",
        count=count,
    )
    return payload.get("recordings", [])


def _get_top_releases_payload(username: str, count: int) -> List[Dict]:
    payload = _fetch_stat_payload(
        username,
        "releases",
        "releases",
        count=count,
    )
    return payload.get("releases", [])


def _format_ranked_lines(items: Iterable[str]) -> str:
    return "<br>".join(f"{idx + 1}. {value}" for idx, value in enumerate(items))


@app.route("/top/albums/<username>/<int:number>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_albums(username: str, number: int) -> str:
    releases = _get_top_releases_payload(username, number)
    names = [release.get("release_name", "Unknown Release") for release in releases]
    return _format_ranked_lines(names)


@app.route("/top/artists/<username>/<int:number>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_artists(username: str, number: int):
    artists = _get_top_artists_payload(username, number)
    return jsonify([artist.get("artist_name", "Unknown artist") for artist in artists])


@app.route("/top/artists/<username>/<int:number>/formatted")
@rate_limit(STATS_RATE_LIMIT)
def get_top_artists_formatted(username: str, number: int) -> str:
    artists = _get_top_artists_payload(username, number)
    names = [artist.get("artist_name", "Unknown artist") for artist in artists]
    return _format_ranked_lines(names)


@app.route("/top/tracks/<username>/<int:number>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_tracks(username: str, number: int):
    tracks = _get_top_tracks_payload(username, number)
    return jsonify([track.get("track_name", "Unknown track") for track in tracks])


@app.route("/top/tracks/<username>/<int:number>/formatted")
@rate_limit(STATS_RATE_LIMIT)
def get_top_tracks_formatted(username: str, number: int) -> str:
    tracks = _get_top_tracks_payload(username, number)
    names = [track.get("track_name", "Unknown track") for track in tracks]
    return _format_ranked_lines(names)


@app.route("/time/total/<username>")
@rate_limit(STATS_RATE_LIMIT)
def get_listen_time(username: str) -> str:
    ranges = [LISTEN_RANGE]
    if LISTEN_RANGE != "all_time":
        ranges.append("all_time")

    activity: Dict = {}
    for stat_range in ranges:
        activity = _fetch_listenbrainz(
            f"/stats/user/{username}/listening-activity",
            {"range": stat_range},
        )
        if activity.get("listening_activity"):
            break

    listen_counts = [
        _normalise_count(item.get("listen_count", 0))
        for item in activity.get("listening_activity", [])
    ]
    total_listens = sum(listen_counts)
    if total_listens <= 0:
        return "0"

    avg_minutes = _calculate_average_track_minutes(username) or AVERAGE_TRACK_LENGTH_MINUTES
    total_minutes = int(total_listens * avg_minutes)
    return f"{total_minutes:,}"


def _extract_artist_mbid(artist: Dict) -> Optional[str]:
    mbid = artist.get("artist_mbid")
    if mbid:
        return mbid
    mbids = artist.get("artist_mbids")
    if isinstance(mbids, list) and mbids:
        return mbids[0]
    return None


@lru_cache(maxsize=256)
def _fetch_artist_details(artist_mbid: str) -> Dict:
    if not artist_mbid:
        return {}
    return _fetch_musicbrainz(
        f"/artist/{artist_mbid}",
        {"fmt": "json", "inc": "tags+genres+url-rels"},
    )


@lru_cache(maxsize=256)
def _lookup_artist_tag(artist_mbid: str) -> Optional[str]:
    if not artist_mbid:
        return None

    data = _fetch_artist_details(artist_mbid)
    genres = data.get("genres") or []
    if genres:
        sorted_genres = sorted(
            genres,
            key=lambda value: value.get("count", 0),
            reverse=True,
        )
        for genre in sorted_genres:
            name = (genre.get("name") or "").strip()
            if not name:
                continue
            lower_name = name.lower()
            if lower_name in POPULAR_GENRES:
                return name.title()
            if any(lower_name.endswith(f" {suffix}") for suffix in ("pop", "rock", "metal", "jazz")):
                return name.title()

    tags = data.get("tags") or []
    if not tags:
        return None

    for tag in sorted(tags, key=lambda value: value.get("count", 0), reverse=True):
        tag_name = (tag.get("name") or "").strip().lower()
        if tag_name and tag_name not in IGNORED_TAGS:
            if tag_name in POPULAR_GENRES:
                return tag_name.title()
            if any(tag_name.endswith(suffix) for suffix in ("pop", "rock", "metal", "jazz", "folk", "house", "core")):
                return tag_name.title()
    return None


def _get_top_genre(username: str) -> str:
    artists = _get_top_artists_payload(username, 10)
    tag_counter: Counter[str] = Counter()

    for artist in artists:
        artist_mbid = _extract_artist_mbid(artist)
        if not artist_mbid:
            continue
        tag = _lookup_artist_tag(artist_mbid)
        if tag:
            tag_counter[tag] += 1

    if not tag_counter:
        return "no genre"
    top_tag, _ = tag_counter.most_common(1)[0]
    return top_tag


def _commons_file_url(filename: str, width: int = 2048) -> Optional[str]:
    if not filename:
        return None
    safe_name = quote(filename.replace(" ", "_"))
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{safe_name}?width={width}"


def _normalise_image_resource(resource: str) -> Optional[str]:
    if not resource:
        return None
    lowered = resource.lower()
    if lowered.startswith("https://commons.wikimedia.org/wiki/file:"):
        filename = resource.split("/File:", 1)[1]
        return _commons_file_url(filename)
    if lowered.startswith("https://commons.wikimedia.org/wiki/special:filepath/"):
        if "width=" not in lowered:
            return f"{resource}?width=1200"
        return resource
    if "upload.wikimedia.org" in lowered:
        return resource
    if lowered.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
        return resource
    return None


def _extract_wikidata_qid(relations: List[Dict]) -> Optional[str]:
    for relation in relations or []:
        if relation.get("type") == "wikidata":
            resource = relation.get("url", {}).get("resource", "")
            if resource:
                return resource.rsplit("/", 1)[-1]
    return None


@lru_cache(maxsize=256)
def _lookup_wikidata_image(qid: str) -> Optional[str]:
    if not qid:
        return None

    response = _request_with_handling(
        wikidata_session,
        f"{WIKIDATA_ENTITY_API}/{qid}.json",
    )
    if not response.ok:
        return None

    try:
        data = response.json()
    except ValueError:
        return None

    entity = (data.get("entities") or {}).get(qid) or {}
    claims = entity.get("claims") or {}
    images = claims.get("P18") or []
    for claim in images:
        mainsnak = claim.get("mainsnak") or {}
        datavalue = mainsnak.get("datavalue") or {}
        value = datavalue.get("value")
        if isinstance(value, str) and value:
            return _commons_file_url(value)
    return None


def _artist_image_candidates(artist_mbid: str) -> List[str]:
    details = _fetch_artist_details(artist_mbid)
    relations = details.get("relations") or []
    candidates: List[str] = []

    for relation in relations:
        if relation.get("type") != "image":
            continue
        resource = relation.get("url", {}).get("resource")
        candidate = _normalise_image_resource(resource or "")
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    if not candidates:
        qid = _extract_wikidata_qid(relations)
        wikidata_candidate = _lookup_wikidata_image(qid or "")
        if wikidata_candidate:
            candidates.append(wikidata_candidate)

    return candidates


def _collect_artist_candidates(username: str) -> List[Tuple[str, Optional[str]]]:
    artists = _get_top_artists_payload(username, COVER_ART_LOOKUP_LIMIT)
    candidates: List[Tuple[str, Optional[str]]] = []
    for artist in artists:
        name = artist.get("artist_name") or artist.get("name")
        artist_mbid = _extract_artist_mbid(artist)
        if name:
            candidates.append((name, artist_mbid))
    return candidates


@lru_cache(maxsize=256)
def _download_artist_image(artist_mbid: str) -> Optional[Tuple[str, bytes]]:
    for candidate in _artist_image_candidates(artist_mbid):
        response = _request_with_handling(image_session, candidate)
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


def _select_lastfm_image(images: List[Dict]) -> Optional[str]:
    if not images:
        return None
    size_order = {"mega": 6, "extralarge": 5, "large": 4, "medium": 3, "small": 2}
    candidates = [
        (size_order.get(image.get("size", "").lower(), 0), image.get("#text", ""))
        for image in images
    ]
    candidates = [entry for entry in candidates if entry[1]]
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


@lru_cache(maxsize=256)
def _download_lastfm_artist_image(artist_name: str, artist_mbid: Optional[str]) -> Optional[Tuple[str, bytes]]:
    if not LASTFM_API_KEY or not artist_name:
        return None

    params = {
        "method": "artist.getinfo",
        "artist": artist_name,
        "api_key": LASTFM_API_KEY,
        "format": "json",
        "autocorrect": "1",
    }
    if artist_mbid:
        params["mbid"] = artist_mbid
    response = _request_with_handling(lastfm_session, LASTFM_API, params=params)
    if response.status_code == 404 or not response.ok:
        return None

    try:
        payload = response.json()
    except ValueError:
        return None

    if isinstance(payload, dict) and payload.get("error"):
        return None

    artist_info = (payload or {}).get("artist") or {}
    image_url = _select_lastfm_image(artist_info.get("image") or [])
    if not image_url:
        return None

    image_response = _request_with_handling(image_session, image_url)
    if image_response.status_code == 404 or image_response.status_code >= 500:
        return None
    if not image_response.ok:
        return None

    content_type = image_response.headers.get("Content-Type", "")
    if "image" not in content_type.lower():
        return None
    content = image_response.content
    if not content:
        return None
    return content_type, content


@lru_cache(maxsize=512)
def _lookup_recording_length(recording_mbid: str) -> Optional[int]:
    if not recording_mbid:
        return None
    data = _fetch_musicbrainz(f"/recording/{recording_mbid}", {"fmt": "json"})
    length = data.get("length")
    try:
        return int(length)
    except (TypeError, ValueError):
        return None


def _calculate_average_track_minutes(username: str) -> Optional[float]:
    sample_limit = max(1, min(AVERAGE_TRACK_SAMPLE_LIMIT, 200))
    recordings = _get_top_tracks_payload(username, sample_limit)

    unique_mbids: List[str] = []
    for recording in recordings:
        recording_mbid = recording.get("recording_mbid")
        if recording_mbid and recording_mbid not in unique_mbids:
            unique_mbids.append(recording_mbid)

    length_map: Dict[str, Optional[int]] = {}
    if unique_mbids:
        with ThreadPoolExecutor(max_workers=6) as pool:
            for mbid, length in zip(unique_mbids, pool.map(_lookup_recording_length, unique_mbids)):
                if length:
                    length_map[mbid] = length

    total_length_ms = 0
    total_listens = 0
    for recording in recordings:
        recording_mbid = recording.get("recording_mbid")
        listen_count = _normalise_count(recording.get("listen_count", 0))
        if listen_count <= 0:
            continue
        length_ms = None
        if recording_mbid:
            length_ms = length_map.get(recording_mbid)
            if length_ms is None:
                length_ms = _lookup_recording_length(recording_mbid or "")
                if length_ms:
                    length_map[recording_mbid] = length_ms
        if not length_ms:
            continue
        total_length_ms += length_ms * listen_count
        total_listens += listen_count

    if total_listens <= 0:
        return None
    return (total_length_ms / total_listens) / 60000.0


@app.route("/top/genre/user/<username>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_genre_user(username: str) -> str:
    return _get_top_genre(username)


def _search_artist_mbid(artist_name: str) -> Optional[str]:
    if not artist_name:
        return None
    params = {"fmt": "json", "limit": "1", "query": f'artist:"{artist_name}"'}
    data = _fetch_musicbrainz("/artist/", params)
    artists = data.get("artists") or []
    if not artists:
        return None
    return artists[0].get("id")


@app.route("/top/genre/artist/<artist_name>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_genre_artist(artist_name: str) -> str:
    artist_mbid = _search_artist_mbid(artist_name)
    if not artist_mbid:
        return "no genre"
    tag = _lookup_artist_tag(artist_mbid)
    return tag.title() if tag else "no genre"


def _collect_cover_candidates(username: str) -> List[Tuple[str, Optional[str]]]:
    candidates: List[Tuple[str, Optional[str]]] = []

    def add_candidate(release_mbid: Optional[str], caa_release_mbid: Optional[str]):
        if not release_mbid:
            return
        pair = (release_mbid, caa_release_mbid or release_mbid)
        if pair not in candidates:
            candidates.append(pair)

    releases = _get_top_releases_payload(username, COVER_ART_LOOKUP_LIMIT)
    for release in releases:
        add_candidate(release.get("caa_release_mbid"), release.get("caa_release_mbid"))
        add_candidate(release.get("release_mbid"), release.get("caa_release_mbid"))

    recordings = _get_top_tracks_payload(username, COVER_ART_LOOKUP_LIMIT)
    for recording in recordings:
        add_candidate(recording.get("caa_release_mbid"), recording.get("caa_release_mbid"))
        add_candidate(recording.get("release_mbid"), recording.get("caa_release_mbid"))

    return candidates[:COVER_ART_LOOKUP_LIMIT]


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
        response = _request_with_handling(cover_art_session, url)
        if response.status_code in (301, 302, 303, 307, 308):
            redirect_url = response.headers.get("Location")
            if not redirect_url:
                continue
            response = _request_with_handling(cover_art_session, redirect_url)

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


@app.route("/top/img/<username>")
@rate_limit(IMAGE_RATE_LIMIT)
def get_top_artist_img(username: str) -> Response:
    artist_candidates = _collect_artist_candidates(username)

    for artist_name, artist_mbid in artist_candidates:
        art = _download_lastfm_artist_image(artist_name, artist_mbid)
        if art:
            content_type, content = art
            proxied = Response(content, content_type=content_type or "image/jpeg")
            proxied.headers["Access-Control-Allow-Origin"] = "*"
            return proxied

    for _, artist_mbid in artist_candidates:
        if not artist_mbid:
            continue
        art = _download_artist_image(artist_mbid)
        if art:
            content_type, content = art
            proxied = Response(content, content_type=content_type or "image/jpeg")
            proxied.headers["Access-Control-Allow-Origin"] = "*"
            return proxied

    for release_mbid, caa_release_mbid in _collect_cover_candidates(username):
        art = _download_cover_art(release_mbid, caa_release_mbid)
        if art:
            content_type, content = art
            proxied = Response(content, content_type=content_type or "image/jpeg")
            proxied.headers["Access-Control-Allow-Origin"] = "*"
            return proxied

    abort(404, description="Artist image unavailable")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
