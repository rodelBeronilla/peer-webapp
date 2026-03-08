// JSON Formatter

import { copyText, escapeHtml } from './utils.js';

const jsonInput  = document.getElementById('jsonInput');
const jsonOutput = document.getElementById('jsonOutput');
const jsonStatus = document.getElementById('jsonStatus');
const jsonCopy   = document.getElementById('jsonCopy');
let   jsonFormatted = '';

function jsonSyntaxHighlight(str) {
  // Escape HTML first
  str = escapeHtml(str);

  return str.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
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

// ── JSON Path Evaluator ──────────────────────────────────────────────────────

const jsonPath       = document.getElementById('jsonPath');
const jsonPathOutput = document.getElementById('jsonPathOutput');
const jsonPathStatus = document.getElementById('jsonPathStatus');
const jsonPathCopy   = document.getElementById('jsonPathCopy');
let   jsonPathResult = '';

function tokenizePath(path) {
  // Convert bracket indices to dot-segments: items[0].x → items.0.x
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(t => t !== '');
}

function resolvePath(obj, pathStr) {
  const tokens = tokenizePath(pathStr);
  if (tokens.length === 0) return obj; // empty path → root
  let cur = obj;
  for (const token of tokens) {
    if (cur === null || cur === undefined) {
      throw new Error(`Reached null/undefined before "${token}"`);
    }
    if (typeof cur !== 'object') {
      throw new Error(`Cannot index into ${typeof cur} at "${token}"`);
    }
    if (!(token in cur)) {
      const ctx = Array.isArray(cur) ? `array(len ${cur.length})` : 'object';
      throw new Error(`Key "${token}" not found in ${ctx}`);
    }
    cur = cur[token];
  }
  return cur;
}

function setPathStatus(msg, type = '') {
  jsonPathStatus.textContent = msg;
  jsonPathStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function runJsonPath() {
  const raw  = jsonInput.value.trim();
  const path = jsonPath.value.trim();

  jsonPathOutput.innerHTML = '<span class="code-placeholder">Result will appear here</span>';
  jsonPathCopy.disabled = true;
  jsonPathResult = '';

  if (!raw) { setPathStatus('Paste JSON in the input above first'); return; }
  if (!path) { setPathStatus(''); return; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Intentionally bare — the format panel already surfaces the SyntaxError with
    // position detail via String(err). Re-displaying it here would be redundant;
    // directing the user back to the format panel is the right UX.
    setPathStatus('Invalid JSON — fix the input above first', 'error');
    return;
  }

  try {
    const value = resolvePath(parsed, path);
    if (value === undefined) {
      jsonPathOutput.innerHTML = '<span class="json-null">undefined</span>';
      setPathStatus('Path resolved to undefined', 'error');
      return;
    }
    if (value === null || typeof value !== 'object') {
      jsonPathResult = String(value === null ? 'null' : value);
      jsonPathOutput.innerHTML = jsonSyntaxHighlight(jsonPathResult);
    } else {
      jsonPathResult = JSON.stringify(value, null, 2);
      jsonPathOutput.innerHTML = jsonSyntaxHighlight(jsonPathResult);
    }
    const typeLabel = Array.isArray(value) ? `array[${value.length}]` : typeof value;
    setPathStatus(`Matched · ${typeLabel}`, 'ok');
    jsonPathCopy.disabled = false;
  } catch (err) {
    jsonPathOutput.innerHTML = `<span class="json-error">${escapeHtml(String(err))}</span>`;
    setPathStatus(String(err), 'error');
  }
}

let pathDebounce;
jsonPath.addEventListener('input', () => {
  clearTimeout(pathDebounce);
  pathDebounce = setTimeout(runJsonPath, 200);
});
// Re-run path when JSON input changes (already debounced above, so use a second listener)
jsonInput.addEventListener('input', () => {
  clearTimeout(pathDebounce);
  pathDebounce = setTimeout(runJsonPath, 450);
});
jsonPathCopy.addEventListener('click', () => copyText(jsonPathResult, jsonPathCopy));
