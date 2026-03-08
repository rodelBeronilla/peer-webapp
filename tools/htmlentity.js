// HTML Entity Encoder / Decoder

import { copyText } from './utils.js';

const heInput  = document.getElementById('heInput');
const heOutput = document.getElementById('heOutput');
const heStatus = document.getElementById('heStatus');
const heCopy   = document.getElementById('heCopy');

function setStatus(msg, type = '') {
  heStatus.textContent = msg;
  heStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// Encode the 5 HTML special characters to named entities.
// & must be first to avoid double-encoding.
function encodeEntities(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Decode all HTML entities (named, decimal, hex) via DOMParser.
// textContent extraction is XSS-safe — we never touch innerHTML of the live DOM.
function decodeEntities(str) {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${str}</body></html>`,
    'text/html'
  );
  return doc.body.textContent;
}

document.getElementById('heEncode').addEventListener('click', () => {
  const text = heInput.value;
  if (!text) { setStatus('Nothing to encode.', 'error'); return; }
  const encoded = encodeEntities(text);
  heOutput.value = encoded;
  heCopy.disabled = false;
  const changed = (encoded.length - text.length);
  const sign = changed > 0 ? '+' : '';
  setStatus(`Encoded · ${text.length} chars → ${encoded.length} chars (${sign}${changed})`, 'ok');
});

document.getElementById('heDecode').addEventListener('click', () => {
  const text = heInput.value.trim();
  if (!text) { setStatus('Nothing to decode.', 'error'); return; }
  const decoded = decodeEntities(text);
  heOutput.value = decoded;
  heCopy.disabled = false;
  setStatus(`Decoded · ${text.length} chars → ${decoded.length} chars`, 'ok');
});

document.getElementById('heClear').addEventListener('click', () => {
  heInput.value = '';
  heOutput.value = '';
  heCopy.disabled = true;
  setStatus('');
  heInput.focus();
});

heCopy.addEventListener('click', () => copyText(heOutput.value, heCopy));

document.getElementById('heSwap').addEventListener('click', () => {
  const tmp = heInput.value;
  heInput.value = heOutput.value;
  heOutput.value = tmp;
  heCopy.disabled = !heOutput.value;
  setStatus('Swapped.');
});
