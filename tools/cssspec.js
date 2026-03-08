// CSS Specificity Calculator
// Calculates CSS specificity as (a,b,c) per CSS Selectors Level 4 spec.
//   a = ID selectors (#foo)
//   b = class selectors (.foo), attribute selectors ([attr]), pseudo-classes (:hover)
//       :is()/:not()/:has() forward to their most specific argument
//       :where() contributes 0
//   c = type selectors (div), pseudo-elements (::before)
//   * and combinators (>, +, ~, space) contribute 0

import { copyText, escapeHtml } from './utils.js';

const cssInput     = document.getElementById('cssSpecInput');
const cssResult    = document.getElementById('cssSpecResult');
const cssBreakdown = document.getElementById('cssSpecBreakdown');
const cssCmp1      = document.getElementById('cssSpecCmp1');
const cssCmp2      = document.getElementById('cssSpecCmp2');
const cssCmpResult = document.getElementById('cssSpecCmpResult');
const cssCopy      = document.getElementById('cssSpecCopy');
const cssStatus    = document.getElementById('cssSpecStatus');

// Pseudo-elements (legacy single-colon + modern double-colon forms)
const PSEUDO_ELEMENTS = new Set([
  'before', 'after', 'first-line', 'first-letter',
  'placeholder', 'selection', 'marker', 'backdrop',
  'spelling-error', 'grammar-error', 'file-selector-button',
  'cue', 'cue-region', 'part', 'slotted',
]);

// Pseudo-classes that forward specificity to their most specific argument
const FORWARDING_PSEUDO = new Set(['is', 'not', 'has', 'matches']);

// Pseudo-classes that always contribute 0 specificity
const ZERO_PSEUDO = new Set(['where']);

// ---------------------------------------------------------------------------
// Read balanced parentheses content starting at sel[pos] where sel[pos] === '('
// Returns [innerContent, indexAfterCloseParen]
// ---------------------------------------------------------------------------
function readParens(sel, pos) {
  let depth = 0, inStr = false, strChar = '';
  const start = pos;
  while (pos < sel.length) {
    const ch = sel[pos];
    if (inStr) {
      if (ch === '\\') pos++;          // skip escaped char
      else if (ch === strChar) inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true; strChar = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) { pos++; break; }
    }
    pos++;
  }
  return [sel.slice(start + 1, pos - 1), pos];
}

// ---------------------------------------------------------------------------
// Check if char belongs to a CSS identifier
// ---------------------------------------------------------------------------
function isIdentChar(ch) {
  return /[a-zA-Z0-9_-]/.test(ch) || ch.charCodeAt(0) > 127;
}

// ---------------------------------------------------------------------------
// Read a CSS identifier starting at pos; returns [ident, newPos]
// ---------------------------------------------------------------------------
function readIdent(sel, pos) {
  const start = pos;
  while (pos < sel.length && isIdentChar(sel[pos])) pos++;
  return [sel.slice(start, pos), pos];
}

