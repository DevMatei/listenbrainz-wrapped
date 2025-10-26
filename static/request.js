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
  listenbrainz: 'ListenBrainz',
  navidrome: 'Navidrome',
};
const ARTWORK_STORAGE_KEY = 'wrappedArtworkData';
const ARTWORK_TRANSFORM_KEY = 'wrappedArtworkTransform';
const ARTWORK_TOKEN_KEY = 'wrappedArtworkToken';
const ARTWORK_TOKEN_EXPIRY_KEY = 'wrappedArtworkTokenExpiry';
const COUNTER_REFRESH_INTERVAL = 30000;

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

let localArtworkStorageAvailable = true;
try {
  const testKey = '__wrapped_artwork_test__';
  window.localStorage.setItem(testKey, '1');
  window.localStorage.removeItem(testKey);
} catch (error) {
  console.warn('Local storage unavailable, will fall back to server for artwork.', error);
  localArtworkStorageAvailable = false;
}

function readLocal(key) {
  if (!localArtworkStorageAvailable) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('Local storage read failed; disabling local artwork cache.', error);
    localArtworkStorageAvailable = false;
    return null;
  }
}

function writeLocal(key, value) {
  if (!localArtworkStorageAvailable) {
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Local storage write failed; disabling local artwork cache.', error);
    localArtworkStorageAvailable = false;
    return false;
  }
}

function removeLocal(key) {
  if (!localArtworkStorageAvailable) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('Local storage removal failed.', error);
  }
}

const serviceInput = document.getElementById('service');
const serviceDropdown = document.querySelector('[data-service-dropdown]');
const serviceToggle = serviceDropdown ? serviceDropdown.querySelector('[data-dropdown-toggle]') : null;
const serviceMenu = serviceDropdown ? serviceDropdown.querySelector('[data-dropdown-menu]') : null;
const serviceOptions = serviceDropdown ? Array.from(serviceDropdown.querySelectorAll('[data-dropdown-option]')) : [];
const serviceCurrentLabel = serviceDropdown ? serviceDropdown.querySelector('.service-select__current') : null;

function getServiceLabel(key) {
  return SERVICE_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'ListenBrainz');
}

