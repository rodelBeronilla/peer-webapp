// Pomodoro Timer

const WORK_SECS  = 25 * 60;
const BREAK_SECS = 5 * 60;
const RING_R     = 54;
const RING_CIRC  = 2 * Math.PI * RING_R; // ≈ 339.3

const modeEl     = document.getElementById('pomodoroMode');
const timeEl     = document.getElementById('pomodoroTime');
const sessionEl  = document.getElementById('pomodoroSession');
const startBtn   = document.getElementById('pomodoroStart');
const resetBtn   = document.getElementById('pomodoroReset');
const soundCheck = document.getElementById('pomodoroSound');
const ringEl     = document.getElementById('pomodoroRingProgress');
const panel      = document.getElementById('panel-pomodoro');

const ORIGINAL_TITLE = document.title;

let state = {
  mode:      'work',   // 'work' | 'break'
  timeLeft:  WORK_SECS,
  totalTime: WORK_SECS,
  session:   1,        // session number (increments after each break)
  running:   false,
  timer:     null,
};

function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function render() {
  const time = fmt(state.timeLeft);
  const isWork = state.mode === 'work';

  timeEl.textContent = time;
  timeEl.setAttribute('aria-label', `${time} remaining`);
  modeEl.textContent = isWork ? 'Work' : 'Break';
  sessionEl.textContent = `Session ${state.session}`;

  // Ring: progress shrinks from full → empty as timeLeft decreases
  const progress = state.timeLeft / state.totalTime;
  ringEl.style.strokeDashoffset = RING_CIRC * (1 - progress);
  ringEl.style.stroke = isWork
    ? 'var(--color-primary)'
    : 'var(--color-ok)';

  // Document title while running
  if (state.running) {
    document.title = `(${time}) ${isWork ? 'Work' : 'Break'} — DevTools`;
  } else {
    document.title = ORIGINAL_TITLE;
  }
}

function playBeep(hz, durationSecs) {
  if (!soundCheck.checked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

function tick() {
  state.timeLeft--;

  if (state.timeLeft <= 0) {
    if (state.mode === 'work') {
      // Work session complete → start break
      playBeep(880, 0.8);
      state.mode      = 'break';
      state.totalTime = BREAK_SECS;
      state.timeLeft  = BREAK_SECS;
    } else {
      // Break complete → start next work session
      playBeep(660, 0.8);
      state.session++;
      state.mode      = 'work';
      state.totalTime = WORK_SECS;
      state.timeLeft  = WORK_SECS;
    }
  }

  render();
}

function startTimer() {
  if (state.running) return;
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
  render();
}

function resetTimer() {
  pauseTimer();
  state.mode      = 'work';
  state.timeLeft  = WORK_SECS;
  state.totalTime = WORK_SECS;
  state.session   = 1;
  render();
}

startBtn.addEventListener('click', () => {
  if (state.running) pauseTimer();
  else startTimer();
});

resetBtn.addEventListener('click', resetTimer);

// Space bar shortcut when focus is inside the Pomodoro panel
// (but not on a button, to avoid double-triggering)
panel.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    if (state.running) pauseTimer();
    else startTimer();
  }
});

// Initialize ring geometry
ringEl.style.strokeDasharray  = RING_CIRC;
ringEl.style.strokeDashoffset = 0;

render();
