// Regex Tester

import { escapeHtml } from './utils.js';

const regexPattern         = document.getElementById('regexPattern');
const regexFlags           = document.getElementById('regexFlags');
const regexText            = document.getElementById('regexText');
const regexStatus          = document.getElementById('regexStatus');
const regexMatchCount      = document.getElementById('regexMatchCount');
const matchListBody        = document.getElementById('matchListBody');
const regexReplaceTemplate = document.getElementById('regexReplaceTemplate');
const regexReplaceOutput   = document.getElementById('regexReplaceOutput');
const regexReplaceCopy     = document.getElementById('regexReplaceCopy');

function setRegexStatus(msg, type = '') {
  regexStatus.textContent = msg;
  regexStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function clearReplace() {
  regexReplaceOutput.value = '';
  regexReplaceCopy.disabled = true;
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
    clearReplace();
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
    clearReplace();
    return;
  }

  if (!text) {
    regexMatchCount.textContent = '';
    matchListBody.innerHTML = '<p class="match-empty">Enter a test string above.</p>';
    regexText.classList.remove('has-matches', 'no-matches');
    clearReplace();
    return;
  }

  // Replace mode — runs regardless of match count
  // Use user's exact flags (without forced 'g') so g/no-g replaces all/first
  const replaceRx = new RegExp(pattern, flags);
  regexReplaceOutput.value = text.replace(replaceRx, regexReplaceTemplate.value);
  regexReplaceCopy.disabled = false;

  const matches = [...text.matchAll(rx)];

  if (matches.length === 0) {
    regexMatchCount.textContent = 'No matches';
    matchListBody.innerHTML = '<p class="match-empty">No matches found.</p>';
    regexText.classList.remove('has-matches');
    regexText.classList.add('no-matches');
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
}

let regexDebounce;
function scheduleRegex() {
  clearTimeout(regexDebounce);
  regexDebounce = setTimeout(runRegex, 200);
}

regexPattern.addEventListener('input', scheduleRegex);
regexFlags.addEventListener('input', scheduleRegex);
regexText.addEventListener('input', scheduleRegex);
regexReplaceTemplate.addEventListener('input', scheduleRegex);

regexReplaceCopy.addEventListener('click', () => {
  if (!regexReplaceOutput.value) return;
  navigator.clipboard.writeText(regexReplaceOutput.value).then(() => {
    regexReplaceCopy.textContent = 'Copied!';
    setTimeout(() => { regexReplaceCopy.textContent = 'Copy'; }, 1500);
  });
});
