// UUID Generator
// Generates RFC 4122 v4 (random) and v7 (time-ordered) UUIDs via Web Crypto API.

import { copyText } from './utils.js';

const uuidVersion  = document.getElementById('uuidVersion');
const uuidCount    = document.getElementById('uuidCount');
const uuidOutput   = document.getElementById('uuidOutput');
const uuidGenerate = document.getElementById('uuidGenerate');
const uuidCopy     = document.getElementById('uuidCopy');
const uuidCasing   = document.getElementById('uuidCasing');
const uuidStatus   = document.getElementById('uuidStatus');

// ---------------------------------------------------------------------------
// UUID v4 — 122 random bits, version/variant fields set per RFC 4122 §4.4
// Uses crypto.randomUUID() when available (all modern browsers), falls back
// to manual bit manipulation via getRandomValues.
// ---------------------------------------------------------------------------
function uuidV4() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  return formatBytes(bytes);
}

// ---------------------------------------------------------------------------
// UUID v7 — 48-bit Unix ms timestamp prefix, then version + random bits.
// Layout: tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx
//   bits 0–47  : current time in milliseconds (big-endian)
//   bits 48–51 : 0111 (version 7)
//   bits 52–63 : random
//   bits 64–65 : 10 (RFC 4122 variant)
//   bits 66–127: random
// ---------------------------------------------------------------------------
function uuidV7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ts = BigInt(Date.now());

  // Write 48-bit timestamp big-endian into bytes 0–5
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >>  8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  return formatBytes(bytes);
}

// ---------------------------------------------------------------------------
// Format a 16-byte array into xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
// ---------------------------------------------------------------------------
function formatBytes(bytes) {
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Generate N UUIDs of the selected version
// ---------------------------------------------------------------------------
function generate() {
  const version = uuidVersion.value;
  const count   = parseInt(uuidCount.value, 10);
  const upper   = uuidCasing.checked;
  const fn      = version === 'v7' ? uuidV7 : uuidV4;

  const uuids = Array.from({ length: count }, fn);
  const output = upper
    ? uuids.map(u => u.toUpperCase()).join('\n')
    : uuids.join('\n');

  uuidOutput.value = output;
  uuidCopy.disabled = false;

  const vLabel = version === 'v7' ? 'v7 (time-ordered)' : 'v4 (random)';
  uuidStatus.textContent = `Generated ${count} UUID${count !== 1 ? 's' : ''} · ${vLabel}`;
  uuidStatus.className = 'status-bar status-bar--ok';
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
uuidGenerate.addEventListener('click', generate);

uuidCopy.addEventListener('click', () => copyText(uuidOutput.value, uuidCopy));

uuidCasing.addEventListener('change', () => {
  if (!uuidOutput.value) return;
  uuidOutput.value = uuidCasing.checked
    ? uuidOutput.value.toUpperCase()
    : uuidOutput.value.toLowerCase();
});

// Generate one v4 UUID immediately on load
generate();
