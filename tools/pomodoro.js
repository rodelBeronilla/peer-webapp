// Pomodoro Timer

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
const PRESETS = {
  classic: { label: '25 / 5',  work: 25, shortBreak:  5, longBreak: 15, longEvery: 4 },
  sprint:  { label: '15 / 5',  work: 15, shortBreak:  5, longBreak: 10, longEvery: 4 },
  deep:    { label: '50 / 10', work: 50, shortBreak: 10, longBreak: 30, longEvery: 4 },
  custom:  { label: 'Custom',  work: 25, shortBreak:  5, longBreak: 15, longEvery: 4 },
};

const RING_R    = 54;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 339.3

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const modeEl        = document.getElementById('pomodoroMode');
const timeEl        = document.getElementById('pomodoroTime');
const sessionEl     = document.getElementById('pomodoroSession');
const startBtn      = document.getElementById('pomodoroStart');
const resetBtn      = document.getElementById('pomodoroReset');
const soundCheck    = document.getElementById('pomodoroSound');
const ringEl        = document.getElementById('pomodoroRingProgress');
const panel         = document.getElementById('panel-pomodoro');
const presetSel     = document.getElementById('pomodoroPreset');
const customFields  = document.getElementById('pomodoroCustomFields');
const customWork    = document.getElementById('pomodoroCustomWork');
const customShort   = document.getElementById('pomodoroCustomShort');
const customLong    = document.getElementById('pomodoroCustomLong');
const todayCountEl  = document.getElementById('pomodoroTodayCount');
const streakEl      = document.getElementById('pomodoroStreak');

const ORIGINAL_TITLE = document.title;

// ---------------------------------------------------------------------------
// Notification API
// ---------------------------------------------------------------------------
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function fireNotif(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: 'favicon.ico', tag: 'pomodoro' });
  } catch {
    // Notifications may be blocked by OS or browser settings
  }
}

// ---------------------------------------------------------------------------
// Session history log
// ---------------------------------------------------------------------------
const LS_HISTORY_KEY   = 'pomodoro_history_v1';
const MAX_HISTORY      = 50;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory(arr) {
  try {
    // Cap at MAX_HISTORY — drop oldest
    const trimmed = arr.slice(-MAX_HISTORY);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // storage may be unavailable
  }
}

function recordWorkSession() {
  const history = loadHistory();
  history.push({ date: todayStr(), ts: Date.now() });
  saveHistory(history);
}

function todayCount() {
  const today = todayStr();
  return loadHistory().filter(e => e.date === today).length;
}

