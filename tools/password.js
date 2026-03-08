// Password Generator

import { copyText } from './utils.js';

const CHARSETS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  digits:  '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
};

const pwLength   = document.getElementById('pwLength');
const pwLenValue = document.getElementById('pwLenValue');
const pwUpper    = document.getElementById('pwUpper');
const pwLower    = document.getElementById('pwLower');
const pwDigits   = document.getElementById('pwDigits');
const pwSymbols  = document.getElementById('pwSymbols');
const pwOutput   = document.getElementById('pwOutput');
const pwEntropy  = document.getElementById('pwEntropy');
const pwGenerate = document.getElementById('pwGenerate');
const pwCopy     = document.getElementById('pwCopy');
const pwStatus   = document.getElementById('pwStatus');

function buildPool() {
  let pool = '';
  if (pwUpper.checked)   pool += CHARSETS.upper;
  if (pwLower.checked)   pool += CHARSETS.lower;
  if (pwDigits.checked)  pool += CHARSETS.digits;
  if (pwSymbols.checked) pool += CHARSETS.symbols;
  return pool;
}

function calcEntropy(poolSize, length) {
  if (poolSize === 0 || length === 0) return 0;
  return Math.log2(Math.pow(poolSize, length));
}

function entropyLabel(bits) {
  if (bits < 40)  return 'Weak';
  if (bits < 60)  return 'Fair';
  if (bits < 80)  return 'Good';
  if (bits < 100) return 'Strong';
  return 'Very Strong';
}

function entropyClass(bits) {
  if (bits < 40)  return 'pw-entropy--weak';
  if (bits < 60)  return 'pw-entropy--fair';
  if (bits < 80)  return 'pw-entropy--good';
  return 'pw-entropy--strong';
}

function setStatus(msg, type = '') {
  pwStatus.textContent = msg;
  pwStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function generate() {
  const pool   = buildPool();
  const length = parseInt(pwLength.value, 10);

  if (pool.length === 0) {
    pwOutput.value = '';
    pwCopy.disabled = true;
    pwEntropy.textContent = '';
    pwEntropy.className = 'pw-entropy';
    setStatus('Select at least one character type', 'error');
    return;
  }

  // Rejection sampling eliminates modulo bias: discard values that fall in the
  // fractional remainder above the largest exact multiple of pool.length.
  const poolLen = pool.length;
  const limit   = (0x100000000 - (0x100000000 % poolLen)) >>> 0;
  const buf     = new Uint32Array(1);
  let password  = '';
  for (let i = 0; i < length; i++) {
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    password += pool[buf[0] % poolLen];
  }

  pwOutput.value = password;
  pwCopy.disabled = false;

  const bits = calcEntropy(pool.length, length);
  const label = entropyLabel(bits);
  pwEntropy.textContent = `${bits.toFixed(1)} bits — ${label}`;
  pwEntropy.className = `pw-entropy ${entropyClass(bits)}`;

  setStatus(`Pool: ${pool.length} chars · Length: ${length}`, 'ok');
}

// Sync length slider label and ARIA attribute
pwLength.addEventListener('input', () => {
  pwLenValue.textContent = pwLength.value;
  pwLength.setAttribute('aria-valuenow', pwLength.value);
  generate();
});

// Regenerate on checkbox changes
[pwUpper, pwLower, pwDigits, pwSymbols].forEach(cb => {
  cb.addEventListener('change', generate);
});

pwGenerate.addEventListener('click', generate);
pwCopy.addEventListener('click', () => copyText(pwOutput.value, pwCopy));

// Generate on load
generate();
