// Cron Expression Explainer

const cronInput    = document.getElementById('cronInput');
const cronDesc     = document.getElementById('cronDesc');
const cronNextRuns = document.getElementById('cronNextRuns');
const cronCopy     = document.getElementById('cronCopy');
const cronStatus   = document.getElementById('cronStatus');

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const MONTH_ABBR  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DOW_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DOW_ABBR    = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// Parse a single cron field into a sorted array of integer values.
// Supports: *, n, n-m, */n, n-m/n, a,b,c and named aliases.
function parseField(str, min, max, aliases) {
  if (aliases) {
    str = str.toUpperCase();
    aliases.forEach((name, i) => {
      str = str.replace(new RegExp('\\b' + name + '\\b', 'g'), String(min + i));
    });
  }

  const values = new Set();

  for (const part of str.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    if (part.includes('/')) {
      const [rangeStr, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step < 1) throw new Error(`Invalid step in "${part}"`);
      let lo = min, hi = max;
      if (rangeStr !== '*') {
        if (rangeStr.includes('-')) {
          [lo, hi] = rangeStr.split('-').map(Number);
        } else {
          lo = parseInt(rangeStr, 10);
        }
        if (isNaN(lo) || isNaN(hi)) throw new Error(`Invalid range in "${part}"`);
      }
      for (let i = lo; i <= hi; i += step) values.add(i);
      continue;
    }

    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (isNaN(a) || isNaN(b)) throw new Error(`Invalid range "${part}"`);
      for (let i = a; i <= b; i++) values.add(i);
      continue;
    }

    const n = parseInt(part, 10);
    if (isNaN(n)) throw new Error(`Invalid value "${part}"`);
    values.add(n);
  }

  for (const v of values) {
    if (v < min || v > max) throw new Error(`Value ${v} out of range ${min}–${max}`);
  }

  return [...values].sort((a, b) => a - b);
}

function ordinal(n) {
  const v = n % 100;
  const s = ['th','st','nd','rd'];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtTime(h, m) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

// Detect if a list is a uniform step sequence starting at min
function detectStep(vals, min) {
  if (vals.length < 2) return null;
  const step = vals[1] - vals[0];
  if (step < 1) return null;
  if (vals[0] !== min) return null; // only report step if it starts at field min
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] - vals[i - 1] !== step) return null;
  }
  return step;
}

// Detect if values form a consecutive run
function isRange(vals) {
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] - vals[i - 1] !== 1) return false;
  }
  return true;
}

function describeMinute(vals) {
  if (vals.length === 60) return null; // wildcard — handled at time-phrase level
  if (vals.length === 1 && vals[0] === 0) return 'on the hour';
  if (vals.length === 1) return `at minute ${vals[0]}`;
  const step = detectStep(vals, 0);
  if (step) return `every ${step} minute${step > 1 ? 's' : ''}`;
  return `at minutes ${vals.join(', ')}`;
}

function describeHour(vals) {
  if (vals.length === 24) return null; // wildcard
  if (vals.length === 1) return null;  // handled at time-phrase level with minute
  const step = detectStep(vals, 0);
  if (step) return `every ${step} hour${step > 1 ? 's' : ''}`;
  return `at ${vals.map(h => fmtTime(h, 0)).join(' and ')}`;
}

function describeDom(vals) {
  if (vals.length === 31) return null;
  if (vals.length === 1) return `on the ${ordinal(vals[0])}`;
  if (isRange(vals)) return `from the ${ordinal(vals[0])} to the ${ordinal(vals[vals.length - 1])}`;
  const step = detectStep(vals, 1);
  if (step) return `every ${step} day${step > 1 ? 's' : ''}`;
  return `on the ${vals.map(ordinal).join(', ')}`;
}

function describeMonth(vals) {
  if (vals.length === 12) return null;
  if (vals.length === 1) return `in ${MONTH_NAMES[vals[0] - 1]}`;
  if (isRange(vals)) return `from ${MONTH_NAMES[vals[0] - 1]} to ${MONTH_NAMES[vals[vals.length - 1] - 1]}`;
  const step = detectStep(vals, 1);
  if (step) return `every ${step} month${step > 1 ? 's' : ''}`;
  return `in ${vals.map(v => MONTH_NAMES[v - 1]).join(', ')}`;
}

function describeDow(vals) {
  // Normalize: 7 → 0 (both mean Sunday)
  const normalized = [...new Set(vals.map(v => v % 7))].sort((a, b) => a - b);
  if (normalized.length === 7) return null;
  if (normalized.length === 1) return `on ${DOW_NAMES[normalized[0]]}`;
  if (isRange(normalized)) {
    return `${DOW_NAMES[normalized[0]]} through ${DOW_NAMES[normalized[normalized.length - 1]]}`;
  }
  return `on ${normalized.map(v => DOW_NAMES[v]).join(', ')}`;
}

