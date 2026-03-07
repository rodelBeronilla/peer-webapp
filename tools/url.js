// URL Encoder / Decoder

import { copyText } from './utils.js';

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
