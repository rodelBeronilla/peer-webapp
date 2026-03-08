// Bookmarks

const bookmarksForm  = document.getElementById('bookmarksForm');
const bookmarkUrl    = document.getElementById('bookmarkUrl');
const bookmarkLabel  = document.getElementById('bookmarkLabel');
const bookmarksList  = document.getElementById('bookmarksList');
const bookmarksCount = document.getElementById('bookmarksCount');
const bookmarkStatus = document.getElementById('bookmarkStatus');
const BOOKMARKS_KEY  = 'peer-bookmarks';

let bookmarks = [];

function setBookmarkStatus(msg, isError) {
  bookmarkStatus.textContent = msg;
  bookmarkStatus.className = 'status-bar' + (isError ? ' status-bar--error' : '');
}

function loadBookmarks() {
  try { bookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY)) || []; }
  catch { bookmarks = []; }
}

function saveBookmarks() {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    setBookmarkStatus('⚠ Storage unavailable — bookmark not saved.', 'error');
  }
}

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`;
  } catch {
    return '';
  }
}

function renderBookmarks() {
  bookmarksList.innerHTML = '';

  if (bookmarks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'bookmark-empty';
    empty.textContent = 'No bookmarks yet. Add a URL above.';
    bookmarksList.appendChild(empty);
    bookmarksCount.textContent = '0 bookmarks';
    return;
  }

  bookmarks.forEach((bm) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.dataset.id = bm.id;

    const favicon = document.createElement('img');
    favicon.className = 'bookmark-item__favicon';
    favicon.width = 16;
    favicon.height = 16;
    favicon.alt = '';
    favicon.setAttribute('aria-hidden', 'true');
    const src = faviconUrl(bm.url);
    if (src) {
      favicon.src = src;
      favicon.onerror = () => { favicon.replaceWith(makeFaviconFallback()); };
    } else {
      favicon.replaceWith(makeFaviconFallback());
    }

    const link = document.createElement('a');
    link.className = 'bookmark-item__link';
    link.href = bm.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = bm.label || bm.url;
    link.title = bm.url;

    const urlSpan = document.createElement('span');
    urlSpan.className = 'bookmark-item__url';
    urlSpan.textContent = bm.url;

    const info = document.createElement('div');
    info.className = 'bookmark-item__info';
    info.appendChild(link);
    if (bm.label) info.appendChild(urlSpan);

    const del = document.createElement('button');
    del.className = 'bookmark-item__delete';
    del.setAttribute('aria-label', `Delete bookmark: ${bm.label || bm.url}`);
    del.setAttribute('type', 'button');
    del.textContent = '×';
    del.addEventListener('click', () => deleteBookmark(bm.id));

    li.appendChild(favicon);
    li.appendChild(info);
    li.appendChild(del);
    bookmarksList.appendChild(li);
  });

  const count = bookmarks.length;
  bookmarksCount.textContent = `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`;
}

function makeFaviconFallback() {
  const span = document.createElement('span');
  span.className = 'bookmark-item__favicon bookmark-item__favicon--fallback';
  span.setAttribute('aria-hidden', 'true');
  span.textContent = '🔖';
  return span;
}

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function addBookmark(rawUrl, label) {
  const url = normalizeUrl(rawUrl);
  if (!url) return;

  // Basic URL validation
  try { new URL(url); } catch {
    setBookmarkStatus('Invalid URL — please enter a valid address.', true);
    return;
  }

  // Deduplicate by URL
  if (bookmarks.some(b => b.url === url)) {
    setBookmarkStatus('That URL is already bookmarked.', true);
    return;
  }

  bookmarks.unshift({ url, label: label.trim(), id: crypto.randomUUID() });
  saveBookmarks();
  renderBookmarks();
  setBookmarkStatus('', false);
}

function deleteBookmark(id) {
  const li = bookmarksList.querySelector(`.bookmark-item[data-id="${id}"]`);
  if (li) {
    li.style.transition = 'opacity 150ms ease, transform 150ms ease';
    li.style.opacity = '0';
    li.style.transform = 'translateX(10px)';
  }
  setTimeout(() => {
    bookmarks = bookmarks.filter(b => b.id !== id);
    saveBookmarks();
    renderBookmarks();
  }, 150);
}

bookmarksForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addBookmark(bookmarkUrl.value, bookmarkLabel.value);
  bookmarkUrl.value = '';
  bookmarkLabel.value = '';
  bookmarkUrl.focus();
});

// ── Export / Import ──────────────────────────────────────────────

const bookmarksExportBtn  = document.getElementById('bookmarksExport');
const bookmarksImportBtn  = document.getElementById('bookmarksImport');
const bookmarksImportFile = document.getElementById('bookmarksImportFile');

bookmarksExportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'devtools-bookmarks.json';
  a.click();
  URL.revokeObjectURL(url);
  setBookmarkStatus(`Exported ${bookmarks.length} ${bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}.`, false);
});

bookmarksImportBtn.addEventListener('click', () => {
  bookmarksImportFile.value = '';
  bookmarksImportFile.click();
});

bookmarksImportFile.addEventListener('change', () => {
  const file = bookmarksImportFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Expected a JSON array.');
      if (imported.some(b => typeof b.url !== 'string')) throw new Error('Each bookmark must have a "url" field.');
      const existingUrls = new Set(bookmarks.map(b => normalizeUrl(b.url)));
      const newBookmarks = imported.filter(b => !existingUrls.has(normalizeUrl(b.url)));
      newBookmarks.forEach(b => {
        b.url = normalizeUrl(b.url);
        if (!b.id) b.id = crypto.randomUUID();
        if (!b.label) b.label = '';
      });
      bookmarks = [...newBookmarks, ...bookmarks];
      saveBookmarks();
      renderBookmarks();
      const skipped = imported.length - newBookmarks.length;
      setBookmarkStatus(`Imported ${newBookmarks.length} new ${newBookmarks.length === 1 ? 'bookmark' : 'bookmarks'} (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped).`, false);
    } catch (err) {
      setBookmarkStatus(`Import failed: ${err.message}`, true);
    }
  };
  reader.onerror = () => setBookmarkStatus('Import failed: could not read file.', true);
  reader.readAsText(file);
});

loadBookmarks();
renderBookmarks();