function buildDescription(raw, parsed) {
  const [mins, hours, doms, months, dows] = parsed;
  const allMin   = mins.length   === 60;
  const allHour  = hours.length  === 24;
  const allDom   = doms.length   === 31;
  const allMonth = months.length === 12;
  const allDow   = dows.length   >= 7;

  // Time phrase
  let time = '';
  if (allMin && allHour) {
    time = 'Every minute';
  } else if (allMin && !allHour) {
    const hDesc = describeHour(hours) || (hours.length === 1 ? `at ${fmtTime(hours[0], 0)}` : '');
    time = `${hDesc}, every minute`;
  } else if (!allMin && allHour) {
    const mDesc = describeMinute(mins) || '';
    time = mDesc ? `Every hour, ${mDesc}` : 'Every hour';
  } else {
    // Both specific
    if (mins.length === 1 && hours.length === 1) {
      time = `At ${fmtTime(hours[0], mins[0])}`;
    } else if (hours.length === 1) {
      const mDesc = describeMinute(mins) || '';
      time = mDesc ? `At ${fmtTime(hours[0], 0)}, ${mDesc}` : `At ${fmtTime(hours[0], 0)}`;
    } else {
      const hDesc = describeHour(hours) || '';
      const mDesc = describeMinute(mins) || '';
      time = [hDesc, mDesc].filter(Boolean).join(', ') || 'At scheduled time';
    }
  }

  // Schedule phrase (dom + dow + month)
  const domPart   = allDom   ? null : describeDom(doms);
  const monthPart = allMonth ? null : describeMonth(months);
  const dowPart   = allDow   ? null : describeDow(dows);

  const scheduleParts = [dowPart, domPart, monthPart].filter(Boolean);

  if (scheduleParts.length === 0) return time;
  return `${time}, ${scheduleParts.join(', ')}`;
}

// Brute-force: find next N run times by advancing minute-by-minute
function nextRuns(parsed, count = 5) {
  const [mins, hours, doms, months, dows] = parsed;
  const minSet   = new Set(mins);
  const hourSet  = new Set(hours);
  const domSet   = new Set(doms);
  const monthSet = new Set(months);
  const dowSet   = new Set(dows.map(d => d % 7));

  const results = [];
  const cursor  = new Date();
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1); // start from next minute

  const MAX = 2 * 366 * 24 * 60; // ~2 years of minutes

  for (let i = 0; i < MAX && results.length < count; i++) {
    if (
      monthSet.has(cursor.getMonth() + 1) &&
      domSet.has(cursor.getDate()) &&
      dowSet.has(cursor.getDay()) &&
      hourSet.has(cursor.getHours()) &&
      minSet.has(cursor.getMinutes())
    ) {
      results.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return results;
}

function fmtRelative(date) {
  const diffMs = date - Date.now();
  const diffM  = Math.floor(diffMs / 60000);
  const diffH  = Math.floor(diffM / 60);
  const diffD  = Math.floor(diffH / 24);
  if (diffD  > 0) return `in ${diffD}d ${diffH % 24}h`;
  if (diffH  > 0) return `in ${diffH}h ${diffM % 60}m`;
  return `in ${diffM}m`;
}

function setStatus(msg, type) {
  cronStatus.textContent = msg;
  cronStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function runCron() {
  const expr = cronInput.value.trim();

  if (!expr) {
    cronDesc.textContent = 'Enter a cron expression above — e.g. 0 9 * * 1-5';
    cronDesc.className = 'cron-desc';
    cronNextRuns.innerHTML = '';
    cronCopy.disabled = true;
    setStatus('', '');
    return;
  }

  const parts = expr.split(/\s+/);
  if (parts.length !== 5) {
    cronDesc.textContent = `Expected 5 fields (min hour dom month dow), got ${parts.length}`;
    cronDesc.className = 'cron-desc cron-desc--error';
    cronNextRuns.innerHTML = '';
    cronCopy.disabled = true;
    setStatus('Invalid expression', 'error');
    return;
  }

  let parsed;
  try {
    parsed = [
      parseField(parts[0], 0, 59, null),
      parseField(parts[1], 0, 23, null),
      parseField(parts[2], 1, 31, null),
      parseField(parts[3], 1, 12, MONTH_ABBR),
      parseField(parts[4], 0,  7, DOW_ABBR),
    ];
  } catch (err) {
    cronDesc.textContent = err.message;
    cronDesc.className = 'cron-desc cron-desc--error';
    cronNextRuns.innerHTML = '';
    cronCopy.disabled = true;
    setStatus('Parse error', 'error');
    return;
  }

  const description = buildDescription(parts, parsed);
  cronDesc.textContent = description;
  cronDesc.className = 'cron-desc cron-desc--ok';
  cronCopy.disabled = false;
  setStatus(parts.join('  ·  '), 'ok');

  const runs = nextRuns(parsed);
  if (runs.length === 0) {
    cronNextRuns.innerHTML = '<li class="cron-run cron-run--empty">No runs found within the next 2 years</li>';
  } else {
    cronNextRuns.innerHTML = runs
      .map(r => `<li class="cron-run">${r.toLocaleString()} <span class="cron-rel">${fmtRelative(r)}</span></li>`)
      .join('');
  }
}

let debounce;
function schedule() {
  clearTimeout(debounce);
  debounce = setTimeout(runCron, 250);
}

cronInput.addEventListener('input', schedule);

cronCopy.addEventListener('click', () => {
  const text = cronDesc.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    cronCopy.textContent = 'Copied!';
    setTimeout(() => { cronCopy.textContent = 'Copy'; }, 1500);
  });
});

// Preset buttons
document.querySelectorAll('[data-cron]').forEach(btn => {
  btn.addEventListener('click', () => {
    cronInput.value = btn.dataset.cron;
    runCron();
  });
});

// Initial render
runCron();
