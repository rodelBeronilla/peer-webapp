// Markdown Previewer
// Renders a subset of CommonMark: headings, bold, italic, code, lists,
// blockquotes, links, images, horizontal rules. Zero external dependencies.

const mdInput   = document.getElementById('mdInput');
const mdPreview = document.getElementById('mdPreview');
const mdCopyBtn = document.getElementById('mdCopyHtml');
const mdStatus  = document.getElementById('mdStatus');

// ---------------------------------------------------------------------------
// HTML escaper — applied to raw text before inline pattern matching
// ---------------------------------------------------------------------------
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// URL sanitizer — blocks javascript:, data:, vbscript: and other dangerous
// schemes. Allows http://, https://, mailto:, and relative URLs.
// ---------------------------------------------------------------------------
function safeUrl(url) {
  // Strip leading whitespace (browsers do this before interpreting the scheme)
  const trimmed = url.trimStart();
  // Block protocol-relative URLs (//evil.com) — browsers resolve these as
  // https://evil.com in an HTTPS context, creating an open-redirect vector.
  if (trimmed.startsWith('//')) return '#';
  if (/^[a-z][a-z0-9+\-.]*:/i.test(trimmed) && !/^https?:/i.test(trimmed) && !/^mailto:/i.test(trimmed)) {
    return '#';
  }
  return url;
}

// ---------------------------------------------------------------------------
// Inline parser — bold, italic, code spans, links, images
// Processes code spans first (with placeholders) to protect their content.
// ---------------------------------------------------------------------------
function inline(raw) {
  const spans = [];
  // Extract inline code spans before HTML escaping
  let s = raw.replace(/`([^`]+)`/g, (_, code) => {
    spans.push(`<code>${esc(code)}</code>`);
    return `\x00${spans.length - 1}\x00`;
  });

  // HTML-escape remaining text
  s = esc(s);

  // Images (must come before links — same syntax with leading !)
  s = s.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, alt, src) =>
    `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy">`);

  // Links — open in same tab for relative, new tab for absolute
  s = s.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, text, href) => {
    const safe = safeUrl(href);
    const rel = /^https?:\/\//i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safe}"${rel}>${text}</a>`;
  });

  // Bold (**text** or __text__)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // Restore code spans — \x00 is used intentionally as a placeholder sentinel
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => spans[+i]);

  return s;
}

// ---------------------------------------------------------------------------
// Block parser — processes lines top-to-bottom
// ---------------------------------------------------------------------------
function parse(md) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line — skip
    if (line.trim() === '') { i++; continue; }

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = esc(line.slice(3).trim());
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      const cls = lang ? ` class="language-${lang}"` : '';
      html += `<pre><code${cls}>${esc(code.join('\n'))}</code></pre>\n`;
      continue;
    }

    // Horizontal rule (---, ***, ___ with optional spaces)
    if (/^[ ]{0,3}(\*[ ]{0,1}){3,}$|^[ ]{0,3}(-[ ]{0,1}){3,}$|^[ ]{0,3}(_[ ]{0,1}){3,}$/.test(line)) {
      html += '<hr>\n';
      i++;
      continue;
    }

    // ATX heading
    const hm = line.match(/^(#{1,6})[ \t]+(.+?)[ \t]*#*$/);
    if (hm) {
      const lvl = hm[1].length;
      html += `<h${lvl}>${inline(hm[2])}</h${lvl}>\n`;
      i++;
      continue;
    }

    // Blockquote — collect consecutive > lines and recurse
    if (/^[ ]{0,3}>/.test(line)) {
      const bq = [];
      while (i < lines.length && /^[ ]{0,3}>/.test(lines[i])) {
        bq.push(lines[i].replace(/^[ ]{0,3}>\s?/, ''));
        i++;
      }
      html += `<blockquote>\n${parse(bq.join('\n'))}</blockquote>\n`;
      continue;
    }

    // Unordered list
    if (/^[ ]{0,3}[-*+][ \t]/.test(line)) {
      html += '<ul>\n';
      while (i < lines.length && /^[ ]{0,3}[-*+][ \t]/.test(lines[i])) {
        html += `<li>${inline(lines[i].replace(/^[ ]{0,3}[-*+][ \t]/, ''))}</li>\n`;
        i++;
      }
      html += '</ul>\n';
      continue;
    }

    // Ordered list
    if (/^[ ]{0,3}\d+[.)]\s/.test(line)) {
      html += '<ol>\n';
      while (i < lines.length && /^[ ]{0,3}\d+[.)]\s/.test(lines[i])) {
        html += `<li>${inline(lines[i].replace(/^[ ]{0,3}\d+[.)]\s/, ''))}</li>\n`;
        i++;
      }
      html += '</ol>\n';
      continue;
    }

    // Paragraph — collect until a blank line or block-level element
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[ ]{0,3}(#{1,6}[ \t]|>|[-*+][ \t]|\d+[.)]\s|```|(\*[ ]{0,1}){3,}$|(-[ ]{0,1}){3,}$|(_[ ]{0,1}){3,}$)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) html += `<p>${inline(para.join(' '))}</p>\n`;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
let renderTimer = null;

function render() {
  const md = mdInput.value;
  const html = parse(md);
  mdPreview.innerHTML = html || '<p class="md-empty">Preview will appear here…</p>';

  const lines  = md.split('\n').length;
  const words  = md.trim() ? md.trim().split(/\s+/).length : 0;
  mdStatus.textContent = md.trim()
    ? `${lines} line${lines !== 1 ? 's' : ''} · ${words} word${words !== 1 ? 's' : ''}`
    : '';

  mdCopyBtn.disabled = !html.trim();
}

mdInput.addEventListener('input', () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
});

mdCopyBtn.addEventListener('click', () => {
  const html = parse(mdInput.value);
  navigator.clipboard.writeText(html).then(() => {
    mdCopyBtn.textContent = 'Copied!';
    setTimeout(() => { mdCopyBtn.textContent = 'Copy HTML'; }, 1500);
  });
});

// Starter content
mdInput.value = `# Markdown Previewer

Paste any **Markdown** here to see the rendered preview.

## Features

- Headers (h1–h6)
- **Bold** and *italic* text
\`\`inline code\`\` spans
- [Links](https://example.com) and images
- Ordered and unordered lists
- Blockquotes
- Fenced code blocks
- Horizontal rules

## Example

> Blockquotes look like this.

\`\`\`js
const greet = name => \`Hello, \${name}!\`;
console.log(greet('world'));
\`\`\`

---

1. First item
2. Second item
3. Third item
`;

render();
