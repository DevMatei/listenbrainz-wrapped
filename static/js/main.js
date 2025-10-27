import {
  ALL_SECTIONS,
  ARTWORK_STORAGE_KEY,
  ARTWORK_TRANSFORM_KEY,
  ARTWORK_TOKEN_KEY,
  ARTWORK_TOKEN_EXPIRY_KEY,
  BACKGROUND_SOURCES,
  COUNTER_REFRESH_INTERVAL,
  MAX_ARTWORK_BYTES,
  SERVICE_LABELS,
} from './constants.js';
import { createCanvasRenderer } from './canvas-renderer.js';
import { createServiceSelector } from './service-selector.js';
import {
  formatSectionListForStatus,
  parseSectionSelection,
  formatRankedList,
  sanitiseRankedArray,
  normaliseGenreLabel,
  ensureMinutesLabel,
  loadImage,
  readFileAsDataUrl,
} from './utils.js';
import {
  readLocal,
  writeLocal,
  removeLocal,
  readSession,
  writeSession,
  removeSession,
} from './storage.js';

const serviceSelector = createServiceSelector();
serviceSelector.init();

const canvas = document.getElementById('canvas');
const themeSelect = document.getElementById('color');
const form = document.getElementById('wrapped-form');
const usernameField = document.getElementById('username');
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

const canvasRenderer = createCanvasRenderer({ canvas, themeSelect, artistImg });

function getServiceLabel(key) {
  if (SERVICE_LABELS[key]) {
    return SERVICE_LABELS[key];
  }
  return key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : 'ListenBrainz';
}
const state = {
  coverObjectUrl: null,
  generatedData: null,
  isCoverReady: false,
  customArtworkUrl: null,
  customArtworkActive: false,
  customArtworkPersistence: null,
  customArtworkServerToken: null,
  customArtworkServerExpiry: null,
  imageTransform: { scale: 1, offsetX: 0, offsetY: 0 },
  queueMessageVisible: false,
};

artistImg.crossOrigin = 'anonymous';

canvasRenderer.preloadBackgrounds(() => drawCanvas());

form.addEventListener('submit', generateWrapped);
themeSelect.addEventListener('change', () => drawCanvas());

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
setArtworkEditorEnabled(state.customArtworkActive);

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
  if (state.customArtworkActive) {
    applyCustomArtwork();
  }
});

function drawCanvas() {
  canvasRenderer.draw({
    data: state.generatedData,
    isCoverReady: state.isCoverReady,
    customArtworkActive: state.customArtworkActive,
    imageTransform: state.imageTransform,
  });
}

function toggleDownload(enabled) {
  downloadBtn.disabled = !enabled;
  downloadBtn.setAttribute('aria-disabled', String(!enabled));
}

