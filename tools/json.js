// JSON Formatter

import { copyText, escapeHtml } from './utils.js';

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
