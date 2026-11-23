// Story missions: a generic step engine drives all 10 missions from the data
// in config.js. Steps: goto / steal / collect / kill / survive / race / tail /
// escape. Completing a mission pays cash + respect, raises district standing,
// recruits crew and autosaves.
import { MISSIONS } from './config.js';

export function createMissions() {
  return {
    current() { return MISSIONS; },
    missionAt(i) { return MISSIONS[i] || null; },
    isDone(G) { return G.state.missionIndex >= MISSIONS.length; },
    // Advance the current step when its condition is met; returns true on mission complete.
    step(G, dt) {
      const s = G.state;
      const m = MISSIONS[s.missionIndex];
      if (!m) return false;
      const step = m.steps[s.missionStep];
      if (!step) return this.complete(G);
      const px = s.player.x, pz = s.player.z;
      if (step.time !== undefined && step.type !== 'survive') {
        s.missionTimer -= dt;
        if (s.missionTimer <= 0) { G.failMission('TIME UP'); return false; }
      }
      switch (step.type) {
        case 'goto': case 'escape': {
          if (Math.hypot(step.x - px, step.z - pz) < 7) this.advance(G);
          break;
        }
        case 'steal': {
          if (s.player.vehicle) this.advance(G);
          break;
        }
        case 'collect': {
          // Crates / cases are pickups placed by startMission.
          if ((s.missionKills ?? 0) >= 0 && s.collected >= step.count) this.advance(G);
          break;
        }
        case 'kill': {
          if (s.missionKills >= step.count) this.advance(G);
          break;
        }
        case 'survive': {
          if (Math.ceil(s.wanted) < step.stars) {
            G.police.addWanted(G, step.stars - Math.ceil(s.wanted));
          }
          s.missionTimer -= dt;
          if (s.missionTimer <= 0) this.advance(G);
          break;
        }
        case 'race': {
          const pt = step.points[s.racePoint || 0];
          if (pt && Math.hypot(pt[0] - px, pt[1] - pz) < 10) {
            s.racePoint = (s.racePoint || 0) + 1;
            G.hud.flash(`CHECKPOINT ${s.racePoint}/${step.points.length}`);
            if (s.racePoint >= step.points.length) this.advance(G);
          }
          break;
        }
        case 'tail': {
          const d = Math.hypot(step.x - px, step.z - pz);
          if (d < 8) this.advance(G);
          else if (d > 60) { G.failMission('YOU LOST THE COURIER'); }
          break;
        }
        default: break;
      }
      return false;
    },
    advance(G) {
      const s = G.state;
      s.missionStep += 1;
      s.collected = 0; s.missionKills = 0; s.racePoint = 0;
      const m = MISSIONS[s.missionIndex];
      const step = m.steps[s.missionStep];
      if (!step) { this.complete(G); return; }
      s.missionTimer = step.time || 0;
      this.setupStep(G, step);
      G.hud.flash(m.steps[s.missionStep].text.toUpperCase());
    },
    setupStep(G, step) {
      const s = G.state;
      if (step.type === 'kill') {
        for (let i = 0; i < step.count; i++) {
          G.combat.spawnEnemy(step.x + (i % 2) * 6 - 3, step.z + Math.floor(i / 2) * 6 - 3);
        }
      }
      if (step.type === 'collect') {
        for (let i = 0; i < step.count; i++) {
          G.combat.spawnPickup(step.x + i * 4 - 4, step.z + (i % 2) * 4, 'cash');
        }
      }
      if (step.type === 'survive') {
        G.police.addWanted(G, step.stars);
      }
      if (step.type === 'race') {
        G.hud.flash('GET IN A BOAT AT THE MARINA!');
      }
    },
    start(G, index) {
      const s = G.state;
      s.missionIndex = index;
      s.missionStep = 0; s.collected = 0; s.missionKills = 0; s.racePoint = 0;
      const m = MISSIONS[index];
      if (!m) return;
      s.missionTimer = m.steps[0].time || 0;
      // Heist missions open the planning screen first.
      if (m.heist) { G.openHeistPlan(m.heist); return; }
      this.setupStep(G, m.steps[0]);
      G.hud.flash(`MISSION: ${m.name.toUpperCase()}`);
    },
    complete(G) {
      const s = G.state;
      const m = MISSIONS[s.missionIndex];
      if (!m) return false;
      const heistBonus = s.heistPlan && s.heistPlan.approach === 'quiet' ? 500 : 0;
      s.cash += m.pay + heistBonus;
      s.respect += m.respect;
      s.districts.add(s.player.x, s.player.z, 15);
      G.hud.flash(`MISSION COMPLETE: ${m.name.toUpperCase()} +$${m.pay + heistBonus}`);
      G.audio.beep(880, 0.2);
      // Crew recruitment milestones.
      const recruitMap = { 0: 'mara', 1: 'juno', 4: 'tayo', 6: 'wren' };
      const rid = recruitMap[s.missionIndex];
      if (rid) {
        const member = G.crew.recruit(rid, s.player.x, s.player.z);
        if (member) G.hud.flash(`${member.name.toUpperCase()} JOINED YOUR CREW!`);
      }
      s.missionIndex += 1;
      s.missionStep = 0; s.collected = 0; s.missionKills = 0; s.racePoint = 0;
      s.missionDone = true;
      G.save();
      if (s.missionIndex < MISSIONS.length) {
        this.start(G, s.missionIndex);
      } else {
        G.hud.flash('YOU ARE THE DELTA KING — TIDELINE IS YOURS');
        G.state.gameWon = true;
      }
      return true;
    },
    objectiveText(G) {
      const s = G.state;
      const m = MISSIONS[s.missionIndex];
      if (!m) return 'All missions complete — you are the Delta King!';
      const step = m.steps[s.missionStep];
      if (!step) return m.name;
      let t = `${m.name}: ${step.text}`;
      if (step.type === 'kill') t += ` (${s.missionKills}/${step.count})`;
      if (step.type === 'collect') t += ` (${s.collected}/${step.count})`;
      if (step.type === 'race') t += ` (${s.racePoint || 0}/${step.points.length})`;
      if (s.missionTimer > 0) t += ` — ${Math.ceil(s.missionTimer)}s`;
      return t;
    },
    beaconPos(G) {
      const s = G.state;
      const m = MISSIONS[s.missionIndex];
      if (!m) return null;
      const step = m.steps[s.missionStep];
      if (!step) return null;
      if (step.type === 'race') {
        const pt = step.points[s.racePoint || 0];
        return pt ? { x: pt[0], z: pt[1] } : null;
      }
      if (step.x !== undefined) return { x: step.x, z: step.z };
      return null;
    },
  };
}