function currentStreak() {
  const history = loadHistory();
  if (!history.length) return 0;

  // Build a Set of unique dates that have at least one session
  const days = new Set(history.map(e => e.date));

  let streak = 0;
  let limit = 365; // safety cap — streaks beyond 365 days are extraordinary
  const d = new Date();
  // Walk backwards from today; allow today to count even if no session yet
  // (streak reflects yesterday→… continuity; today breaks it only if it's past midnight and no session)
  while (limit-- > 0) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    } else if (key === todayStr()) {
      // Today hasn't had a session yet — skip it without breaking streak
      d.setUTCDate(d.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderStats() {
  const count = todayCount();
  if (todayCountEl) {
    todayCountEl.textContent = count === 1 ? 'Today: 1 pomodoro' : `Today: ${count} pomodoros`;
  }
  if (streakEl) {
    const s = currentStreak();
    streakEl.textContent = s > 1 ? `${s}-day streak 🔥` : '';
    streakEl.hidden = s <= 1;
  }
}

// ---------------------------------------------------------------------------
// Shared AudioContext (single instance, reused across beeps)
// ---------------------------------------------------------------------------
let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Browsers suspend the context after user inactivity — resume before use
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

function playBeep(hz, durationSecs) {
  if (!soundCheck.checked) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSecs);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationSecs);
  } catch {
    // AudioContext may be unavailable in some environments
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function defaultState(preset) {
  const p = PRESETS[preset] || PRESETS.classic;
  return {
    preset,
    mode:              'work',   // 'work' | 'shortBreak' | 'longBreak'
    timeLeft:          p.work * 60,
    totalTime:         p.work * 60,
    session:           1,        // displayed session number
    workDoneInCycle:   0,        // completed work blocks since last long break
    running:           false,
    timer:             null,
    // custom durations (only used when preset === 'custom')
    customWork:        PRESETS.custom.work,
    customShort:       PRESETS.custom.shortBreak,
    customLong:        PRESETS.custom.longBreak,
  };
}

let state = defaultState('classic');

// ---------------------------------------------------------------------------
// Persistence (localStorage)
// ---------------------------------------------------------------------------
const LS_KEY = 'pomodoro_state_v2';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h — discard stale saves

function saveState() {
  const payload = {
    ts:             Date.now(),
    preset:         state.preset,
    mode:           state.mode,
    timeLeft:       state.timeLeft,
    totalTime:      state.totalTime,
    session:        state.session,
    workDoneInCycle: state.workDoneInCycle,
    customWork:     state.customWork,
    customShort:    state.customShort,
    customLong:     state.customLong,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // storage may be unavailable (private browsing quota, etc.)
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.ts !== 'number') return null;
    if (Date.now() - p.ts > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

function restoreState() {
  const saved = loadState();
  if (!saved) return;

  // Restore preset selector first
  const preset = PRESETS[saved.preset] ? saved.preset : 'classic';
  presetSel.value = preset;
  toggleCustomFields(preset);

  state.preset          = preset;
  state.mode            = saved.mode          || 'work';
  state.timeLeft        = saved.timeLeft      ?? PRESETS[preset].work * 60;
  state.totalTime       = saved.totalTime     ?? PRESETS[preset].work * 60;
  state.session         = saved.session       ?? 1;
  state.workDoneInCycle = saved.workDoneInCycle ?? 0;
  state.customWork      = saved.customWork    ?? PRESETS.custom.work;
  state.customShort     = saved.customShort   ?? PRESETS.custom.shortBreak;
  state.customLong      = saved.customLong    ?? PRESETS.custom.longBreak;

  if (preset === 'custom') {
    customWork.value  = state.customWork;
    customShort.value = state.customShort;
    customLong.value  = state.customLong;
  }
}

// ---------------------------------------------------------------------------
// Preset helpers
// ---------------------------------------------------------------------------
function activePreset() {
  const key = state.preset;
  if (key === 'custom') {
    return {
      work:        state.customWork,
      shortBreak:  state.customShort,
      longBreak:   state.customLong,
      longEvery:   4,
    };
  }
  return PRESETS[key];
}

function toggleCustomFields(presetKey) {
  if (customFields) {
    customFields.hidden = presetKey !== 'custom';
  }
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------
function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function modeLabel(mode) {
  if (mode === 'longBreak')  return 'Long Break';
  if (mode === 'shortBreak') return 'Short Break';
  return 'Work';
}

function render() {
  const time   = fmt(state.timeLeft);
  const isWork = state.mode === 'work';

  timeEl.textContent = time;
  timeEl.setAttribute('aria-label', `${time} remaining`);
  modeEl.textContent    = modeLabel(state.mode);
  sessionEl.textContent = `Session ${state.session}`;

  const progress = state.totalTime > 0 ? state.timeLeft / state.totalTime : 1;
  ringEl.style.strokeDashoffset = RING_CIRC * (1 - progress);
  ringEl.style.stroke = isWork
    ? 'var(--color-primary)'
    : state.mode === 'longBreak'
      ? 'var(--color-warn, #f59e0b)'
      : 'var(--color-ok)';

  if (state.running) {
    document.title = `(${time}) ${modeLabel(state.mode)} — DevTools`;
  } else {
    document.title = ORIGINAL_TITLE;
  }
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------
function tick() {
  state.timeLeft--;

  if (state.timeLeft <= 0) {
    const p = activePreset();

    if (state.mode === 'work') {
      // Work session complete
      playBeep(880, 0.8);
      recordWorkSession();
      state.workDoneInCycle++;

      if (state.workDoneInCycle >= p.longEvery) {
        // Long break
        state.workDoneInCycle = 0;
        state.mode      = 'longBreak';
        state.totalTime = p.longBreak * 60;
        state.timeLeft  = p.longBreak * 60;
        fireNotif('Pomodoro complete!', `Great work! Take a ${p.longBreak}-min long break.`);
      } else {
        // Short break
        state.mode      = 'shortBreak';
        state.totalTime = p.shortBreak * 60;
        state.timeLeft  = p.shortBreak * 60;
        fireNotif('Pomodoro complete!', `Great work! Take a ${p.shortBreak}-min break.`);
      }
    } else {
      // Break complete → next work session
      playBeep(660, 0.8);
      state.session++;
      state.mode      = 'work';
      state.totalTime = p.work * 60;
      state.timeLeft  = p.work * 60;
      fireNotif('Break over!', `Time to focus. Session ${state.session} starting.`);
    }

    renderStats();
  }

  saveState();
  render();
}

// ---------------------------------------------------------------------------
// Timer control
// ---------------------------------------------------------------------------
function startTimer() {
  if (state.running) return;
  // Resume AudioContext and request notification permission on first user gesture
  getAudioCtx();
  requestNotifPermission();
  state.running = true;
  startBtn.textContent = 'Pause';
  startBtn.setAttribute('aria-label', 'Pause timer');
  state.timer = setInterval(tick, 1000);
  render();
}

function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timer);
  startBtn.textContent = 'Start';
  startBtn.setAttribute('aria-label', 'Start timer');
  document.title = ORIGINAL_TITLE;
  saveState();
  render();
}

function resetTimer() {
  pauseTimer();
  const p       = activePreset();
  state.mode            = 'work';
  state.timeLeft        = p.work * 60;
  state.totalTime       = p.work * 60;
  state.session         = 1;
  state.workDoneInCycle = 0;
  saveState();
  render();
}

// ---------------------------------------------------------------------------
// Preset change
// ---------------------------------------------------------------------------
presetSel.addEventListener('change', () => {
  const key = presetSel.value;
  state.preset = key;
  toggleCustomFields(key);

  if (key === 'custom') {
    // Sync custom fields → state before applying
    state.customWork  = parseInt(customWork.value,  10) || 25;
    state.customShort = parseInt(customShort.value, 10) || 5;
    state.customLong  = parseInt(customLong.value,  10) || 15;
  }

  resetTimer();
});

// Custom field changes apply immediately via reset.
// Intentional: changing duration mid-session resets to session 1 —
// safer than trying to apply new duration to an in-progress timer.
function onCustomChange() {
  state.customWork  = Math.max(1, parseInt(customWork.value,  10) || 25);
  state.customShort = Math.max(1, parseInt(customShort.value, 10) || 5);
  state.customLong  = Math.max(1, parseInt(customLong.value,  10) || 15);
  resetTimer();
}

if (customWork)  customWork.addEventListener('change',  onCustomChange);
if (customShort) customShort.addEventListener('change', onCustomChange);
if (customLong)  customLong.addEventListener('change',  onCustomChange);

// ---------------------------------------------------------------------------
// Button listeners
// ---------------------------------------------------------------------------
startBtn.addEventListener('click', () => {
  if (state.running) pauseTimer();
  else startTimer();
});

resetBtn.addEventListener('click', resetTimer);

panel.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    e.preventDefault();
    if (state.running) pauseTimer();
    else startTimer();
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
ringEl.style.strokeDasharray  = RING_CIRC;
ringEl.style.strokeDashoffset = 0;

restoreState();
render();
renderStats();
