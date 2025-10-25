const BACKGROUND_SOURCES = {
  black: 'img/black.png',
  purple: 'img/purple.png',
  yellow: 'img/yellow.png',
  pink: 'img/pink.png',
};

const THEME_COLORS = {
  black: { label: '#f3f6ff', value: '#ffffff' },
  purple: { label: '#efe7ff', value: '#ffffff' },
  yellow: { label: '#2b2118', value: '#3b2815' },
  pink: { label: '#ffe7f5', value: '#ffffff' },
};

const ALL_SECTIONS = ['artists', 'tracks', 'time', 'genre', 'image'];
const SECTION_LABELS = {
  artists: 'Top artists',
  tracks: 'Top tracks',
  time: 'Minutes listened',
  genre: 'Top genre',
  image: 'Artist image',
};
const SERVICE_LABELS = {
  musicbrainz: 'MusicBrainz',
  navidrome: 'Navidrome',
};

function formatSectionListForStatus(sections) {
  if (!sections.length) {
    return '';
  }
  const labels = sections.map((section) => SECTION_LABELS[section] || section);
  if (labels.length === 1) {
    return labels[0];
  }
  const head = labels.slice(0, -1).join(', ');
  const tail = labels[labels.length - 1];
  return `${head} and ${tail}`;
}

function parseSectionSelection(raw) {
  if (!raw) {
    return [];
  }
  const input = raw.toLowerCase();
  if (input === 'all' || input === 'everything') {
    return [...ALL_SECTIONS];
  }
  const selections = new Set();
  if (input.includes('artist')) {
    selections.add('artists');
  }
  if (input.includes('track') || input.includes('song')) {
    selections.add('tracks');
  }
  if (input.includes('time') || input.includes('minute') || input.includes('listen')) {
    selections.add('time');
  }
  if (input.includes('genre')) {
    selections.add('genre');
  }
  if (
    input.includes('image')
    || input.includes('photo')
    || input.includes('cover')
    || input.includes('art')
  ) {
    selections.add('image');
  }
  return Array.from(selections);
}

const serviceInput = document.getElementById('service');
const serviceDropdown = document.querySelector('[data-service-dropdown]');
const serviceToggle = serviceDropdown ? serviceDropdown.querySelector('[data-dropdown-toggle]') : null;
const serviceMenu = serviceDropdown ? serviceDropdown.querySelector('[data-dropdown-menu]') : null;
const serviceOptions = serviceDropdown ? Array.from(serviceDropdown.querySelectorAll('[data-dropdown-option]')) : [];
const serviceCurrentLabel = serviceDropdown ? serviceDropdown.querySelector('.service-select__current') : null;

function getServiceLabel(key) {
  return SERVICE_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'MusicBrainz');
}

function getSelectedService() {
  return (serviceInput && serviceInput.value) || 'musicbrainz';
}

function updateServiceSelection(value, labelText) {
  if (serviceInput) {
    serviceInput.value = value;
  }
  if (serviceCurrentLabel) {
    serviceCurrentLabel.textContent = labelText || getServiceLabel(value);
  }
  serviceOptions.forEach((option) => {
    const isActive = option.dataset.value === value && option.getAttribute('aria-disabled') !== 'true';
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', String(isActive));
  });
}

function openServiceDropdown() {
  if (!serviceDropdown) {
    return;
  }
  serviceDropdown.classList.add('is-open');
  if (serviceToggle) {
    serviceToggle.setAttribute('aria-expanded', 'true');
  }
  if (serviceMenu) {
    serviceMenu.setAttribute('aria-hidden', 'false');
  }
}

function closeServiceDropdown() {
  if (!serviceDropdown) {
    return;
  }
  serviceDropdown.classList.remove('is-open');
  if (serviceToggle) {
    serviceToggle.setAttribute('aria-expanded', 'false');
  }
  if (serviceMenu) {
    serviceMenu.setAttribute('aria-hidden', 'true');
  }
}

function toggleServiceDropdown() {
  if (!serviceDropdown) {
    return;
  }
  if (serviceDropdown.classList.contains('is-open')) {
    closeServiceDropdown();
  } else {
    openServiceDropdown();
  }
}

