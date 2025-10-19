const BACKGROUND_SOURCES = {
  black: 'img/black.png',
  purple: 'img/purple.png',
  yellow: 'img/yellow.png',
  pink: 'img/pink.png',
};

const THEME_COLORS = {
  black: { label: '#f3f6ff', value: '#ffffff' },
  purple: { label: '#efe7ff', value: '#ffffff' },
  yellow: { label: '#2b2118', value: '#1e150f' },
  pink: { label: '#ffe7f5', value: '#ffffff' },
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const form = document.getElementById('wrapped-form');
const usernameField = document.getElementById('username');
const themeSelect = document.getElementById('color');
const downloadBtn = document.getElementById('download');
const loadingIndicator = document.getElementById('loading');
const statusMessage = document.getElementById('status-message');
const downloadError = document.getElementById('download-error');
const resultsCard = document.querySelector('.results');
const topArtistsEl = document.getElementById('top-artists');
const topTracksEl = document.getElementById('top-tracks');
const listenTimeEl = document.getElementById('listen-time');
const topGenreEl = document.getElementById('top-genre');
const artistImg = document.getElementById('artist-img');

const backgrounds = {};
let coverObjectUrl = null;
let generatedData = null;
let isCoverReady = false;

function getPalette(theme) {
  return THEME_COLORS[theme] || THEME_COLORS.black;
}

artistImg.crossOrigin = 'anonymous';

Object.entries(BACKGROUND_SOURCES).forEach(([key, src]) => {
  const image = new Image();
  image.src = src;
  image.onload = () => {
    if (key === themeSelect.value) {
      drawCanvas();
    }
  };
  backgrounds[key] = image;
});

form.addEventListener('submit', generateWrapped);
themeSelect.addEventListener('change', () => {
  drawCanvas();
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'listenbrainz-wrapped.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

window.addEventListener('load', () => {
  toggleDownload(false);
  const paint = () => window.requestAnimationFrame(drawCanvas);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(paint).catch(paint);
  } else {
    paint();
  }
});

function toggleDownload(enabled) {
  downloadBtn.disabled = !enabled;
  downloadBtn.setAttribute('aria-disabled', String(!enabled));
}

function setLoading(isLoading) {
  loadingIndicator.hidden = !isLoading;
  downloadBtn.setAttribute('aria-busy', String(isLoading));
  form.querySelectorAll('input, button, select').forEach((element) => {
    if (element !== themeSelect) {
      element.disabled = isLoading;
    }
  });
}

function setStatus(message, type = 'info') {
  if (!message) {
    statusMessage.hidden = true;
    statusMessage.textContent = '';
    return;
  }
  statusMessage.hidden = false;
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', type === 'error');
}

async function generateWrapped(event) {
  event.preventDefault();
  const username = usernameField.value.trim();
  if (!username) {
    setStatus('Enter a ListenBrainz username to get started.', 'error');
    return;
  }

  setStatus('');
  setLoading(true);
  resultsCard.hidden = true;
  downloadError.hidden = true;
  toggleDownload(false);
  isCoverReady = false;

  try {
    const [artists, tracks, minutes, genre] = await Promise.all([
      fetchJson(`/top/artists/${encodeURIComponent(username)}/5`),
      fetchJson(`/top/tracks/${encodeURIComponent(username)}/5`),
      fetchText(`/time/total/${encodeURIComponent(username)}`),
      fetchText(`/top/genre/user/${encodeURIComponent(username)}`),
    ]);

    isCoverReady = await loadCoverArt(username);

    generatedData = {
      username,
      artists,
      tracks,
      minutes,
      genre: normaliseGenreLabel(genre),
    };

    populateResults(generatedData);
    drawCanvas();

    resultsCard.hidden = false;
    toggleDownload(isCoverReady);
    downloadError.hidden = isCoverReady;
    setStatus(`Wrapped ready for ${username}.`);
  } catch (error) {
    console.error(error);
    generatedData = null;
    setStatus(error.message || 'Something went wrong. Try again in a moment.', 'error');
  } finally {
    setLoading(false);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.text();
}

async function parseError(response) {
  const fallback = `Request failed (${response.status})`;
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const body = await response.json();
      return body.description || body.error || fallback;
    }
    const text = await response.text();
    if (!text) {
      return fallback;
    }
    return text.replace(/<[^>]+>/g, '').trim() || fallback;
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

async function loadCoverArt(username) {
  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = null;
  }

  try {
    const response = await fetch(`/top/img/${encodeURIComponent(username)}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Artist image unavailable');
    }
    const blob = await response.blob();
    coverObjectUrl = URL.createObjectURL(blob);
    const loaded = await loadImage(artistImg, coverObjectUrl);
    if (!loaded) {
      throw new Error('Artist image failed to load');
    }
    return true;
  } catch (error) {
    console.info('Artist image unavailable, using theme background instead.', error);
    await loadImage(artistImg, BACKGROUND_SOURCES.black);
    return false;
  }
}

function loadImage(img, src) {
  return new Promise((resolve) => {
    const cleanup = () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve(img.naturalWidth > 0);
    };
    const handleError = () => {
      cleanup();
      resolve(false);
    };

    img.addEventListener('load', handleLoad, { once: true });
    img.addEventListener('error', handleError, { once: true });

    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      cleanup();
      resolve(true);
    }
  });
}

function populateResults(data) {
  topArtistsEl.textContent = formatRankedList(data.artists);
  topTracksEl.textContent = formatRankedList(data.tracks);
  listenTimeEl.textContent = data.minutes;
  topGenreEl.textContent = normaliseGenreLabel(data.genre);
}

function formatRankedList(items) {
  return items
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');
}

function normaliseGenreLabel(value) {
  if (!value) {
    return 'No genre';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'no genre') {
    return 'No genre';
  }
  return trimmed;
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const theme = themeSelect.value;
  const background = backgrounds[theme];
  if (background && background.complete) {
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  } else if (background) {
    background.onload = () => drawCanvas();
  }

  if (!generatedData) {
    return;
  }

  if (isCoverReady && artistImg.complete && artistImg.naturalWidth > 0) {
    ctx.drawImage(artistImg, 268, 244, 544, 544);
  }

  const palette = getPalette(theme);
  const listHeadingY = 1030;
  const listStartY = 1110;
  const summaryLabelY = 1620;
  const summaryValueY = 1695;

  ctx.fillStyle = palette.label;
  ctx.textBaseline = 'top';

  ctx.font = '400 40px Nunito';
  ctx.fillText('Top Artists', 112, listHeadingY);
  ctx.fillText('Top Tracks', 590, listHeadingY);

  ctx.font = '700 40px Nunito';
  drawList(generatedData.artists, 112, listStartY, palette.value);
  drawList(generatedData.tracks, 590, listStartY, palette.value);

  ctx.font = '400 40px Nunito';
  ctx.fillStyle = palette.label;
  ctx.fillText('Minutes Listened', 112, summaryLabelY);
  ctx.fillText('Top Genre', 590, summaryLabelY);

  ctx.font = '700 68px Nunito';
  ctx.fillStyle = palette.value;
  ctx.fillText(generatedData.minutes, 112, summaryValueY);
  ctx.fillText(truncateForCanvas(generatedData.genre, 20), 590, summaryValueY);
}

function drawList(items, x, startY, color) {
  const lineHeight = 70;
  ctx.fillStyle = color;
  items.forEach((item, index) => {
    const label = `${index + 1}. ${truncateForCanvas(item, 24)}`;
    ctx.fillText(label, x, startY + index * lineHeight);
  });
}

function truncateForCanvas(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 1)}...`;
}
