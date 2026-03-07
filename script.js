// DevTools — script.js
// Alpha: pivot to developer toolkit (JSON, Regex, Base64, Color, Notes)

'use strict';

/* ============================================
   Theme Toggle
   ============================================ */
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const THEME_KEY = 'peer-theme';

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.querySelector('.theme-toggle__icon').textContent = isDark ? '☀' : '☾';
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferred);
})();

themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light');
});

/* ============================================
   Hamburger / Mobile Nav
   ============================================ */
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

function setNavOpen(open) {
  hamburger.setAttribute('aria-expanded', String(open));
  navMenu.classList.toggle('is-open', open);
}

hamburger.addEventListener('click', () => {
  setNavOpen(hamburger.getAttribute('aria-expanded') !== 'true');
});

navMenu.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => setNavOpen(false));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
    setNavOpen(false);
    hamburger.focus();
  }
});

document.addEventListener('click', (e) => {
  if (navMenu.classList.contains('is-open') &&
      !navMenu.contains(e.target) &&
      !hamburger.contains(e.target)) {
    setNavOpen(false);
  }
});

/* ============================================
   Tab System
   ============================================ */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

function activateTab(panelId) {
  tabs.forEach(t => {
    const active = t.dataset.panel === panelId;
    t.classList.toggle('tab--active', active);
    t.setAttribute('aria-selected', String(active));
    t.tabIndex = active ? 0 : -1;
  });
  panels.forEach(p => {
    const active = p.id === `panel-${panelId}`;
    p.classList.toggle('panel--active', active);
    if (active) p.removeAttribute('hidden');
    else p.setAttribute('hidden', '');
  });
  // Persist active tab
  sessionStorage.setItem('devtools-tab', panelId);
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.panel));

  // Keyboard navigation: arrow keys cycle tabs
  tab.addEventListener('keydown', (e) => {
    const tabList = [...tabs];
    const idx = tabList.indexOf(tab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      tabList[(idx + 1) % tabList.length].focus();
      tabList[(idx + 1) % tabList.length].click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      tabList[(idx - 1 + tabList.length) % tabList.length].focus();
      tabList[(idx - 1 + tabList.length) % tabList.length].click();
    } else if (e.key === 'Home') {
      e.preventDefault();
      tabList[0].focus();
      tabList[0].click();
    } else if (e.key === 'End') {
      e.preventDefault();
      tabList[tabList.length - 1].focus();
      tabList[tabList.length - 1].click();
    }
  });
});

// Nav links that target specific tools
document.querySelectorAll('.nav-tool-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    activateTab(link.dataset.tab);
    document.getElementById('tools').scrollIntoView({ behavior: 'smooth' });
  });
});

// Restore last-used tab
(function restoreTab() {
  const saved = sessionStorage.getItem('devtools-tab');
  if (saved && document.getElementById(`panel-${saved}`)) {
    activateTab(saved);
  }
})();

/* ============================================
   Utility: copy to clipboard with feedback
   ============================================ */
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('btn--success');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('btn--success');
    }, 1500);
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

/* ============================================
   JSON Formatter
   ============================================ */
const jsonInput  = document.getElementById('jsonInput');
const jsonOutput = document.getElementById('jsonOutput');
const jsonStatus = document.getElementById('jsonStatus');
const jsonCopy   = document.getElementById('jsonCopy');
let   jsonFormatted = '';

