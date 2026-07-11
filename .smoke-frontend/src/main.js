const DEFAULT_API_KEY =
  'ifp_test_cli_D3rI_g802lD7_8a4e93de2094a459af6f0b313c03ade493e325c25a21cc28';

const STORAGE_KEY = 'oil-api-smoke.apiKey';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  form: $('#search-form'),
  pinInput: $('#pin-input'),
  searchBtn: $('#search-btn'),
  settingsToggle: $('#settings-toggle'),
  settingsPanel: $('#settings-panel'),
  apiKeyInput: $('#api-key-input'),
  saveSettings: $('#save-settings'),
  resetSettings: $('#reset-settings'),
  settingsStatus: $('#settings-status'),
  statusRegion: $('#status-region'),
  results: $('#results'),
  emptyState: $('#empty-state'),
  resultsTitle: $('#results-title'),
  resultsMeta: $('#results-meta'),
  priceGrid: $('#price-grid'),
};

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_KEY;
}

function setApiKey(key) {
  if (key === DEFAULT_API_KEY) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key);
  }
}

function formatCurrency(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function validatePin(pin) {
  return /^\d{6}$/.test(pin);
}

function setLoading(loading) {
  els.searchBtn.disabled = loading;
  els.searchBtn.classList.toggle('is-loading', loading);
  els.pinInput.disabled = loading;
}

function clearStatus() {
  els.statusRegion.innerHTML = '';
}

function showAlert(type, title, message, code) {
  const alert = document.createElement('div');
  alert.className = `alert alert--${type}`;
  alert.innerHTML = `
    <span class="alert__title">${escapeHtml(title)}</span>
    ${message ? `<span>${escapeHtml(message)}</span>` : ''}
    ${code ? `<div class="alert__code">${escapeHtml(code)}</div>` : ''}
  `;
  els.statusRegion.appendChild(alert);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderWarnings(warnings) {
  if (!warnings?.length) return;
  for (const w of warnings) {
    const type = w.code === 'NO_RESOLUTION' || w.code === 'NO_PRICE_AVAILABLE' ? 'warning' : 'info';
    showAlert(type, w.code, w.message, null);
  }
}

function renderPriceCard(price) {
  const card = document.createElement('article');
  card.className = 'price-card';

  const loc = price.location ?? {};
  const resolution = loc.resolution ?? {};
  const prov = price.provenance ?? {};
  const fuel = price.fuel ?? {};
  const priceVal = price.price ?? {};

  card.innerHTML = `
    <div class="price-card__top">
      <div>
        <h3 class="price-card__fuel">${escapeHtml(fuel.label ?? fuel.code ?? 'Fuel')}</h3>
        <span class="price-card__code">${escapeHtml(fuel.code ?? '')}</span>
      </div>
      <div class="price-card__amount">
        <span class="price-card__value">${escapeHtml(formatCurrency(priceVal.value, priceVal.currency))}</span>
        <span class="price-card__unit">per ${escapeHtml(priceVal.unit ?? fuel.unit ?? 'unit')}</span>
      </div>
    </div>
    <div class="price-card__details">
      <div class="price-card__row">
        <span>Location</span>
        <span>${escapeHtml([loc.city_name, loc.state_name].filter(Boolean).join(', ') || '—')}</span>
      </div>
      <div class="price-card__row">
        <span>PIN</span>
        <span>${escapeHtml(loc.pincode ?? '—')}</span>
      </div>
      <div class="price-card__row">
        <span>Resolution</span>
        <span>${escapeHtml(resolution.method ?? '—')}</span>
      </div>
      <div class="price-card__row">
        <span>Applicable date</span>
        <span>${escapeHtml(prov.applicable_date ?? '—')}</span>
      </div>
      <div class="price-card__row">
        <span>Freshness</span>
        <span class="badge badge--fresh" title="${escapeHtml(prov.freshness_badge ?? '')}">${escapeHtml(prov.freshness_badge ?? '—')}</span>
      </div>
    </div>
  `;

  return card;
}

function renderResults(data, meta, pin) {
  const prices = Array.isArray(data) ? data : [];

  els.emptyState.hidden = true;
  els.results.hidden = false;

  const firstLoc = prices[0]?.location;
  const locationLabel = firstLoc
    ? [firstLoc.city_name, firstLoc.state_name, firstLoc.pincode].filter(Boolean).join(' · ')
    : `PIN ${pin}`;

  els.resultsTitle.textContent = prices.length ? 'Fuel prices' : 'No prices found';
  els.resultsMeta.textContent = locationLabel;

  els.priceGrid.innerHTML = '';

  if (prices.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'results__meta';
    empty.textContent = 'The API returned no price rows for this PIN. Check warnings above.';
    els.priceGrid.appendChild(empty);
    return;
  }

  for (const price of prices) {
    els.priceGrid.appendChild(renderPriceCard(price));
  }

  if (meta?.cache?.status) {
    const cacheNote = document.createElement('p');
    cacheNote.className = 'results__meta';
    cacheNote.style.marginTop = '0.75rem';
    cacheNote.textContent = `Cache: ${meta.cache.status}${meta.cache.ttl_seconds != null ? ` · TTL ${meta.cache.ttl_seconds}s` : ''}`;
    els.priceGrid.appendChild(cacheNote);
  }
}

function showEmptyState() {
  els.results.hidden = true;
  els.emptyState.hidden = false;
}

async function fetchPrices(pin) {
  const params = new URLSearchParams({ pin });
  // Omit fuel — API defaults to PETROL, DIESEL, CNG, PNG (MVP_DEFAULT_FUELS).

  const res = await fetch(`/api/v1/prices?${params}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: 'application/json',
    },
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const err = body?.error ?? {};
    const errObj = new Error(err.message || `Request failed (HTTP ${res.status})`);
    errObj.status = res.status;
    errObj.code = err.code;
    errObj.details = err.details;
    throw errObj;
  }

  return body;
}

async function handleSearch(pin) {
  clearStatus();
  setLoading(true);

  try {
    const body = await fetchPrices(pin);
    renderWarnings(body.meta?.warnings);
    renderResults(body.data, body.meta, pin);
  } catch (err) {
    showEmptyState();

    if (err.status === 401) {
      showAlert(
        'error',
        'Unauthorized (401)',
        'Invalid or missing API key. Open Settings and verify your Bearer token.',
        err.code ?? 'UNAUTHORIZED',
      );
    } else if (err.status === 403) {
      showAlert('error', 'Forbidden (403)', err.message, err.code);
    } else if (err.status === 429) {
      showAlert('error', 'Rate limited (429)', err.message, err.code);
    } else if (err.code === 'VALIDATION_ERROR') {
      const detail = err.details?.map((d) => `${d.field}: ${d.reason}`).join('; ');
      showAlert('error', 'Validation error', err.message, detail);
    } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      showAlert(
        'error',
        'Network error',
        'Could not reach the API via the dev proxy. Is the backend running at 192.168.122.212:8080?',
        null,
      );
    } else {
      showAlert('error', err.code ?? 'Error', err.message ?? 'Something went wrong.', null);
    }
  } finally {
    setLoading(false);
  }
}

function initSettings() {
  els.apiKeyInput.value = getApiKey();

  els.settingsToggle.addEventListener('click', () => {
    const open = els.settingsPanel.hidden;
    els.settingsPanel.hidden = !open;
    els.settingsToggle.setAttribute('aria-expanded', String(open));
  });

  els.saveSettings.addEventListener('click', () => {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
      els.settingsStatus.textContent = 'API key cannot be empty.';
      els.settingsStatus.style.color = 'var(--error)';
      return;
    }
    setApiKey(key);
    els.settingsStatus.textContent = 'Settings saved.';
    els.settingsStatus.style.color = 'var(--success)';
    setTimeout(() => {
      els.settingsStatus.textContent = '';
    }, 2500);
  });

  els.resetSettings.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    els.apiKeyInput.value = DEFAULT_API_KEY;
    els.settingsStatus.textContent = 'Reset to default key.';
    els.settingsStatus.style.color = 'var(--success)';
    setTimeout(() => {
      els.settingsStatus.textContent = '';
    }, 2500);
  });
}

function initSearch() {
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = els.pinInput.value.trim();

    if (!validatePin(pin)) {
      clearStatus();
      showAlert('error', 'Invalid PIN', 'Enter exactly 6 digits (India Post PIN code).', null);
      return;
    }

    handleSearch(pin);
  });

  $$('.chip[data-pin]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const pin = chip.dataset.pin;
      els.pinInput.value = pin;
      handleSearch(pin);
    });
  });

  els.pinInput.addEventListener('input', () => {
    els.pinInput.value = els.pinInput.value.replace(/\D/g, '').slice(0, 6);
  });
}

initSettings();
initSearch();