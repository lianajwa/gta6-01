// economy.js: cash, respect ranks, shops and district standing.
// Money comes from missions, heists and the Tide Trial; respect ranks the
// player from Nobody to Delta King and opens the crew's trust.
import { ECONOMY, DISTRICTS } from './config.js';

export function createEconomy() {
  const state = {
    cash: ECONOMY.startCash,
    respect: ECONOMY.startRespect,
    standing: {}, // district id -> -100..100
  };
  for (const d of DISTRICTS) state.standing[d.id] = 0;
  return {
    state,
    earn(cash, respect = 0, districtId = null) {
      state.cash += cash;
      state.respect += respect;
      if (districtId && state.standing[districtId] !== undefined) {
        // Standing is bounded both ways: -100 (hated) to 100 (revered).
        state.standing[districtId] = Math.max(-100, Math.min(100, state.standing[districtId] + Math.ceil(respect / 4)));
      }
    },
    spend(amount) {
      if (state.cash < amount) return false;
      state.cash -= amount;
      return true;
    },
    rank() {
      let r = 0;
      for (let i = 0; i < ECONOMY.ranks.length; i++) {
        if (state.respect >= ECONOMY.rankAt[i]) r = i;
      }
      return { name: ECONOMY.ranks[r], index: r, next: ECONOMY.rankAt[r + 1] ?? null };
    },
    standingFor(id) { return state.standing[id] ?? 0; },
    districtNameAt(x, z) {
      let best = null, bd = 1e9;
      for (const d of DISTRICTS) {
        const dd = Math.hypot(x - d.x, z - d.z);
        if (dd < bd) { bd = dd; best = d; }
      }
      return best && bd < best.r + 40 ? best.name : 'Tideline';
    },
  };
}
