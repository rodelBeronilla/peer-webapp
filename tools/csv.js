// CSV ↔ JSON Converter
// RFC 4180 CSV parser + JSON array-of-objects serializer.
// No external libraries.

import { copyText } from './utils.js';

const csvInput  = document.getElementById('csvInput');
const csvOutput = document.getElementById('csvOutput');
const csvStatus = document.getElementById('csvStatus');
const csvCopy   = document.getElementById('csvCopy');
const csvClear  = document.getElementById('csvClear');
const csvSwap   = document.getElementById('csvSwap');
const csvToJson = document.getElementById('csvToJson');
const csvToCSV  = document.getElementById('csvFromJson');

function setStatus(msg, type = '') {
  csvStatus.textContent = msg;
  csvStatus.className = 'status-bar' + (type ? ` status-bar--${type}` : '');
}

// ---------------------------------------------------------------------------
// RFC 4180 CSV parser
// Returns: { headers: string[], rows: string[][] }
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    // Skip Windows CRLF or Unix LF at row boundary (empty row = skip)
    const row = [];
    while (i < n) {
      // Each field
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < n) {
          if (text[i] === '"') {
            if (i + 1 < n && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i++];
          }
        }
        row.push(field);
      } else {
        // Unquoted field — collect until comma or newline
        let start = i;
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') i++;
        row.push(text.slice(start, i));
      }

      // After field: comma → next field, newline/end → next row
      if (i < n && text[i] === ',') {
        i++;
      } else {
        break;
      }
    }

    // Consume line ending
    if (i < n && text[i] === '\r') i++;
    if (i < n && text[i] === '\n') i++;

    rows.push(row);
  }

  // Drop trailing blank row (common from trailing newline)
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  return { headers, rows: rows.slice(1) };
}

// ---------------------------------------------------------------------------
// CSV → JSON
// ---------------------------------------------------------------------------
function csvToJSON() {
  const raw = csvInput.value;
  if (!raw.trim()) { setStatus('Paste CSV in the input.', 'error'); return; }

  let parsed;
  try {
    parsed = parseCSV(raw);
  } catch (e) {
    setStatus('Parse error: ' + e.message, 'error');
    return;
  }

  const { headers, rows } = parsed;
  if (headers.length === 0) { setStatus('No data found.', 'error'); return; }

  const objects = rows.map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    return obj;
  });

  const json = JSON.stringify(objects, null, 2);
  csvOutput.value = json;
  csvCopy.disabled = false;
  setStatus(`${rows.length} row${rows.length !== 1 ? 's' : ''}, ${headers.length} field${headers.length !== 1 ? 's' : ''}`, 'ok');
}

// ---------------------------------------------------------------------------
// JSON → CSV
// ---------------------------------------------------------------------------
function jsonToCSV() {
  const raw = csvInput.value.trim();
  if (!raw) { setStatus('Paste JSON in the input.', 'error'); return; }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    setStatus('Invalid JSON: ' + e.message, 'error');
    return;
  }

  if (!Array.isArray(data)) {
    setStatus('JSON must be an array of objects.', 'error');
    return;
  }
  if (data.length === 0) {
    csvOutput.value = '';
    setStatus('Empty array — nothing to convert.', 'error');
    return;
  }

  // Collect all keys across all objects (preserving first-seen order)
  const keySet = new Set();
  data.forEach(row => {
    if (row && typeof row === 'object') Object.keys(row).forEach(k => keySet.add(k));
  });
  const headers = [...keySet];

  function escField(val) {
    const s = val === null || val === undefined
      ? ''
      : typeof val === 'object'
        ? JSON.stringify(val)
        : String(val);
    // Quote if contains comma, double-quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const lines = [headers.map(escField).join(',')];
  data.forEach(row => {
    if (!row || typeof row !== 'object') {
      lines.push(headers.map(() => '').join(','));
      return;
    }
    lines.push(headers.map(h => escField(row[h])).join(','));
  });

  const csv = lines.join('\r\n');
  csvOutput.value = csv;
  csvCopy.disabled = false;
  setStatus(`${data.length} row${data.length !== 1 ? 's' : ''}, ${headers.length} field${headers.length !== 1 ? 's' : ''}`, 'ok');
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
csvToJson.addEventListener('click', csvToJSON);
csvToCSV.addEventListener('click', jsonToCSV);

csvCopy.addEventListener('click', () => copyText(csvOutput.value, csvCopy));

csvClear.addEventListener('click', () => {
  csvInput.value = '';
  csvOutput.value = '';
  csvCopy.disabled = true;
  setStatus('');
  csvInput.focus();
});

csvSwap.addEventListener('click', () => {
  const tmp = csvInput.value;
  csvInput.value = csvOutput.value;
  csvOutput.value = tmp;
  csvCopy.disabled = !csvOutput.value;
  setStatus('Swapped.');
});
