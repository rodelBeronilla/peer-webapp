// UUID Generator

import { copyText } from './utils.js';

const uuidVersion  = document.getElementById('uuidVersion');
const uuidCount    = document.getElementById('uuidCount');
const uuidOutput   = document.getElementById('uuidOutput');
const uuidCase     = document.getElementById('uuidCase');
const uuidGenerate = document.getElementById('uuidGenerate');
const uuidCopyAll  = document.getElementById('uuidCopyAll');
const uuidStatus   = document.getElementById('uuidStatus');

function setStatus(msg, type = '') {
  uuidStatus.textContent = msg;
  uuidStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function formatUUID(bytes, upper) {
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  return upper ? uuid.toUpperCase() : uuid;
}

function generateV4() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Set version: bits 4-7 of byte 6 → 0100
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant: bits 6-7 of byte 8 → 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function generateV7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // First 48 bits = Unix timestamp in ms
  const now = BigInt(Date.now());
  bytes[0] = Number((now >> 40n) & 0xffn);
  bytes[1] = Number((now >> 32n) & 0xffn);
  bytes[2] = Number((now >> 24n) & 0xffn);
  bytes[3] = Number((now >> 16n) & 0xffn);
  bytes[4] = Number((now >> 8n)  & 0xffn);
  bytes[5] = Number(now          & 0xffn);
  // Set version: bits 4-7 of byte 6 → 0111
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Set variant: bits 6-7 of byte 8 → 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function generate() {
  const version = uuidVersion.value;
  const count   = parseInt(uuidCount.value, 10);
  const upper   = uuidCase.value === 'upper';

  const uuids = [];
  for (let i = 0; i < count; i++) {
    const bytes = version === 'v7' ? generateV7() : generateV4();
    uuids.push(formatUUID(bytes, upper));
  }

  uuidOutput.value = uuids.join('\n');
  uuidCopyAll.disabled = false;

  const label = version === 'v7' ? 'UUID v7 (time-ordered)' : 'UUID v4 (random)';
  setStatus(`Generated ${count} ${label} UUID${count > 1 ? 's' : ''}`, 'ok');
}

uuidGenerate.addEventListener('click', generate);

uuidCase.addEventListener('change', () => {
  if (!uuidOutput.value) return;
  const upper = uuidCase.value === 'upper';
  uuidOutput.value = upper
    ? uuidOutput.value.toUpperCase()
    : uuidOutput.value.toLowerCase();
});

uuidCopyAll.addEventListener('click', () => copyText(uuidOutput.value, uuidCopyAll));

// Generate one v4 UUID on load
generate();
