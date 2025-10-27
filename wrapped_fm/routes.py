"""Flask routes blueprint."""

from __future__ import annotations

import io

from flask import (
    Blueprint,
    Response,
    abort,
    current_app,
    jsonify,
    request,
    send_file,
)

from .config import (
    IMAGE_RATE_LIMIT,
    STATS_RATE_LIMIT,
    TEMP_ARTWORK_MAX_BYTES,
    TEMP_ARTWORK_TTL_SECONDS,
    WRAPPED_COUNT_SINCE,
)
from .genres import get_genre_for_artist, get_top_genre
from .images import (
    ImageQueueBusyError,
    ImageQueueFullError,
    ImageUnavailableError,
    fetch_top_artist_image,
)
from .listenbrainz import (
    clamp_top_number,
    format_ranked_lines,
    get_top_artists_payload,
    get_top_releases_payload,
    get_top_tracks_payload,
    estimate_total_listen_minutes,
)
from .metrics import increment_wrapped_count, read_wrapped_count
from .rate_limiter import rate_limit
from .temp_artwork import ArtworkExpiredError, ArtworkMissingError, fetch_artwork, store_artwork

bp = Blueprint("wrapped_routes", __name__)


@bp.route("/")
def root() -> Response:
    return current_app.send_static_file("index.html")


@bp.route("/metrics/wrapped", methods=["GET"])
def get_wrapped_metric() -> Response:
    return jsonify({"count": read_wrapped_count(), "since": WRAPPED_COUNT_SINCE})


@bp.route("/metrics/wrapped", methods=["POST"])
def increment_wrapped_metric() -> Response:
    count = increment_wrapped_count()
    return jsonify({"count": count, "since": WRAPPED_COUNT_SINCE})


@bp.route("/artwork/upload", methods=["POST"])
@rate_limit(IMAGE_RATE_LIMIT)
def upload_custom_artwork() -> Response:
    uploaded_file = request.files.get("artwork")
    if uploaded_file is None or uploaded_file.filename == "":
        abort(400, description="Missing artwork file")
    data = uploaded_file.read()
    if not data:
        abort(400, description="Empty artwork file")
    if len(data) > TEMP_ARTWORK_MAX_BYTES:
        abort(413, description="Artwork exceeds size limit")
    content_type = uploaded_file.mimetype or "application/octet-stream"
    if "image" not in content_type.lower():
        abort(400, description="Artwork must be an image")
    token = store_artwork(data, content_type)
    return jsonify({"token": token, "expires_in": TEMP_ARTWORK_TTL_SECONDS})


@bp.route("/artwork/<token>", methods=["GET"])
def fetch_custom_artwork(token: str) -> Response:
    try:
        data, content_type = fetch_artwork(token)
    except ArtworkMissingError:
        abort(404, description="Artwork expired")
    except ArtworkExpiredError:
        abort(410, description="Artwork expired")
    response = send_file(
        io.BytesIO(data),
        mimetype=content_type,
        as_attachment=False,
        download_name=f"artwork-{token}.img",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@bp.route("/top/albums/<username>/<int:number>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_albums(username: str, number: int) -> str:
    number = clamp_top_number(number)
    releases = get_top_releases_payload(username, number)
    names = [release.get("release_name", "Unknown Release") for release in releases]
    return format_ranked_lines(names)


@bp.route("/top/artists/<username>/<int:number>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_artists(username: str, number: int):
    number = clamp_top_number(number)
    artists = get_top_artists_payload(username, number)
    return jsonify([artist.get("artist_name", "Unknown artist") for artist in artists])


@bp.route("/top/artists/<username>/<int:number>/formatted")
@rate_limit(STATS_RATE_LIMIT)
def get_top_artists_formatted(username: str, number: int) -> str:
    number = clamp_top_number(number)
    artists = get_top_artists_payload(username, number)
    names = [artist.get("artist_name", "Unknown artist") for artist in artists]
    return format_ranked_lines(names)


@bp.route("/top/tracks/<username>/<int:number>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_tracks(username: str, number: int):
    number = clamp_top_number(number)
    tracks = get_top_tracks_payload(username, number)
    return jsonify([track.get("track_name", "Unknown track") for track in tracks])


@bp.route("/top/tracks/<username>/<int:number>/formatted")
@rate_limit(STATS_RATE_LIMIT)
def get_top_tracks_formatted(username: str, number: int) -> str:
    number = clamp_top_number(number)
    tracks = get_top_tracks_payload(username, number)
    names = [track.get("track_name", "Unknown track") for track in tracks]
    return format_ranked_lines(names)


@bp.route("/time/total/<username>")
@rate_limit(STATS_RATE_LIMIT)
def get_listen_time(username: str) -> str:
    return estimate_total_listen_minutes(username)


@bp.route("/top/genre/user/<username>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_genre_user(username: str) -> str:
    return get_top_genre(username)


@bp.route("/top/genre/artist/<artist_name>")
@rate_limit(STATS_RATE_LIMIT)
def get_top_genre_artist(artist_name: str) -> str:
    return get_genre_for_artist(artist_name)


@bp.route("/top/img/<username>")
@rate_limit(IMAGE_RATE_LIMIT)
def get_top_artist_img(username: str) -> Response:
    source = request.args.get("source", "artist").strip().lower() or "artist"
    if source not in {"artist", "release"}:
        source = "artist"
    try:
        image_result = fetch_top_artist_image(username, preferred_source=source)
    except ImageQueueFullError:
        abort(429, description="Image queue is full, try again in a moment.")
    except ImageQueueBusyError:
        abort(429, description="Image queue is busy, please retry shortly.")
    except ImageUnavailableError:
        abort(404, description="Artist image unavailable")

    response = Response(image_result.content, content_type=image_result.content_type or "image/jpeg")
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["X-Image-Queue-Position"] = str(image_result.queue_position)
    return response
