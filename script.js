// Peer Webapp — script.js
// Alpha, Turn 2: clock, notes, theme toggle, hamburger nav

/* ============================================
   Theme Toggle
   ============================================ */
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const THEME_KEY = 'peer-theme';

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.querySelector('.theme-toggle__icon').textContent = isDark ? '☀' : '☾';
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferred);
})();

themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

// Sync if OS preference changes and user has no saved choice
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light');
});

/* ============================================
   Hamburger / Mobile Nav
   ============================================ */
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

function setNavOpen(open) {
  hamburger.setAttribute('aria-expanded', String(open));
  navMenu.classList.toggle('is-open', open);
}

hamburger.addEventListener('click', () => {
  setNavOpen(hamburger.getAttribute('aria-expanded') !== 'true');
});

// Close on nav link click (mobile)
navMenu.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => setNavOpen(false));
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
    setNavOpen(false);
    hamburger.focus();
  }
});

// Close if clicking outside nav on mobile
document.addEventListener('click', (e) => {
  if (navMenu.classList.contains('is-open') &&
      !navMenu.contains(e.target) &&
      !hamburger.contains(e.target)) {
    setNavOpen(false);
  }
});

/* ============================================
   Clock Widget
   ============================================ */
const clockTime = document.getElementById('clockTime');
const clockDate = document.getElementById('clockDate');
const clockTz   = document.getElementById('clockTz');

function updateClock() {
  const now = new Date();

  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  clockTime.textContent = `${h}:${m}:${s}`;
  clockTime.setAttribute('datetime', now.toISOString());

  clockDate.textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = now.toTimeString().match(/GMT[+-]\d{4}/)?.[0] ?? '';
  clockTz.textContent = `${tz} ${offset}`;
}

updateClock();
setInterval(updateClock, 1000);

/* ============================================
   Notes Widget
   ============================================ */
const notesForm   = document.getElementById('notesForm');
const noteInput   = document.getElementById('noteInput');
const notesList   = document.getElementById('notesList');
const notesCount  = document.getElementById('notesCount');
const NOTES_KEY   = 'peer-notes';

let notes = [];

function loadNotes() {
  try { notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || []; }
  catch { notes = []; }
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function renderNotes() {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'notes__empty';
    empty.setAttribute('aria-live', 'polite');
    empty.textContent = 'No notes yet. Add one above.';
    notesList.appendChild(empty);
    notesCount.textContent = '0 notes';
    return;
  }

  notes.forEach((note, index) => {
    const li = document.createElement('li');
    li.className = 'note-item';

    const text = document.createElement('span');
    text.className = 'note-item__text';
    text.textContent = note.text;

    const del = document.createElement('button');
    del.className = 'note-item__delete';
    del.setAttribute('aria-label', `Delete note: ${note.text}`);
    del.setAttribute('type', 'button');
    del.textContent = '×';
    del.addEventListener('click', () => deleteNote(index));

    li.appendChild(text);
    li.appendChild(del);
    notesList.appendChild(li);
  });

  const count = notes.length;
  notesCount.textContent = `${count} ${count === 1 ? 'note' : 'notes'}`;
}

function addNote(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  notes.unshift({ text: trimmed, id: Date.now() });
  saveNotes();
  renderNotes();
}

function deleteNote(index) {
  // Animate out, then remove
  const items = notesList.querySelectorAll('.note-item');
  const li = items[index];
  if (li) {
    li.style.transition = 'opacity 150ms ease, transform 150ms ease';
    li.style.opacity = '0';
    li.style.transform = 'translateX(10px)';
  }
  setTimeout(() => {
    notes.splice(index, 1);
    saveNotes();
    renderNotes();
  }, 150);
}

notesForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addNote(noteInput.value);
  noteInput.value = '';
  noteInput.focus();
});

loadNotes();
renderNotes();
