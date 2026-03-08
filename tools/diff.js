// Text Diff Tool
// Compares two text blocks line-by-line using the Myers O(ND) diff algorithm.
// Highlights additions (+, green) and deletions (-, red) with line numbers.

import { copyText } from './utils.js';

const beforeInput = document.getElementById('diffBefore');
const afterInput  = document.getElementById('diffAfter');
const diffOutput  = document.getElementById('diffOutput');
const diffStats   = document.getElementById('diffStats');
const swapBtn     = document.getElementById('diffSwap');
const clearBtn    = document.getElementById('diffClear');
const copyBtn     = document.getElementById('diffCopy');

// ---------------------------------------------------------------------------
// Myers O(ND) diff — line-level
// Returns [{type: 'equal'|'insert'|'delete', value: string}]
// ---------------------------------------------------------------------------
function myersDiff(a, b) {
  const n = a.length, m = b.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map(v => ({ type: 'insert',  value: v }));
  if (m === 0) return a.map(v => ({ type: 'delete', value: v }));

  const max = n + m;
  const off = max;
  const v   = new Int32Array(2 * max + 1);
  const trace = [];
  let found = false;

  for (let d = 0; d <= max && !found; d++) {
    trace.push(new Int32Array(v));
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[k - 1 + off] < v[k + 1 + off])) {
        x = v[k + 1 + off];          // move down (insert from b)
      } else {
        x = v[k - 1 + off] + 1;      // move right (delete from a)
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; } // diagonal snake
      v[k + off] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
  }

  // Backtrack through trace to recover the edit sequence
  const edits = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d];
    const k  = x - y;
    let prevK;
    if (k === -d || (k !== d && vd[k - 1 + off] < vd[k + 1 + off])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vd[prevK + off];
    const prevY = prevX - prevK;

    // Diagonal (snake) moves — equal lines
    while (x > prevX && y > prevY) {
      edits.push({ type: 'equal', value: a[x - 1] });
      x--; y--;
    }

    // Single non-diagonal edit (skip at d=0, no edit to recover)
    if (d > 0) {
      if (x > prevX) {
        edits.push({ type: 'delete', value: a[x - 1] });
        x--;
      } else if (y > prevY) {
        edits.push({ type: 'insert', value: b[y - 1] });
        y--;
      }
    }
  }

  return edits.reverse();
}

// ---------------------------------------------------------------------------
// Escape HTML for safe innerHTML insertion
// ---------------------------------------------------------------------------
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Render diff output and update stats
// ---------------------------------------------------------------------------
function renderDiff(edits, hasInput) {
  if (!hasInput) {
    diffOutput.innerHTML = '<span class="diff-empty">Paste text in Before and After to see the diff.</span>';
    diffStats.textContent = '';
    copyBtn.disabled = true;
    return;
  }

  let added = 0, removed = 0, unchanged = 0;
  let bLine = 0, aLine = 0;
  const html = [];

  for (const { type, value } of edits) {
    if (type === 'equal') {
      bLine++; aLine++; unchanged++;
      html.push(
        `<div class="diff-line diff-line--equal">` +
        `<span class="diff-linenum" aria-hidden="true">${bLine}</span>` +
        `<span class="diff-linenum" aria-hidden="true">${aLine}</span>` +
        `<span class="diff-sign" aria-hidden="true"> </span>` +
        `<span class="diff-content">${esc(value)}</span>` +
        `</div>`
      );
    } else if (type === 'delete') {
      bLine++; removed++;
      html.push(
        `<div class="diff-line diff-line--delete">` +
        `<span class="diff-linenum" aria-hidden="true">${bLine}</span>` +
        `<span class="diff-linenum" aria-hidden="true"></span>` +
        `<span class="diff-sign" aria-label="removed">-</span>` +
        `<span class="diff-content">${esc(value)}</span>` +
        `</div>`
      );
    } else {
      aLine++; added++;
      html.push(
        `<div class="diff-line diff-line--insert">` +
        `<span class="diff-linenum" aria-hidden="true"></span>` +
        `<span class="diff-linenum" aria-hidden="true">${aLine}</span>` +
        `<span class="diff-sign" aria-label="added">+</span>` +
        `<span class="diff-content">${esc(value)}</span>` +
        `</div>`
      );
    }
  }

  diffOutput.innerHTML = html.join('');

  const parts = [];
  if (added)   parts.push(`+${added} added`);
  if (removed) parts.push(`-${removed} removed`);
  parts.push(`${unchanged} unchanged`);
  diffStats.textContent = parts.join(' · ');
  diffStats.className = 'status-bar' + (added || removed ? ' status-bar--ok' : '');
  copyBtn.disabled = false;
}

// ---------------------------------------------------------------------------
// Build unified diff string for clipboard
// ---------------------------------------------------------------------------
function buildUnifiedDiff(edits) {
  const lines = ['--- Before', '+++ After'];
  for (const { type, value } of edits) {
    if (type === 'equal')  lines.push(' ' + value);
    if (type === 'delete') lines.push('-' + value);
    if (type === 'insert') lines.push('+' + value);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Compute diff and render
// ---------------------------------------------------------------------------
function compute() {
  const hasInput = beforeInput.value !== '' || afterInput.value !== '';
  if (!hasInput) {
    renderDiff([], false);
    return;
  }
  const a = beforeInput.value.split('\n');
  const b = afterInput.value.split('\n');
  const edits = myersDiff(a, b);
  renderDiff(edits, true);
}

// ---------------------------------------------------------------------------
// Debounced input handler
// ---------------------------------------------------------------------------
let timer;
function onInput() {
  clearTimeout(timer);
  timer = setTimeout(compute, 150);
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
beforeInput.addEventListener('input', onInput);
afterInput.addEventListener('input', onInput);

swapBtn.addEventListener('click', () => {
  const tmp = beforeInput.value;
  beforeInput.value = afterInput.value;
  afterInput.value = tmp;
  compute();
});

clearBtn.addEventListener('click', () => {
  beforeInput.value = '';
  afterInput.value = '';
  compute();
});

copyBtn.addEventListener('click', () => {
  const a = beforeInput.value.split('\n');
  const b = afterInput.value.split('\n');
  copyText(buildUnifiedDiff(myersDiff(a, b)), copyBtn);
});

// Initial state
compute();
