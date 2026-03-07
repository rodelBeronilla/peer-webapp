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

/* ============================================
   Weather Widget
   ============================================ */
const WEATHER_DATA_KEY   = 'peer-weather-data';   // {data, ts} — 10min TTL
const WEATHER_COORDS_KEY = 'peer-weather-coords';  // {lat, lon, city} — persisted
const WEATHER_UNIT_KEY   = 'peer-weather-unit';
const WEATHER_TTL        = 10 * 60 * 1000;

const WMO_CODES = {
  0:  { label: 'Clear sky',           day: '☀️',  night: '🌙' },
  1:  { label: 'Mainly clear',        day: '🌤️', night: '🌙' },
  2:  { label: 'Partly cloudy',       day: '⛅',  night: '🌙' },
  3:  { label: 'Overcast',            day: '☁️',  night: '☁️' },
  45: { label: 'Fog',                 day: '🌫️', night: '🌫️' },
  48: { label: 'Icy fog',             day: '🌫️', night: '🌫️' },
  51: { label: 'Light drizzle',       day: '🌦️', night: '🌧️' },
  53: { label: 'Drizzle',             day: '🌧️', night: '🌧️' },
  55: { label: 'Heavy drizzle',       day: '🌧️', night: '🌧️' },
  61: { label: 'Light rain',          day: '🌧️', night: '🌧️' },
  63: { label: 'Rain',                day: '🌧️', night: '🌧️' },
  65: { label: 'Heavy rain',          day: '🌧️', night: '🌧️' },
  71: { label: 'Light snow',          day: '🌨️', night: '🌨️' },
  73: { label: 'Snow',                day: '❄️',  night: '❄️' },
  75: { label: 'Heavy snow',          day: '❄️',  night: '❄️' },
  77: { label: 'Snow grains',         day: '🌨️', night: '🌨️' },
  80: { label: 'Light showers',       day: '🌦️', night: '🌧️' },
  81: { label: 'Showers',             day: '🌦️', night: '🌧️' },
  82: { label: 'Heavy showers',       day: '⛈️',  night: '⛈️' },
  85: { label: 'Snow showers',        day: '🌨️', night: '🌨️' },
  86: { label: 'Heavy snow showers',  day: '❄️',  night: '❄️' },
  95: { label: 'Thunderstorm',        day: '⛈️',  night: '⛈️' },
  96: { label: 'Thunderstorm + hail', day: '⛈️',  night: '⛈️' },
  99: { label: 'Thunderstorm + hail', day: '⛈️',  night: '⛈️' },
};

let weatherUnit = localStorage.getItem(WEATHER_UNIT_KEY) || 'C';
let weatherData = null;
let currentCity = null;

const weatherBody    = document.getElementById('weatherBody');
const weatherUnitBtn = document.getElementById('weatherUnitBtn');

function formatTemp(degC) {
  if (weatherUnit === 'F') {
    return `${(degC * 9 / 5 + 32).toFixed(1)}°F`;
  }
  return `${degC.toFixed(1)}°C`;
}

function renderWeatherLoading(msg = 'Getting location…') {
  weatherBody.innerHTML = `
    <div class="weather__state">
      <div class="weather__spinner" aria-hidden="true"></div>
      <span class="weather__status-msg">${msg}</span>
    </div>`;
}

function renderWeatherError(msg) {
  weatherUnitBtn.hidden = true;
  weatherBody.innerHTML = `
    <div class="weather__state weather__state--error" role="alert">
      <span class="weather__error-icon" aria-hidden="true">⚠️</span>
      <p class="weather__status-msg">${msg}</p>
      <button class="weather__retry" id="weatherRetry">Retry</button>
    </div>`;
  document.getElementById('weatherRetry').addEventListener('click', initWeather);
}