function jsonSyntaxHighlight(str) {
  // Escape HTML first
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return str.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-num';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-str';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function setJsonStatus(msg, type = '') {
  jsonStatus.textContent = msg;
  jsonStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function runJsonFormat(indent = 2) {
  const raw = jsonInput.value.trim();
  if (!raw) {
    jsonOutput.innerHTML = '<span class="code-placeholder">Output will appear here</span>';
    jsonCopy.disabled = true;
    setJsonStatus('');
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    jsonFormatted = JSON.stringify(parsed, null, indent);
    jsonOutput.innerHTML = jsonSyntaxHighlight(jsonFormatted);
    setJsonStatus(`Valid JSON · ${raw.length} chars in, ${jsonFormatted.length} chars out`, 'ok');
    jsonCopy.disabled = false;
  } catch (err) {
    jsonFormatted = '';
    jsonOutput.innerHTML = `<span class="json-error">${escapeHtml(String(err))}</span>`;
    setJsonStatus(String(err), 'error');
    jsonCopy.disabled = true;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('jsonFormat').addEventListener('click', () => runJsonFormat(2));
document.getElementById('jsonMinify').addEventListener('click', () => runJsonFormat(0));
document.getElementById('jsonClear').addEventListener('click', () => {
  jsonInput.value = '';
  jsonOutput.innerHTML = '<span class="code-placeholder">Output will appear here</span>';
  jsonCopy.disabled = true;
  setJsonStatus('');
  jsonInput.focus();
});
jsonCopy.addEventListener('click', () => copyText(jsonFormatted, jsonCopy));

// Auto-format on input (debounced)
let jsonDebounce;
jsonInput.addEventListener('input', () => {
  clearTimeout(jsonDebounce);
  jsonDebounce = setTimeout(() => runJsonFormat(2), 400);
});

/* ============================================
   Regex Tester
   ============================================ */
const regexPattern   = document.getElementById('regexPattern');
const regexFlags     = document.getElementById('regexFlags');
const regexText      = document.getElementById('regexText');
const regexStatus    = document.getElementById('regexStatus');
const regexMatchCount = document.getElementById('regexMatchCount');
const matchListBody  = document.getElementById('matchListBody');

function setRegexStatus(msg, type = '') {
  regexStatus.textContent = msg;
  regexStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function runRegex() {
  const pattern = regexPattern.value;
  const flags   = regexFlags.value.replace(/[^gimsuy]/g, '');
  const text    = regexText.value;

  if (!pattern) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = '<p class="match-empty">Enter a pattern and test string to see matches.</p>';
    setRegexStatus('');
    // Clear highlight class
    regexText.classList.remove('has-matches', 'no-matches');
    return;
  }

  let rx;
  try {
    rx = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    setRegexStatus(`/${pattern}/${flags}`, 'ok');
  } catch (err) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = `<p class="match-empty match-empty--error">${escapeHtml(String(err))}</p>`;
    setRegexStatus(String(err), 'error');
    regexText.classList.remove('has-matches', 'no-matches');
    return;
  }

  if (!text) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = '<p class="match-empty">Enter a test string above.</p>';
    regexText.classList.remove('has-matches', 'no-matches');
    return;
  }

  const matches = [...text.matchAll(rx)];

  if (matches.length === 0) {
    regexMatchCount.textContent = 'No matches';
    matchListBody.innerHTML = '<p class="match-empty">No matches found.</p>';
    regexText.classList.remove('has-matches');
    regexText.classList.add('no-matches');
    return;
  }

  regexText.classList.add('has-matches');
  regexText.classList.remove('no-matches');
  regexMatchCount.textContent = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;

  // Build match list
  const frag = document.createDocumentFragment();
  matches.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'match-item';

    const idx = document.createElement('span');
    idx.className = 'match-idx';
    idx.textContent = `#${i + 1}`;

    const val = document.createElement('code');
    val.className = 'match-val';
    val.textContent = m[0];

    const pos = document.createElement('span');
    pos.className = 'match-pos';
    pos.textContent = `index ${m.index}`;

    item.appendChild(idx);
    item.appendChild(val);
    item.appendChild(pos);

    // Groups
    if (m.length > 1) {
      m.slice(1).forEach((g, gi) => {
        const grp = document.createElement('div');
        grp.className = 'match-group';
        grp.textContent = `Group ${gi + 1}: ${g === undefined ? '(unmatched)' : g}`;
        item.appendChild(grp);
      });
    }

    frag.appendChild(item);
  });

  matchListBody.innerHTML = '';
  matchListBody.appendChild(frag);
}

let regexDebounce;
function scheduleRegex() {
  clearTimeout(regexDebounce);
  regexDebounce = setTimeout(runRegex, 200);
}

regexPattern.addEventListener('input', scheduleRegex);
regexFlags.addEventListener('input', scheduleRegex);
regexText.addEventListener('input', scheduleRegex);

/* ============================================
   Base64
   ============================================ */
const b64Input  = document.getElementById('b64Input');
const b64Output = document.getElementById('b64Output');
const b64Status = document.getElementById('b64Status');
const b64Copy   = document.getElementById('b64Copy');

