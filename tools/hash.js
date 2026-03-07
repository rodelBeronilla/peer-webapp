// SHA Hash Generator
// Computes SHA-256, SHA-384, and SHA-512 hashes using the Web Crypto API.
// Updates live as the user types (debounced). No external dependencies.

import { copyText } from './utils.js';

const hashInput   = document.getElementById('hashInput');
const hashStatus  = document.getElementById('hashStatus');
const out256      = document.getElementById('hashOut256');
const out384      = document.getElementById('hashOut384');
const out512      = document.getElementById('hashOut512');
const copyBtn256  = document.getElementById('hashCopy256');
const copyBtn384  = document.getElementById('hashCopy384');
const copyBtn512  = document.getElementById('hashCopy512');
const casingBtn   = document.getElementById('hashCasing');
const clearBtn    = document.getElementById('hashClear');

// Compare mode elements
const compareToggle256 = document.getElementById('hashCompareToggle256');
const compareToggle384 = document.getElementById('hashCompareToggle384');
const compareToggle512 = document.getElementById('hashCompareToggle512');
const compareRow256    = document.getElementById('hashCompareRow256');
const compareRow384    = document.getElementById('hashCompareRow384');
const compareRow512    = document.getElementById('hashCompareRow512');
const expected256      = document.getElementById('hashExpected256');
const expected384      = document.getElementById('hashExpected384');
const expected512      = document.getElementById('hashExpected512');
const matchStatus256   = document.getElementById('hashMatch256');
const matchStatus384   = document.getElementById('hashMatch384');
const matchStatus512   = document.getElementById('hashMatch512');

let upperCase = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(msg, type = '') {
  hashStatus.textContent = msg;
  hashStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

async function digest(algorithm, data) {
  const buf = await crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function applyCase(hex) {
  return upperCase ? hex.toUpperCase() : hex;
}

// ---------------------------------------------------------------------------
// Compare mode
// ---------------------------------------------------------------------------

function updateMatchStatus(expectedInput, statusEl, computedOutput) {
  const expected = expectedInput.value.trim().toLowerCase();
  const computed  = computedOutput.value.toLowerCase();

  if (!expected || !computed) {
    statusEl.textContent = '';
    statusEl.className = 'hash-match';
    return;
  }

  const match = computed === expected;
  statusEl.textContent = match ? '✓ Match' : '✗ Mismatch';
  statusEl.className   = 'hash-match ' + (match ? 'hash-match--ok' : 'hash-match--err');
}

function clearMatchStatus(statusEl, expectedInput) {
  expectedInput.value  = '';
  statusEl.textContent = '';
  statusEl.className   = 'hash-match';
}

function wireCompareToggle(toggleBtn, row, expectedInput, statusEl, computedOutput) {
  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!expanded));
    row.hidden = expanded;
    if (!expanded) expectedInput.focus();
  });

  expectedInput.addEventListener('input', () => {
    updateMatchStatus(expectedInput, statusEl, computedOutput);
  });
}

wireCompareToggle(compareToggle256, compareRow256, expected256, matchStatus256, out256);
wireCompareToggle(compareToggle384, compareRow384, expected384, matchStatus384, out384);
wireCompareToggle(compareToggle512, compareRow512, expected512, matchStatus512, out512);

// ---------------------------------------------------------------------------
// Compute all three hashes in parallel
// ---------------------------------------------------------------------------
async function computeHashes() {
  const text = hashInput.value;

  if (!text) {
    out256.value = '';
    out384.value = '';
    out512.value = '';
    copyBtn256.disabled = true;
    copyBtn384.disabled = true;
    copyBtn512.disabled = true;
    clearMatchStatus(matchStatus256, expected256);
    clearMatchStatus(matchStatus384, expected384);
    clearMatchStatus(matchStatus512, expected512);
    setStatus('');
    return;
  }

  const encoded = new TextEncoder().encode(text);
  const byteLen = encoded.byteLength;

  try {
    const [h256, h384, h512] = await Promise.all([
      digest('SHA-256', encoded),
      digest('SHA-384', encoded),
      digest('SHA-512', encoded),
    ]);

    out256.value = applyCase(h256);
    out384.value = applyCase(h384);
    out512.value = applyCase(h512);

    copyBtn256.disabled = false;
    copyBtn384.disabled = false;
    copyBtn512.disabled = false;

    // Re-evaluate open compare fields against the new hashes
    updateMatchStatus(expected256, matchStatus256, out256);
    updateMatchStatus(expected384, matchStatus384, out384);
    updateMatchStatus(expected512, matchStatus512, out512);

    setStatus(`${byteLen} byte${byteLen !== 1 ? 's' : ''} · ${text.length} char${text.length !== 1 ? 's' : ''}`, 'ok');
  } catch {
    setStatus('Hashing failed — Web Crypto API not available.', 'error');
  }
}

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------
let debounceTimer;
function scheduleHash() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(computeHashes, 200);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

hashInput.addEventListener('input', scheduleHash);

casingBtn.addEventListener('click', () => {
  upperCase = !upperCase;
  casingBtn.textContent = upperCase ? 'UPPER' : 'lower';
  casingBtn.setAttribute('aria-pressed', String(upperCase));
  // Re-apply casing to existing outputs without re-hashing
  if (out256.value) out256.value = applyCase(out256.value.toLowerCase());
  if (out384.value) out384.value = applyCase(out384.value.toLowerCase());
  if (out512.value) out512.value = applyCase(out512.value.toLowerCase());
  // Case toggle doesn't change hash value — comparison is always case-insensitive
});

clearBtn.addEventListener('click', () => {
  hashInput.value = '';
  computeHashes();
  hashInput.focus();
});

copyBtn256.addEventListener('click', () => copyText(out256.value, copyBtn256));
copyBtn384.addEventListener('click', () => copyText(out384.value, copyBtn384));
copyBtn512.addEventListener('click', () => copyText(out512.value, copyBtn512));
