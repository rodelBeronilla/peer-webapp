// Unicode Character Inspector

import { copyText, escapeHtml } from './utils.js';

const cmInput   = document.getElementById('cmInput');
const cmClear   = document.getElementById('cmClear');
const cmCopy    = document.getElementById('cmCopy');
const cmStatus  = document.getElementById('cmStatus');
const cmTable   = document.getElementById('cmTable');
const cmTbody   = document.getElementById('cmTbody');
const cmEmpty   = document.getElementById('cmEmpty');

const enc = new TextEncoder();

const HTML_NAMED = {
  38: '&amp;',
  60: '&lt;',
  62: '&gt;',
  34: '&quot;',
  39: '&#39;',
};

// Unicode General_Category approximations (rough ranges)
function getCategory(cp) {
  if (cp < 32 || (cp >= 127 && cp <= 159)) return 'control';
  if (cp === 32 || cp === 160 || cp === 8199 || cp === 8239 ||
      (cp >= 8192 && cp <= 8202) || cp === 12288) return 'space';
  if (cp < 127) return 'ascii';
  // Emoji (simplified: Emoticons + Misc Symbols + Supplemental Symbols)
  if ((cp >= 0x1F300 && cp <= 0x1FAFF) ||
      (cp >= 0x2600  && cp <= 0x27BF)  ||
      (cp >= 0xFE00  && cp <= 0xFE0F)) return 'emoji';
  if (cp > 127) return 'unicode';
  return 'ascii';
}

function categoryLabel(cat) {
  const map = {
    control: 'Control',
    space:   'Space',
    ascii:   'ASCII',
    unicode: 'Unicode',
    emoji:   'Emoji',
  };
  return map[cat] || cat;
}

function htmlEntity(cp) {
  if (HTML_NAMED[cp]) return HTML_NAMED[cp];
  if (cp < 128) return '—'; // printable ASCII, no entity needed
  return '&#x' + cp.toString(16).toUpperCase() + ';';
}

function displayChar(char, cat) {
  if (cat === 'control') {
    const cp = char.codePointAt(0);
    // Show standard abbreviations for common control chars
    const abbr = { 0:'NUL',1:'SOH',2:'STX',3:'ETX',4:'EOT',5:'ENQ',6:'ACK',7:'BEL',
                   8:'BS',9:'HT',10:'LF',11:'VT',12:'FF',13:'CR',14:'SO',15:'SI',
                   27:'ESC',127:'DEL' };
    return abbr[cp] || ('[' + cp.toString(16).toUpperCase().padStart(2,'0') + ']');
  }
  if (cat === 'space' && char !== ' ') {
    return '·'; // visible placeholder for non-breaking/zero-width spaces
  }
  return char;
}

function utf8Bytes(char) {
  const bytes = enc.encode(char);
  return Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
}


function render(text) {
  if (!text) {
    cmTbody.innerHTML = '';
    cmEmpty.hidden    = false;
    cmTable.hidden    = true;
    cmStatus.textContent = '';
    cmCopy.disabled   = true;
    return;
  }

  const chars = [...text]; // spread handles surrogate pairs
  let nonAscii = 0;
  let uniqueCps = new Set();

  const rows = chars.map((char, i) => {
    const cp  = char.codePointAt(0);
    const hex = cp.toString(16).toUpperCase().padStart(4, '0');
    const cat = getCategory(cp);
    const disp = displayChar(char, cat);
    const bytes = utf8Bytes(char);
    const entity = htmlEntity(cp);
    if (cp > 127) nonAscii++;
    uniqueCps.add(cp);

    const catClass = 'cm-cat cm-cat--' + cat;
    const rowClass = (cat === 'control' || cat === 'space' && char !== ' ')
      ? 'cm-row cm-row--special' : 'cm-row';

    return `<tr class="${rowClass}" aria-rowindex="${i+2}">
      <td class="cm-cell cm-cell--char"><span class="cm-char${cat==='control'?' cm-char--control':''}" aria-label="character">${escapeHtml(disp)}</span></td>
      <td class="cm-cell cm-cell--cp"><code>U+${hex}</code></td>
      <td class="cm-cell cm-cell--bytes"><code>${escapeHtml(bytes)}</code></td>
      <td class="cm-cell cm-cell--entity"><code>${escapeHtml(entity)}</code></td>
      <td class="cm-cell cm-cell--cat"><span class="${catClass}">${categoryLabel(cat)}</span></td>
    </tr>`;
  });

  cmTbody.innerHTML = rows.join('');
  cmEmpty.hidden  = true;
  cmTable.hidden  = false;
  cmCopy.disabled = false;

  const parts = [
    chars.length + ' char' + (chars.length !== 1 ? 's' : ''),
    uniqueCps.size + ' unique',
  ];
  if (nonAscii) parts.push(nonAscii + ' non-ASCII');
  cmStatus.textContent = parts.join(' · ');
}

cmInput.addEventListener('input', () => render(cmInput.value));

cmClear.addEventListener('click', () => {
  cmInput.value = '';
  render('');
  cmInput.focus();
});

cmCopy.addEventListener('click', () => {
  // Build TSV of the table
  const rows = [...cmTbody.querySelectorAll('tr')];
  const tsv = ['Char\tU+\tUTF-8\tHTML Entity\tCategory']
    .concat(rows.map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      return cells.map(td => td.textContent.trim()).join('\t');
    })).join('\n');
  copyText(tsv, cmCopy);
});
