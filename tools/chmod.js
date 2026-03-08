// Unix Permissions / chmod Calculator
// Click checkboxes to set permissions — octal and symbolic update live.
// Type an octal (e.g. 755) or symbolic string (e.g. rwxr-xr-x) to update checkboxes.
// Optionally enter a filename to build a ready-to-paste chmod command.

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const octalInput    = document.getElementById('chmodOctal');
const symbolicInput = document.getElementById('chmodSymbolic');
const filenameInput = document.getElementById('chmodFilename');
const commandOut    = document.getElementById('chmodCommand');
const chmodStatus   = document.getElementById('chmodStatus');
const copyOctal     = document.getElementById('chmodCopyOctal');
const copySymbolic  = document.getElementById('chmodCopySymbolic');
const copyCommand   = document.getElementById('chmodCopyCmd');

// Bit checkboxes: [owner-r, owner-w, owner-x, group-r, group-w, group-x, other-r, other-w, other-x]
const bitBoxes = [
  document.getElementById('chmodOwnerR'),
  document.getElementById('chmodOwnerW'),
  document.getElementById('chmodOwnerX'),
  document.getElementById('chmodGroupR'),
  document.getElementById('chmodGroupW'),
  document.getElementById('chmodGroupX'),
  document.getElementById('chmodOtherR'),
  document.getElementById('chmodOtherW'),
  document.getElementById('chmodOtherX'),
];

const suidBox   = document.getElementById('chmodSUID');
const sgidBox   = document.getElementById('chmodSGID');
const stickyBox = document.getElementById('chmodSticky');

// Bit weight for each checkbox (index 0-8 maps to rwxrwxrwx)
const BIT_WEIGHTS = [256, 128, 64, 32, 16, 8, 4, 2, 1]; // 2^8 … 2^0

// ---------------------------------------------------------------------------
// Core: compute octal value from checkbox state
// ---------------------------------------------------------------------------
function getOctalValue() {
  let val = 0;
  bitBoxes.forEach((cb, i) => { if (cb.checked) val |= BIT_WEIGHTS[i]; });
  if (suidBox.checked)   val |= 0o4000;
  if (sgidBox.checked)   val |= 0o2000;
  if (stickyBox.checked) val |= 0o1000;
  return val;
}

// ---------------------------------------------------------------------------
// Core: build symbolic string from octal value
// E.g. 0o755 → "rwxr-xr-x" (file type prefix excluded — added at display time)
// ---------------------------------------------------------------------------
function octalToSymbolic(val) {
  const chars = ['r','w','x','r','w','x','r','w','x'];
  let sym = '';
  for (let i = 0; i < 9; i++) {
    sym += (val & BIT_WEIGHTS[i]) ? chars[i] : '-';
  }
  // Handle setuid on owner-x position
  if (val & 0o4000) sym = sym.slice(0, 2) + ((val & 0o100) ? 's' : 'S') + sym.slice(3);
  // Handle setgid on group-x position
  if (val & 0o2000) sym = sym.slice(0, 5) + ((val & 0o010) ? 's' : 'S') + sym.slice(6);
  // Handle sticky on other-x position
  if (val & 0o1000) sym = sym.slice(0, 8) + ((val & 0o001) ? 't' : 'T');
  return sym;
}

// ---------------------------------------------------------------------------
// Core: set checkboxes from an octal integer value
// ---------------------------------------------------------------------------
function applyOctal(val) {
  bitBoxes.forEach((cb, i) => { cb.checked = !!(val & BIT_WEIGHTS[i]); });
  suidBox.checked   = !!(val & 0o4000);
  sgidBox.checked   = !!(val & 0o2000);
  stickyBox.checked = !!(val & 0o1000);
}

// ---------------------------------------------------------------------------
// Core: parse a symbolic string (e.g. "rwxr-xr-x" or "-rwxr-xr-x")
// Returns an octal integer, or null if invalid.
// ---------------------------------------------------------------------------
function parseSymbolic(sym) {
  // Strip leading file type char if present
  const s = sym.length === 10 ? sym.slice(1) : sym;
  if (s.length !== 9) return null;

  const expected = ['r','w','x','r','w','x','r','w','x'];
  // Also accept 's'/'S' in positions 2,5 and 't'/'T' in position 8
  const specialPos = { 2: ['x','s','S'], 5: ['x','s','S'], 8: ['x','t','T'] };
  let val = 0;

  for (let i = 0; i < 9; i++) {
    const c = s[i];
    const allowed = specialPos[i] || [expected[i]];
    if (c !== '-' && !allowed.includes(c)) return null;
    if (c === expected[i] || c === 's' || c === 't') val |= BIT_WEIGHTS[i];
    // uppercase S/T means special bit set but base x-bit not set
  }

  // Special bits from symbolic
  if ('sS'.includes(s[2])) val |= 0o4000;
  if ('sS'.includes(s[5])) val |= 0o2000;
  if ('tT'.includes(s[8])) val |= 0o1000;

  return val;
}