function setB64Status(msg, type = '') {
  b64Status.textContent = msg;
  b64Status.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function b64EncodeUnicode(str) {
  // Handle Unicode by encoding to UTF-8 bytes first
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')
  );
}

document.getElementById('b64Encode').addEventListener('click', () => {
  const text = b64Input.value;
  if (!text) { setB64Status('Nothing to encode.', 'error'); return; }
  try {
    const encoded = b64EncodeUnicode(text);
    b64Output.value = encoded;
    b64Copy.disabled = false;
    setB64Status(`Encoded · ${text.length} chars → ${encoded.length} chars`, 'ok');
  } catch (err) {
    setB64Status(`Encode error: ${err.message}`, 'error');
  }
});

document.getElementById('b64Decode').addEventListener('click', () => {
  const text = b64Input.value.trim();
  if (!text) { setB64Status('Nothing to decode.', 'error'); return; }
  try {
    const decoded = b64DecodeUnicode(text);
    b64Output.value = decoded;
    b64Copy.disabled = false;
    setB64Status(`Decoded · ${text.length} chars → ${decoded.length} chars`, 'ok');
  } catch {
    setB64Status('Invalid Base64 string.', 'error');
  }
});

document.getElementById('b64Clear').addEventListener('click', () => {
  b64Input.value = '';
  b64Output.value = '';
  b64Copy.disabled = true;
  setB64Status('');
  b64Input.focus();
});

b64Copy.addEventListener('click', () => copyText(b64Output.value, b64Copy));

document.getElementById('b64Swap').addEventListener('click', () => {
  const tmp = b64Input.value;
  b64Input.value = b64Output.value;
  b64Output.value = tmp;
  b64Copy.disabled = !b64Output.value;
  setB64Status('Swapped.');
});

/* ============================================
   Color Converter
   ============================================ */
const colorPicker  = document.getElementById('colorPicker');
const colorSwatch  = document.getElementById('colorSwatch');
const colorHexIn   = document.getElementById('colorHex');
const colorRgbIn   = document.getElementById('colorRgb');
const colorHslIn   = document.getElementById('colorHsl');
const tabColorSwatch = document.getElementById('tabColorSwatch');

const COLOR_HISTORY_KEY = 'devtools-color-history';
let colorHistory = [];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function updateColorDisplay(hex) {
  colorSwatch.style.background = hex;
  // Update tab swatch
  if (tabColorSwatch) tabColorSwatch.style.background = hex;

  colorHexIn.value = hex.toUpperCase();

  const { r, g, b } = hexToRgb(hex);
  colorRgbIn.value = `rgb(${r}, ${g}, ${b})`;

  const { h, s, l } = rgbToHsl(r, g, b);
  colorHslIn.value = `hsl(${h}, ${s}%, ${l}%)`;
}

function loadColorHistory() {
  try { colorHistory = JSON.parse(localStorage.getItem(COLOR_HISTORY_KEY)) || []; }
  catch { colorHistory = []; }
}

function saveColorHistory() {
  localStorage.setItem(COLOR_HISTORY_KEY, JSON.stringify(colorHistory.slice(0, 24)));
}

function renderColorHistory() {
  const el = document.getElementById('colorHistory');
  if (colorHistory.length === 0) {
    el.innerHTML = '<p class="match-empty">Pick a color to add it here.</p>';
    return;
  }
  el.innerHTML = '';
  colorHistory.forEach(hex => {
    const btn = document.createElement('button');
    btn.className = 'color-history-swatch';
    btn.style.background = hex;
    btn.title = hex.toUpperCase();
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `Select color ${hex.toUpperCase()}`);
    btn.addEventListener('click', () => {
      colorPicker.value = hex;
      updateColorDisplay(hex);
    });
    el.appendChild(btn);
  });
}

function addToHistory(hex) {
  colorHistory = [hex, ...colorHistory.filter(h => h !== hex)].slice(0, 24);
  saveColorHistory();
  renderColorHistory();
}

colorPicker.addEventListener('input', () => {
  updateColorDisplay(colorPicker.value);
});

colorPicker.addEventListener('change', () => {
  addToHistory(colorPicker.value);
});