function getSelectedService() {
  return (serviceInput && serviceInput.value) || 'listenbrainz';
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
      const value = option.dataset.value || 'listenbrainz';
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
const artworkUploadInput = document.getElementById('artwork-upload');
const artworkUploadBtn = document.getElementById('artwork-upload-btn');
const artworkResetBtn = document.getElementById('artwork-reset-btn');
const artworkEditor = document.querySelector('.artwork-editor');
const artworkEditorControls = artworkEditor ? Array.from(artworkEditor.querySelectorAll('input[type="range"]')) : [];
const artworkScaleInput = document.getElementById('artwork-scale');
const artworkOffsetXInput = document.getElementById('artwork-offset-x');
const artworkOffsetYInput = document.getElementById('artwork-offset-y');
const wrappedCountEl = document.getElementById('wrapped-count');
const wrappedCountSinceEl = document.getElementById('wrapped-count-since');

const backgrounds = {};
let coverObjectUrl = null;
let generatedData = null;
let isCoverReady = false;
let customArtworkUrl = null;
let customArtworkActive = false;
let customArtworkPersistence = null;
let customArtworkServerToken = null;
let customArtworkServerExpiry = null;
let imageTransform = { scale: 1, offsetX: 0, offsetY: 0 };
let queueMessageVisible = false;

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

if (artworkUploadBtn && artworkUploadInput) {
  artworkUploadBtn.addEventListener('click', () => artworkUploadInput.click());
  artworkUploadInput.addEventListener('change', handleArtworkUpload);
}

if (artworkResetBtn) {
  artworkResetBtn.addEventListener('click', () => resetArtworkUpload());
}

if (artworkScaleInput) {
  artworkScaleInput.addEventListener('input', handleArtworkTransformChange);
}

if (artworkOffsetXInput) {
  artworkOffsetXInput.addEventListener('input', handleArtworkTransformChange);
}

if (artworkOffsetYInput) {
  artworkOffsetYInput.addEventListener('input', handleArtworkTransformChange);
}

restoreImageTransform();
restoreStoredArtwork();
setArtworkEditorEnabled(customArtworkActive);

window.addEventListener('load', () => {
  toggleDownload(false);
  const paint = () => window.requestAnimationFrame(drawCanvas);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(paint).catch(paint);
  } else {
    paint();
  }
  refreshWrappedCount();
  window.setInterval(refreshWrappedCount, COUNTER_REFRESH_INTERVAL);
  if (customArtworkActive) {
    applyCustomArtwork();
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
  if (artworkUploadBtn) {
    artworkUploadBtn.disabled = isLoading;
  }
  if (artworkResetBtn) {
    if (isLoading) {
      artworkResetBtn.disabled = true;
      artworkResetBtn.setAttribute('aria-disabled', 'true');
    } else if (customArtworkActive) {
      toggleArtworkReset(true);
    } else {
      toggleArtworkReset(false);
    }
  }
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

function handleArtworkTransformChange() {
  if (!customArtworkActive) {
    applyTransformToControls();
    return;
  }
  const nextScale = artworkScaleInput ? Number(artworkScaleInput.value) : imageTransform.scale;
  const nextOffsetX = artworkOffsetXInput ? Number(artworkOffsetXInput.value) : imageTransform.offsetX;
  const nextOffsetY = artworkOffsetYInput ? Number(artworkOffsetYInput.value) : imageTransform.offsetY;
  imageTransform = {
    scale: Number.isFinite(nextScale) ? nextScale : 1,
    offsetX: Number.isFinite(nextOffsetX) ? nextOffsetX : 0,
    offsetY: Number.isFinite(nextOffsetY) ? nextOffsetY : 0,
  };
  saveImageTransform();
  drawCanvas();
}

function applyTransformToControls() {
  if (artworkScaleInput) {
    artworkScaleInput.value = String(imageTransform.scale);
  }
  if (artworkOffsetXInput) {
    artworkOffsetXInput.value = String(imageTransform.offsetX);
  }
  if (artworkOffsetYInput) {
    artworkOffsetYInput.value = String(imageTransform.offsetY);
  }
}

function saveImageTransform() {
  if (!customArtworkActive) {
    return;
  }
  writeLocal(ARTWORK_TRANSFORM_KEY, JSON.stringify(imageTransform));
}

function toggleArtworkReset(enabled) {
  if (!artworkResetBtn) {
    return;
  }
  artworkResetBtn.disabled = !enabled;
  artworkResetBtn.setAttribute('aria-disabled', String(!enabled));
}

function setArtworkEditorEnabled(enabled) {
  if (artworkEditor) {
    artworkEditor.setAttribute('aria-disabled', String(!enabled));
  }
  artworkEditorControls.forEach((input) => {
    input.disabled = !enabled;
  });
}

async function applyCustomArtwork() {
  if (!customArtworkActive || !customArtworkUrl) {
    return false;
  }
  const loaded = await loadImage(artistImg, customArtworkUrl);
  if (loaded) {
    isCoverReady = true;
    downloadError.hidden = true;
    toggleDownload(true);
    setArtworkEditorEnabled(true);
    drawCanvas();
    return true;
  }
  setStatus(customArtworkPersistence === 'server'
    ? 'Server-stored artwork expired. Please upload a new image.'
    : 'Could not load that image. Try a different file.', 'error');
  resetArtworkUpload({ silent: true });
  return false;
}

async function handleArtworkUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith('image/')) {
    setStatus('Please select a valid image file.', 'error');
    event.target.value = '';
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    setStatus('Image must be smaller than 6 MB.', 'error');
    event.target.value = '';
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const stored = writeLocal(ARTWORK_STORAGE_KEY, dataUrl);
    if (!stored) {
      removeLocal(ARTWORK_STORAGE_KEY);
      await uploadArtworkToServer(file);
      return;
    }
    clearServerToken();
    customArtworkUrl = dataUrl;
    customArtworkActive = true;
    customArtworkPersistence = 'local';
    toggleArtworkReset(true);
    setArtworkEditorEnabled(true);
    setStatus('Custom artwork saved to your browser.');
    await applyCustomArtwork();
  } catch (error) {
    console.warn('Local artwork save failed, falling back to server.', error);
    try {
      await uploadArtworkToServer(file);
    } catch (uploadError) {
      console.error(uploadError);
      setStatus('Something went wrong while loading the artwork.', 'error');
      resetArtworkUpload({ silent: true });
    }
  }
}

function resetArtworkUpload(options = {}) {
  const { silent = false } = options;
  if (customArtworkUrl && customArtworkUrl.startsWith('blob:')) {
    URL.revokeObjectURL(customArtworkUrl);
  }
  customArtworkUrl = null;
  customArtworkActive = false;
  customArtworkPersistence = null;
  removeLocal(ARTWORK_STORAGE_KEY);
  clearServerToken();
  if (artworkUploadInput) {
    artworkUploadInput.value = '';
  }
  toggleArtworkReset(false);
  setArtworkEditorEnabled(false);
  if (!silent) {
    setStatus('Custom artwork cleared. The next generation will fetch Last.fm artwork again.');
  }
  if (generatedData && generatedData.username) {
    loadCoverArt(generatedData.username).then((success) => {
      isCoverReady = success;
      downloadError.hidden = success;
      toggleDownload(success);
      drawCanvas();
    });
  } else {
    isCoverReady = false;
    toggleDownload(false);
  }
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
    const existingLabel = `"${generatedData.username}" via ${getServiceLabel(generatedData.service || 'listenbrainz')}`;
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
    if (customArtworkActive && customArtworkUrl) {
      isCoverReady = true;
      toggleDownload(true);
    } else {
      toggleDownload(false);
      isCoverReady = false;
    }
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
    if (sectionsToRefresh.length === ALL_SECTIONS.length) {
      await recordWrappedGenerated();
    }
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
  if (customArtworkActive && customArtworkUrl) {
    if (coverObjectUrl) {
      URL.revokeObjectURL(coverObjectUrl);
      coverObjectUrl = null;
    }
    return applyCustomArtwork();
  }
  setArtworkEditorEnabled(false);
  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = null;
  }

  try {
    const response = await fetch(withService(`/top/img/${encodeURIComponent(username)}`), { cache: 'no-store' });
    if (response.status === 429) {
      throw new Error(await parseError(response));
    }
    if (!response.ok) {
      throw new Error('Artist image unavailable');
    }
    const queuePosition = Number(response.headers.get('X-Image-Queue-Position'));
    if (Number.isFinite(queuePosition) && queuePosition > 0) {
      setStatus(`Image queue is busy (position ${queuePosition}). Hang tight, we’ll grab the art asap.`);
      queueMessageVisible = true;
    } else if (queueMessageVisible) {
      setStatus('');
      queueMessageVisible = false;
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

async function uploadArtworkToServer(file) {
  removeLocal(ARTWORK_STORAGE_KEY);
  const formData = new FormData();
  formData.append('artwork', file, file.name || 'artwork.png');
  const response = await fetch('/artwork/upload', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  customArtworkUrl = `/artwork/${payload.token}`;
  customArtworkActive = true;
  customArtworkPersistence = 'server';
  persistServerToken(payload.token, payload.expires_in || 0);
  toggleArtworkReset(true);
  setArtworkEditorEnabled(true);
  setStatus('Artwork stored server-side for up to 1 hour, then purged automatically.');
  await applyCustomArtwork();
}

function populateResults(data) {
  topArtistsEl.textContent = formatRankedList(data.artists);
  topTracksEl.textContent = formatRankedList(data.tracks);
  listenTimeEl.textContent = data.minutes;
  topGenreEl.textContent = normaliseGenreLabel(data.genre);
}

function formatRankedList(items) {
  if (!Array.isArray(items) || !items.length) {
    return 'No data yet';
  }
  return items
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');
}

function sanitiseRankedArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object') {
        return (item.artist_name || item.track_name || item.name || '').trim();
      }
      return '';
    })
    .filter(Boolean);
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

function ensureMinutesLabel(value) {
  if (typeof value !== 'string') {
    return '0';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '0';
  }
  return trimmed;
}

function restoreImageTransform() {
  const raw = readLocal(ARTWORK_TRANSFORM_KEY);
  if (!raw) {
    applyTransformToControls();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    imageTransform = {
      scale: Number.isFinite(parsed.scale) ? parsed.scale : 1,
      offsetX: Number.isFinite(parsed.offsetX) ? parsed.offsetX : 0,
      offsetY: Number.isFinite(parsed.offsetY) ? parsed.offsetY : 0,
    };
  } catch (error) {
    console.warn('Failed to parse stored artwork transform.', error);
    imageTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  }
  applyTransformToControls();
}

function restoreStoredArtwork() {
  const storedData = readLocal(ARTWORK_STORAGE_KEY);
  if (storedData) {
    customArtworkUrl = storedData;
    customArtworkActive = true;
    customArtworkPersistence = 'local';
    toggleArtworkReset(true);
    setArtworkEditorEnabled(true);
    applyCustomArtwork();
    return;
  }
  try {
    const token = window.sessionStorage.getItem(ARTWORK_TOKEN_KEY);
    const expiry = Number(window.sessionStorage.getItem(ARTWORK_TOKEN_EXPIRY_KEY));
    if (token && Number.isFinite(expiry) && Date.now() < expiry) {
      customArtworkServerToken = token;
      customArtworkServerExpiry = expiry;
      customArtworkUrl = `/artwork/${token}`;
      customArtworkActive = true;
      customArtworkPersistence = 'server';
      toggleArtworkReset(true);
      setArtworkEditorEnabled(true);
      applyCustomArtwork();
    }
  } catch (error) {
    console.warn('Session storage unavailable; cannot restore server artwork token.', error);
  }
}

function persistServerToken(token, expiresInSeconds) {
  customArtworkServerToken = token;
  customArtworkServerExpiry = Date.now() + (Number(expiresInSeconds) || 0) * 1000;
  try {
    window.sessionStorage.setItem(ARTWORK_TOKEN_KEY, customArtworkServerToken);
    window.sessionStorage.setItem(ARTWORK_TOKEN_EXPIRY_KEY, String(customArtworkServerExpiry));
  } catch (error) {
    console.warn('Session storage unavailable for server artwork token.', error);
  }
}

function clearServerToken() {
  customArtworkServerToken = null;
  customArtworkServerExpiry = null;
  try {
    window.sessionStorage.removeItem(ARTWORK_TOKEN_KEY);
    window.sessionStorage.removeItem(ARTWORK_TOKEN_EXPIRY_KEY);
  } catch (error) {
    console.warn('Unable to clear server artwork token from session storage.', error);
  }
}

function updateWrappedCounter(count, since) {
  if (!wrappedCountEl) {
    return;
  }
  const parsed = Number(count);
  if (!Number.isFinite(parsed)) {
    return;
  }
  wrappedCountEl.textContent = parsed.toLocaleString();
  if (wrappedCountSinceEl && since) {
    let formatted = since;
    const parsed = new Date(since);
    if (!Number.isNaN(parsed.getTime())) {
      formatted = parsed.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    }
    wrappedCountSinceEl.textContent = formatted;
  }
}

async function refreshWrappedCount() {
  if (!wrappedCountEl) {
    return;
  }
  try {
    const response = await fetch('/metrics/wrapped', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    updateWrappedCounter(data.count, data.since);
  } catch (error) {
    console.warn('Unable to refresh wrapped counter', error);
  }
}

async function recordWrappedGenerated() {
  try {
    const response = await fetch('/metrics/wrapped', { method: 'POST' });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    const data = await response.json();
    updateWrappedCounter(data.count, data.since);
  } catch (error) {
    console.error('Unable to record wrapped generation', error);
  }
}

async function updateSections(username, sections) {
  const tasks = [];

  if (sections.includes('artists')) {
    tasks.push((async () => {
      const artists = sanitiseRankedArray(await fetchJson(`/top/artists/${encodeURIComponent(username)}/5`));
      generatedData.artists = artists;
      topArtistsEl.textContent = formatRankedList(artists);
    })());
  }

  if (sections.includes('tracks')) {
    tasks.push((async () => {
      const tracks = sanitiseRankedArray(await fetchJson(`/top/tracks/${encodeURIComponent(username)}/5`));
      generatedData.tracks = tracks;
      topTracksEl.textContent = formatRankedList(tracks);
    })());
  }

  if (sections.includes('time')) {
    tasks.push((async () => {
      const minutes = ensureMinutesLabel(await fetchText(`/time/total/${encodeURIComponent(username)}`));
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
      if (customArtworkActive && customArtworkUrl) {
        isCoverReady = await applyCustomArtwork();
      } else {
        isCoverReady = await loadCoverArt(username);
      }
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
    listenTimeEl.textContent = ensureMinutesLabel(generatedData.minutes);
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
    const containScale = Math.min(destSize / imgWidth, destSize / imgHeight);
    const allowTransform = customArtworkActive;
    const userScale = allowTransform && Number.isFinite(imageTransform.scale) ? imageTransform.scale : 1;
    const offsetX = allowTransform && Number.isFinite(imageTransform.offsetX) ? imageTransform.offsetX : 0;
    const offsetY = allowTransform && Number.isFinite(imageTransform.offsetY) ? imageTransform.offsetY : 0;

    const drawWidth = imgWidth * containScale * userScale;
    const drawHeight = imgHeight * containScale * userScale;
    const drawX = destX + (destSize - drawWidth) / 2 + offsetX;
    const drawY = destY + (destSize - drawHeight) / 2 + offsetY;

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(destX, destY, destSize, destSize, 32);
    } else {
      ctx.rect(destX, destY, destSize, destSize);
    }
    ctx.clip();
    ctx.drawImage(artistImg, 0, 0, imgWidth, imgHeight, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    ctx.save();
    const frameGradient = ctx.createLinearGradient(destX, destY, destX, destY + destSize);
    frameGradient.addColorStop(0, 'rgba(5, 8, 16, 0.55)');
    frameGradient.addColorStop(1, 'rgba(5, 8, 16, 0.25)');
    ctx.strokeStyle = frameGradient;
    ctx.lineWidth = 10;
    ctx.strokeRect(destX + 5, destY + 5, destSize - 10, destSize - 10);
    ctx.restore();
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
