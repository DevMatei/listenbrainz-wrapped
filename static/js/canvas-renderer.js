import { BACKGROUND_SOURCES, THEME_COLORS } from './constants.js';
import { normaliseGenreLabel, truncateForCanvas } from './utils.js';

function getPalette(theme) {
  return THEME_COLORS[theme] || THEME_COLORS.black;
}

export function createCanvasRenderer({ canvas, themeSelect, artistImg }) {
  const ctx = canvas.getContext('2d');
  const backgrounds = {};

  function preloadBackgrounds(callback) {
    Object.entries(BACKGROUND_SOURCES).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      image.onload = () => {
        if (key === themeSelect.value && typeof callback === 'function') {
          callback();
        }
      };
      backgrounds[key] = image;
    });
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

  function draw({ data, isCoverReady, customArtworkActive, imageTransform }) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const theme = themeSelect.value;
    const background = backgrounds[theme];
    if (background && background.complete) {
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } else if (background) {
      background.onload = () => draw({
        data,
        isCoverReady,
        customArtworkActive,
        imageTransform,
      });
    }

    if (!data) {
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

    const artistList = Array.isArray(data.artists) ? data.artists : [];
    const trackList = Array.isArray(data.tracks) ? data.tracks : [];
    ctx.font = '700 40px Nunito';
    drawList(artistList, 112, listStartY, palette.value);
    drawList(trackList, 590, listStartY, palette.value);

    ctx.font = '400 40px Nunito';
    ctx.fillStyle = palette.label;
    ctx.fillText('Minutes Listened', 112, summaryLabelY);
    ctx.fillText('Top Genre', 590, summaryLabelY);

    ctx.font = '700 68px Nunito';
    ctx.fillStyle = palette.value;
    const minutesLabel = typeof data.minutes === 'string' ? data.minutes : '0';
    const genreLabel = truncateForCanvas(normaliseGenreLabel(data.genre), 20);
    ctx.fillText(minutesLabel, 112, summaryValueY);
    ctx.fillText(genreLabel, 590, summaryValueY);
  }

  return {
    preloadBackgrounds,
    draw,
  };
}
