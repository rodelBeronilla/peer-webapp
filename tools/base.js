// Number Base Converter
// Converts integers between binary (2), octal (8), decimal (10), and hex (16).
// Editing any field updates the other three live.

import { copyText } from './utils.js';

const binInput   = document.getElementById('baseInputBin');
const octInput   = document.getElementById('baseInputOct');
const decInput   = document.getElementById('baseInputDec');
const hexInput   = document.getElementById('baseInputHex');
const baseStatus = document.getElementById('baseStatus');
const baseBits   = document.getElementById('baseBits');

const copyBin = document.getElementById('baseCopyBin');
const copyOct = document.getElementById('baseCopyOct');
const copyDec = document.getElementById('baseCopyDec');
const copyHex = document.getElementById('baseCopyHex');

const MAX = Number.MAX_SAFE_INTEGER; // 2^53 - 1

// ---------------------------------------------------------------------------
// Strip common prefixes (0b, 0o, 0x), whitespace, and internal spaces
// (internal spaces appear when grouped binary values are pasted back in)
// ---------------------------------------------------------------------------
function stripPrefix(raw) {
  return raw.trim().replace(/^0[bBoOxX]/, '').replace(/\s+/g, '');
}

// ---------------------------------------------------------------------------
// Group a binary string for readability:
//   ≤ 16 bits  → nibbles (groups of 4), e.g. "1010 1010"
//   > 16 bits  → bytes  (groups of 8), e.g. "11001100 10101010"
// Left-pads to the nearest group boundary so all groups are full-width.
// ---------------------------------------------------------------------------
function groupBinary(str) {
  const size = str.length <= 16 ? 4 : 8;
  const pad  = (size - (str.length % size)) % size;
  const padded = '0'.repeat(pad) + str;
  const groups = [];
  for (let i = 0; i < padded.length; i += size) {
    groups.push(padded.slice(i, i + size));
  }
  // Keep all groups including zero-padded leading ones — consistent group widths
  // aid readability even when the leading group is all zeros.
  return groups.join(' ');
}

// ---------------------------------------------------------------------------
// Validate that a string contains only digits legal for the given base
// ---------------------------------------------------------------------------
const VALID = {
  2:  /^[01]+$/,
  8:  /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-fA-F]+$/,
};

function validate(str, base) {
  if (!str) return true; // empty is fine — user is clearing
  return VALID[base].test(str);
}

// ---------------------------------------------------------------------------
// Set status bar
// ---------------------------------------------------------------------------
function setStatus(msg, type) {
  baseStatus.textContent = msg;
  baseStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// ---------------------------------------------------------------------------
// Update all fields from a parsed integer value
// ---------------------------------------------------------------------------
function fill(value, skipEl) {
  if (skipEl !== binInput) binInput.value = groupBinary(value.toString(2));
  if (skipEl !== octInput) octInput.value = value.toString(8);
  if (skipEl !== decInput) decInput.value = value.toString(10);
  if (skipEl !== hexInput) hexInput.value = value.toString(16).toUpperCase();

  const bits = value === 0 ? 1 : Math.floor(Math.log2(value)) + 1;
  baseBits.textContent = `${bits} bit${bits !== 1 ? 's' : ''} minimum`;

  copyBin.disabled = false;
  copyOct.disabled = false;
  copyDec.disabled = false;
  copyHex.disabled = false;
}

// ---------------------------------------------------------------------------
// Clear all output fields (but not the active input)
// ---------------------------------------------------------------------------
function clearOutputs(skipEl) {
  if (skipEl !== binInput) binInput.value = '';
  if (skipEl !== octInput) octInput.value = '';
  if (skipEl !== decInput) decInput.value = '';
  if (skipEl !== hexInput) hexInput.value = '';
  baseBits.textContent = '';
  copyBin.disabled = true;
  copyOct.disabled = true;
  copyDec.disabled = true;
  copyHex.disabled = true;
}

// ---------------------------------------------------------------------------
// Handle input on one field
// ---------------------------------------------------------------------------
function onInput(sourceEl, base, label) {
  const raw = stripPrefix(sourceEl.value);

  if (!raw) {
    clearOutputs(sourceEl);
    setStatus('', '');
    return;
  }

  if (!validate(raw, base)) {
    clearOutputs(sourceEl);
    setStatus(`Invalid ${label} value — unexpected characters.`, 'error');
    return;
  }

  const value = parseInt(raw, base);

  if (!Number.isFinite(value)) {
    clearOutputs(sourceEl);
    setStatus('Value could not be parsed.', 'error');
    return;
  }

  if (value > MAX) {
    clearOutputs(sourceEl);
    setStatus(`Value exceeds maximum safe integer (2⁵³ − 1 = ${MAX.toLocaleString()}).`, 'error');
    return;
  }

  if (value < 0) {
    clearOutputs(sourceEl);
    setStatus('Negative values are not supported.', 'error');
    return;
  }

  fill(value, sourceEl);
  setStatus('', '');
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
binInput.addEventListener('input', () => onInput(binInput,  2,  'binary'));
octInput.addEventListener('input', () => onInput(octInput,  8,  'octal'));
decInput.addEventListener('input', () => onInput(decInput,  10, 'decimal'));
hexInput.addEventListener('input', () => onInput(hexInput,  16, 'hexadecimal'));

copyBin.addEventListener('click', () => copyText(binInput.value.replace(/\s+/g, ''), copyBin));
copyOct.addEventListener('click', () => copyText(octInput.value, copyOct));
copyDec.addEventListener('click', () => copyText(decInput.value, copyDec));
copyHex.addEventListener('click', () => copyText(hexInput.value, copyHex));
