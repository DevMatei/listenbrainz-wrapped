import { ALL_SECTIONS, SECTION_LABELS } from './constants.js';

export function formatSectionListForStatus(sections) {
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

export function parseSectionSelection(raw) {
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

export function formatRankedList(items) {
  if (!Array.isArray(items) || !items.length) {
    return 'No data yet';
  }
  return items
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');
}

export function sanitiseRankedArray(value) {
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

export function normaliseGenreLabel(value) {
  if (!value) {
    return 'No genre';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'no genre') {
    return 'No genre';
  }
  return trimmed;
}

export function ensureMinutesLabel(value) {
  if (typeof value !== 'string') {
    return '0';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '0';
  }
  return trimmed;
}

export function truncateForCanvas(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 1)}...`;
}

export function loadImage(img, src) {
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

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}
