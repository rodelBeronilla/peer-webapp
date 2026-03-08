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
  // Apply to file hash outputs too
  if (fileOut256 && fileOut256.value) fileOut256.value = applyCase(fileOut256.value.toLowerCase());
  if (fileOut384 && fileOut384.value) fileOut384.value = applyCase(fileOut384.value.toLowerCase());
  if (fileOut512 && fileOut512.value) fileOut512.value = applyCase(fileOut512.value.toLowerCase());
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

// ---------------------------------------------------------------------------
// HMAC section
// ---------------------------------------------------------------------------

const hmacKey     = document.getElementById('hmacKey');
const hmacMessage = document.getElementById('hmacMessage');
const hmacStatus  = document.getElementById('hmacStatus');
const hmacOut256  = document.getElementById('hmacOut256');
const hmacOut384  = document.getElementById('hmacOut384');
const hmacOut512  = document.getElementById('hmacOut512');
const hmacCopy256 = document.getElementById('hmacCopy256');
const hmacCopy384 = document.getElementById('hmacCopy384');
const hmacCopy512 = document.getElementById('hmacCopy512');
const hmacClearBtn = document.getElementById('hmacClear');

function setHmacStatus(msg, type = '') {
  hmacStatus.textContent = msg;
  hmacStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

async function hmacDigest(algorithm, keyStr, messageStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyStr),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(messageStr));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeHmac() {
  const keyStr = hmacKey.value;
  const msgStr = hmacMessage.value;

  if (!keyStr && !msgStr) {
    hmacOut256.value = '';
    hmacOut384.value = '';
    hmacOut512.value = '';
    hmacCopy256.disabled = true;
    hmacCopy384.disabled = true;
    hmacCopy512.disabled = true;
    setHmacStatus('');
    return;
  }

  if (!keyStr) {
    setHmacStatus('Enter a secret key.', 'error');
    return;
  }

  if (!msgStr) {
    hmacOut256.value = '';
    hmacOut384.value = '';
    hmacOut512.value = '';
    hmacCopy256.disabled = true;
    hmacCopy384.disabled = true;
    hmacCopy512.disabled = true;
    setHmacStatus('');
    return;
  }

  try {
    const [h256, h384, h512] = await Promise.all([
      hmacDigest('SHA-256', keyStr, msgStr),
      hmacDigest('SHA-384', keyStr, msgStr),
      hmacDigest('SHA-512', keyStr, msgStr),
    ]);

    hmacOut256.value = applyCase(h256);
    hmacOut384.value = applyCase(h384);
    hmacOut512.value = applyCase(h512);

    hmacCopy256.disabled = false;
    hmacCopy384.disabled = false;
    hmacCopy512.disabled = false;

    const msgBytes = new TextEncoder().encode(msgStr).byteLength;
    setHmacStatus(`${msgBytes} byte${msgBytes !== 1 ? 's' : ''} · key: ${keyStr.length} char${keyStr.length !== 1 ? 's' : ''}`, 'ok');
  } catch {
    setHmacStatus('HMAC failed — Web Crypto API not available.', 'error');
  }
}

let hmacDebounceTimer;
function scheduleHmac() {
  clearTimeout(hmacDebounceTimer);
  hmacDebounceTimer = setTimeout(computeHmac, 200);
}

hmacKey.addEventListener('input', scheduleHmac);
hmacMessage.addEventListener('input', scheduleHmac);

hmacClearBtn.addEventListener('click', () => {
  hmacKey.value = '';
  hmacMessage.value = '';
  computeHmac();
  hmacKey.focus();
});

hmacCopy256.addEventListener('click', () => copyText(hmacOut256.value, hmacCopy256));
hmacCopy384.addEventListener('click', () => copyText(hmacOut384.value, hmacCopy384));
hmacCopy512.addEventListener('click', () => copyText(hmacOut512.value, hmacCopy512));

// ---------------------------------------------------------------------------
// File Hash section
// ---------------------------------------------------------------------------

