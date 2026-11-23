// heists.js: two staged heists with a planning phase. The player picks Loud
// (fast, more guards, less pay) or Quiet (slow, fewer guards, more pay) at a
// planning board, then runs the stages. Juno the Hacker cuts every timer 30%.
import { HEISTS } from './config.js';

export function createHeists(onEvent) {
  const state = {
    planning: null, // heist being planned
    active: null, // {heist, plan, stage, timer, guardsLeft}
    done: {}, // heist id -> 'loud' | 'quiet'
  };

  function planTime(heist, plan, hacker) {
    const base = heist[plan].time;
    return hacker ? Math.round(base * 0.7) : base;
  }

  return {
    state,
    openPlanning(heistId) {
      const h = HEISTS.find((x) => x.id === heistId);
      if (!h || state.done[h.id] || state.active) return null;
      state.planning = h;
      onEvent({ type: 'heist-plan', heist: h });
      return h;
    },
    closePlanning() { state.planning = null; },
    startPlan(plan, hacker) {
      const h = state.planning;
      if (!h) return null;
      if (plan !== 'loud' && plan !== 'quiet') return null; // unknown plan
      const time = planTime(h, plan, hacker);
      state.active = { heist: h, plan, stage: 1, timer: time, guardsLeft: h[plan].guards, total: time };
      state.planning = null;
      onEvent({ type: 'heist-start', heist: h, plan, time });
      return state.active;
    },
    update(dt, ctx) {
      const a = state.active;
      if (!a) return null;
      a.timer -= dt;
      if (a.guardsLeft <= 0 && a.stage === 1) {
        a.stage = 2;
        onEvent({ type: 'heist-stage', heist: a.heist, stage: 2 });
      }
      if (a.stage === 2 && ctx.atEscape) {
        const pay = a.heist[a.plan].pay;
        state.done[a.heist.id] = a.plan;
        onEvent({ type: 'heist-done', heist: a.heist, plan: a.plan, pay });
        const done = { heist: a.heist, plan: a.plan, pay };
        state.active = null;
        return done;
      }
      if (a.timer <= 0) {
        onEvent({ type: 'heist-failed', heist: a.heist });
        state.active = null;
        return { failed: a.heist };
      }
      return null;
    },
    guardDown() {
      if (state.active) state.active.guardsLeft = Math.max(0, state.active.guardsLeft - 1);
    },
    statusText() {
      if (state.active) {
        const a = state.active;
        return `HEIST: ${a.heist.name} (${a.plan}) — stage ${a.stage}/2 — ${Math.ceil(a.timer)}s — guards ${a.guardsLeft}`;
      }
      if (state.planning) return `Plan ${state.planning.name}: LOUD or QUIET?`;
      return null;
    },
    list() { return HEISTS; },
  };
}
