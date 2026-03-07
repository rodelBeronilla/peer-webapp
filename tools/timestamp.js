// Unix Timestamp Converter

import { copyText } from './utils.js';

const epochInput    = document.getElementById('tsEpoch');
const datetimeInput = document.getElementById('tsDatetime');
const tsStatus      = document.getElementById('tsStatus');
const tsNow         = document.getElementById('tsNow');
const tsFromEpoch   = document.getElementById('tsFromEpoch');
const tsFromDate    = document.getElementById('tsFromDate');
const tsClear       = document.getElementById('tsClear');
const tsCopyEpoch   = document.getElementById('tsCopyEpoch');
const tsCopyDate    = document.getElementById('tsCopyDate');

const outIso      = document.getElementById('tsOutIso');
const outLocal    = document.getElementById('tsOutLocal');
const outUtc      = document.getElementById('tsOutUtc');
const outRelative = document.getElementById('tsOutRelative');
const outEpochMs  = document.getElementById('tsOutEpochMs');
const outEpochS   = document.getElementById('tsOutEpochS');

function setStatus(msg, type = '') {
  tsStatus.textContent = msg;
  tsStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function relativeTime(ms) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;

  const units = [
    { label: 'year',   ms: 365.25 * 24 * 60 * 60 * 1000 },
    { label: 'month',  ms: 30.44 * 24 * 60 * 60 * 1000 },
    { label: 'day',    ms: 24 * 60 * 60 * 1000 },
    { label: 'hour',   ms: 60 * 60 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
    { label: 'second', ms: 1000 },
  ];

  for (const unit of units) {
    const n = Math.floor(abs / unit.ms);
    if (n >= 1) {
      const label = `${n} ${unit.label}${n !== 1 ? 's' : ''}`;
      return future ? `in ${label}` : `${label} ago`;
    }
  }
  return 'just now';
}

function populateOutputs(ms) {
  const d = new Date(ms);
  outIso.textContent      = d.toISOString();
  outLocal.textContent    = d.toLocaleString(undefined, { timeZoneName: 'short' });
  outUtc.textContent      = d.toUTCString();
  outRelative.textContent = relativeTime(ms);
  outEpochMs.textContent  = String(ms);
  outEpochS.textContent   = String(Math.floor(ms / 1000));
  tsCopyEpoch.disabled = false;
  tsCopyDate.disabled  = false;
}

function clearOutputs() {
  [outIso, outLocal, outUtc, outRelative, outEpochMs, outEpochS].forEach(el => {
    el.textContent = '—';
  });
  tsCopyEpoch.disabled = true;
  tsCopyDate.disabled  = true;
}

// Epoch → datetime
tsFromEpoch.addEventListener('click', () => {
  const raw = epochInput.value.trim();
  if (!raw) { setStatus('Enter an epoch value.', 'error'); return; }
  if (!/^\d+$/.test(raw)) { setStatus('Epoch must be a positive integer.', 'error'); return; }

  let ms = Number(raw);
  // Auto-detect seconds vs milliseconds: < 1e12 → seconds
  if (ms < 1e12) ms *= 1000;

  const d = new Date(ms);
  if (isNaN(d.getTime())) { setStatus('Invalid epoch value.', 'error'); return; }

  // Sync datetime-local input (uses local time, ISO-like without Z)
  const pad = n => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  datetimeInput.value = local;

  populateOutputs(ms);
  setStatus(`Converted · auto-detected as ${raw.length >= 13 ? 'milliseconds' : 'seconds'}`, 'ok');
});

// Datetime → epoch
tsFromDate.addEventListener('click', () => {
  const raw = datetimeInput.value;
  if (!raw) { setStatus('Pick a date and time.', 'error'); return; }

  const d = new Date(raw); // datetime-local is parsed as local time
  if (isNaN(d.getTime())) { setStatus('Invalid date/time.', 'error'); return; }

  epochInput.value = String(Math.floor(d.getTime() / 1000));
  populateOutputs(d.getTime());
  setStatus('Converted · local time assumed', 'ok');
});

// Now
tsNow.addEventListener('click', () => {
  const now = Date.now();
  epochInput.value = String(Math.floor(now / 1000));

  const d = new Date(now);
  const pad = n => String(n).padStart(2, '0');
  datetimeInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  populateOutputs(now);
  setStatus('Loaded current time', 'ok');
});

// Clear
tsClear.addEventListener('click', () => {
  epochInput.value    = '';
  datetimeInput.value = '';
  clearOutputs();
  setStatus('');
  epochInput.focus();
});

// Copy epoch (seconds)
tsCopyEpoch.addEventListener('click', () => copyText(outEpochS.textContent, tsCopyEpoch));

// Copy ISO date
tsCopyDate.addEventListener('click', () => copyText(outIso.textContent, tsCopyDate));

// Enter key on epoch input triggers conversion
epochInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') tsFromEpoch.click();
});

datetimeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') tsFromDate.click();
});
