# ListenBrainz Wrapped
A Spotify Wrapped style (totally not 1:1 copy of wrapped image) summary for your ListenBrainz scrobbles, built with Flask.

**Status:** Work in progress, but fully functional.

## Setup
1. Install dependencies: `pip install -r requirements.txt` (or at minimum `flask` and `requests`).
2. Run the app with any WSGI server, e.g. `gunicorn -w 4 -b <ip>:<port> wrapped-fm:app`.
3. For local development you can use `start.sh <ip> <port>`.

The app talks directly to the public ListenBrainz, MusicBrainz, Cover Art Archive, and Wikimedia APIs (via Wikidata), so no API keys are required. If you need to customise requests, the following optional environment variables are supported:

- `LISTENBRAINZ_API` - override the ListenBrainz API base URL (default `https://api.listenbrainz.org/1`).
- `MUSICBRAINZ_API` - override the MusicBrainz API base URL.
- `COVER_ART_API` - override the Cover Art Archive base URL.
- `LISTENBRAINZ_USER_AGENT` / `MUSICBRAINZ_USER_AGENT` - provide a custom User-Agent string.
- `AVERAGE_TRACK_LENGTH_MINUTES` - adjust the minutes listened estimate (default `3.5`).
- `COVER_ART_LOOKUP_LIMIT` - number of top releases/recordings to scan when searching for cover art (default `15`).
- `AVERAGE_TRACK_SAMPLE_LIMIT` - number of top recordings sampled to estimate average track length (default `50`).
- `LASTFM_API_KEY` - optional, enables higher quality artist images via Last.fm (recommended).
- `LASTFM_API` - override the Last.fm API base URL.
- `LASTFM_USER_AGENT` - provide a custom User-Agent when calling Last.fm.


good luck reading the code LMFAO

## License
wrapped-fm is licensed under the AGPL-3.0 license. Share alike, please!
