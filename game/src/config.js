// TIDELINE — Delta Kings: world constants, districts, crew, missions, heists, shops.
// All names, places and story are original inventions for this game.
export const WORLD = { size: 480, half: 240, roadWidth: 10, canalHalf: 12 };
export const ROADS = [-180, -120, -60, 0, 60, 120, 180];
export const STEP = 1 / 60;

export const DISTRICTS = [
  { id: 'oldtown', name: 'Old Town', color: '#c9a227', x0: -240, z0: -240, x1: 0, z1: 0, desc: 'Crumbling canalside houses and old money.' },
  { id: 'market', name: 'Market Row', color: '#2ecc71', x0: 0, z0: -240, x1: 240, z1: 0, desc: 'Stalls, spice and smugglers by daylight.' },
  { id: 'neon', name: 'Neon Strip', color: '#e84393', x0: 0, z0: 0, x1: 240, z1: 200, desc: 'Casinos, clubs and bright lights.' },
  { id: 'marina', name: 'Marina', color: '#3498db', x0: -240, z0: 200, x1: 240, z1: 240, desc: 'Boats, docks and the tide coming in.' },
  { id: 'canal', name: 'Canal Quarter', color: '#9b59b6', x0: -240, z0: 0, x1: 0, z1: 200, desc: 'Bridges, warehouses and quiet water.' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[3];
}

export const RANKS = [
  { name: 'Nobody', need: 0 },
  { name: 'Deckhand', need: 100 },
  { name: 'Hustler', need: 300 },
  { name: 'Shot Caller', need: 600 },
  { name: 'Delta King', need: 1000 },
];
export function rankFor(respect) {
  let r = RANKS[0];
  for (const cand of RANKS) if (respect >= cand.need) r = cand;
  return r.name;
}

export const CREW_DEFS = [
  { id: 'mara', name: 'Mara Voss', role: 'Driver', bonus: '+15% car speed & handling', color: '#e74c3c', recruit: 'Finish mission 1' },
  { id: 'juno', name: 'Juno Park', role: 'Hacker', bonus: 'Wanted fades twice as fast', color: '#2ecc71', recruit: 'Finish mission 2' },
  { id: 'tayo', name: 'Big Tayo', role: 'Muscle', bonus: '+50% gun damage, fights beside you', color: '#f39c12', recruit: 'Finish mission 5' },
  { id: 'wren', name: 'Wren', role: 'Lookout', bonus: 'Police & roadblocks marked on map', color: '#9b59b6', recruit: 'Finish mission 7' },
];

// Steps: goto {x,z} | collect {x,z,count} | kill {x,z,count} | survive {time,stars}
//        race {points:[[x,z]...]} | tail {x,z} | escape {x,z}
export const MISSIONS = [
  { name: 'First Tide', giver: 'Mara Voss', pay: 300, respect: 100,
    intro: 'You wash up in Tideline with nothing but a name. Mara needs a runner — meet her at Market Row.',
    steps: [{ type: 'goto', x: 120, z: -120, text: 'Meet Mara at Market Row' }] },
  { name: 'Hot Wheels', giver: 'Mara Voss', pay: 400, respect: 100,
    intro: 'Mara needs wheels. Steal any traffic car (E) and bring it to the garage on Canal Quarter.',
    steps: [
      { type: 'steal', text: 'Steal a car — walk up to traffic and press E' },
      { type: 'goto', x: -120, z: 120, text: 'Drive the car to Tia\'s Garage' }] },
  { name: 'The Drop', giver: 'Juno Park', pay: 600, respect: 120,
    intro: 'A package for the Marina, and the clock is already running. 90 seconds. No excuses.',
    steps: [{ type: 'goto', x: -60, z: 215, time: 90, text: 'Deliver the package to the Marina — 90s' }] },
  { name: 'Heat Wave', giver: 'Mara Voss', pay: 700, respect: 120,
    intro: 'The cops are sweeping the Strip. Make noise, then survive 2 stars for 60 seconds.',
    steps: [{ type: 'survive', time: 60, stars: 2, text: 'Survive 2 wanted stars for 60s' }] },
  { name: 'Dockside Debt', giver: 'Big Tayo', pay: 900, respect: 150,
    intro: 'The Docks crew owes Tayo money and answers with guns. Settle it at the Canal Quarter docks.',
    steps: [{ type: 'kill', x: -180, z: 60, count: 4, text: 'Take out 4 Dock enforcers' }] },
  { name: 'Canal Run', giver: 'Mara Voss', pay: 1000, respect: 150,
    intro: 'A boat race through the canals. Grab a boat at the Marina and hit every checkpoint.',
    steps: [{ type: 'race', points: [[-60, 30], [30, -60], [120, 30], [30, 180], [-120, 30]], text: 'Boat race — hit all 5 checkpoints' }] },
  { name: 'Silent Partner', giver: 'Juno Park', pay: 1100, respect: 150,
    intro: 'Tail the courier across the Neon Strip. Stay close, stay unseen — do not get spotted.',
    steps: [{ type: 'tail', x: 120, z: 120, text: 'Tail the courier through the Neon Strip' }] },
  { name: 'Marina Heist', giver: 'The Crew', pay: 2500, respect: 200, heist: 'marina',
    intro: 'The big one: the Marina vault. Plan it first — Loud or Quiet, pick your crew, pick the getaway.',
    steps: [
      { type: 'collect', x: -60, z: 215, count: 3, text: 'Grab 3 vault crates at the Marina' },
      { type: 'escape', x: -180, z: -180, text: 'Escape to the Old Town safehouse' }] },
  { name: "The Commodore's Convoy", giver: 'Big Tayo', pay: 2000, respect: 200,
    intro: 'The Commodore moves his money in a convoy down Market Row. Stop the lead car and take the case.',
    steps: [
      { type: 'kill', x: 120, z: -60, count: 3, text: 'Stop the convoy — take out 3 guards' },
      { type: 'collect', x: 120, z: -60, count: 1, text: 'Grab the money case' }] },
  { name: 'Delta King', giver: 'Tideline', pay: 5000, respect: 300,
    intro: 'The Commodore himself, on the Neon Strip, with every cop in the city behind him. End it.',
    steps: [
      { type: 'kill', x: 120, z: 120, count: 6, text: 'Take out the Commodore\'s 6 enforcers' },
      { type: 'survive', time: 45, stars: 4, text: 'Survive 4 wanted stars for 45s — become Delta King' }] },
];

export const HEISTS = [
  { id: 'marina', name: 'Marina Vault', cut: 2500, desc: 'Crack the vault under the Marina. Loud brings the cops; Quiet needs Juno.' },
  { id: 'neon', name: 'Neon Casino', cut: 4000, desc: 'The casino cage on the Neon Strip. Unlocks after mission 6 — talk to Mara at the safehouse.', unlockMission: 6 },
];

export const SHOPS = [
  { id: 'gun', name: 'Ironworks Gun Shop', x: 60, z: -180, color: '#e74c3c', desc: 'Pistol $500 · Ammo $50' },
  { id: 'garage', name: "Tia's Garage", x: -120, z: 120, color: '#f39c12', desc: 'Turbo $800 · Armor $600 · Grip $400' },
  { id: 'spray', name: 'Spray Shop', x: 180, z: 60, color: '#2ecc71', desc: 'Clean record $200' },
  { id: 'clinic', name: 'Clinic', x: -180, z: -60, color: '#ecf0f1', desc: 'Full heal $150' },
  { id: 'safehouse', name: 'Safehouse', x: -180, z: -180, color: '#9b59b6', desc: 'Save · Heist board · Crew jobs' },
];

export const SAVE_KEY = 'tideline-delta-kings-save-v1';
