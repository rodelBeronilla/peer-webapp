// CIDR / IP Subnet Calculator
// Parses CIDR notation and computes network details using bitwise arithmetic.

import { copyText } from './utils.js';

const cidrInput   = document.getElementById('cidrInput');
const cidrCalc    = document.getElementById('cidrCalc');
const cidrClear   = document.getElementById('cidrClear');
const cidrStatus  = document.getElementById('cidrStatus');
const cidrResult  = document.getElementById('cidrResult');

function setStatus(msg, type = '') {
  cidrStatus.textContent = msg;
  cidrStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// Parse "a.b.c.d" → 32-bit unsigned integer (big-endian)
function ipToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (isNaN(v) || v < 0 || v > 255 || String(v) !== p) return null;
    n = (n * 256 + v) >>> 0;
  }
  return n;
}

// 32-bit unsigned integer → "a.b.c.d"
function intToIp(n) {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n         & 0xff,
  ].join('.');
}

function calculate() {
  const raw = cidrInput.value.trim();
  if (!raw) {
    setStatus('Enter a CIDR block.', 'error');
    return;
  }

  const slash = raw.indexOf('/');
  if (slash === -1) {
    setStatus('Missing prefix length — use format x.x.x.x/n', 'error');
    return;
  }

  const ipStr     = raw.slice(0, slash);
  const prefixStr = raw.slice(slash + 1);
  const prefix    = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32 || String(prefix) !== prefixStr) {
    setStatus('Prefix length must be 0–32.', 'error');
    return;
  }

  const ipInt = ipToInt(ipStr);
  if (ipInt === null) {
    setStatus('Invalid IP address — use dotted decimal (e.g. 192.168.1.0).', 'error');
    return;
  }

  // Subnet mask: prefix 1-bits followed by (32-prefix) 0-bits
  const maskInt = prefix === 0
    ? 0
    : (0xffffffff << (32 - prefix)) >>> 0;

  const networkInt   = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  const wildcardInt  = (~maskInt) >>> 0;
  const hostCount    = prefix >= 31
    ? (prefix === 32 ? 1 : 2)           // /32 = single host, /31 = 2 peers
    : (broadcastInt - networkInt - 1);  // usable hosts

  const firstHost = prefix >= 31 ? networkInt   : networkInt   + 1;
  const lastHost  = prefix >= 31 ? broadcastInt : broadcastInt - 1;

  const rows = [
    { label: 'Network address',   value: intToIp(networkInt),   id: 'cidrNetwork'   },
    { label: 'Broadcast address', value: intToIp(broadcastInt), id: 'cidrBroadcast' },
    { label: 'Subnet mask',       value: intToIp(maskInt),      id: 'cidrMask'      },
    { label: 'Wildcard mask',     value: intToIp(wildcardInt),  id: 'cidrWildcard'  },
    { label: 'First host',        value: intToIp(firstHost),    id: 'cidrFirst'     },
    { label: 'Last host',         value: intToIp(lastHost),     id: 'cidrLast'      },
    { label: 'Host count',        value: hostCount.toLocaleString(), id: 'cidrHosts' },
    { label: 'Prefix length',     value: `/${prefix}`,          id: 'cidrPrefix'    },
  ];

  // Note for special prefix lengths
  let note = '';
  if (prefix === 31) note = '/31 — point-to-point link (RFC 3021): no network or broadcast address.';
  if (prefix === 32) note = '/32 — single host route.';
  if (prefix === 0)  note = '/0 — entire IPv4 address space (default route).';

  cidrResult.innerHTML = `
    <table class="cidr-table" aria-label="Subnet details">
      <thead>
        <tr><th>Field</th><th>Value</th><th></th></tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td class="cidr-field-label">${r.label}</td>
            <td class="cidr-field-value" id="${r.id}"><code>${r.value}</code></td>
            <td><button class="btn btn--sm btn--ghost cidr-copy-btn" data-value="${r.value}" aria-label="Copy ${r.label}">Copy</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    ${note ? `<p class="cidr-note">${note}</p>` : ''}
  `;

  cidrResult.hidden = false;
  setStatus('Calculated.', 'ok');

  // Wire copy buttons
  cidrResult.querySelectorAll('.cidr-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.dataset.value, btn));
  });
}

cidrCalc.addEventListener('click', calculate);
cidrInput.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });

cidrClear.addEventListener('click', () => {
  cidrInput.value = '';
  cidrResult.hidden = true;
  cidrResult.innerHTML = '';
  setStatus('');
  cidrInput.focus();
});

// Auto-calculate on valid-looking input
cidrInput.addEventListener('input', () => {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(cidrInput.value.trim())) {
    calculate();
  } else {
    cidrResult.hidden = true;
    setStatus('');
  }
});
