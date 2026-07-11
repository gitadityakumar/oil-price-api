const STORAGE_KEY = 'oil-api-smoke.apiKey';

const $ = (sel) => document.querySelector(sel);

const els = {
  form: $('#create-key-form'),
  name: $('#client-name'),
  tier: $('#client-tier'),
  live: $('#client-live'),
  rateLimit: $('#rate-limit'),
  quota: $('#quota'),
  createBtn: $('#create-btn'),
  status: $('#create-status'),
  resultPanel: $('#result-panel'),
  outClientId: $('#out-client-id'),
  outApiKey: $('#out-api-key'),
  useKeyBtn: $('#use-key-btn'),
  useKeyStatus: $('#use-key-status'),
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAlert(type, title, message) {
  els.status.innerHTML = '';
  const alert = document.createElement('div');
  alert.className = `alert alert--${type}`;
  alert.innerHTML = `
    <span class="alert__title">${escapeHtml(title)}</span>
    ${message ? `<span>${escapeHtml(message)}</span>` : ''}
  `;
  els.status.appendChild(alert);
}

function clearStatus() {
  els.status.innerHTML = '';
}

function setLoading(loading) {
  els.createBtn.disabled = loading;
  els.createBtn.classList.toggle('is-loading', loading);
}

function selectedScopes() {
  return [...document.querySelectorAll('input[name="scope"]:checked')].map((el) => el.value);
}

async function createClient(payload) {
  const res = await fetch('/dev/create-api-client', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Invalid JSON from create endpoint (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const msg = body?.error || body?.message || `Create failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return body;
}

function showResult({ client_id, api_key }) {
  els.resultPanel.hidden = false;
  els.outClientId.value = client_id;
  els.outApiKey.value = api_key;
  els.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearStatus();
  els.useKeyStatus.textContent = '';

  const name = els.name.value.trim();
  if (!name) {
    showAlert('error', 'Name required', 'Enter a client name.');
    return;
  }

  const scopes = selectedScopes();
  if (scopes.length === 0) {
    showAlert('error', 'Scopes required', 'Select at least one scope.');
    return;
  }

  const payload = {
    name,
    tier: els.tier.value,
    scopes,
    live: els.live.checked,
  };

  const rate = els.rateLimit.value.trim();
  const quota = els.quota.value.trim();
  if (rate) payload.rate_limit = Number(rate);
  if (quota) payload.quota = Number(quota);

  setLoading(true);
  try {
    const result = await createClient(payload);
    showAlert('info', 'Client created', 'Copy the API key below. It will not be shown again.');
    showResult(result);
  } catch (err) {
    els.resultPanel.hidden = true;
    showAlert(
      'error',
      'Could not create key',
      err.message ||
        'Is Postgres up (compose) and API_KEY_PEPPER / DATABASE_URL configured for the smoke frontend?',
    );
  } finally {
    setLoading(false);
  }
});

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = btn.getAttribute('data-copy');
    const input = document.getElementById(id);
    if (!input?.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.textContent = 'Copy';
      }, 1500);
    } catch {
      input.select();
      document.execCommand('copy');
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.textContent = 'Copy';
      }, 1500);
    }
  });
});

els.useKeyBtn.addEventListener('click', () => {
  const key = els.outApiKey.value.trim();
  if (!key) return;
  localStorage.setItem(STORAGE_KEY, key);
  els.useKeyStatus.textContent = 'Saved to localStorage — open Prices to use it.';
  els.useKeyStatus.style.color = 'var(--success)';
});
