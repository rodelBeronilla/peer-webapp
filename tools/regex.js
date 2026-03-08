// Regex Tester

import { escapeHtml } from './utils.js';

const regexPattern    = document.getElementById('regexPattern');
const regexFlags      = document.getElementById('regexFlags');
const regexText       = document.getElementById('regexText');
const regexStatus     = document.getElementById('regexStatus');
const regexMatchCount = document.getElementById('regexMatchCount');
const matchListBody   = document.getElementById('matchListBody');
const regexHighlight  = document.getElementById('regexHighlight');
const regexHighlightPane = document.getElementById('regexHighlightPane');

function setRegexStatus(msg, type = '') {
  regexStatus.textContent = msg;
  regexStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function clearHighlight() {
  regexHighlight.innerHTML = '';
  regexHighlightPane.hidden = true;
}

function buildHighlight(text, matches) {
  let html = '';
  let cursor = 0;
  matches.forEach((m, i) => {
    const start = m.index;
    const end   = start + m[0].length;
    // Append unmatched text before this match
    if (start > cursor) {
      html += escapeHtml(text.slice(cursor, start));
    }
    // Skip zero-length matches (e.g. /a*/g on non-a chars) to avoid empty marks
    if (m[0].length > 0) {
      html += `<mark class="hl-${i % 4}">${escapeHtml(m[0])}</mark>`;
    }
    cursor = Math.max(cursor, end);
  });
  html += escapeHtml(text.slice(cursor));
  return html;
}

function runRegex() {
  const pattern = regexPattern.value;
  const flags   = regexFlags.value.replace(/[^gimsuy]/g, '');
  const text    = regexText.value;

  if (!pattern) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = '<p class="match-empty">Enter a pattern and test string to see matches.</p>';
    setRegexStatus('');
    regexText.classList.remove('has-matches', 'no-matches');
    clearHighlight();
    return;
  }

  let rx;
  try {
    rx = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    setRegexStatus(`/${pattern}/${flags}`, 'ok');
  } catch (err) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = `<p class="match-empty match-empty--error">${escapeHtml(String(err))}</p>`;
    setRegexStatus(String(err), 'error');
    regexText.classList.remove('has-matches', 'no-matches');
    clearHighlight();
    return;
  }

  if (!text) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = '<p class="match-empty">Enter a test string above.</p>';
    regexText.classList.remove('has-matches', 'no-matches');
    clearHighlight();
    return;
  }

  const matches = [...text.matchAll(rx)];

  if (matches.length === 0) {
    regexMatchCount.textContent = 'No matches';
    matchListBody.innerHTML = '<p class="match-empty">No matches found.</p>';
    regexText.classList.remove('has-matches');
    regexText.classList.add('no-matches');
    clearHighlight();
    return;
  }

  regexText.classList.add('has-matches');
  regexText.classList.remove('no-matches');
  regexMatchCount.textContent = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;

  // Build match list
  const frag = document.createDocumentFragment();
  matches.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'match-item';

    const idx = document.createElement('span');
    idx.className = 'match-idx';
    idx.textContent = `#${i + 1}`;

    const val = document.createElement('code');
    val.className = 'match-val';
    val.textContent = m[0];

    const pos = document.createElement('span');
    pos.className = 'match-pos';
    pos.textContent = `index ${m.index}`;

    item.appendChild(idx);
    item.appendChild(val);
    item.appendChild(pos);

    // Groups
    if (m.length > 1) {
      m.slice(1).forEach((g, gi) => {
        const grp = document.createElement('div');
        grp.className = 'match-group';
        grp.textContent = `Group ${gi + 1}: ${g === undefined ? '(unmatched)' : g}`;
        item.appendChild(grp);
      });
    }

    frag.appendChild(item);
  });

  matchListBody.innerHTML = '';
  matchListBody.appendChild(frag);

  // Inline highlight
  regexHighlight.innerHTML = buildHighlight(text, matches);
  regexHighlightPane.hidden = false;
}

let regexDebounce;
function scheduleRegex() {
  clearTimeout(regexDebounce);
  regexDebounce = setTimeout(runRegex, 200);
}

regexPattern.addEventListener('input', scheduleRegex);
regexFlags.addEventListener('input', scheduleRegex);
regexText.addEventListener('input', scheduleRegex);
