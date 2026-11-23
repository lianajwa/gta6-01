// Save / load through localStorage. Only plain numbers, strings and flags — no
// functions, no DOM — so a save is always safe to read back.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const s = G.state;
    const data = {
      cash: s.cash, respect: s.respect, health: s.health, armor: s.armor,
      missionIndex: s.missionIndex, missionDone: s.missionDone,
      wanted: s.wanted, pistol: s.pistol, ammo: s.ammo,
      upgrades: s.upgrades, crew: s.crew.map((c) => ({ id: c.id, recruited: c.recruited, onJob: c.onJob })),
      districts: s.districts, heistPlan: s.heistPlan,
      player: { x: s.player.x, z: s.player.z },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }
