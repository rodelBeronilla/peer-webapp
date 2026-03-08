// String Utilities

import { copyText } from './utils.js';

const strInput      = document.getElementById('strInput');
const strOutput     = document.getElementById('strOutput');
const strStatus     = document.getElementById('strStatus');
const strInputStats = document.getElementById('strInputStats');
const strStats      = document.getElementById('strStats');
const strCopy       = document.getElementById('strCopy');

function setStrStatus(msg, type = '') {
  strStatus.textContent = msg;
  strStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function statsText(text) {
  if (!text) return '';
  const lines = text.split('\n').length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  return `Lines: ${lines} · Words: ${words} · Chars: ${chars}`;
}

function updateInputStats() {
  strInputStats.textContent = strInput.value ? statsText(strInput.value) : '';
}

function applyTransform(fn, label) {
  const input = strInput.value;
  if (!input) { setStrStatus('Nothing to transform.', 'error'); return; }
  const result = fn(input);
  strOutput.value = result;
  strCopy.disabled = false;
  strStats.textContent = statsText(result);
  setStrStatus(label, 'ok');
}

// Split text into words, handling camelCase, snake_case, kebab-case, and spaces
function splitWords(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s\-_.,;:!?()[\]{}'"/\\]+/)
    .filter(w => w.length > 0);
}

// Sort
document.getElementById('strSortAZ').addEventListener('click', () =>
  applyTransform(t => t.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'), 'Sorted A→Z')
);
document.getElementById('strSortZA').addEventListener('click', () =>
  applyTransform(t => t.split('\n').sort((a, b) => b.localeCompare(a)).join('\n'), 'Sorted Z→A')
);
document.getElementById('strSortLen').addEventListener('click', () =>
  applyTransform(t => t.split('\n').sort((a, b) => a.length - b.length).join('\n'), 'Sorted by length')
);

// Case
document.getElementById('strUpper').addEventListener('click', () =>
  applyTransform(t => t.toUpperCase(), 'UPPERCASE')
);
document.getElementById('strLower').addEventListener('click', () =>
  applyTransform(t => t.toLowerCase(), 'lowercase')
);
document.getElementById('strTitle').addEventListener('click', () =>
  applyTransform(t => t.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()), 'Title Case')
);
document.getElementById('strCamel').addEventListener('click', () =>
  applyTransform(t => t.split('\n').map(line => {
    const words = splitWords(line);
    if (!words.length) return line;
    return words[0].toLowerCase() +
      words.slice(1).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  }).join('\n'), 'camelCase')
);
document.getElementById('strSnake').addEventListener('click', () =>
  applyTransform(t => t.split('\n').map(line =>
    splitWords(line).map(w => w.toLowerCase()).join('_') || line
  ).join('\n'), 'snake_case')
);
document.getElementById('strKebab').addEventListener('click', () =>
  applyTransform(t => t.split('\n').map(line =>
    splitWords(line).map(w => w.toLowerCase()).join('-') || line
  ).join('\n'), 'kebab-case')
);

// Lines
document.getElementById('strDedup').addEventListener('click', () =>
  applyTransform(t => {
    const seen = new Set();
    return t.split('\n').filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    }).join('\n');
  }, 'Duplicates removed')
);
document.getElementById('strTrim').addEventListener('click', () =>
  applyTransform(t => t.split('\n').map(line => line.trim()).join('\n'), 'Lines trimmed')
);
document.getElementById('strRemoveBlanks').addEventListener('click', () =>
  applyTransform(t => t.split('\n').filter(line => line.trim()).join('\n'), 'Blank lines removed')
);

// Use output as input
document.getElementById('strUseOutput').addEventListener('click', () => {
  if (!strOutput.value) return;
  strInput.value = strOutput.value;
  strOutput.value = '';
  strCopy.disabled = true;
  strStats.textContent = '';
  setStrStatus('Output loaded into input.');
  updateInputStats();
  strInput.focus();
});

// Clear
document.getElementById('strClear').addEventListener('click', () => {
  strInput.value = '';
  strOutput.value = '';
  strCopy.disabled = true;
  strInputStats.textContent = '';
  strStats.textContent = '';
  setStrStatus('');
  strInput.focus();
});

// Copy
strCopy.addEventListener('click', () => copyText(strOutput.value, strCopy));

// Live input stats
strInput.addEventListener('input', updateInputStats);
