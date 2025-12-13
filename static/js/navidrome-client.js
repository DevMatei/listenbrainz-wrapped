import { md5 } from './md5.js';

const API_VERSION = '1.16.1';
const CLIENT_ID = 'listenbrainz-wrapped';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normaliseServerUrl(url) {
  if (!url) {
    return '';
  }
  return url.replace(/\/+$/, '');
}

function buildRandomSalt(length = 16) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export class NavidromeClient {
  constructor(serverUrl, username, password) {
    this.root = normaliseServerUrl(serverUrl);
    this.user = username;
    this.password = password;
    this.base = `${this.root}/rest`;
  }

  _buildParams(params = {}, { json = true } = {}) {
    const salt = buildRandomSalt();
    const token = md5(`${this.password}${salt}`);
    const search = new URLSearchParams({
      u: this.user,
      t: token,
      s: salt,
      v: API_VERSION,
      c: CLIENT_ID,
      ...(json ? { f: 'json' } : {}),
      ...params,
    });
    return search;
  }

  async _requestJson(endpoint, params = {}) {
    const query = this._buildParams(params, { json: true });
    let response;
    try {
      response = await fetch(`${this.base}/${endpoint}?${query.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      throw new Error('Unable to reach your Navidrome server. Check the URL and network settings.');
    }
    if (!response.ok) {
      throw new Error(`Navidrome request failed (${response.status} – ${response.statusText})`);
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('Navidrome returned an invalid response.');
    }
    const payload = data && data['subsonic-response'];
    if (!payload) {
      throw new Error('Navidrome response was missing data.');
    }
    if (payload.status !== 'ok') {
      const message = payload.error?.message || 'Navidrome rejected the request.';
      throw new Error(message);
    }
    return payload;
  }

  async fetchCoverArt(id) {
    if (!id) {
      return null;
    }
    const query = this._buildParams({ id }, { json: false });
    let response;
    try {
      response = await fetch(`${this.base}/getCoverArt?${query.toString()}`, {
        method: 'GET',
      });
    } catch (error) {
      throw new Error('Unable to fetch cover art from Navidrome.');
    }
    if (!response.ok) {
      throw new Error(`Navidrome cover art unavailable (status ${response.status}).`);
    }
    return response.blob();
  }

  async ping() {
    await this._requestJson('ping');
    return true;
  }

  async stats(progressCallback = () => {}) {
    const albums = [];
    const songs = [];
    const artistPlays = new Map();
    const artistIdToName = new Map();
    let offset = 0;
    let totalPlays = 0;
    let totalSec = 0;
    let rated = 0;
    let ratingSum = 0;
    let oldestDate = Infinity;
    let oldestSong = null;
    let totalBitrate = 0;
    let bitrateCount = 0;
    let totalDuration = 0;
    let numFavorites = 0;
    const artistIds = new Set();
    const artistsListened = new Set();
    let totalQuality = 0;
    let qualityCount = 0;
    let totalQualityWeightedByPlays = 0;
    let losslessCount = 0;
    let hiResCount = 0;

    function computeQualityScore(song) {
      const suffix = (song.suffix || '').toLowerCase();
      const contentType = (song.contentType || '').toLowerCase();
      const bitRate = song.bitRate || 0;
      const sampleRate = song.samplingRate || song.sampleRate || 0;
      const bitDepth = song.bitDepth || 0;

      const losslessSuffixes = ['flac', 'alac', 'wav', 'aiff', 'aif', 'ape'];
      const lossySuffixes = ['mp3', 'aac', 'm4a', 'ogg', 'opus'];

      const isLossless = losslessSuffixes.includes(suffix)
        || contentType.includes('flac')
        || contentType.includes('wav')
        || contentType.includes('alac')
        || contentType.includes('aiff');

      const isLossy = lossySuffixes.includes(suffix)
        || contentType.includes('mpeg')
        || contentType.includes('mp3')
        || contentType.includes('aac')
        || contentType.includes('ogg')
        || contentType.includes('opus');

      if (isLossless) {
        losslessCount += 1;
        if (bitDepth >= 24 && sampleRate >= 96000) {
          hiResCount += 1;
          return 100;
        }
        if (bitDepth >= 24 && sampleRate >= 48000) {
          return 95;
        }
        if (bitDepth >= 16 && sampleRate >= 44100) {
          return 85;
        }
        return 75;
      }

      if (isLossy) {
        if (bitRate >= 320) {
          return 75;
        }
        if (bitRate >= 256) {
          return 60;
        }
        if (bitRate >= 192) {
          return 45;
        }
        if (bitRate >= 128) {
          return 30;
        }
        return 15;
      }

      if (bitDepth >= 24 && sampleRate >= 96000) {
        hiResCount += 1;
        return 98;
      }
      if (bitRate >= 320) {
        return 70;
      }
      if (bitRate) {
        return Math.min(70, Math.floor((bitRate / 320) * 70));
      }
      return 50;
    }

    progressCallback(0, 'Starting album scan', 'albums');
    while (true) { // eslint-disable-line no-constant-condition
      const payload = await this._requestJson('getAlbumList2', {
        type: 'alphabeticalByName',
        size: 500,
        offset,
      });
      const batch = payload?.albumList2?.album || [];
      if (!batch.length) {
        break;
      }
      albums.push(...batch);
      offset += batch.length;
      progressCallback(10 + (albums.length / 5000) * 20, `Fetched ${albums.length} albums`, 'albums');
      await delay(100);
    }

    progressCallback(30, `Processing ${albums.length} albums`, 'albums');

    for (let i = 0; i < albums.length; i += 1) {
      const albumPayload = await this._requestJson('getAlbum', { id: albums[i].id });
      const album = albumPayload?.album;
      if (!album) {
        continue; // eslint-disable-line no-continue
      }

      for (const song of album.song || []) {
        const playCount = song.playCount || 0;
        const duration = song.duration || 0;
        const rating = song.userRating || 0;
        const artistName = song.displayArtist || song.artist || album.artist || '';
        const genre = song.genre || album.genre || '';
        const year = song.year || album.year || 0;
        const coverArt = song.coverArt || album.coverArt;
        totalBitrate += song.bitRate || 0;
        bitrateCount += song.bitRate ? 1 : 0;
        totalDuration += duration;
        numFavorites += song.starred ? 1 : 0;

        const quality = computeQualityScore(song);
        totalQuality += quality;
        qualityCount += 1;
        totalQualityWeightedByPlays += quality * (playCount || 1);

        if (song.played) {
          const playedMs = new Date(song.played).getTime();
          if (Number.isFinite(playedMs) && playedMs < oldestDate) {
            oldestDate = playedMs;
            oldestSong = {
              title: song.title || '',
              artist: artistName,
              played: song.played,
            };
          }
        }

        const artistsArr = Array.isArray(song.artists) && song.artists.length
          ? song.artists
          : [
            {
              id: song.artistId || album.artistId || '',
              name: artistName,
            },
          ];
        artistsArr.forEach((entry) => {
          const artistKey = entry.id || entry.name || artistName;
          const artistLabel = entry.name || artistName || 'Unknown artist';
          if (!artistKey && !artistLabel) {
            return;
          }
          const key = artistKey || artistLabel;
          artistIdToName.set(key, artistLabel);
          artistIds.add(key);
          if (playCount > 0) {
            artistsListened.add(key);
            artistPlays.set(key, (artistPlays.get(key) || 0) + playCount);
          }
        });

        const primaryArtist = artistsArr[0] || { id: '', name: artistName };
        const primaryArtistId = primaryArtist.id || primaryArtist.name || artistName;
        const primaryArtistLabel = primaryArtist.name || artistName || 'Unknown artist';

        songs.push({
          title: song.title || '',
          artists: artistsArr.map((entry) => entry.name || artistName || 'Unknown artist'),
          artist: primaryArtistLabel,
          duration,
          plays: playCount,
          rating,
          genre,
          year,
          album: album.name || '',
          albumId: album.id,
          artistId: primaryArtistId,
          coverArtId: coverArt,
          qualityScore: Math.round(quality),
        });

        if (playCount) {
          totalPlays += playCount;
          totalSec += duration * playCount;
        }

        if (rating) {
          rated += 1;
          ratingSum += rating;
        }
      }

      if (i % 50 === 0) {
        progressCallback(30 + (i / albums.length) * 60, `Album ${i}/${albums.length}`, 'albums');
      }
      await delay(50);
    }

    const avgBitrate = bitrateCount ? totalBitrate / bitrateCount : 0;
    const avgQuality = qualityCount ? totalQuality / qualityCount : 0;
    const avgQualityByPlays = totalPlays > 0 ? totalQualityWeightedByPlays / totalPlays : avgQuality;
    const percentLossless = qualityCount ? (losslessCount / qualityCount) * 100 : 0;
    const percentHiRes = qualityCount ? (hiResCount / qualityCount) * 100 : 0;

    progressCallback(90, 'Building final objects', 'wrap');

    const topArtists = [...artistPlays.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([id]) => (artistIdToName.get(id) || id).toLowerCase() !== 'various artists')
      .slice(0, 10)
      .map(([id, plays]) => [artistIdToName.get(id) || id, plays]);

    const topSongs = songs
      .filter((song) => song.plays)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10)
      .map((song) => ({
        title: song.title,
        artists: song.artists,
        plays: song.plays,
        albumId: song.albumId,
        coverArtId: song.coverArtId,
      }));

    const topAlbums = albums
      .filter((album) => album.playCount)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10)
      .map((album) => ({
        name: album.name,
        artists: album.artist || album.artistId || 'Unknown',
        playCount: album.playCount,
        id: album.id,
        coverArtId: album.coverArt,
      }));

    const topRated = songs
      .filter((song) => song.rating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map((song) => [song.rating, song.title, song.artist]);

    const genreSongCounts = {};
    const genrePlayCounts = {};
    const decadeSongCounts = {};
    const decadePlayCounts = {};
    const artistSongMap = new Map();
    const artistAlbumSet = new Map();

    songs.forEach((song) => {
      if (song.genre) {
        genreSongCounts[song.genre] = (genreSongCounts[song.genre] || 0) + 1;
        genrePlayCounts[song.genre] = (genrePlayCounts[song.genre] || 0) + (song.plays || 0);
      }

      const decade = song.year ? `${Math.floor(song.year / 10) * 10}s` : 'Unknown';
      decadeSongCounts[decade] = (decadeSongCounts[decade] || 0) + 1;
      decadePlayCounts[decade] = (decadePlayCounts[decade] || 0) + (song.plays || 0);

      const key = song.artistId || song.artists?.[0] || 'Unknown artist';
      if (!artistSongMap.has(key)) {
        artistSongMap.set(key, []);
      }
      artistSongMap.get(key).push(song);

      if (!artistAlbumSet.has(key)) {
        artistAlbumSet.set(key, new Set());
      }
      if (song.albumId) {
        artistAlbumSet.get(key).add(song.albumId);
      }
    });

    const topGenresByPlays = Object.entries(genrePlayCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topDecadesByPlays = Object.entries(decadePlayCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const deepArtists = [];
    for (let i = 0; i < Math.min(3, topArtists.length); i += 1) {
      const [name, plays] = topArtists[i];
      const key = artistIdToName.get(name) || name;
      const artistSongs = artistSongMap.get(key) || [];
      const albumsSet = artistAlbumSet.get(key) || new Set();
      const duration = artistSongs.reduce((total, song) => total + (song.duration || 0), 0);
      const listeningTime = artistSongs.reduce(
        (total, song) => total + (song.duration || 0) * (song.plays || 0),
        0,
      );
      const ratings = artistSongs.filter((song) => song.rating).map((song) => song.rating);
      const avgRating = ratings.length ? ratings.reduce((total, val) => total + val, 0) / ratings.length : 0;
      deepArtists.push({
        name,
        totalPlays: plays,
        totalSongs: artistSongs.length,
        albumCount: albumsSet.size,
        totalDuration: duration,
        listeningTime,
        averageRating: avgRating,
        topSongs: artistSongs
          .sort((a, b) => (b.plays || 0) - (a.plays || 0))
          .slice(0, 3)
          .map((song) => [song.title, song.plays || 0]),
      });
    }

    const diversity = artistIds.size ? (artistsListened.size / artistIds.size) * 100 : 0;

    const ratingDistribution = {
      '5_star': 0,
      '4_star': 0,
      '3_star': 0,
      '2_star': 0,
      '1_star': 0,
      unrated: 0,
    };
    songs.forEach((song) => {
      if (!song.rating) {
        ratingDistribution.unrated += 1;
      } else if (song.rating >= 4.5) {
        ratingDistribution['5_star'] += 1;
      } else if (song.rating >= 3.5) {
        ratingDistribution['4_star'] += 1;
      } else if (song.rating >= 2.5) {
        ratingDistribution['3_star'] += 1;
      } else if (song.rating >= 1.5) {
        ratingDistribution['2_star'] += 1;
      } else {
        ratingDistribution['1_star'] += 1;
      }
    });

    progressCallback(100, 'Done', 'complete');

    return {
      username: this.user,
      totalSongs: songs.length,
      totalAlbums: albums.length,
      totalArtists: artistIds.size,
      totalDuration,
      listeningTime: totalSec,
      topArtistsByPlays: topArtists,
      topSongsByPlaycount: topSongs,
      topAlbumsByPlaycount: topAlbums,
      topRatedSongs: topRated,
      albumBasedStats: {
        totalPlays,
        totalRatings: rated,
        averageRating: rated ? ratingSum / rated : 0,
        listeningTimeBreakdown: { formatted: this.fmtDuration(totalSec) },
        trueArtistDiversity: {
          listened: artistsListened.size,
          total: artistIds.size,
          percentage: diversity,
        },
        topGenresBySongs: Object.entries(genreSongCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topGenresByPlays,
        topDecadesBySongs: Object.entries(decadeSongCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topDecadesByPlays,
      },
      ratingDistribution,
      genreBreakdown: genreSongCounts,
      decadeBreakdown: decadeSongCounts,
      diversityScore: (
        1
        - [...artistPlays.values()].reduce((total, plays) => total + (plays / totalPlays) ** 2, 0)
      ) * 100,
      deepArtists,
      neglectedTrack: oldestSong,
      qualityScore: Math.round(avgQuality),
      qualityScoreByPlays: Math.round(avgQualityByPlays),
      percentLossless: Math.round(percentLossless * 10) / 10,
      percentHiRes: Math.round(percentHiRes * 10) / 10,
      avgBitrate: Math.round(avgBitrate),
      numFavorites,
      generatedAt: new Date().toISOString(),
    };
  }

  fmtDuration(seconds) {
    if (!seconds) {
      return '0s';
    }
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (seconds < 3600) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes % 60}m`;
  }
}
