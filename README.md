# 🎧 ListenBrainz Wrapped

wrapped generator for listenbrainz built with flask
 
 
<img width="1857" height="983" alt="ListenBrainz Wrapped — shareable stats for your scrobbles" src="https://github.com/user-attachments/assets/ee64a7f1-6bbc-4af3-9a1b-3129de9c1f9c" />

## 🌐 website

https://wrapped.devmatei.com/

## 💡 why it’s cool

* grabs data from listenbrainz, musicbrainz, cover art archive and wikidata — all public, no tokens (unlesssssssss u want last.fm)
* artist art uses last.fm first, then falls back to musicbrainz/wikidata — and if that fails/you preffer another image, there’s a built-in editor so you can upload/zoom/position your own artwork (saved in local storage or temporarily on the server for 1 hour)
* there are rate limits implimented so your server dosent get ddosed (i use cloudflare anyway) 
* there’s a live counter of total wraps ever generated (don`t ask why it seemed cool tbh)
* officially listed on the [ListenBrainz Enabled Applications](https://wiki.musicbrainz.org/ListenBrainz_Enabled_Applications) page :D 

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

`HTTP_TIMEOUT`, `HTTP_POOL_MAXSIZE`, `LISTENBRAINZ_CACHE_TTL`, `LISTENBRAINZ_CACHE_SIZE`
`APP_RATE_LIMIT`, `APP_STATS_RATE_LIMIT`, `APP_IMAGE_RATE_LIMIT`, `APP_MAX_TOP_RESULTS`
`APP_IMAGE_CONCURRENCY`, `APP_IMAGE_QUEUE_LIMIT`, `APP_IMAGE_QUEUE_TIMEOUT`
`TEMP_ARTWORK_TTL_SECONDS`, `TEMP_ARTWORK_MAX_BYTES`
`WRAPPED_COUNT_FILE` (defaults to `data/wrapped-count.txt`)
`WRAPPED_COUNT_SINCE` – label for when you started counting wraps (ISO date string)
`APP_RATE_LIMIT_SALT`, `APP_TRUST_PROXY_HEADERS`

### why it exists

Yeah, the idea is for people whose friends all use Spotify and post their Wrapped. When you share a ListenBrainz one everyone replies “wait, what’s that?”—so this bridges the gap. I swapped Spotify for Navidrome but still wanted that wrapped-moment vibe, its a bit of a niche problem to have.

Share [wrapped.devmatei.com](https://wrapped.devmatei.com), flex your open music stats, and be the coolest person in the room!

### about me

I’m Matei (aka [DevMatei](https://devmatei.com)) — a full-stack dev who loves shipping playful web tools, tinkering with AI and homelab setups, streaming on Twitch, and yes, drinking an obscene amount of tea. If you want to talk projects, self-hosting, or just nerd out, hit the email on my site or ping me on socials.

### frontend

uses [anime.js](https://animejs.com/) cuz it’s smooth as hell

## 🤝 contributing

See [CONTRIBUTING.yml](./CONTRIBUTING.yml) for setup steps, coding style notes, and the pull-request checklist. TL;DR: keep PRs focused, run `python -m py_compile wrapped-fm.py`, and drop screenshots for any UI tweaks.

## 🧩 to-do

* [ ] try to set some more security features and maybe add last.fm support?
* [x] faster wrapped rendering - im limited by the api speeds so cant go under 33s ish
* [x] make code modular and readable (maybe)

originally made for last.fm by [jeff parla](https://github.com/parlajatwit) <3

## 📜 license

AGPL-3.0 — share alike

Note: This project isn’t affiliated with or endorsed by Spotify, ListenBrainz, or MusicBrainz. It’s just a fan-made thing built for fun.