function setLoading(isLoading) {
  loadingIndicator.hidden = !isLoading;
  downloadBtn.setAttribute('aria-busy', String(isLoading));
  if (isLoading) {
    serviceSelector.closeDropdown();
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
    } else if (state.customArtworkActive) {
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
  if (!state.customArtworkActive) {
    applyTransformToControls();
    return;
  }
  const nextScale = artworkScaleInput ? Number(artworkScaleInput.value) : state.imageTransform.scale;
  const nextOffsetX = artworkOffsetXInput ? Number(artworkOffsetXInput.value) : state.imageTransform.offsetX;
  const nextOffsetY = artworkOffsetYInput ? Number(artworkOffsetYInput.value) : state.imageTransform.offsetY;
  state.imageTransform = {
    scale: Number.isFinite(nextScale) ? nextScale : 1,
    offsetX: Number.isFinite(nextOffsetX) ? nextOffsetX : 0,
    offsetY: Number.isFinite(nextOffsetY) ? nextOffsetY : 0,
  };
  saveImageTransform();
  drawCanvas();
}

function applyTransformToControls() {
  if (artworkScaleInput) {
    artworkScaleInput.value = String(state.imageTransform.scale);
  }
  if (artworkOffsetXInput) {
    artworkOffsetXInput.value = String(state.imageTransform.offsetX);
  }
  if (artworkOffsetYInput) {
    artworkOffsetYInput.value = String(state.imageTransform.offsetY);
  }
}

function saveImageTransform() {
  if (!state.customArtworkActive) {
    return;
  }
  writeLocal(ARTWORK_TRANSFORM_KEY, JSON.stringify(state.imageTransform));
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
  if (!state.customArtworkActive || !state.customArtworkUrl) {
    return false;
  }
  const loaded = await loadImage(artistImg, state.customArtworkUrl);
  if (loaded) {
    state.isCoverReady = true;
    downloadError.hidden = true;
    toggleDownload(true);
    setArtworkEditorEnabled(true);
    drawCanvas();
    return true;
  }
  setStatus(state.customArtworkPersistence === 'server'
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
  if (file.size > MAX_ARTWORK_BYTES) {
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
    state.customArtworkUrl = dataUrl;
    state.customArtworkActive = true;
    state.customArtworkPersistence = 'local';
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
  if (state.customArtworkUrl && state.customArtworkUrl.startsWith('blob:')) {
    URL.revokeObjectURL(state.customArtworkUrl);
  }
  state.customArtworkUrl = null;
  state.customArtworkActive = false;
  state.customArtworkPersistence = null;
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
  if (state.generatedData && state.generatedData.username) {
    loadCoverArt(state.generatedData.username).then((success) => {
      state.isCoverReady = success;
      downloadError.hidden = success;
      toggleDownload(success);
      drawCanvas();
    });
  } else {
    state.isCoverReady = false;
    toggleDownload(false);
  }
}

function restoreImageTransform() {
  const raw = readLocal(ARTWORK_TRANSFORM_KEY);
  if (!raw) {
    applyTransformToControls();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state.imageTransform = {
      scale: Number.isFinite(parsed.scale) ? parsed.scale : 1,
      offsetX: Number.isFinite(parsed.offsetX) ? parsed.offsetX : 0,
      offsetY: Number.isFinite(parsed.offsetY) ? parsed.offsetY : 0,
    };
  } catch (error) {
    console.warn('Failed to parse stored artwork transform.', error);
    state.imageTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  }
  applyTransformToControls();
}

function restoreStoredArtwork() {
  const storedData = readLocal(ARTWORK_STORAGE_KEY);
  if (storedData) {
    state.customArtworkUrl = storedData;
    state.customArtworkActive = true;
    state.customArtworkPersistence = 'local';
    toggleArtworkReset(true);
    setArtworkEditorEnabled(true);
    applyCustomArtwork();
    return;
  }
  try {
    const token = readSession(ARTWORK_TOKEN_KEY);
    const expiry = Number(readSession(ARTWORK_TOKEN_EXPIRY_KEY));
    if (token && Number.isFinite(expiry) && Date.now() < expiry) {
      state.customArtworkServerToken = token;
      state.customArtworkServerExpiry = expiry;
      state.customArtworkUrl = `/artwork/${token}`;
      state.customArtworkActive = true;
      state.customArtworkPersistence = 'server';
      toggleArtworkReset(true);
      setArtworkEditorEnabled(true);
      applyCustomArtwork();
    }
  } catch (error) {
    console.warn('Session storage unavailable; cannot restore server artwork token.', error);
  }
}

function persistServerToken(token, expiresInSeconds) {
  state.customArtworkServerToken = token;
  state.customArtworkServerExpiry = Date.now() + (Number(expiresInSeconds) || 0) * 1000;
  writeSession(ARTWORK_TOKEN_KEY, state.customArtworkServerToken);
  writeSession(ARTWORK_TOKEN_EXPIRY_KEY, String(state.customArtworkServerExpiry));
}

function clearServerToken() {
  state.customArtworkServerToken = null;
  state.customArtworkServerExpiry = null;
  removeSession(ARTWORK_TOKEN_KEY);
  removeSession(ARTWORK_TOKEN_EXPIRY_KEY);
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
    const parsedDate = new Date(since);
    if (!Number.isNaN(parsedDate.getTime())) {
      formatted = parsedDate.toLocaleString(undefined, { month: 'short', year: 'numeric' });
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

async function generateWrapped(event) {
  event.preventDefault();
  const username = usernameField.value.trim();
  if (!username) {
    setStatus('Enter a ListenBrainz username to get started.', 'error');
    return;
  }

  const selectedService = serviceSelector.getValue();
  const hasExisting = Boolean(state.generatedData);
  const sameProfile = hasExisting
    && state.generatedData.username === username
    && state.generatedData.service === selectedService;
  let sectionsToRefresh = [...ALL_SECTIONS];

  if (hasExisting) {
    const existingLabel = `"${state.generatedData.username}" via ${getServiceLabel(state.generatedData.service || 'listenbrainz')}`;
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
      downloadError.hidden = state.isCoverReady;
      toggleDownload(state.isCoverReady);
      setStatus('Keeping your current wrapped.');
      return;
    }
    if (choice && choice !== 'new') {
      const parsed = parseSectionSelection(choice);
      if (!parsed.length) {
        setStatus('No valid sections selected; keeping current wrapped.');
        toggleDownload(state.isCoverReady);
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
    if (state.customArtworkActive && state.customArtworkUrl) {
      state.isCoverReady = true;
      toggleDownload(true);
    } else {
      toggleDownload(false);
      state.isCoverReady = false;
    }
  }

  try {
    if (!state.generatedData) {
      state.generatedData = {};
    }
    state.generatedData.username = username;
    state.generatedData.service = selectedService;

    await updateSections(username, sectionsToRefresh);

    drawCanvas();
    resultsCard.hidden = false;
    if (sectionsToRefresh.length === ALL_SECTIONS.length) {
      await recordWrappedGenerated();
    }
    const statusLabel = sectionsToRefresh.length === ALL_SECTIONS.length
      ? `Wrapped refreshed for ${username}.`
      : `Updated ${formatSectionListForStatus(sectionsToRefresh)}.`;
    setStatus(statusLabel);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Something went wrong. Try again in a moment.', 'error');
  } finally {
    downloadError.hidden = state.isCoverReady;
    toggleDownload(state.isCoverReady);
    setLoading(false);
  }
}

async function fetchJson(path) {
  const response = await fetch(serviceSelector.withService(path), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(serviceSelector.withService(path), { cache: 'no-store' });
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
  state.customArtworkUrl = `/artwork/${payload.token}`;
  state.customArtworkActive = true;
  state.customArtworkPersistence = 'server';
  persistServerToken(payload.token, payload.expires_in || 0);
  toggleArtworkReset(true);
  setArtworkEditorEnabled(true);
  setStatus('Artwork stored server-side for up to 1 hour, then purged automatically.');
  await applyCustomArtwork();
}

async function loadCoverArt(username) {
  if (state.customArtworkActive && state.customArtworkUrl) {
    if (state.coverObjectUrl) {
      URL.revokeObjectURL(state.coverObjectUrl);
      state.coverObjectUrl = null;
    }
    return applyCustomArtwork();
  }
  setArtworkEditorEnabled(false);
  if (state.coverObjectUrl) {
    URL.revokeObjectURL(state.coverObjectUrl);
    state.coverObjectUrl = null;
  }

  try {
    const response = await fetch(serviceSelector.withService(`/top/img/${encodeURIComponent(username)}`), { cache: 'no-store' });
    if (response.status === 429) {
      throw new Error(await parseError(response));
    }
    if (!response.ok) {
      throw new Error('Artist image unavailable');
    }
    const queuePosition = Number(response.headers.get('X-Image-Queue-Position'));
    if (Number.isFinite(queuePosition) && queuePosition > 0) {
      setStatus(`Image queue is busy (position ${queuePosition}). Hang tight, we’ll grab the art asap.`);
      state.queueMessageVisible = true;
    } else if (state.queueMessageVisible) {
      setStatus('');
      state.queueMessageVisible = false;
    }
    const blob = await response.blob();
    state.coverObjectUrl = URL.createObjectURL(blob);
    const loaded = await loadImage(artistImg, state.coverObjectUrl);
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

async function updateSections(username, sections) {
  const tasks = [];

  if (sections.includes('artists')) {
    tasks.push((async () => {
      const artists = sanitiseRankedArray(await fetchJson(`/top/artists/${encodeURIComponent(username)}/5`));
      state.generatedData.artists = artists;
      topArtistsEl.textContent = formatRankedList(artists);
    })());
  }

  if (sections.includes('tracks')) {
    tasks.push((async () => {
      const tracks = sanitiseRankedArray(await fetchJson(`/top/tracks/${encodeURIComponent(username)}/5`));
      state.generatedData.tracks = tracks;
      topTracksEl.textContent = formatRankedList(tracks);
    })());
  }

  if (sections.includes('time')) {
    tasks.push((async () => {
      const minutes = ensureMinutesLabel(await fetchText(`/time/total/${encodeURIComponent(username)}`));
      state.generatedData.minutes = minutes;
      listenTimeEl.textContent = minutes;
    })());
  }

  if (sections.includes('genre')) {
    tasks.push((async () => {
      const genre = await fetchText(`/top/genre/user/${encodeURIComponent(username)}`);
      const normalised = normaliseGenreLabel(genre);
      state.generatedData.genre = normalised;
      topGenreEl.textContent = normalised;
    })());
  }

  if (sections.includes('image')) {
    tasks.push((async () => {
      if (state.customArtworkActive && state.customArtworkUrl) {
        state.isCoverReady = await applyCustomArtwork();
      } else {
        state.isCoverReady = await loadCoverArt(username);
      }
    })());
  }

  await Promise.all(tasks);

  if (!sections.includes('artists') && Array.isArray(state.generatedData.artists)) {
    topArtistsEl.textContent = formatRankedList(state.generatedData.artists);
  }
  if (!sections.includes('tracks') && Array.isArray(state.generatedData.tracks)) {
    topTracksEl.textContent = formatRankedList(state.generatedData.tracks);
  }
  if (!sections.includes('time') && typeof state.generatedData.minutes === 'string') {
    listenTimeEl.textContent = ensureMinutesLabel(state.generatedData.minutes);
  }
  if (!sections.includes('genre') && typeof state.generatedData.genre === 'string') {
    topGenreEl.textContent = normaliseGenreLabel(state.generatedData.genre);
  }
}
