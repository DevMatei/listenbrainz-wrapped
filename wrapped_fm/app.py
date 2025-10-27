"""Application factory."""

from __future__ import annotations

from pathlib import Path

from flask import Flask

from .rate_limiter import init_rate_limiter
from .routes import bp as routes_bp

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


def create_app() -> Flask:
    app = Flask(__name__, static_url_path="", static_folder=str(STATIC_DIR))
    init_rate_limiter(app)
    app.register_blueprint(routes_bp)
    return app