// ---------------------------------------------------------------------------
// Render: update all outputs from current checkbox state
// ---------------------------------------------------------------------------
function renderFromCheckboxes() {
  const val     = getOctalValue();
  const special = (val >> 9) & 0o7;
  const plain   = val & 0o777;

  const octalStr    = special ? special.toString() + plain.toString(8).padStart(3, '0') : plain.toString(8).padStart(3, '0');
  const symbolicStr = '-' + octalToSymbolic(val);
  const filename    = filenameInput.value.trim() || 'filename';
  const cmdStr      = `chmod ${octalStr} ${filename}`;

  // Update inputs (suppress re-triggering handlers via flag)
  updating = true;
  octalInput.value    = octalStr;
  symbolicInput.value = symbolicStr;
  updating = false;

  commandOut.value = cmdStr;
  setStatus('', '');
  setOutputsEnabled(true);

  // Update ARIA descriptions
  octalInput.setAttribute('aria-label', `Octal permission code: ${octalStr}`);
  symbolicInput.setAttribute('aria-label', `Symbolic permission string: ${symbolicStr}`);
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------
function setStatus(msg, type) {
  chmodStatus.textContent = msg;
  chmodStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function setOutputsEnabled(enabled) {
  copyOctal.disabled    = !enabled;
  copySymbolic.disabled = !enabled;
  copyCommand.disabled  = !enabled;
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
// Guard against update loops when checkboxes → inputs → checkboxes
// ---------------------------------------------------------------------------
let updating = false;

// ---------------------------------------------------------------------------
// Event: any checkbox changed
// ---------------------------------------------------------------------------
[...bitBoxes, suidBox, sgidBox, stickyBox].forEach(cb => {
  cb.addEventListener('change', renderFromCheckboxes);
});

// ---------------------------------------------------------------------------
// Event: octal input changed
// ---------------------------------------------------------------------------
octalInput.addEventListener('input', () => {
  if (updating) return;
  const raw = octalInput.value.trim();
  if (!raw) {
    setStatus('', '');
    return;
  }
  if (!/^[0-7]{1,5}$/.test(raw)) {
    setStatus('Invalid octal — use digits 0–7, up to 4 digits (e.g. 755 or 4755).', 'error');
    setOutputsEnabled(false);
    return;
  }
  const val = parseInt(raw, 8);
  applyOctal(val);
  renderFromCheckboxes();
});

// ---------------------------------------------------------------------------
// Event: symbolic input changed
// ---------------------------------------------------------------------------
symbolicInput.addEventListener('input', () => {
  if (updating) return;
  const raw = symbolicInput.value.trim();
  if (!raw) {
    setStatus('', '');
    return;
  }
  const val = parseSymbolic(raw);
  if (val === null) {
    setStatus('Invalid symbolic string — expected format: -rwxr-xr-x (10 chars) or rwxr-xr-x (9 chars).', 'error');
    setOutputsEnabled(false);
    return;
  }
  applyOctal(val);
  renderFromCheckboxes();
});

// ---------------------------------------------------------------------------
// Event: filename changes — rebuild command
// ---------------------------------------------------------------------------
filenameInput.addEventListener('input', () => {
  if (octalInput.value) renderFromCheckboxes();
});

// ---------------------------------------------------------------------------
// Event: copy buttons
// ---------------------------------------------------------------------------
copyOctal.addEventListener('click',    () => copyText(octalInput.value, copyOctal));
copySymbolic.addEventListener('click', () => copyText(symbolicInput.value, copySymbolic));
copyCommand.addEventListener('click',  () => copyText(commandOut.value, copyCommand));

// ---------------------------------------------------------------------------
// Init: default to 644 (common file permission)
// ---------------------------------------------------------------------------
applyOctal(0o644);
renderFromCheckboxes();
