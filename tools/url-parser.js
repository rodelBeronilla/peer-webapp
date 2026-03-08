// tools/url-parser.js — URL Parser / Builder
// Decomposes a URL into editable fields; reconstructs the full URL on change.

import { copyText } from './utils.js';

const parserInput    = document.getElementById('urlParserInput');
const parserStatus   = document.getElementById('urlParserStatus');
const parserCopy     = document.getElementById('urlParserCopy');
const parserClear    = document.getElementById('urlParserClear');
const parserScheme   = document.getElementById('urlParserScheme');
const parserHost     = document.getElementById('urlParserHost');
const parserPort     = document.getElementById('urlParserPort');
const parserPath     = document.getElementById('urlParserPath');
const parserFragment = document.getElementById('urlParserFragment');
const paramsList     = document.getElementById('urlParamsList');
const paramsEmpty    = document.getElementById('urlParamsEmpty');
const addParamBtn    = document.getElementById('urlAddParam');

let rebuilding = false; // prevent parse↔build feedback loops

// ── Parse URL → fields ──────────────────────────────────────────────────────

function parseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    clearFields();
    setStatus('');
    return;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    setStatus('Invalid URL — cannot parse.', 'error');
    return;
  }

  rebuilding = true;
  parserScheme.value   = parsed.protocol.replace(/:$/, '');
  parserHost.value     = parsed.hostname;
  parserPort.value     = parsed.port;
  parserPath.value     = parsed.pathname;
  parserFragment.value = parsed.hash.replace(/^#/, '');

  renderParams(parsed.searchParams);

  setStatus(`Parsed · ${[...parsed.searchParams].length} query param(s)`, 'ok');
  rebuilding = false;
}

// ── Build URL ← fields ──────────────────────────────────────────────────────

function buildUrl() {
  if (rebuilding) return;

  const scheme   = parserScheme.value.trim() || 'https';
  const host     = parserHost.value.trim();
  const port     = parserPort.value.trim();
  const path     = parserPath.value.trim() || '/';
  const fragment = parserFragment.value.trim();

  if (!host) {
    setStatus('Host is required to build a URL.', 'error');
    return;
  }

  const params = collectParams();

  let url = `${scheme}://${host}`;
  if (port) url += `:${port}`;
  if (!path.startsWith('/')) url += '/';
  url += path;
  if (params.size > 0) url += '?' + params.toString();
  if (fragment) url += '#' + fragment;

  rebuilding = true;
  parserInput.value = url;
  rebuilding = false;

  setStatus('URL updated.', 'ok');
}

// ── Query param rows ─────────────────────────────────────────────────────────

function renderParams(searchParams) {
  // Remove old rows (keep empty sentinel)
  paramsList.querySelectorAll('.url-param-row').forEach(r => r.remove());
  paramsEmpty.hidden = false;

  if (!searchParams) return;

  const entries = [...searchParams.entries()];
  if (entries.length === 0) return;

  paramsEmpty.hidden = true;
  entries.forEach(([k, v]) => addParamRow(k, v));
}

function addParamRow(key = '', value = '') {
  paramsEmpty.hidden = true;

  const row = document.createElement('div');
  row.className = 'url-param-row';
  row.setAttribute('role', 'listitem');

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'url-param-key';
  keyInput.value = key;
  keyInput.placeholder = 'key';
  keyInput.spellcheck = false;
  keyInput.autocomplete = 'off';
  keyInput.setAttribute('aria-label', 'Parameter key');

  const sep = document.createElement('span');
  sep.className = 'url-param-sep';
  sep.textContent = '=';
  sep.setAttribute('aria-hidden', 'true');

  const valInput = document.createElement('input');
  valInput.type = 'text';
  valInput.className = 'url-param-val';
  valInput.value = value;
  valInput.placeholder = 'value';
  valInput.spellcheck = false;
  valInput.autocomplete = 'off';
  valInput.setAttribute('aria-label', 'Parameter value');

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn--sm btn--ghost url-param-remove';
  removeBtn.textContent = '×';
  removeBtn.setAttribute('aria-label', 'Remove parameter');
  removeBtn.addEventListener('click', () => {
    row.remove();
    if (!paramsList.querySelector('.url-param-row')) {
      paramsEmpty.hidden = false;
    }
    buildUrl();
  });

  keyInput.addEventListener('input', buildUrl);
  valInput.addEventListener('input', buildUrl);

  row.append(keyInput, sep, valInput, removeBtn);
  paramsList.appendChild(row);
}

function collectParams() {
  const params = new URLSearchParams();
  paramsList.querySelectorAll('.url-param-row').forEach(row => {
    const k = row.querySelector('.url-param-key').value.trim();
    const v = row.querySelector('.url-param-val').value;
    if (k) params.append(k, v);
  });
  return params;
}

// ── Status ───────────────────────────────────────────────────────────────────

function setStatus(msg, type = '') {
  parserStatus.textContent = msg;
  parserStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function clearFields() {
  parserScheme.value = '';
  parserHost.value = '';
  parserPort.value = '';
  parserPath.value = '';
  parserFragment.value = '';
  renderParams(null);
}

// ── Copy-part buttons ────────────────────────────────────────────────────────

document.querySelectorAll('.copy-url-part').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (target && target.value) copyText(target.value, btn);
  });
});

// ── Wire up events ───────────────────────────────────────────────────────────

parserInput.addEventListener('input', () => parseUrl(parserInput.value));

[parserScheme, parserHost, parserPort, parserPath, parserFragment].forEach(el =>
  el.addEventListener('input', buildUrl)
);

parserCopy.addEventListener('click', () => {
  if (parserInput.value) copyText(parserInput.value, parserCopy);
});

parserClear.addEventListener('click', () => {
  parserInput.value = '';
  clearFields();
  setStatus('');
  parserInput.focus();
});

addParamBtn.addEventListener('click', () => {
  addParamRow();
  const newRow = paramsList.querySelector('.url-param-row:last-child');
  newRow?.querySelector('.url-param-key')?.focus();
});
