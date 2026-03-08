// Time Zone Converter

import { copyText } from './utils.js';

const tzDateInput   = document.getElementById('tzDate');
const tzTimeInput   = document.getElementById('tzTime');
const tzNow         = document.getElementById('tzNow');
const tzFromSel     = document.getElementById('tzFrom');
const tzToSel       = document.getElementById('tzTo');
const tzFromSearch  = document.getElementById('tzFromSearch');
const tzToSearch    = document.getElementById('tzToSearch');
const tzConvert     = document.getElementById('tzConvert');
const tzClear       = document.getElementById('tzClear');
const tzCopy        = document.getElementById('tzCopy');
const tzStatus      = document.getElementById('tzStatus');
const tzResult      = document.getElementById('tzResult');

// ─── Populate time zone selects ─────────────────────────────────────────────

const ALL_ZONES = Intl.supportedValuesOf('timeZone');

function groupZones(zones) {
  const groups = {};
  for (const tz of zones) {
    const slash = tz.indexOf('/');
    const region = slash === -1 ? 'Other' : tz.slice(0, slash);
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  }
  return groups;
}

function buildSelect(sel, zones) {
  const groups = groupZones(zones);
  sel.innerHTML = '';
  for (const region of Object.keys(groups).sort()) {
    const og = document.createElement('optgroup');
    og.label = region;
    for (const tz of groups[region]) {
      const opt = document.createElement('option');
      opt.value = tz;
      opt.textContent = tz.replace(/_/g, ' ');
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

buildSelect(tzFromSel, ALL_ZONES);
buildSelect(tzToSel, ALL_ZONES);

// Default: from local zone, to UTC (or Etc/UTC if UTC not listed)
const localTz  = Intl.DateTimeFormat().resolvedOptions().timeZone;
const UTC_ZONE = ALL_ZONES.includes('UTC') ? 'UTC'
               : ALL_ZONES.includes('Etc/UTC') ? 'Etc/UTC'
               : 'America/New_York';

tzFromSel.value = localTz;
tzToSel.value   = UTC_ZONE;

// ─── Search/filter ───────────────────────────────────────────────────────────

function filterSelect(sel, query) {
  const q        = query.toLowerCase().replace(/\s+/g, '_');
  const filtered = q ? ALL_ZONES.filter(tz => tz.toLowerCase().includes(q)) : ALL_ZONES;
  const prev     = sel.value;
  buildSelect(sel, filtered);
  if (filtered.includes(prev)) sel.value = prev;
}

tzFromSearch.addEventListener('input', () => filterSelect(tzFromSel, tzFromSearch.value));
tzToSearch.addEventListener('input',   () => filterSelect(tzToSel,   tzToSearch.value));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setStatus(msg, type = '') {
  tzStatus.textContent = msg;
  tzStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function pad(n) { return String(n).padStart(2, '0'); }

// Format a Date in a specific time zone: "YYYY-MM-DD, HH:MM:SS"
function formatInZone(date, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
  }).format(date);
}

// Get UTC offset in milliseconds for a given zone at a given instant.
// Uses Intl longOffset (e.g. "GMT+05:30") to extract the signed offset.
function getOffsetMs(date, tz) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  if (!tzPart) return 0;
  // "GMT+05:30" or "GMT" (UTC)
  const match = tzPart.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10)) * 60 * 1000;
}

// Format the UTC offset as a readable string (e.g. "UTC+05:30")
function offsetLabel(date, tz) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  if (!tzPart) return 'UTC';
  return tzPart.value.replace('GMT', 'UTC');
}

// Parse wall-clock time in a given zone to a UTC Date.
// Two-pass approach to handle DST transitions: the offset can change by ±1h
// at the transition boundary, so we refine once with the corrected offset.
function parseInZone(dateStr, timeStr, tz) {
  const baseMs = Date.parse(`${dateStr}T${timeStr}:00Z`); // fake UTC base
  if (isNaN(baseMs)) return null;

  // Pass 1: approximate offset
  const offset1 = getOffsetMs(new Date(baseMs), tz);
  const guess1  = new Date(baseMs - offset1);

  // Pass 2: refine with the offset at the guessed moment (handles DST boundary)
  const offset2 = getOffsetMs(guess1, tz);
  return new Date(baseMs - offset2);
}

