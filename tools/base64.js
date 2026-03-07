// Base64 Encoder / Decoder

import { copyText } from './utils.js';

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
