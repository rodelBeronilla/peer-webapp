// Notes

const notesForm  = document.getElementById('notesForm');
const noteInput  = document.getElementById('noteInput');
const notesList  = document.getElementById('notesList');
const notesCount = document.getElementById('notesCount');
const NOTES_KEY  = 'peer-notes';

let notes = [];

function loadNotes() {
  try { notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || []; }
  catch { notes = []; }
}

function saveNotes() {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    setNotesStatus('⚠ Storage unavailable — changes won\'t persist.', true);
  }
}

function renderNotes() {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'notes__empty';
    empty.textContent = 'No notes yet. Add one above.';
    notesList.appendChild(empty);
    notesCount.textContent = '0 notes';
    return;
  }

  notes.forEach((note) => {
    const li = document.createElement('li');
    li.className = 'note-item';
    li.dataset.id = note.id;

    const text = document.createElement('span');
    text.className = 'note-item__text';
    text.textContent = note.text;

    const del = document.createElement('button');
    del.className = 'note-item__delete';
    del.setAttribute('aria-label', `Delete note: ${note.text}`);
    del.setAttribute('type', 'button');
    del.textContent = '×';
    del.addEventListener('click', () => deleteNote(note.id));

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
  notes.unshift({ text: trimmed, id: crypto.randomUUID() });
  saveNotes();
  renderNotes();
}

function deleteNote(id) {
  const li = notesList.querySelector(`.note-item[data-id="${id}"]`);
  if (li) {
    li.style.transition = 'opacity 150ms ease, transform 150ms ease';
    li.style.opacity = '0';
    li.style.transform = 'translateX(10px)';
  }
  setTimeout(() => {
    notes = notes.filter(n => n.id !== id);
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

// ── Export / Import ──────────────────────────────────────────────

const notesStatus   = document.getElementById('notesStatus');
const notesExportBtn = document.getElementById('notesExport');
const notesImportBtn = document.getElementById('notesImport');
const notesImportFile = document.getElementById('notesImportFile');

function setNotesStatus(msg, isError) {
  notesStatus.textContent = msg;
  notesStatus.className = 'status-bar' + (isError ? ' status-bar--error' : '');
}

notesExportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'devtools-notes.json';
  a.click();
  URL.revokeObjectURL(url);
  setNotesStatus(`Exported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}.`, false);
});

notesImportBtn.addEventListener('click', () => {
  notesImportFile.value = '';
  notesImportFile.click();
});

notesImportFile.addEventListener('change', () => {
  const file = notesImportFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Expected a JSON array.');
      // Validate entries have a text field
      if (imported.some(n => typeof n.text !== 'string')) throw new Error('Each note must have a "text" field.');
      // Deduplicate by text content
      const existingTexts = new Set(notes.map(n => n.text));
      const newNotes = imported.filter(n => !existingTexts.has(n.text));
      newNotes.forEach(n => { if (!n.id) n.id = crypto.randomUUID(); });
      notes = [...newNotes, ...notes];
      saveNotes();
      renderNotes();
      setNotesStatus(`Imported ${newNotes.length} new ${newNotes.length === 1 ? 'note' : 'notes'} (${imported.length - newNotes.length} duplicate${imported.length - newNotes.length === 1 ? '' : 's'} skipped).`, false);
    } catch (err) {
      setNotesStatus(`Import failed: ${err.message}`, true);
    }
  };
  reader.onerror = () => setNotesStatus('Import failed: could not read file.', true);
  reader.readAsText(file);
});

loadNotes();
renderNotes();