function setupServiceDropdown() {
  if (!serviceDropdown) {
    return;
  }
  if (serviceToggle) {
    serviceToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleServiceDropdown();
    });
  }
  serviceOptions.forEach((option) => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      if (
        option.classList.contains('service-select__option--disabled')
        || option.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }
      const value = option.dataset.value || 'musicbrainz';
      const label = option.dataset.label || getServiceLabel(value);
      updateServiceSelection(value, label);
      closeServiceDropdown();
    });
  });
  document.addEventListener('click', (event) => {
    if (serviceDropdown && !serviceDropdown.contains(event.target)) {
      closeServiceDropdown();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeServiceDropdown();
    }
  });
  if (serviceMenu) {
    serviceMenu.setAttribute('aria-hidden', 'true');
  }
}

function withService(path) {
  const service = getSelectedService();
  if (!service) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}service=${encodeURIComponent(service)}`;
}

if (serviceDropdown) {
  updateServiceSelection(getSelectedService());
  setupServiceDropdown();
}

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
  if (isLoading) {
    closeServiceDropdown();
  }
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

  const selectedService = getSelectedService();
  const hasExisting = Boolean(generatedData);
  const sameProfile = hasExisting
    && generatedData.username === username
    && generatedData.service === selectedService;
  let sectionsToRefresh = [...ALL_SECTIONS];

  if (hasExisting) {
    const existingLabel = `"${generatedData.username}" via ${getServiceLabel(generatedData.service || 'musicbrainz')}`;
    const promptMessage = [
      sameProfile
        ? 'You already generated a wrapped for this selection.'
        : `Current wrapped belongs to ${existingLabel}.`,
      'Type:',
      '- keep — keep the existing poster',
      '- new — refresh everything',
      '- or list sections to refresh (artists, tracks, time, genre, image)',
    ].join('\n');
    const choiceRaw = window.prompt(promptMessage, 'new');
    if (choiceRaw === null) {
      setStatus('Generation cancelled.');
      return;
    }
    const choice = choiceRaw.trim().toLowerCase();
    if (choice === 'keep' || choice === 'old' || choice === 'current') {
      resultsCard.hidden = false;
      drawCanvas();
      downloadError.hidden = isCoverReady;
      toggleDownload(isCoverReady);
      setStatus('Keeping your current wrapped.');
      return;
    }
    if (choice && choice !== 'new') {
      const parsed = parseSectionSelection(choice);
      if (!parsed.length) {
        setStatus('No valid sections selected; keeping current wrapped.');
        toggleDownload(isCoverReady);
        return;
      }
      sectionsToRefresh = parsed;
    }
  }

  if (!hasExisting || !sameProfile) {
    sectionsToRefresh = [...ALL_SECTIONS];
  }

  const refreshImage = sectionsToRefresh.includes('image');

  setStatus('');
  setLoading(true);
  if (!hasExisting || sectionsToRefresh.length === ALL_SECTIONS.length) {
    resultsCard.hidden = true;
  }
  if (refreshImage) {
    downloadError.hidden = true;
    toggleDownload(false);
    isCoverReady = false;
  }

  try {
    if (!generatedData) {
      generatedData = {};
    }
    generatedData.username = username;
    generatedData.service = selectedService;

    await updateSections(username, sectionsToRefresh);

    drawCanvas();
    resultsCard.hidden = false;
    const statusMessage = sectionsToRefresh.length === ALL_SECTIONS.length
      ? `Wrapped refreshed for ${username}.`
      : `Updated ${formatSectionListForStatus(sectionsToRefresh)}.`;
    setStatus(statusMessage);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Something went wrong. Try again in a moment.', 'error');
  } finally {
    downloadError.hidden = isCoverReady;
    toggleDownload(isCoverReady);
    setLoading(false);
  }
}

async function fetchJson(url) {
  const response = await fetch(withService(url), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(withService(url), { cache: 'no-store' });
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
    const response = await fetch(withService(`/top/img/${encodeURIComponent(username)}`), { cache: 'no-store' });
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

async function updateSections(username, sections) {
  const tasks = [];

  if (sections.includes('artists')) {
    tasks.push((async () => {
      const artists = await fetchJson(`/top/artists/${encodeURIComponent(username)}/5`);
      generatedData.artists = artists;
      topArtistsEl.textContent = formatRankedList(artists);
    })());
  }

  if (sections.includes('tracks')) {
    tasks.push((async () => {
      const tracks = await fetchJson(`/top/tracks/${encodeURIComponent(username)}/5`);
      generatedData.tracks = tracks;
      topTracksEl.textContent = formatRankedList(tracks);
    })());
  }

  if (sections.includes('time')) {
    tasks.push((async () => {
      const minutes = await fetchText(`/time/total/${encodeURIComponent(username)}`);
      generatedData.minutes = minutes;
      listenTimeEl.textContent = minutes;
    })());
  }

  if (sections.includes('genre')) {
    tasks.push((async () => {
      const genre = await fetchText(`/top/genre/user/${encodeURIComponent(username)}`);
      const normalised = normaliseGenreLabel(genre);
      generatedData.genre = normalised;
      topGenreEl.textContent = normalised;
    })());
  }

  if (sections.includes('image')) {
    tasks.push((async () => {
      isCoverReady = await loadCoverArt(username);
    })());
  }

  await Promise.all(tasks);

  if (!sections.includes('artists') && Array.isArray(generatedData.artists)) {
    topArtistsEl.textContent = formatRankedList(generatedData.artists);
  }
  if (!sections.includes('tracks') && Array.isArray(generatedData.tracks)) {
    topTracksEl.textContent = formatRankedList(generatedData.tracks);
  }
  if (!sections.includes('time') && typeof generatedData.minutes === 'string') {
    listenTimeEl.textContent = generatedData.minutes;
  }
  if (!sections.includes('genre') && typeof generatedData.genre === 'string') {
    topGenreEl.textContent = normaliseGenreLabel(generatedData.genre);
  }
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
    const destX = 268;
    const destY = 244;
    const destSize = 544;
    const imgWidth = artistImg.naturalWidth;
    const imgHeight = artistImg.naturalHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = imgWidth;
    let sourceHeight = imgHeight;

    if (imgWidth > 0 && imgHeight > 0) {
      const imgAspect = imgWidth / imgHeight;
      if (imgAspect > 1) {
        sourceHeight = imgHeight;
        sourceWidth = imgHeight;
        sourceX = Math.floor((imgWidth - sourceWidth) / 2);
      } else if (imgAspect < 1) {
        sourceWidth = imgWidth;
        sourceHeight = imgWidth;
        sourceY = Math.floor((imgHeight - sourceHeight) / 2);
      }
    }

    ctx.drawImage(
      artistImg,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destSize,
      destSize,
    );
  }

  const palette = getPalette(theme);
  const listHeadingY = 1080;
  const listStartY = 1180;
  const summaryLabelY = 1700;
  const summaryValueY = 1775;

  ctx.fillStyle = palette.label;
  ctx.textBaseline = 'top';

  ctx.font = '400 40px Nunito';
  ctx.fillText('Top Artists', 112, listHeadingY);
  ctx.fillText('Top Tracks', 590, listHeadingY);

  const artistList = Array.isArray(generatedData.artists) ? generatedData.artists : [];
  const trackList = Array.isArray(generatedData.tracks) ? generatedData.tracks : [];
  ctx.font = '700 40px Nunito';
  drawList(artistList, 112, listStartY, palette.value);
  drawList(trackList, 590, listStartY, palette.value);

  ctx.font = '400 40px Nunito';
  ctx.fillStyle = palette.label;
  ctx.fillText('Minutes Listened', 112, summaryLabelY);
  ctx.fillText('Top Genre', 590, summaryLabelY);

  ctx.font = '700 68px Nunito';
  ctx.fillStyle = palette.value;
  const minutesLabel = typeof generatedData.minutes === 'string' ? generatedData.minutes : '0';
  const genreLabel = truncateForCanvas(normaliseGenreLabel(generatedData.genre), 20);
  ctx.fillText(minutesLabel, 112, summaryValueY);
  ctx.fillText(genreLabel, 590, summaryValueY);
}

function drawList(items, x, startY, color) {
  const lineHeight = 72;
  ctx.fillStyle = color;
  const list = Array.isArray(items) ? items : [];
  list.forEach((item, index) => {
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
