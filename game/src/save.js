// save.js: save / load / autosave through localStorage. The save holds cash,
// respect, mission progress, trial best time, crew and standing — everything
// the player earned. Corrupt or missing saves fall back to a fresh start.
const KEY = 'tideline-delta-kings-save-v1';
const SAVE_VERSION = 1;

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, v: SAVE_VERSION, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // Versioned: a save written by another format is refused, not trusted.
    if (typeof d !== 'object' || !d || d.v !== SAVE_VERSION || typeof d.cash !== 'number') return null;
    return d;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

// Autosave timer: call tick(dt, dataFn) from the main loop.
export function createAutosave(intervalSec = 30) {
  let t = 0;
  let lastSaved = 0;
  return {
    tick(dt, dataFn) {
      t += dt;
      if (t >= intervalSec) {
        t = 0;
        if (saveGame(dataFn())) lastSaved = Date.now();
      }
    },
    saveNow(dataFn) {
      if (saveGame(dataFn())) lastSaved = Date.now();
    },
    get lastSaved() { return lastSaved; },
  };
}
