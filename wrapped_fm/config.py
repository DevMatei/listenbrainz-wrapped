"""Application configuration and environment-derived settings."""

from __future__ import annotations

import logging
import os
from pathlib import Path


def _env_bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

LISTENBRAINZ_API = os.getenv("LISTENBRAINZ_API", "https://api.listenbrainz.org/1")
MUSICBRAINZ_API = os.getenv("MUSICBRAINZ_API", "https://musicbrainz.org/ws/2")
COVER_ART_API = os.getenv("COVER_ART_API", "https://coverartarchive.org/release")
LISTEN_RANGE = os.getenv("LISTENBRAINZ_RANGE", "year")
AVERAGE_TRACK_LENGTH_MINUTES = float(os.getenv("AVERAGE_TRACK_LENGTH_MINUTES", "3.5"))
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "10"))
COVER_ART_LOOKUP_LIMIT = int(os.getenv("COVER_ART_LOOKUP_LIMIT", "15"))
AVERAGE_TRACK_SAMPLE_LIMIT = int(os.getenv("AVERAGE_TRACK_SAMPLE_LIMIT", "50"))
MAX_TOP_RESULTS = int(os.getenv("APP_MAX_TOP_RESULTS", "15"))
TEMP_ARTWORK_TTL_SECONDS = int(os.getenv("TEMP_ARTWORK_TTL_SECONDS", "3600"))
TEMP_ARTWORK_MAX_BYTES = int(os.getenv("TEMP_ARTWORK_MAX_BYTES", str(6 * 1024 * 1024)))
IMAGE_CONCURRENCY = int(os.getenv("APP_IMAGE_CONCURRENCY", "2"))
IMAGE_QUEUE_LIMIT = int(os.getenv("APP_IMAGE_QUEUE_LIMIT", "10"))
IMAGE_QUEUE_TIMEOUT = float(os.getenv("APP_IMAGE_QUEUE_TIMEOUT", "15"))
HTTP_POOL_MAXSIZE = int(os.getenv("HTTP_POOL_MAXSIZE", "40"))
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
RATE_LIMIT_SALT = os.getenv("APP_RATE_LIMIT_SALT", "")
TRUST_PROXY_HEADERS = _env_bool("APP_TRUST_PROXY_HEADERS", "false")
WRAPPED_COUNT_FILE = Path(os.getenv("WRAPPED_COUNT_FILE", "data/wrapped-count.txt"))

LISTENBRAINZ_USER_AGENT = os.getenv(
    "LISTENBRAINZ_USER_AGENT",
    "spotify-wrapped-listenbrainz/1.0 (+https://github.com/devmatei/spotify-wrapped)",
)
MUSICBRAINZ_USER_AGENT = os.getenv(
    "MUSICBRAINZ_USER_AGENT",
    "spotify-wrapped-listenbrainz/1.0 (+https://github.com/devmatei/spotify-wrapped)",
)
WRAPPED_COUNT_SINCE = os.getenv("WRAPPED_COUNT_SINCE", "2025-10-26")

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
LASTFM_PLACEHOLDER_HASHES = {"2a96cbd8b46e442fc41c2b86b821562f"}