// ─── Conversion ──────────────────────────────────────────────────────────────

function convert() {
  const dateStr = tzDateInput.value;
  const timeStr = tzTimeInput.value || '00:00';
  const fromTz  = tzFromSel.value;
  const toTz    = tzToSel.value;

  if (!dateStr) { setStatus('Pick a date.', 'error'); return; }
  if (!fromTz)  { setStatus('Select a source time zone.', 'error'); return; }
  if (!toTz)    { setStatus('Select a target time zone.', 'error'); return; }

  const utc = parseInZone(dateStr, timeStr, fromTz);
  if (!utc || isNaN(utc.getTime())) {
    setStatus('Invalid date or time.', 'error');
    return;
  }

  const resultStr  = formatInZone(utc, toTz);
  const fromOffset = offsetLabel(utc, fromTz);
  const toOffset   = offsetLabel(utc, toTz);

  // Day-difference hint
  const fromDay = new Intl.DateTimeFormat('en-CA', { timeZone: fromTz, year:'numeric', month:'2-digit', day:'2-digit' }).format(utc);
  const toDay   = new Intl.DateTimeFormat('en-CA', { timeZone: toTz,   year:'numeric', month:'2-digit', day:'2-digit' }).format(utc);
  let dayDiff = '';
  if (fromDay !== toDay) {
    const diff = Math.round((new Date(toDay) - new Date(fromDay)) / (24 * 60 * 60 * 1000));
    dayDiff = diff > 0 ? ` (+${diff} day${diff !== 1 ? 's' : ''})` : ` (${diff} day${Math.abs(diff) !== 1 ? 's' : ''})`;
  }

  tzResult.querySelector('.tz-result__value').textContent = resultStr + dayDiff;
  tzResult.querySelector('.tz-result__from').textContent  = `${fromTz} (${fromOffset})`;
  tzResult.querySelector('.tz-result__to').textContent    = `${toTz} (${toOffset})`;
  tzResult.querySelector('.tz-result__utc').textContent   = utc.toISOString();
  tzResult.hidden  = false;
  tzCopy.disabled  = false;
  setStatus('Converted', 'ok');
}

tzConvert.addEventListener('click', convert);

tzDateInput.addEventListener('keydown', e => { if (e.key === 'Enter') convert(); });
tzTimeInput.addEventListener('keydown', e => { if (e.key === 'Enter') convert(); });

// Live update on zone change if date is already filled in
tzFromSel.addEventListener('change', () => { if (tzDateInput.value) convert(); });
tzToSel.addEventListener('change',   () => { if (tzDateInput.value) convert(); });

// ─── Now ─────────────────────────────────────────────────────────────────────

tzNow.addEventListener('click', () => {
  const d = new Date();
  tzDateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  tzTimeInput.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  convert();
});

// ─── Clear ───────────────────────────────────────────────────────────────────

tzClear.addEventListener('click', () => {
  tzDateInput.value  = '';
  tzTimeInput.value  = '';
  tzFromSearch.value = '';
  tzToSearch.value   = '';
  filterSelect(tzFromSel, '');
  filterSelect(tzToSel,   '');
  tzFromSel.value  = localTz;
  tzToSel.value    = UTC_ZONE;
  tzResult.hidden  = true;
  tzCopy.disabled  = true;
  setStatus('');
  tzDateInput.focus();
});

// ─── Copy ────────────────────────────────────────────────────────────────────

tzCopy.addEventListener('click', () => {
  const val = tzResult.querySelector('.tz-result__value').textContent;
  const to  = tzResult.querySelector('.tz-result__to').textContent;
  copyText(`${val} (${to})`, tzCopy);
});
