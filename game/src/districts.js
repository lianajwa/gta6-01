// District standing: each of Tideline's five districts tracks how much the
// locals respect you. Jobs and missions raise standing where they happen;
// high standing unlocks cheaper shops, crew side-job pay and safehouse perks.
import { DISTRICTS, districtAt } from './config.js';

export function createDistricts() {
  const standing = {};
  for (const d of DISTRICTS) standing[d.id] = 10;
  return {
    standing,
    at(x, z) { return districtAt(x, z); },
    add(x, z, amount) {
      const d = districtAt(x, z);
      standing[d.id] = Math.max(0, Math.min(100, standing[d.id] + amount));
      return d;
    },
    get(id) { return standing[id] ?? 0; },
    // Shop discount in a district: 0% below 50 standing, up to 25% at 100.
    discount(x, z) {
      const v = standing[districtAt(x, z).id] ?? 0;
      return v >= 50 ? Math.min(0.25, (v - 50) * 0.005) : 0;
    },
    // The district the player controls most — shown on the HUD.
    top() {
      let best = DISTRICTS[0], bv = -1;
      for (const d of DISTRICTS) if (standing[d.id] > bv) { bv = standing[d.id]; best = d; }
      return { district: best, value: bv };
    },
  };
}
