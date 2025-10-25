# 🎧 ListenBrainz Wrapped

wrapped generator for listenbrainz built with flask
 
 
 
![preview](image-1.png)

## 🌐 website

soon

## 💡 why it’s cool

* grabs data from listenbrainz, musicbrainz, cover art archive and wikidata — all public, no tokens (unlesssssssss u want last.fm)
* artist art uses last.fm first, then falls back to musicbrainz/wikidata

## ⚡ quickstart

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

copy `.env.example` to `.env` and tweak the basics:

```
FLASK_ENV=production
SECRET_KEY=<something>
LASTFM_API_KEY=<your-lastfm-key>
# set HTTP_PROXY / HTTPS_PROXY if you tunnel through a proxy
```

run it

```bash
gunicorn -w 4 -b 0.0.0.0:8000 wrapped-fm:app
```

or locally

```bash
./start.sh <host> <port>
```

### 🧠 production

* reverse proxy + https
* `APP_TRUST_PROXY_HEADERS=1` if proxying
* `APP_RATE_LIMIT_SALT` = random string
* 1 worker per instance unless you know what you’re doing
* add `FLASK_DEBUG=0`, `PYTHONUNBUFFERED=1`, `LOG_LEVEL=info`

## ⚙️ config

### core

`LISTENBRAINZ_API=https://api.listenbrainz.org/1`
`MUSICBRAINZ_API`, `COVER_ART_API`
`LISTENBRAINZ_RANGE=year`
`AVERAGE_TRACK_LENGTH_MINUTES`, `COVER_ART_LOOKUP_LIMIT`

### integrations

`LASTFM_API_KEY` – better artist images
`LASTFM_API`, `LASTFM_USER_AGENT`

### performance

`HTTP_TIMEOUT`, `LISTENBRAINZ_CACHE_TTL`, `LISTENBRAINZ_CACHE_SIZE`
`APP_RATE_LIMIT`, `APP_STATS_RATE_LIMIT`, `APP_IMAGE_RATE_LIMIT`
`APP_RATE_LIMIT_SALT`, `APP_TRUST_PROXY_HEADERS`

### frontend

uses [anime.js](https://animejs.com/) cuz it’s smooth as hell

## 🧩 to-do

* [ ] navidrome support for self-hosters
* [ ] faster wrapped rendering

originally made for last.fm by [jeff parla](https://github.com/parlajatwit) <3
my code is unreadable but it works 😭

## 📜 license

AGPL-3.0 — share alike