// ---------------------------------------------------------------------------
// Split a selector list on top-level commas (respecting parens and strings)
// ---------------------------------------------------------------------------
function splitList(sel) {
  const parts = [];
  let depth = 0, start = 0, inStr = false, strChar = '';
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === strChar) inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true; strChar = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      parts.push(sel.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(sel.slice(start).trim());
  return parts.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Compare two specificity objects: returns >0 if s1 wins, <0 if s2 wins, 0 if tie
// ---------------------------------------------------------------------------
function cmpSpec(s1, s2) {
  if (s1.a !== s2.a) return s1.a - s2.a;
  if (s1.b !== s2.b) return s1.b - s2.b;
  return s1.c - s2.c;
}

// ---------------------------------------------------------------------------
// Calculate specificity of a (single, non-comma-separated) selector string.
// Returns { a, b, c, tokens[] } where each token is { label, a, b, c }
// ---------------------------------------------------------------------------
function calcSpec(selector) {
  let a = 0, b = 0, c = 0;
  const tokens = [];
  let i = 0;
  const sel = selector.trim();

  while (i < sel.length) {
    const ch = sel[i];

    if (ch === '#') {
      // ID selector
      i++;
      const [ident, end] = readIdent(sel, i);
      i = end;
      const label = '#' + (ident || '?');
      a++;
      tokens.push({ label, a: 1, b: 0, c: 0 });

    } else if (ch === '.') {
      // Class selector
      i++;
      const [ident, end] = readIdent(sel, i);
      i = end;
      const label = '.' + (ident || '?');
      b++;
      tokens.push({ label, a: 0, b: 1, c: 0 });

    } else if (ch === '[') {
      // Attribute selector — scan to matching ]
      const start = i;
      i++;
      let inStr2 = false, strChar2 = '';
      while (i < sel.length) {
        const c2 = sel[i];
        if (inStr2) {
          if (c2 === '\\') i++;
          else if (c2 === strChar2) inStr2 = false;
        } else if (c2 === '"' || c2 === "'") {
          inStr2 = true; strChar2 = c2;
        } else if (c2 === ']') { i++; break; }
        i++;
      }
      b++;
      tokens.push({ label: sel.slice(start, i), a: 0, b: 1, c: 0 });

    } else if (ch === ':') {
      i++;
      const isElement = sel[i] === ':';
      if (isElement) i++;
      const [name, afterName] = readIdent(sel, i);
      i = afterName;
      const lname = name.toLowerCase();

      if (isElement || PSEUDO_ELEMENTS.has(lname)) {
        // Pseudo-element → c
        c++;
        tokens.push({ label: (isElement ? '::' : ':') + name, a: 0, b: 0, c: 1 });

      } else if (sel[i] === '(') {
        // Functional pseudo-class
        const [args, afterParen] = readParens(sel, i);
        i = afterParen;

        if (ZERO_PSEUDO.has(lname)) {
          // :where() → 0
          tokens.push({ label: `:${name}(\u2026)`, a: 0, b: 0, c: 0 });

        } else if (FORWARDING_PSEUDO.has(lname)) {
          // :is()/:not()/:has() → max specificity of arguments
          const argParts = splitList(args);
          let maxS = { a: 0, b: 0, c: 0 };
          for (const arg of argParts) {
            const s = calcSpec(arg);
            if (cmpSpec(s, maxS) > 0) maxS = s;
          }
          a += maxS.a; b += maxS.b; c += maxS.c;
          tokens.push({ label: `:${name}(\u2026)`, a: maxS.a, b: maxS.b, c: maxS.c });

        } else {
          // Normal functional pseudo-class → b
          b++;
          tokens.push({ label: `:${name}(\u2026)`, a: 0, b: 1, c: 0 });
        }

      } else {
        // Simple pseudo-class → b
        b++;
        tokens.push({ label: `:${name}`, a: 0, b: 1, c: 0 });
      }

    } else if (ch === '*') {
      // Universal selector → 0
      i++;
      tokens.push({ label: '*', a: 0, b: 0, c: 0 });

    } else if (ch === '>' || ch === '+' || ch === '~' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      // Combinator → 0
      i++;

    } else if (ch === '|') {
      // Namespace separator or column combinator — skip
      i++;
      if (sel[i] === '|') i++;

    } else if (ch === ',') {
      // Top-level comma (caller should have split; treat as end of selector)
      break;

    } else if (isIdentChar(ch)) {
      // Type selector → c
      const [ident, end] = readIdent(sel, i);
      i = end;
      c++;
      tokens.push({ label: ident, a: 0, b: 0, c: 1 });

    } else {
      i++;
    }
  }

  return { a, b, c, tokens };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function specStr(s) {
  return `(${s.a},${s.b},${s.c})`;
}


function setStatus(msg, type = '') {
  cssStatus.textContent = msg;
  cssStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// ---------------------------------------------------------------------------
// Render: main selector result + breakdown
// ---------------------------------------------------------------------------
function renderResult(sel) {
  if (!sel.trim()) {
    cssResult.innerHTML = '<span class="css-spec-placeholder">Enter a CSS selector to see its specificity.</span>';
    cssBreakdown.innerHTML = '';
    cssCopy.disabled = true;
    setStatus('');
    return;
  }

  const spec = calcSpec(sel);

  cssResult.innerHTML = `
    <div class="css-spec-tuple" aria-label="Specificity ${specStr(spec)}">
      <div class="css-spec-col">
        <span class="css-spec-num css-spec-num--a">${spec.a}</span>
        <span class="css-spec-label">IDs<br><small>(a)</small></span>
      </div>
      <span class="css-spec-comma" aria-hidden="true">,</span>
      <div class="css-spec-col">
        <span class="css-spec-num css-spec-num--b">${spec.b}</span>
        <span class="css-spec-label">Classes<br><small>(b)</small></span>
      </div>
      <span class="css-spec-comma" aria-hidden="true">,</span>
      <div class="css-spec-col">
        <span class="css-spec-num css-spec-num--c">${spec.c}</span>
        <span class="css-spec-label">Types<br><small>(c)</small></span>
      </div>
    </div>
    <div class="css-spec-score">${escapeHtml(specStr(spec))}</div>
  `;

  // Token breakdown
  if (spec.tokens.length > 0) {
    const rows = spec.tokens.map(t => {
      const parts = [];
      if (t.a) parts.push(`+${t.a} ID`);
      if (t.b) parts.push(`+${t.b} class`);
      if (t.c) parts.push(`+${t.c} type`);
      const contrib = parts.join(', ') || '<span class="css-spec-zero">0 (ignored)</span>';
      return `<tr>
        <td><code class="css-spec-token-code">${escapeHtml(t.label)}</code></td>
        <td class="css-spec-contrib">${contrib}</td>
      </tr>`;
    }).join('');
    cssBreakdown.innerHTML = `
      <table class="css-spec-table" aria-label="Per-token specificity breakdown">
        <thead><tr><th>Token</th><th>Contributes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } else {
    cssBreakdown.innerHTML = '';
  }

  cssCopy.disabled = false;
  setStatus(`Specificity: ${specStr(spec)}`, 'ok');
}

// ---------------------------------------------------------------------------
// Render: comparison
// ---------------------------------------------------------------------------
function renderCompare() {
  const sel1 = cssCmp1.value.trim();
  const sel2 = cssCmp2.value.trim();
  if (!sel1 || !sel2) { cssCmpResult.innerHTML = ''; return; }

  const s1 = calcSpec(sel1);
  const s2 = calcSpec(sel2);
  const cmp = cmpSpec(s1, s2);

  if (cmp > 0) {
    cssCmpResult.innerHTML =
      `<span class="css-cmp-badge css-cmp-badge--win">\u2460 wins</span> ` +
      `<code>${escapeHtml(specStr(s1))}</code> beats <code>${escapeHtml(specStr(s2))}</code>`;
  } else if (cmp < 0) {
    cssCmpResult.innerHTML =
      `<span class="css-cmp-badge css-cmp-badge--win">\u2461 wins</span> ` +
      `<code>${escapeHtml(specStr(s2))}</code> beats <code>${escapeHtml(specStr(s1))}</code>`;
  } else {
    cssCmpResult.innerHTML =
      `<span class="css-cmp-badge css-cmp-badge--tie">Tie</span> ` +
      `Both are <code>${escapeHtml(specStr(s1))}</code> \u2014 last-declared wins`;
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
let timer;
cssInput.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => renderResult(cssInput.value), 100);
});

cssCmp1.addEventListener('input', renderCompare);
cssCmp2.addEventListener('input', renderCompare);

cssCopy.addEventListener('click', () => {
  const spec = calcSpec(cssInput.value);
  copyText(specStr(spec), cssCopy);
});

document.getElementById('cssSpecClear').addEventListener('click', () => {
  cssInput.value = '';
  renderResult('');
  cssInput.focus();
});

// Initial render
renderResult('');