const fileDropZone     = document.getElementById('fileDropZone');
const fileInput        = document.getElementById('fileHashInput');
const fileHashStatus   = document.getElementById('fileHashStatus');
const fileOut256       = document.getElementById('fileHashOut256');
const fileOut384       = document.getElementById('fileHashOut384');
const fileOut512       = document.getElementById('fileHashOut512');
const fileCopy256      = document.getElementById('fileHashCopy256');
const fileCopy384      = document.getElementById('fileHashCopy384');
const fileCopy512      = document.getElementById('fileHashCopy512');
const fileClearBtn     = document.getElementById('fileHashClear');
const fileCompareToggle256 = document.getElementById('fileHashCompareToggle256');
const fileCompareToggle384 = document.getElementById('fileHashCompareToggle384');
const fileCompareToggle512 = document.getElementById('fileHashCompareToggle512');
const fileCompareRow256    = document.getElementById('fileHashCompareRow256');
const fileCompareRow384    = document.getElementById('fileHashCompareRow384');
const fileCompareRow512    = document.getElementById('fileHashCompareRow512');
const fileExpected256      = document.getElementById('fileHashExpected256');
const fileExpected384      = document.getElementById('fileHashExpected384');
const fileExpected512      = document.getElementById('fileHashExpected512');
const fileMatchStatus256   = document.getElementById('fileHashMatch256');
const fileMatchStatus384   = document.getElementById('fileHashMatch384');
const fileMatchStatus512   = document.getElementById('fileHashMatch512');

function setFileStatus(msg, type = '') {
  fileHashStatus.textContent = msg;
  fileHashStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function clearFileOutputs() {
  fileOut256.value = '';
  fileOut384.value = '';
  fileOut512.value = '';
  fileCopy256.disabled = true;
  fileCopy384.disabled = true;
  fileCopy512.disabled = true;
  clearMatchStatus(fileMatchStatus256, fileExpected256);
  clearMatchStatus(fileMatchStatus384, fileExpected384);
  clearMatchStatus(fileMatchStatus512, fileExpected512);
  fileDropZone.classList.remove('file-drop-zone--loaded');
  setFileStatus('');
}

async function hashFile(file) {
  setFileStatus(`Reading ${file.name}…`);

  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    setFileStatus('Could not read file.', 'error');
    return;
  }

  try {
    const [h256, h384, h512] = await Promise.all([
      digest('SHA-256', arrayBuffer),
      digest('SHA-384', arrayBuffer),
      digest('SHA-512', arrayBuffer),
    ]);

    fileOut256.value = applyCase(h256);
    fileOut384.value = applyCase(h384);
    fileOut512.value = applyCase(h512);

    fileCopy256.disabled = false;
    fileCopy384.disabled = false;
    fileCopy512.disabled = false;

    updateMatchStatus(fileExpected256, fileMatchStatus256, fileOut256);
    updateMatchStatus(fileExpected384, fileMatchStatus384, fileOut384);
    updateMatchStatus(fileExpected512, fileMatchStatus512, fileOut512);

    fileDropZone.classList.add('file-drop-zone--loaded');
    fileDropZone.querySelector('.file-drop-zone__label').textContent = file.name;
    fileDropZone.querySelector('.file-drop-zone__hint').textContent = formatBytes(file.size);
    setFileStatus(`${file.name} · ${formatBytes(file.size)}`, 'ok');
  } catch {
    setFileStatus('Hashing failed — Web Crypto API not available.', 'error');
  }
}

// Drop zone interaction
fileDropZone.addEventListener('click', () => fileInput.click());
fileDropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

fileDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  fileDropZone.classList.add('file-drop-zone--active');
});
fileDropZone.addEventListener('dragleave', () => {
  fileDropZone.classList.remove('file-drop-zone--active');
});
fileDropZone.addEventListener('drop', e => {
  e.preventDefault();
  fileDropZone.classList.remove('file-drop-zone--active');
  const file = e.dataTransfer.files[0];
  if (file) hashFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) hashFile(file);
});

fileClearBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileDropZone.querySelector('.file-drop-zone__label').innerHTML =
    'Drop file here or <span class="file-drop-zone__browse">browse</span>';
  fileDropZone.querySelector('.file-drop-zone__hint').textContent =
    'SHA-256, SHA-384, SHA-512 \u2014 nothing leaves your device';
  clearFileOutputs();
});

// Compare toggles for file hashes
wireCompareToggle(fileCompareToggle256, fileCompareRow256, fileExpected256, fileMatchStatus256, fileOut256);
wireCompareToggle(fileCompareToggle384, fileCompareRow384, fileExpected384, fileMatchStatus384, fileOut384);
wireCompareToggle(fileCompareToggle512, fileCompareRow512, fileExpected512, fileMatchStatus512, fileOut512);

fileCopy256.addEventListener('click', () => copyText(fileOut256.value, fileCopy256));
fileCopy384.addEventListener('click', () => copyText(fileOut384.value, fileCopy384));
fileCopy512.addEventListener('click', () => copyText(fileOut512.value, fileCopy512));
