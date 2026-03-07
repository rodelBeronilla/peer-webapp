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
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
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
  notes.unshift({ text: trimmed, id: Date.now() });
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

loadNotes();
renderNotes();
