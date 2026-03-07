// Number Base Converter
// Converts integers between binary (2), octal (8), decimal (10), and hex (16).
// Editing any field updates the other three live.

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
// Strip common prefixes (0b, 0o, 0x) and whitespace
// ---------------------------------------------------------------------------
function stripPrefix(raw) {
  return raw.trim().replace(/^0[bBoOxX]/, '');
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
  if (skipEl !== binInput) binInput.value = value.toString(2);
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
// Copy helper
// ---------------------------------------------------------------------------
function copyText(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {
    const orig = btn.textContent;
    btn.textContent = 'Failed!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
binInput.addEventListener('input', () => onInput(binInput,  2,  'binary'));
octInput.addEventListener('input', () => onInput(octInput,  8,  'octal'));
decInput.addEventListener('input', () => onInput(decInput,  10, 'decimal'));
hexInput.addEventListener('input', () => onInput(hexInput,  16, 'hexadecimal'));

copyBin.addEventListener('click', () => copyText(binInput.value, copyBin));
copyOct.addEventListener('click', () => copyText(octInput.value, copyOct));
copyDec.addEventListener('click', () => copyText(decInput.value, copyDec));
copyHex.addEventListener('click', () => copyText(hexInput.value, copyHex));
