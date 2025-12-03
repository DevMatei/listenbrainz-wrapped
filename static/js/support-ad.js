const AD_SCRIPT_SRC = 'https://pl28007060.effectivegatecpm.com/7aa51c6a07bc22c8f745bad7b838de01/invoke.js';
const SUPPORT_AD_SCRIPT_ID = 'support-ad-script';
const DEFAULT_ALLOWED_HOSTS = ['wrapped.devmatei.com'];
const SUPPORT_MESSAGE_HTML = `
  <strong class="support-banner__label" aria-hidden="true">Support this project</strong>
  <p class="support-banner__note">
    This slot stays quiet and respectful. If the network ad is blocked, sharing the site or sponsoring the GitHub project via Ko-fi helps cover hosting just as much.
  </p>
  <a class="support-banner__link" href="https://ko-fi.com/devmatei/projects" target="_blank" rel="noopener noreferrer">
    Sponsor the GitHub project on Ko-fi
  </a>
`;

function getFallbackElement() {
  return document.getElementById('support-banner-fallback');
}

function renderSupportMessage(container) {
  if (!container || container.dataset.supportMessageRendered === 'true') {
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'support-banner__house';
  wrapper.innerHTML = SUPPORT_MESSAGE_HTML;
  container.appendChild(wrapper);
  container.dataset.supportMessageRendered = 'true';
}

function showFallback(reason) {
  const fallback = getFallbackElement();
  if (!fallback) {
    return;
  }
  if (reason === 'host') {
    fallback.textContent = 'Ads only load on the production domain. All good — thanks for hacking locally!';
  }
  fallback.hidden = false;
}

function shouldLoadAdScript() {
  if (window.__WRAPPED_DISABLE_ADS__ === true) {
    return false;
  }
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') {
    return false;
  }
  const host = window.location.hostname || '';
  const overrides = window.__WRAPPED_ALLOWED_AD_HOSTS__;
  const allowedHosts = Array.isArray(overrides) && overrides.length ? overrides : DEFAULT_ALLOWED_HOSTS;
  return allowedHosts.includes(host);
}

function injectAdScript(adContainer) {
  if (document.getElementById(SUPPORT_AD_SCRIPT_ID)) {
    return;
  }
  let timeout = window.setTimeout(() => {
    showFallback('network');
  }, 3500);
  const script = document.createElement('script');
  script.id = SUPPORT_AD_SCRIPT_ID;
  script.async = true;
  script.dataset.cfasync = 'false';
  script.src = AD_SCRIPT_SRC;
  script.referrerPolicy = 'no-referrer';
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    window.clearTimeout(timeout);
    if (adContainer) {
      adContainer.setAttribute('data-ad-loaded', 'true');
    }
  };
  script.onerror = () => {
    window.clearTimeout(timeout);
    showFallback('network');
  };
  document.body.appendChild(script);
}

function initSupportAd() {
  const adContainer = document.querySelector('[data-support-ad-container]');
  if (!adContainer) {
    return;
  }
  renderSupportMessage(adContainer);
  if (!shouldLoadAdScript()) {
    showFallback('host');
    return;
  }
  injectAdScript(adContainer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupportAd);
} else {
  initSupportAd();
}
