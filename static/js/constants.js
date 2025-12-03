export const BACKGROUND_SOURCES = {
  black: 'img/black.png',
  purple: 'img/purple.png',
  yellow: 'img/yellow.png',
  pink: 'img/pink.png',
};

export const THEME_COLORS = {
  black: { label: '#f3f6ff', value: '#ffffff' },
  purple: { label: '#efe7ff', value: '#ffffff' },
  yellow: { label: '#2b2118', value: '#3b2815' },
  pink: { label: '#ffe7f5', value: '#ffffff' },
};

export const ALL_SECTIONS = ['artists', 'tracks', 'time', 'genre', 'image'];

export const SECTION_LABELS = {
  artists: 'Top artists',
  tracks: 'Top tracks',
  time: 'Minutes listened',
  genre: 'Top genre',
  image: 'Artist image',
};

export const SERVICE_LABELS = {
  listenbrainz: 'ListenBrainz',
  navidrome: 'Navidrome',
};

export const ARTWORK_STORAGE_KEY = 'wrappedArtworkData';
export const ARTWORK_TRANSFORM_KEY = 'wrappedArtworkTransform';
export const ARTWORK_TOKEN_KEY = 'wrappedArtworkToken';
export const ARTWORK_TOKEN_EXPIRY_KEY = 'wrappedArtworkTokenExpiry';
export const ARTWORK_SOURCE_KEY = 'wrappedArtworkSource';
export const TURNSTILE_TOKEN_KEY = 'wrappedTurnstileToken';
export const TURNSTILE_TOKEN_EXPIRY_KEY = 'wrappedTurnstileTokenExpiry';
export const TURNSTILE_TOKEN_TTL_MS = 4.5 * 60 * 1000;

export const COUNTER_REFRESH_INTERVAL = 30000;
export const MAX_ARTWORK_BYTES = 6 * 1024 * 1024;