function renderWeatherData(data, city) {
  const c    = data.current;
  const code = WMO_CODES[c.weather_code] || { label: 'Unknown', day: '🌡️', night: '🌡️' };
  const icon = c.is_day ? code.day : code.night;

  let updatedStr = '';
  try {
    updatedStr = new Date(c.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { /* best-effort */ }

  weatherUnitBtn.hidden = false;
  weatherUnitBtn.textContent = weatherUnit === 'C' ? '°C' : '°F';

  weatherBody.innerHTML = `
    <div class="weather__content">
      <div class="weather__location">
        <span class="weather__city">${city || 'Unknown location'}</span>
        <button class="weather__refresh" id="weatherRefresh" aria-label="Refresh weather" title="Refresh weather">↻</button>
      </div>
      <div class="weather__main">
        <span class="weather__icon" aria-hidden="true">${icon}</span>
        <span class="weather__temp">${formatTemp(c.temperature_2m)}</span>
      </div>
      <div class="weather__condition">${code.label}</div>
      <div class="weather__details">
        <div class="weather__detail">
          <span aria-hidden="true">💨</span>
          <span>${Math.round(c.wind_speed_10m)} km/h</span>
        </div>
        <div class="weather__detail">
          <span aria-hidden="true">💧</span>
          <span>${c.relative_humidity_2m}%</span>
        </div>
        <div class="weather__detail">
          <span aria-hidden="true">🌡️</span>
          <span>Feels ${formatTemp(c.apparent_temperature)}</span>
        </div>
      </div>
      ${updatedStr ? `<div class="weather__updated">Updated ${updatedStr}</div>` : ''}
    </div>`;

  document.getElementById('weatherRefresh').addEventListener('click', refreshWeather);
}

function getSavedCoords() {
  try { return JSON.parse(localStorage.getItem(WEATHER_COORDS_KEY)); }
  catch { return null; }
}

function saveCoords(lat, lon, city) {
  localStorage.setItem(WEATHER_COORDS_KEY, JSON.stringify({ lat, lon, city }));
}

function getCachedData() {
  try {
    const raw = JSON.parse(localStorage.getItem(WEATHER_DATA_KEY));
    if (raw && Date.now() - raw.ts < WEATHER_TTL) return raw.data;
  } catch { /* ignore */ }
  return null;
}

function cacheData(data) {
  localStorage.setItem(WEATHER_DATA_KEY, JSON.stringify({ data, ts: Date.now() }));
}

async function fetchWeatherAPI(lat, lon) {
  const params = [
    `latitude=${lat.toFixed(4)}`,
    `longitude=${lon.toFixed(4)}`,
    'current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    'temperature_unit=celsius',
    'windspeed_unit=kmh',
    'timezone=auto',
  ].join('&');
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  return res.json();
}

async function fetchCityName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.address || {};
    return a.city || a.town || a.village || a.county || a.state || null;
  } catch { return null; }
}

async function loadWeather(lat, lon, city) {
  renderWeatherLoading('Fetching weather…');
  try {
    const data = await fetchWeatherAPI(lat, lon);
    weatherData  = data;
    currentCity  = city;
    cacheData(data);
    renderWeatherData(data, city);
  } catch {
    renderWeatherError('Weather data unavailable. Check your connection.');
  }
}

async function initWeather() {
  const cached = getCachedData();
  const coords = getSavedCoords();

  if (cached && coords) {
    weatherData = cached;
    currentCity = coords.city;
    renderWeatherData(cached, coords.city);
    return;
  }

  if (coords) {
    await loadWeather(coords.lat, coords.lon, coords.city);
    return;
  }

  if (!navigator.geolocation) {
    renderWeatherError('Geolocation is not supported by your browser.');
    return;
  }

  renderWeatherLoading('Getting location…');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const city = await fetchCityName(lat, lon);
      saveCoords(lat, lon, city);
      await loadWeather(lat, lon, city);
    },
    (err) => {
      const msgs = {
        1: 'Location access denied. Enable it in browser settings.',
        2: 'Location unavailable.',
        3: 'Location request timed out.',
      };
      renderWeatherError(msgs[err.code] || 'Could not get location.');
    },
    { timeout: 10000 }
  );
}

function refreshWeather() {
  localStorage.removeItem(WEATHER_DATA_KEY);
  initWeather();
}

weatherUnitBtn.addEventListener('click', () => {
  weatherUnit = weatherUnit === 'C' ? 'F' : 'C';
  localStorage.setItem(WEATHER_UNIT_KEY, weatherUnit);
  if (weatherData) renderWeatherData(weatherData, currentCity);
});

// Auto-refresh every 10 minutes
setInterval(initWeather, WEATHER_TTL);

initWeather();
