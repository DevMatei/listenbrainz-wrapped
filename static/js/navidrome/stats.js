import {
  NAVIDROME_ALBUM_PAGE_SIZE,
  NAVIDROME_ALBUM_DELAY_MS,
  NAVIDROME_DETAIL_DELAY_MS,
  NAVIDROME_MAX_ALBUMS_TO_SCAN,
} from './constants.js';
import { delay } from './helpers.js';

export async function collectNavidromeStats(api, progressCallback = () => {}) {
  const albums = [];
  const songs = [];
  const artistPlays = new Map();
  const artistIdToName = new Map();
  const genrePlayCounts = {};
  let offset = 0;
  let totalSec = 0;

  progressCallback(0, 'Starting album scan', 'albums');
  while (albums.length < NAVIDROME_MAX_ALBUMS_TO_SCAN) {
    const payload = await api.requestJson('getAlbumList2', {
      type: 'alphabeticalByName',
      size: NAVIDROME_ALBUM_PAGE_SIZE,
      offset,
    });
    const batch = payload?.albumList2?.album || [];
    if (!batch.length) {
      break;
    }
    albums.push(...batch);
    offset += batch.length;
    const ratio = Math.min(albums.length / NAVIDROME_MAX_ALBUMS_TO_SCAN, 1);
    progressCallback(
      10 + ratio * 20,
      `Fetched ${Math.min(albums.length, NAVIDROME_MAX_ALBUMS_TO_SCAN)} albums`,
      'albums',
    );
    if (batch.length < NAVIDROME_ALBUM_PAGE_SIZE || albums.length >= NAVIDROME_MAX_ALBUMS_TO_SCAN) {
      break;
    }
    await delay(NAVIDROME_ALBUM_DELAY_MS);
  }

  const albumsToProcess = Math.min(albums.length, NAVIDROME_MAX_ALBUMS_TO_SCAN);
  progressCallback(30, `Processing ${albumsToProcess} albums`, 'albums');

  for (let i = 0; i < albumsToProcess; i += 1) {
    const albumPayload = await api.requestJson('getAlbum', { id: albums[i].id });
    const album = albumPayload?.album;
    if (!album) {
      continue; // eslint-disable-line no-continue
    }

    for (const song of album.song || []) {
      const playCount = song.playCount || 0;
      const duration = song.duration || 0;
      const artistName = song.displayArtist || song.artist || album.artist || '';
      const genre = (song.genre || album.genre || '').trim();
      const coverArt = song.coverArt || album.coverArt;
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
        if (playCount > 0) {
          artistPlays.set(key, (artistPlays.get(key) || 0) + playCount);
        }
      });

      songs.push({
        title: song.title || '',
        plays: playCount,
        albumId: album.id,
        coverArtId: coverArt,
      });

      if (genre) {
        genrePlayCounts[genre] = (genrePlayCounts[genre] || 0) + playCount;
      }
      if (playCount) {
        totalSec += duration * playCount;
      }
    }

    if (albumsToProcess && (i % 50 === 0 || i === albumsToProcess - 1)) {
      const ratio = Math.min((i + 1) / albumsToProcess, 1);
      progressCallback(30 + ratio * 55, `Album ${i + 1}/${albumsToProcess}`, 'albums');
    }
    await delay(NAVIDROME_DETAIL_DELAY_MS);
  }

  if (albums.length > NAVIDROME_MAX_ALBUMS_TO_SCAN) {
    progressCallback(85, `Sampled ${NAVIDROME_MAX_ALBUMS_TO_SCAN} albums for performance`, 'wrap');
  }

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
      title: song.title || 'Unknown track',
      coverArtId: song.coverArtId || null,
      albumId: song.albumId || null,
    }));

  const topAlbums = albums
    .slice(0, albumsToProcess)
    .filter((album) => album.playCount)
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 10)
    .map((album) => ({
      name: album.name,
      id: album.id,
      coverArtId: album.coverArt,
    }));

  const topGenresByPlays = Object.entries(genrePlayCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  progressCallback(100, 'Done', 'complete');

  return {
    username: api.user,
    listeningTime: totalSec,
    topArtistsByPlays: topArtists,
    topSongsByPlaycount: topSongs,
    topAlbumsByPlaycount: topAlbums,
    albumBasedStats: {
      topGenresByPlays,
    },
  };
}
