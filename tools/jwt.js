// JWT Decoder
// Decodes the header and payload of a JWT — no signature verification.

const jwtInput   = document.getElementById('jwtInput');
const jwtDecode  = document.getElementById('jwtDecode');
const jwtClear   = document.getElementById('jwtClear');
const jwtStatus  = document.getElementById('jwtStatus');
const jwtHeader  = document.getElementById('jwtHeader');
const jwtPayload = document.getElementById('jwtPayload');
const jwtExpiry  = document.getElementById('jwtExpiry');
const jwtCopyHeader  = document.getElementById('jwtCopyHeader');
const jwtCopyPayload = document.getElementById('jwtCopyPayload');
const jwtExpiryWrap  = document.getElementById('jwtExpiryWrap');

// ---------------------------------------------------------------------------
// Base64url decode → UTF-8 string
// ---------------------------------------------------------------------------
function b64urlDecode(str) {
  // Convert base64url → base64
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (s.length % 4) s += '=';
  try {
    // atob gives binary string; encode each byte as %XX for decodeURIComponent
    return decodeURIComponent(
      atob(s).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
  } catch {
    throw new Error('Invalid base64url encoding');
  }
}

// ---------------------------------------------------------------------------
// Format epoch claim as human-readable string
// ---------------------------------------------------------------------------
function fmtEpoch(secs) {
  const d = new Date(secs * 1000);
  return d.toLocaleString(undefined, { timeZoneName: 'short' });
}

// ---------------------------------------------------------------------------
// Decode and render
// ---------------------------------------------------------------------------
function decode() {
  const token = jwtInput.value.trim();
  if (!token) {
    clearOutput();
    return;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    setStatus('Invalid JWT — expected 3 dot-separated parts.', 'error');
    clearOutput();
    return;
  }

  let header, payload;

  try {
    header = JSON.parse(b64urlDecode(parts[0]));
  } catch {
    setStatus('Could not decode header — invalid base64url or JSON.', 'error');
    clearOutput();
    return;
  }

  try {
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    setStatus('Could not decode payload — invalid base64url or JSON.', 'error');
    clearOutput();
    return;
  }

  // Render header
  jwtHeader.textContent = JSON.stringify(header, null, 2);
  jwtCopyHeader.disabled = false;

  // Render payload
  jwtPayload.textContent = JSON.stringify(payload, null, 2);
  jwtCopyPayload.disabled = false;

  // Expiry status
  renderExpiry(payload);

  setStatus('Decoded successfully. Signature is NOT verified.', 'ok');
}

function renderExpiry(payload) {
  const now = Math.floor(Date.now() / 1000);
  const lines = [];

  if (typeof payload.iat === 'number') {
    lines.push(`Issued at:  ${fmtEpoch(payload.iat)}`);
  }
  if (typeof payload.nbf === 'number') {
    const notBefore = payload.nbf > now ? ` (not yet valid)` : '';
    lines.push(`Not before: ${fmtEpoch(payload.nbf)}${notBefore}`);
  }
  if (typeof payload.exp === 'number') {
    const expired = payload.exp < now;
    lines.push(`Expires:    ${fmtEpoch(payload.exp)} — ${expired ? '⚠ EXPIRED' : '✓ Valid'}`);
  } else {
    lines.push('Expires:    No expiry claim (exp)');
  }

  const hasContent = lines.length > 0;
  jwtExpiry.textContent = lines.join('\n');
  jwtExpiry.hidden = !hasContent;
  jwtExpiryWrap.hidden = !hasContent;
}

function clearOutput() {
  jwtHeader.textContent = '';
  jwtPayload.textContent = '';
  jwtExpiry.textContent = '';
  jwtExpiry.hidden = true;
  jwtExpiryWrap.hidden = true;
  jwtCopyHeader.disabled = true;
  jwtCopyPayload.disabled = true;
}

function setStatus(msg, type) {
  jwtStatus.textContent = msg;
  jwtStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// ---------------------------------------------------------------------------
// Copy helper
// ---------------------------------------------------------------------------
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
jwtDecode.addEventListener('click', decode);

jwtClear.addEventListener('click', () => {
  jwtInput.value = '';
  clearOutput();
  setStatus('', '');
  jwtInput.focus();
});

jwtCopyHeader.addEventListener('click', () => copyText(jwtHeader.textContent, jwtCopyHeader));
jwtCopyPayload.addEventListener('click', () => copyText(jwtPayload.textContent, jwtCopyPayload));

// Decode on paste for instant feedback
jwtInput.addEventListener('paste', () => setTimeout(decode, 0));
