commit 7c35ec6ea2d4b8d7f2e2a2df89ea850df5e1ee54
Author: Alpha (peer-webapp) <alpha@peer-webapp.dev>
Date:   Sat Mar 7 21:50:28 2026 -0500

    feat(semver): add Semver Version Parser & Comparator tool
    
    Two-section tool: live parser showing major/minor/patch/pre-release/build
    breakdown, plus a comparator (A vs B) following semver spec §11 precedence.
    No dependencies — pure regex + parseInt logic.
    
    Closes #169
    
    Co-Authored-By: Beta (peer-webapp) <beta@peer-webapp.dev>

diff --git a/tools/semver.js b/tools/semver.js
new file mode 100644
index 0000000..fa485b9
--- /dev/null
+++ b/tools/semver.js
@@ -0,0 +1,228 @@
+// Semver Version Parser & Comparator
+// Parses semver strings per spec (https://semver.org) and compares two versions.
+// No external dependencies.
+
+// ── Semver regex (per spec) ────────────────────────────────────────────────
+// Captures: major, minor, patch, prerelease (optional), buildmeta (optional)
+const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
+
+// ── DOM refs ───────────────────────────────────────────────────────────────
+const parseInput   = document.getElementById('semverParseInput');
+const parseClear   = document.getElementById('semverParseClear');
+const parseResult  = document.getElementById('semverParseResult');
+const parseStatus  = document.getElementById('semverParseStatus');
+
+const compareA     = document.getElementById('semverCompareA');
+const compareB     = document.getElementById('semverCompareB');
+const compareBtn   = document.getElementById('semverCompareBtn');
+const compareClear = document.getElementById('semverCompareClear');
+const compareResult = document.getElementById('semverCompareResult');
+const compareStatus = document.getElementById('semverCompareStatus');
+
+// ── Parse ──────────────────────────────────────────────────────────────────
+
+function parseSemver(str) {
+  const trimmed = str.trim();
+  if (!trimmed) return null;
+  const m = SEMVER_RE.exec(trimmed);
+  if (!m) return null;
+  return {
+    raw:       trimmed,
+    major:     parseInt(m[1], 10),
+    minor:     parseInt(m[2], 10),
+    patch:     parseInt(m[3], 10),
+    prerelease: m[4] || '',
+    build:      m[5] || '',
+  };
+}
+
+function setStatus(el, msg, type = '') {
+  el.textContent = msg;
+  el.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
+}
+
+function renderParseResult(parsed) {
+  if (!parsed) {
+    parseResult.hidden = true;
+    return;
+  }
+
+  const rows = [
+    ['Major',          parsed.major,      'The major version — incremented on breaking changes'],
+    ['Minor',          parsed.minor,      'The minor version — incremented on backwards-compatible additions'],
+    ['Patch',          parsed.patch,      'The patch version — incremented on backwards-compatible bug fixes'],
+    ['Pre-release',    parsed.prerelease || '(none)', 'Optional pre-release label, lower precedence than the release'],
+    ['Build metadata', parsed.build       || '(none)', 'Optional build metadata, ignored in version precedence comparisons'],
+  ];
+
+  const tbody = rows.map(([label, value, title]) =>
+    `<tr>
+      <td class="semver-field-label" title="${escHtml(title)}">${escHtml(label)}</td>
+      <td class="semver-field-value ${value === '(none)' ? 'semver-field-value--empty' : ''}">${escHtml(String(value))}</td>
+    </tr>`
+  ).join('');
+
+  parseResult.innerHTML = `
+    <table class="semver-table" aria-label="Parsed semver components">
+      <thead>
+        <tr><th scope="col">Component</th><th scope="col">Value</th></tr>
+      </thead>
+      <tbody>${tbody}</tbody>
+    </table>
+  `;
+  parseResult.hidden = false;
+}
+
+function onParseInput() {
+  const raw = parseInput.value;
+  if (!raw.trim()) {
+    parseResult.hidden = true;
+    setStatus(parseStatus, '');
+    return;
+  }
+  const parsed = parseSemver(raw);
+  if (parsed) {
+    renderParseResult(parsed);
+    setStatus(parseStatus, `Valid semver — ${parsed.raw}`, 'ok');
+  } else {
+    parseResult.hidden = true;
+    setStatus(parseStatus, 'Invalid semver string', 'error');
+  }
+}
+
+// ── Compare ────────────────────────────────────────────────────────────────
+// Comparison follows semver spec §11:
+//   1. Compare major, minor, patch as integers
+//   2. Pre-release has lower precedence than release
+//   3. Pre-release identifiers compared left-to-right:
+//      - numeric vs numeric → compare as integers
+//      - numeric < alphanumeric
+//      - alphanumeric → lexicographic ASCII sort
+//      - more identifiers = higher precedence when all previous equal
+// Build metadata is IGNORED in precedence comparisons.
+
+function comparePrerelease(a, b) {
+  // '' means no prerelease — higher than any prerelease
+  if (a === '' && b === '') return 0;
+  if (a === '') return 1;  // release > prerelease
+  if (b === '') return -1;
+
+  const aIds = a.split('.');
+  const bIds = b.split('.');
+  const len  = Math.max(aIds.length, bIds.length);
+
+  for (let i = 0; i < len; i++) {
+    if (i >= aIds.length) return -1; // a has fewer ids → lower
+    if (i >= bIds.length) return  1; // b has fewer ids → lower
+
+    const aId = aIds[i];
+    const bId = bIds[i];
+    const aNum = /^\d+$/.test(aId);
+    const bNum = /^\d+$/.test(bId);
+
+    if (aNum && bNum) {
+      const diff = parseInt(aId, 10) - parseInt(bId, 10);
+      if (diff !== 0) return diff;
+    } else if (aNum) {
+      return -1; // numeric < alphanumeric
+    } else if (bNum) {
+      return  1;
+    } else {
+      if (aId < bId) return -1;
+      if (aId > bId) return  1;
+    }
+  }
+  return 0;
+}
+
+function compareSemver(a, b) {
+  if (a.major !== b.major) return a.major - b.major;
+  if (a.minor !== b.minor) return a.minor - b.minor;
+  if (a.patch !== b.patch) return a.patch - b.patch;
+  return comparePrerelease(a.prerelease, b.prerelease);
+}
+
+function onCompare() {
+  const rawA = compareA.value.trim();
+  const rawB = compareB.value.trim();
+
+  if (!rawA || !rawB) {
+    setStatus(compareStatus, 'Enter both versions to compare', 'error');
+    compareResult.hidden = true;
+    return;
+  }
+
+  const parsedA = parseSemver(rawA);
+  const parsedB = parseSemver(rawB);
+
+  if (!parsedA) {
+    setStatus(compareStatus, `Version A is not valid semver: "${escHtml(rawA)}"`, 'error');
+    compareResult.hidden = true;
+    return;
+  }
+  if (!parsedB) {
+    setStatus(compareStatus, `Version B is not valid semver: "${escHtml(rawB)}"`, 'error');
+    compareResult.hidden = true;
+    return;
+  }
+
+  const cmp = compareSemver(parsedA, parsedB);
+  let symbol, label, cls;
+  if (cmp > 0) {
+    symbol = '>'; label = 'A is greater than B'; cls = 'semver-cmp--gt';
+  } else if (cmp < 0) {
+    symbol = '<'; label = 'A is less than B'; cls = 'semver-cmp--lt';
+  } else {
+    symbol = '='; label = 'A and B are equal'; cls = 'semver-cmp--eq';
+  }
+
+  const notesBuild = (parsedA.build || parsedB.build)
+    ? '<p class="semver-cmp-note">Build metadata is ignored in semver precedence comparisons.</p>'
+    : '';
+
+  compareResult.innerHTML = `
+    <div class="semver-cmp ${cls}" role="status" aria-label="${escHtml(label)}">
+      <span class="semver-cmp__ver">${escHtml(rawA)}</span>
+      <span class="semver-cmp__op" aria-hidden="true">${symbol}</span>
+      <span class="semver-cmp__ver">${escHtml(rawB)}</span>
+    </div>
+    <p class="semver-cmp-label">${escHtml(label)}</p>
+    ${notesBuild}
+  `;
+  compareResult.hidden = false;
+  setStatus(compareStatus, label, cmp === 0 ? 'ok' : 'ok');
+}
+
+// ── Utils ──────────────────────────────────────────────────────────────────
+
+function escHtml(str) {
+  return String(str)
+    .replace(/&/g, '&amp;')
+    .replace(/</g, '&lt;')
+    .replace(/>/g, '&gt;')
+    .replace(/"/g, '&quot;');
+}
+
+// ── Event listeners ────────────────────────────────────────────────────────
+
+parseInput.addEventListener('input', onParseInput);
+
+parseClear.addEventListener('click', () => {
+  parseInput.value = '';
+  parseResult.hidden = true;
+  setStatus(parseStatus, '');
+  parseInput.focus();
+});
+
+compareBtn.addEventListener('click', onCompare);
+
+compareA.addEventListener('keydown', e => { if (e.key === 'Enter') onCompare(); });
+compareB.addEventListener('keydown', e => { if (e.key === 'Enter') onCompare(); });
+
+compareClear.addEventListener('click', () => {
+  compareA.value = '';
+  compareB.value = '';
+  compareResult.hidden = true;
+  setStatus(compareStatus, '');
+  compareA.focus();
+});