document.querySelectorAll('.copy-color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = document.getElementById(btn.dataset.target).value;
    copyText(val, btn);
  });
});

document.getElementById('clearColorHistory').addEventListener('click', () => {
  colorHistory = [];
  saveColorHistory();
  renderColorHistory();
});

// Init color tool
loadColorHistory();
updateColorDisplay(colorPicker.value);
renderColorHistory();

/* ============================================
   Notes
   ============================================ */
const notesForm  = document.getElementById('notesForm');
const noteInput  = document.getElementById('noteInput');
const notesList  = document.getElementById('notesList');
const notesCount = document.getElementById('notesCount');
const NOTES_KEY  = 'peer-notes';

let notes = [];

function loadNotes() {
  try { notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || []; }
  catch { notes = []; }
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function renderNotes() {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'notes__empty';
    empty.textContent = 'No notes yet. Add one above.';
    notesList.appendChild(empty);
    notesCount.textContent = '0 notes';
    return;
  }

  notes.forEach((note, index) => {
    const li = document.createElement('li');
    li.className = 'note-item';

    const text = document.createElement('span');
    text.className = 'note-item__text';
    text.textContent = note.text;

    const del = document.createElement('button');
    del.className = 'note-item__delete';
    del.setAttribute('aria-label', `Delete note: ${note.text}`);
    del.setAttribute('type', 'button');
    del.textContent = '×';
    del.addEventListener('click', () => deleteNote(index));

    li.appendChild(text);
    li.appendChild(del);
    notesList.appendChild(li);
  });

  const count = notes.length;
  notesCount.textContent = `${count} ${count === 1 ? 'note' : 'notes'}`;
}

function addNote(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  notes.unshift({ text: trimmed, id: Date.now() });
  saveNotes();
  renderNotes();
}

function deleteNote(index) {
  const items = notesList.querySelectorAll('.note-item');
  const li = items[index];
  if (li) {
    li.style.transition = 'opacity 150ms ease, transform 150ms ease';
    li.style.opacity = '0';
    li.style.transform = 'translateX(10px)';
  }
  setTimeout(() => {
    notes.splice(index, 1);
    saveNotes();
    renderNotes();
  }, 150);
}

notesForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addNote(noteInput.value);
  noteInput.value = '';
  noteInput.focus();
});

loadNotes();
renderNotes();

/* ============================================
   URL Encoder / Decoder
   ============================================ */
const urlInput  = document.getElementById('urlInput');
const urlOutput = document.getElementById('urlOutput');
const urlStatus = document.getElementById('urlStatus');
const urlCopy   = document.getElementById('urlCopy');

function setUrlStatus(msg, type = '') {
  urlStatus.textContent = msg;
  urlStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

document.getElementById('urlEncode').addEventListener('click', () => {
  const text = urlInput.value;
  if (!text) { setUrlStatus('Nothing to encode.', 'error'); return; }
  const encoded = encodeURIComponent(text);
  urlOutput.value = encoded;
  urlCopy.disabled = false;
  setUrlStatus(`Encoded · ${text.length} chars → ${encoded.length} chars`, 'ok');
});

document.getElementById('urlDecode').addEventListener('click', () => {
  const text = urlInput.value.trim();
  if (!text) { setUrlStatus('Nothing to decode.', 'error'); return; }
  try {
    const decoded = decodeURIComponent(text);
    urlOutput.value = decoded;
    urlCopy.disabled = false;
    setUrlStatus(`Decoded · ${text.length} chars → ${decoded.length} chars`, 'ok');
  } catch {
    setUrlStatus('Malformed percent-encoding — cannot decode.', 'error');
  }
});

document.getElementById('urlClear').addEventListener('click', () => {
  urlInput.value = '';
  urlOutput.value = '';
  urlCopy.disabled = true;
  setUrlStatus('');
  urlInput.focus();
});

urlCopy.addEventListener('click', () => copyText(urlOutput.value, urlCopy));

document.getElementById('urlSwap').addEventListener('click', () => {
  const tmp = urlInput.value;
  urlInput.value = urlOutput.value;
  urlOutput.value = tmp;
  urlCopy.disabled = !urlOutput.value;
  setUrlStatus('Swapped.');
});
