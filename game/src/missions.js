// missions.js: the 10-mission story chain. Each mission has a marker on the
// map and the HUD; reaching it with the right state completes it and pays
// cash + respect. The chain is linear: mission N unlocks N+1.
import { MISSIONS, ECONOMY } from './config.js';

export function createMissions(onEvent) {
  let current = 0; // index into MISSIONS; 10 means the story is done
  let active = null; // {mission, phase, timer}
  let kills = 0;

  function start(i) {
    const m = MISSIONS[i];
    active = { mission: m, phase: 'go', timer: 0, done: false };
    onEvent({ type: 'mission-start', mission: m });
    return active;
  }

  return {
    get current() { return current; },
    get active() { return active; },
    get done() { return current >= MISSIONS.length; },
    start(i = 0) {
      if (!MISSIONS[i]) return null; // out-of-range mission index: no-op
      current = i;
      return start(i);
    },
    // Called every frame with the player's position and world state.
    update(dt, px, pz, ctx) {
      if (!active || active.done) return null;
      const m = active.mission;
      const d = Math.hypot(px - m.x, pz - m.z);
      active.timer += dt;
      const complete = () => {
        active.done = true;
        const pay = ECONOMY.missionPay[m.pay];
        const rep = ECONOMY.respectPay[m.pay];
        onEvent({ type: 'mission-complete', mission: m, pay, rep });
        current++;
        if (current < MISSIONS.length) start(current);
        else onEvent({ type: 'story-done' });
        return { completed: m, pay, rep };
      };
      switch (m.kind) {
        case 'goto':
        case 'deliver':
        case 'steal':
        case 'boat':
          if (d < 10) return complete();
          break;
        case 'evade':
          if (ctx.wanted >= 2 && active.phase === 'go') active.phase = 'lose';
          if (active.phase === 'lose' && ctx.wanted === 0 && active.timer > 20) return complete();
          break;
        case 'combat':
          if (ctx.kills >= 4) return complete();
          break;
        case 'trial':
          if (ctx.trialDone) return complete();
          break;
        case 'race':
          if (d < 10 && active.timer > 30 && ctx.raceWon) return complete();
          if (d < 10 && active.phase === 'go') { active.phase = 'race'; onEvent({ type: 'race-start', mission: m }); }
          break;
        case 'defend':
          if (ctx.defended) return complete();
          break;
        case 'finale':
          if (d < 10 && ctx.kills >= 2) return complete();
          break;
        default:
          if (d < 10) return complete();
      }
      return null;
    },
    marker() {
      if (!active) return null;
      return { x: active.mission.x, z: active.mission.z, name: active.mission.name, phase: active.phase };
    },
    objectiveText() {
      if (this.done) return 'Story complete — you are the Delta King.';
      if (!active) return 'Talk to Mara to start the story.';
      const m = active.mission;
      return `Mission ${m.id}/10 — ${m.name}: ${m.text}`;
    },
    noteKill() { kills++; },
    get kills() { return kills; },
  };
}
