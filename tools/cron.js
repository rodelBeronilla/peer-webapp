// tools/cron.js — Cron Expression Parser & Next-Run Calculator

import { copyText } from './utils.js';

const cronInput   = document.getElementById('cronInput');
const cronCopy    = document.getElementById('cronCopy');
const cronClear   = document.getElementById('cronClear');
const cronStatus  = document.getElementById('cronStatus');
const cronDesc    = document.getElementById('cronDesc');
const cronRuns    = document.getElementById('cronRuns');
const cronRunList = document.getElementById('cronRunList');

// ── Named aliases ─────────────────────────────────────────────────────────────

const ALIASES = {
  '@yearly':   '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly':  '0 0 1 * *',
  '@weekly':   '0 0 * * 0',
  '@daily':    '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly':   '0 * * * *',
};

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const DAY_NAMES   = ['sun','mon','tue','wed','thu','fri','sat'];


// ── Parser ────────────────────────────────────────────────────────────────────

function parseField(token, min, max, names) {
  // Returns a sorted array of matching integers, or throws a descriptive error.
  if (token === '*') {
    return range(min, max);
  }

  const values = new Set();

  for (const part of token.split(',')) {
    // step: */n or a-b/n
    const slashIdx = part.indexOf('/');
    let base = part;
    let step = 1;

    if (slashIdx !== -1) {
      const stepStr = part.slice(slashIdx + 1);
      step = parseInt(stepStr, 10);
      if (isNaN(step) || step < 1) throw new Error(`Invalid step value: "${stepStr}"`);
      base = part.slice(0, slashIdx);
    }

    let lo, hi;

    if (base === '*') {
      lo = min; hi = max;
    } else if (base.includes('-')) {
      const [aStr, bStr] = base.split('-');
      lo = resolveValue(aStr, names, min, max);
      hi = resolveValue(bStr, names, min, max);
      if (lo > hi) throw new Error(`Invalid range: "${base}" (start > end)`);
    } else {
      const v = resolveValue(base, names, min, max);
      lo = hi = v;
    }

    for (let v = lo; v <= hi; v += step) {
      values.add(v);
    }
  }

  const result = [...values].sort((a, b) => a - b);
  for (const v of result) {
    if (v < min || v > max) throw new Error(`Value ${v} out of range [${min}–${max}]`);
  }
  return result;
}

function resolveValue(str, names, min, _max) {
  if (names) {
    const idx = names.indexOf(str.toLowerCase());
    if (idx !== -1) return idx + (min === 1 ? 1 : 0);
  }
  const n = parseInt(str, 10);
  if (isNaN(n)) throw new Error(`Unrecognised value: "${str}"`);
  return n;
}

function range(lo, hi) {
  const r = [];
  for (let i = lo; i <= hi; i++) r.push(i);
  return r;
}

