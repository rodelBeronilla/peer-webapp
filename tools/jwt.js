// JWT Decoder & Verifier
// Decodes header/payload and verifies signatures for HS256/384/512 and RS256/384/512.

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

// Verify section elements
const jwtVerifyWrap        = document.getElementById('jwtVerifyWrap');
const jwtVerifyAlgInfo     = document.getElementById('jwtVerifyAlgInfo');
const jwtVerifyHmacSection = document.getElementById('jwtVerifyHmacSection');
const jwtVerifyRsaSection  = document.getElementById('jwtVerifyRsaSection');
const jwtVerifyActions     = document.getElementById('jwtVerifyActions');
const jwtVerifyBtn         = document.getElementById('jwtVerifyBtn');
const jwtVerifyStatus      = document.getElementById('jwtVerifyStatus');
const jwtVerifySecret      = document.getElementById('jwtVerifySecret');
const jwtVerifyPem         = document.getElementById('jwtVerifyPem');

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------
function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try {
    return decodeURIComponent(
      atob(s).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
  } catch {
    throw new Error('Invalid base64url encoding');
  }
}

function b64urlToBuffer(b64url) {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

// ---------------------------------------------------------------------------
// Format epoch claim as human-readable string
// ---------------------------------------------------------------------------
function fmtEpoch(secs) {
  const d = new Date(secs * 1000);
  return d.toLocaleString(undefined, { timeZoneName: 'short' });
}

// ---------------------------------------------------------------------------
// Algorithm maps
// ---------------------------------------------------------------------------
const HMAC_HASH = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };
const RSA_HASH  = { RS256: 'SHA-256', RS384: 'SHA-384', RS512: 'SHA-512' };

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------
async function verifyHmac(alg, secret, token) {
  const hash = HMAC_HASH[alg];
  const parts = token.split('.');
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const signingInput = enc.encode(parts[0] + '.' + parts[1]);
  const sig = b64urlToBuffer(parts[2]);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash },
    false, ['verify']
  );
  return crypto.subtle.verify('HMAC', cryptoKey, sig, signingInput);
}

async function verifyRsa(alg, pem, token) {
  const hash = RSA_HASH[alg];
  const parts = token.split('.');

  // Strip PEM header/footer and whitespace, decode base64 to DER
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  const enc = new TextEncoder();
  const signingInput = enc.encode(parts[0] + '.' + parts[1]);
  const sig = b64urlToBuffer(parts[2]);

  const cryptoKey = await crypto.subtle.importKey(
    'spki', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash },
    false, ['verify']
  );
  return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, sig, signingInput);
}

// ---------------------------------------------------------------------------
// Verify section UI setup — called after decode
// ---------------------------------------------------------------------------
function setupVerify(alg) {
  // Hide all, then configure for detected alg
  jwtVerifyHmacSection.hidden = true;
  jwtVerifyRsaSection.hidden  = true;
  jwtVerifyActions.hidden     = true;
  jwtVerifyStatus.textContent = '';
  jwtVerifyStatus.className   = 'status-bar';

  if (HMAC_HASH[alg]) {
    jwtVerifyAlgInfo.textContent = `Algorithm: ${alg} — paste your secret key to verify the signature.`;
    jwtVerifyHmacSection.hidden  = false;
    jwtVerifyActions.hidden      = false;
    jwtVerifyWrap.hidden         = false;
  } else if (RSA_HASH[alg]) {
    jwtVerifyAlgInfo.textContent = `Algorithm: ${alg} — paste your RSA public key (PEM format) to verify the signature.`;
    jwtVerifyRsaSection.hidden   = false;
    jwtVerifyActions.hidden      = false;
    jwtVerifyWrap.hidden         = false;
  } else if (alg === 'none') {
    jwtVerifyAlgInfo.textContent = 'Algorithm: none — this token has no signature.';
    jwtVerifyWrap.hidden         = false;
  } else {
    jwtVerifyAlgInfo.textContent = `Algorithm: ${alg} — signature verification not supported for this algorithm.`;
    jwtVerifyWrap.hidden         = false;
  }
}

function hideVerify() {
  jwtVerifyWrap.hidden        = true;
  jwtVerifyStatus.textContent = '';
  jwtVerifyStatus.className   = 'status-bar';
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

  // Setup signature verify section
  const alg = typeof header.alg === 'string' ? header.alg : '';
  if (alg) {
    setupVerify(alg);
  } else {
    hideVerify();
  }

  setStatus('Decoded successfully.', 'ok');
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
  jwtHeader.innerHTML = '<span class="code-placeholder">Header will appear here</span>';
  jwtPayload.innerHTML = '<span class="code-placeholder">Payload will appear here</span>';
  jwtExpiry.textContent = '';
  jwtExpiry.hidden = true;
  jwtExpiryWrap.hidden = true;
  jwtCopyHeader.disabled = true;
  jwtCopyPayload.disabled = true;
  hideVerify();
}

function setStatus(msg, type) {
  jwtStatus.textContent = msg;
  jwtStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function setVerifyStatus(msg, type) {
  jwtVerifyStatus.textContent = msg;
  jwtVerifyStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// ---------------------------------------------------------------------------
// Copy helper
// ---------------------------------------------------------------------------
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {
    const orig = btn.textContent;
    btn.textContent = 'Failed!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
    setStatus('Copy failed — check clipboard permissions.', 'error');
  });
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

// Verify button
jwtVerifyBtn.addEventListener('click', async () => {
  const token = jwtInput.value.trim();
  if (!token) return;

  const parts = token.split('.');
  if (parts.length !== 3) return;

  let header;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
  } catch {
    return;
  }

  const alg = typeof header.alg === 'string' ? header.alg : '';
  jwtVerifyBtn.disabled = true;
  setVerifyStatus('Verifying…', '');

  try {
    if (HMAC_HASH[alg]) {
      const secret = jwtVerifySecret.value;
      if (!secret) {
        setVerifyStatus('Enter a secret key to verify.', 'error');
        return;
      }
      const valid = await verifyHmac(alg, secret, token);
      setVerifyStatus(valid ? '✓ Signature valid' : '✗ Signature invalid', valid ? 'ok' : 'error');

    } else if (RSA_HASH[alg]) {
      const pem = jwtVerifyPem.value.trim();
      if (!pem) {
        setVerifyStatus('Paste a PEM public key to verify.', 'error');
        return;
      }
      const valid = await verifyRsa(alg, pem, token);
      setVerifyStatus(valid ? '✓ Signature valid' : '✗ Signature invalid', valid ? 'ok' : 'error');
    }
  } catch (err) {
    setVerifyStatus(`Error: ${err.message}`, 'error');
  } finally {
    jwtVerifyBtn.disabled = false;
  }
});

// Clear verify status when inputs change
jwtVerifySecret.addEventListener('input', () => { jwtVerifyStatus.textContent = ''; jwtVerifyStatus.className = 'status-bar'; });
jwtVerifyPem.addEventListener('input',    () => { jwtVerifyStatus.textContent = ''; jwtVerifyStatus.className = 'status-bar'; });
