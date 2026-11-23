// crew.js: the crew of four. Each member's bonus is a real multiplier the
// systems read — Driver for cars, Hacker for heist timers, Muscle for health,
// Lookout for wanted warnings and decay. The crew is hired with respect:
// the more the player has done, the more of the crew will ride along.
import { CREW } from './config.js';

export function createCrew() {
  // All four ride from the start in this build: the story introduces them in
  // the first three missions, and their bonuses are the point of the crew.
  const hired = new Set(CREW.map((c) => c.id));
  return {
    list: CREW,
    hired,
    has(id) { return hired.has(id); },
    get driver() { return hired.has('mara'); },
    get hacker() { return hired.has('juno'); },
    get muscle() { return hired.has('bram'); },
    get lookout() { return hired.has('sable'); },
    maxHp() { return 100 + (hired.has('bram') ? 50 : 0); },
    topSpeedMul() { return hired.has('mara') ? 1.12 : 1; },
    gripMul() { return hired.has('mara') ? 1.25 : 1; },
    heistTimeMul() { return hired.has('juno') ? 0.7 : 1; },
    wantedDecayMul() { return hired.has('sable') ? 2 : 1; },
    names() { return CREW.filter((c) => hired.has(c.id)).map((c) => `${c.name} · ${c.role}`).join('  '); },
    // One line per hired member with the bonus they actually give, for the
    // start screen: the bonuses are the point of the crew, so show them.
    bonusText() {
      const parts = [];
      if (hired.has('mara')) parts.push('Mara · Driver: +12% top speed, +25% grip');
      if (hired.has('juno')) parts.push('Juno · Hacker: −30% heist timers');
      if (hired.has('bram')) parts.push('Bram · Muscle: +50 max HP');
      if (hired.has('sable')) parts.push('Sable · Lookout: wanted warning, faster decay');
      return parts.join(' &nbsp;·&nbsp; ');
    },
  };
}