function parseCron(expr) {
  const trimmed = expr.trim();

  // Alias expansion
  if (ALIASES[trimmed.toLowerCase()]) {
    return parseCron(ALIASES[trimmed.toLowerCase()]);
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Expected 5 fields (minute hour day month weekday), got ${parts.length}`);
  }

  const [minTok, hrTok, domTok, monTok, dowTok] = parts;

  const minutes  = parseField(minTok, 0, 59, null);
  const hours    = parseField(hrTok,  0, 23, null);
  const doms     = parseField(domTok, 1, 31, null);
  const months   = parseField(monTok, 1, 12, MONTH_NAMES);
  let   dows     = parseField(dowTok, 0,  7, DAY_NAMES);

  // Normalize: 7 → 0 (Sunday)
  dows = [...new Set(dows.map(d => d === 7 ? 0 : d))].sort((a, b) => a - b);

  // When both DOM and DOW are unrestricted (*), standard cron uses AND.
  // When one is restricted, cron uses OR between them.
  const domRestricted = domTok !== '*';
  const dowRestricted = dowTok !== '*';

  return { minutes, hours, doms, months, dows, domRestricted, dowRestricted };
}

// ── Next-run calculator ───────────────────────────────────────────────────────

function nextRuns(parsed, count = 10) {
  const { minutes, hours, doms, months, dows, domRestricted, dowRestricted } = parsed;

  const results = [];
  // Start from next minute
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  let d = new Date(start);
  const maxIterations = 366 * 24 * 60 * 4; // ~4 years of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;

    const month = d.getMonth() + 1; // 1-based
    const dom   = d.getDate();
    const dow   = d.getDay();       // 0 = Sunday
    const hour  = d.getHours();
    const min   = d.getMinutes();

    if (!months.includes(month)) {
      // Jump to next valid month
      const nextMonth = months.find(m => m > month) ?? months[0];
      if (nextMonth > month) {
        d.setMonth(nextMonth - 1, 1);
        d.setHours(0, 0, 0, 0);
      } else {
        // Wrap to next year
        d.setFullYear(d.getFullYear() + 1, months[0] - 1, 1);
        d.setHours(0, 0, 0, 0);
      }
      continue;
    }

    // Day matching: OR logic when both restricted, AND when neither restricted
    const domMatch = doms.includes(dom);
    const dowMatch = dows.includes(dow);
    let dayMatch;
    if (domRestricted && dowRestricted) {
      dayMatch = domMatch || dowMatch;
    } else {
      dayMatch = domMatch && dowMatch;
    }

    if (!dayMatch) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }

    if (!hours.includes(hour)) {
      const nextHour = hours.find(h => h > hour);
      if (nextHour !== undefined) {
        d.setHours(nextHour, 0, 0, 0);
      } else {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
      }
      continue;
    }

    if (!minutes.includes(min)) {
      const nextMin = minutes.find(m => m > min);
      if (nextMin !== undefined) {
        d.setMinutes(nextMin, 0, 0);
      } else {
        const nextHour = hours.find(h => h > hour);
        if (nextHour !== undefined) {
          d.setHours(nextHour, 0, 0, 0);
        } else {
          d.setDate(d.getDate() + 1);
          d.setHours(0, 0, 0, 0);
        }
      }
      continue;
    }

    results.push(new Date(d));
    d.setMinutes(d.getMinutes() + 1, 0, 0);
  }

  return results;
}

// ── Human-readable description ────────────────────────────────────────────────

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
  '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
  '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st'];

const MONTH_FULL  = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function describeList(vals, total, formatter) {
  if (vals.length === total) return 'every ' + (formatter ? formatter(-1) : 'value');
  if (vals.length === 1) return formatter ? formatter(vals[0]) : String(vals[0]);
  const last = vals[vals.length - 1];
  const rest = vals.slice(0, -1);
  const parts = rest.map(v => formatter ? formatter(v) : String(v));
  return parts.join(', ') + ' and ' + (formatter ? formatter(last) : String(last));
}

function fmtMin(v)   { return v === -1 ? 'minute' : String(v).padStart(2, '0'); }
function fmtHour(v)  {
  if (v === -1) return 'hour';
  const ampm = v < 12 ? 'AM' : 'PM';
  const h = v % 12 || 12;
  return `${h} ${ampm}`;
}
function fmtMonth(v) { return v === -1 ? 'month' : MONTH_FULL[v - 1]; }
function fmtDow(v)   { return v === -1 ? 'day of the week' : DOW_FULL[v]; }
function fmtDom(v)   { return v === -1 ? 'day' : ORDINALS[v]; }

function describeExpression(expr, parsed) {
  const { minutes, hours, doms, months, dows, domRestricted, dowRestricted } = parsed;

  // Check for alias match
  for (const [alias, expanded] of Object.entries(ALIASES)) {
    if (expanded === expr.trim().split(/\s+/).slice(0,5).join(' ')) {
      const descriptions = {
        '@yearly':   'Runs once a year, at midnight on January 1st.',
        '@monthly':  'Runs once a month, at midnight on the 1st.',
        '@weekly':   'Runs once a week, at midnight on Sunday.',
        '@daily':    'Runs once a day, at midnight.',
        '@hourly':   'Runs once an hour, at the start of the hour.',
      };
      if (descriptions[alias]) return descriptions[alias];
    }
  }

  const minuteDesc = describeList(minutes, 60, fmtMin);
  const hourDesc   = describeList(hours,   24, fmtHour);

  let timeStr;
  if (minutes.length === 60 && hours.length === 24) {
    timeStr = 'every minute';
  } else if (minutes.length === 60) {
    timeStr = `every minute during ${hourDesc}`;
  } else if (hours.length === 24) {
    timeStr = `at minute ${minuteDesc} of every hour`;
  } else {
    // Build concise HH:MM format when possible
    if (minutes.length === 1 && hours.length === 1) {
      const h = hours[0];
      const m = String(minutes[0]).padStart(2, '0');
      const ampm = h < 12 ? 'AM' : 'PM';
      const hh = h % 12 || 12;
      timeStr = `at ${hh}:${m} ${ampm}`;
    } else {
      timeStr = `at minute ${minuteDesc} past ${hourDesc}`;
    }
  }

  let dayStr;
  if (!domRestricted && !dowRestricted) {
    dayStr = 'every day';
  } else if (domRestricted && !dowRestricted) {
    dayStr = `on the ${describeList(doms, 31, fmtDom)} of the month`;
  } else if (!domRestricted && dowRestricted) {
    dayStr = `on ${describeList(dows, 7, fmtDow)}`;
  } else {
    dayStr = `on the ${describeList(doms, 31, fmtDom)} of the month or on ${describeList(dows, 7, fmtDow)}`;
  }

  const monthStr = months.length === 12 ? '' : ` in ${describeList(months, 12, fmtMonth)}`;

  return `Runs ${timeStr}, ${dayStr}${monthStr}.`;
}

// ── Field descriptions for detail panel ───────────────────────────────────────

function fieldSummary(vals, total, label) {
  if (vals.length === total) return `${label}: every`;
  if (vals.length <= 6) return `${label}: ${vals.join(', ')}`;
  return `${label}: ${vals.slice(0, 5).join(', ')} … (+${vals.length - 5} more)`;
}

// ── Format date for display ───────────────────────────────────────────────────

function fmtDate(d) {
  return d.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Update UI ─────────────────────────────────────────────────────────────────

function setStatus(msg, type = '') {
  cronStatus.textContent = msg;
  cronStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

function evaluate() {
  const raw = cronInput.value.trim();

  if (!raw) {
    cronDesc.hidden = true;
    cronRuns.hidden = true;
    setStatus('');
    cronCopy.disabled = true;
    return;
  }

  let parsed;
  try {
    parsed = parseCron(raw);
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
    cronDesc.hidden = true;
    cronRuns.hidden = true;
    cronCopy.disabled = true;
    return;
  }

  // Expand aliases for description
  const expanded = ALIASES[raw.toLowerCase()] ?? raw;

  const description = describeExpression(expanded, parsed);
  document.getElementById('cronDescText').textContent = description;

  const { minutes, hours, doms, months, dows } = parsed;
  document.getElementById('cronFieldMin').textContent   = fieldSummary(minutes, 60, 'Minute');
  document.getElementById('cronFieldHour').textContent  = fieldSummary(hours,   24, 'Hour');
  document.getElementById('cronFieldDom').textContent   = fieldSummary(doms,    31, 'Day of month');
  document.getElementById('cronFieldMon').textContent   = fieldSummary(months,  12, 'Month');
  document.getElementById('cronFieldDow').textContent   = fieldSummary(dows,     7, 'Day of week');

  cronDesc.hidden = false;

  const runs = nextRuns(parsed, 10);
  cronRunList.innerHTML = '';
  for (const run of runs) {
    const li = document.createElement('li');
    li.className = 'cron-run-item';
    li.textContent = fmtDate(run);
    cronRunList.appendChild(li);
  }
  cronRuns.hidden = runs.length === 0;

  setStatus('Valid expression', 'ok');
  cronCopy.disabled = false;
}

// ── Events ────────────────────────────────────────────────────────────────────

cronInput.addEventListener('input', evaluate);

cronCopy.addEventListener('click', () => {
  if (cronInput.value.trim()) copyText(cronInput.value.trim(), cronCopy);
});

cronClear.addEventListener('click', () => {
  cronInput.value = '';
  cronDesc.hidden = true;
  cronRuns.hidden = true;
  setStatus('');
  cronCopy.disabled = true;
  cronInput.focus();
});

// Example presets
document.querySelectorAll('.cron-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    cronInput.value = btn.dataset.expr;
    evaluate();
    cronInput.focus();
  });
});
