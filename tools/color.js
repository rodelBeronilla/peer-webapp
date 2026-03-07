// Color Converter

import { copyText } from './utils.js';

const colorPicker  = document.getElementById('colorPicker');
const colorSwatch  = document.getElementById('colorSwatch');
const colorHexIn   = document.getElementById('colorHex');
const colorRgbIn   = document.getElementById('colorRgb');
const colorHslIn   = document.getElementById('colorHsl');
const tabColorSwatch = document.getElementById('tabColorSwatch');

// Contrast checker elements
const contrastBgPicker = document.getElementById('contrastBgPicker');
const contrastBgSwatch = document.getElementById('contrastBgSwatch');
const contrastBgHex    = document.getElementById('contrastBgHex');
const contrastPreview  = document.getElementById('contrastPreview');
const contrastRatio    = document.getElementById('contrastRatio');

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
  if (tabColorSwatch) tabColorSwatch.style.background = hex;

  colorHexIn.value = hex.toUpperCase();

  const { r, g, b } = hexToRgb(hex);
  colorRgbIn.value = `rgb(${r}, ${g}, ${b})`;

  const { h, s, l } = rgbToHsl(r, g, b);
  colorHslIn.value = `hsl(${h}, ${s}%, ${l}%)`;

  updateContrast();
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

// ---- Editable color input helpers ----

function parseHexInput(raw) {
  const s = raw.trim();
  const full = /^#?([0-9a-f]{6})$/i.exec(s);
  if (full) return '#' + full[1].toLowerCase();
  const short = /^#?([0-9a-f]{3})$/i.exec(s);
  if (short) {
    const [r, g, b] = short[1].split('');
    return '#' + r + r + g + g + b + b;
  }
  return null;
}

function parseRgbInput(raw) {
  const m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(raw.trim());
  if (!m) return null;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  if (r > 255 || g > 255 || b > 255) return null;
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

function parseHslInput(raw) {
  const m = /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i.exec(raw.trim());
  if (!m) return null;
  const [h, s, l] = [+m[1], +m[2], +m[3]];
  if (h > 360 || s > 100 || l > 100) return null;
  return hslToHex(h, s, l);
}

function flashInvalid(el) {
  el.classList.remove('is-invalid');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('is-invalid');
  el.addEventListener('animationend', () => el.classList.remove('is-invalid'), { once: true });
}

function applyColorInput(inputEl, parseFn) {
  const hex = parseFn(inputEl.value);
  if (hex) {
    colorPicker.value = hex;
    updateColorDisplay(hex);
    addToHistory(hex);
  } else {
    flashInvalid(inputEl);
    updateColorDisplay(colorPicker.value);
  }
}

[colorHexIn, colorRgbIn, colorHslIn].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
  });
});

colorHexIn.addEventListener('blur', () => applyColorInput(colorHexIn, parseHexInput));
colorRgbIn.addEventListener('blur', () => applyColorInput(colorRgbIn, parseRgbInput));
colorHslIn.addEventListener('blur', () => applyColorInput(colorHslIn, parseHslInput));

// ---- Native picker ----
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

// ---- WCAG Contrast Checker ----

const CONTRAST_BADGES = [
  { id: 'badge-aa-normal',  threshold: 4.5, label: 'AA normal text' },
  { id: 'badge-aa-large',   threshold: 3,   label: 'AA large text' },
  { id: 'badge-aaa-normal', threshold: 7,   label: 'AAA normal text' },
  { id: 'badge-aaa-large',  threshold: 4.5, label: 'AAA large text' },
];

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function calcContrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function updateContrast() {
  const fgHex = colorPicker.value;
  const bgHex = contrastBgPicker.value;

  contrastPreview.style.backgroundColor = bgHex;
  contrastPreview.style.color = fgHex;

  const ratio = calcContrastRatio(fgHex, bgHex);
  contrastRatio.textContent = ratio.toFixed(2) + ':1';

  CONTRAST_BADGES.forEach(({ id, threshold, label }) => {
    const badge = document.getElementById(id);
    const result = badge.querySelector('.contrast-badge__result');
    const pass = ratio >= threshold;
    badge.classList.toggle('contrast-badge--pass', pass);
    badge.classList.toggle('contrast-badge--fail', !pass);
    result.textContent = pass ? 'Pass' : 'Fail';
    result.setAttribute('aria-label', `${label}: ${pass ? 'Pass' : 'Fail'}`);
  });
}

function updateBgDisplay(hex) {
  contrastBgSwatch.style.background = hex;
  contrastBgHex.value = hex.toUpperCase();
  updateContrast();
}

contrastBgPicker.addEventListener('input', () => updateBgDisplay(contrastBgPicker.value));

contrastBgHex.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); contrastBgHex.blur(); }
});
contrastBgHex.addEventListener('blur', () => {
  const hex = parseHexInput(contrastBgHex.value);
  if (hex) {
    contrastBgPicker.value = hex;
    updateBgDisplay(hex);
  } else {
    flashInvalid(contrastBgHex);
    updateBgDisplay(contrastBgPicker.value);
  }
});

// Init
loadColorHistory();
updateColorDisplay(colorPicker.value);
renderColorHistory();
updateBgDisplay(contrastBgPicker.value);
