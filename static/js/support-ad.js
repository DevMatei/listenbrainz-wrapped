const AD_SCRIPT_SRC = 'https://pl28007060.effectivegatecpm.com/7aa51c6a07bc22c8f745bad7b838de01/invoke.js';
const SUPPORT_AD_SCRIPT_ID = 'support-ad-script';
const DEFAULT_ALLOWED_HOSTS = ['wrapped.devmatei.com'];

function getFallbackElement() {
  return document.getElementById('support-banner-fallback');
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
  const host = window.location.hostname || '';
  const overrides = window.__WRAPPED_ALLOWED_AD_HOSTS__;
  const allowedHosts = Array.isArray(overrides) && overrides.length ? overrides : DEFAULT_ALLOWED_HOSTS;
  return allowedHosts.includes(host);
}

function injectAdScript() {
  if (document.getElementById(SUPPORT_AD_SCRIPT_ID)) {
    return;
  }
  const script = document.createElement('script');
  script.id = SUPPORT_AD_SCRIPT_ID;
  script.async = true;
  script.dataset.cfasync = 'false';
  script.src = AD_SCRIPT_SRC;
  script.referrerPolicy = 'no-referrer';
  script.crossOrigin = 'anonymous';
  script.onerror = () => showFallback('network');
  document.body.appendChild(script);
}

function initSupportAd() {
  const adContainer = document.querySelector('[data-support-ad-container]');
  if (!adContainer) {
    return;
  }
  if (!shouldLoadAdScript()) {
    showFallback('host');
    return;
  }
  injectAdScript();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupportAd);
} else {
  initSupportAd();
}
