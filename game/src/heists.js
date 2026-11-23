// Staged heists: a planning phase (approach, crew, getaway) followed by an
// execution mission. Quiet needs Juno and brings fewer enemies; Loud pays the
// same but starts the job hot with wanted stars already on you.
import { HEISTS } from './config.js';

export function createHeists() {
  return {
    list() { return HEISTS; },
    byId(id) { return HEISTS.find((h) => h.id === id); },
    available(G) {
      return HEISTS.filter((h) => h.unlockMission === undefined || G.state.missionIndex > h.unlockMission);
    },
    // Apply the chosen plan to the game state; returns a summary line.
    applyPlan(G, heistId, plan) {
      const s = G.state;
      s.heistPlan = { heist: heistId, approach: plan.approach, crew: plan.crew, getaway: plan.getaway };
      const h = this.byId(heistId);
      if (plan.approach === 'loud') {
        G.police.addWanted(G, 2);
        for (let i = 0; i < 3; i++) G.combat.spawnEnemy(-60 + i * 8, 215 + (i % 2) * 6);
      } else {
        // Quiet: Juno kills the cameras, so the job starts cold.
        if (!s.crew.find((c) => c.id === 'juno' && c.recruited)) {
          G.hud.flash('QUIET NEEDS JUNO — SWITCHING TO LOUD');
          s.heistPlan.approach = 'loud';
          G.police.addWanted(G, 2);
        }
      }
      return `${h.name}: ${s.heistPlan.approach.toUpperCase()} approach, getaway ${plan.getaway}`;
    },
    planSummary(G) {
      const p = G.state.heistPlan;
      if (!p) return 'No heist planned';
      return `${p.heist} · ${p.approach} · crew ${p.crew.join(', ') || 'solo'} · getaway ${p.getaway}`;
    },
  };
}
