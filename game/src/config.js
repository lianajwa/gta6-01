// SOLMAR HEAT — open-world crime in Solmar Bay (an invented coastal city).
// Every tuning number, colour and story beat in one place. The world is a
// fixed 2600x1800 logical area; the camera follows the player, so no rule
// below depends on the screen size.

export const WORLD = { width: 2600, height: 1800 };

// Road centrelines. Vertical avenues and horizontal streets, 64 px wide.
export const AVENUES = [200, 520, 840, 1160, 1480, 1800];
export const STREETS = [200, 480, 760, 1040, 1320, 1560];
export const ROAD_W = 64;
export const BEACH_X = 2100; // east of here: sand, then ocean
export const WATER_X = 2280;

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walk: 175,
  sprint: 265,
  hp: 100,
  punchDamage: 25,
  punchRange: 36,
  punchArc: 1.1,
};

export const CAR = {
  length: 46,
  width: 22,
  radius: 20,
  accel: 340,
  brake: 520,
  reverseMax: 120,
  topSpeed: 330,
  turn: 2.6,
  drag: 0.55,
  hp: 100,
};

export const UPGRADES = {
  engine: { name: 'Turbo Engine', cost: 400, desc: '+55 top speed' },
  armor: { name: 'Plated Armor', cost: 350, desc: '+80 car health' },
  tires: { name: 'Grip Tires', cost: 250, desc: 'sharper handling' },
};

export const GUN = { name: 'Pistol', cost: 250, ammoCost: 50, ammoPack: 12, damage: 34, range: 420, fireDelay: 0.28 };

export const SHOPS = [
  { id: 'garage', name: "TIA'S GARAGE", x: 520, y: 1320, color: '#ffb020', blurb: 'Upgrades: Engine $400 (1) · Armor $350 (2) · Tires $250 (3)' },
  { id: 'guns', name: 'IRONWORKS', x: 1160, y: 200, color: '#ff5a4e', blurb: 'Pistol $250 (G) · Ammo $50 / 12 (H)' },
  { id: 'spray', name: 'SPRAY SHOP', x: 1800, y: 1560, color: '#37d67a', blurb: 'New paint, clean record — clears wanted, $150 (G)' },
  { id: 'clinic', name: 'CLINIC', x: 200, y: 760, color: '#4fc3f7', blurb: 'Patch up: full health $100 (G)' },
];

export const LANDMARKS = [
  { name: 'SOLMAR PIER', x: 2330, y: 900 },
  { name: 'THE DOCKS', x: 120, y: 1500 },
  { name: 'MARINA', x: 1950, y: 1500 },
  { name: 'DOWNTOWN', x: 1160, y: 760 },
  { name: 'PALM ROW', x: 1950, y: 480 },
  { name: 'KESSLER TOWER', x: 1025, y: 625 },
];

export const RANKS = [
  { at: 0, name: 'NOBODY' },
  { at: 200, name: 'STREET' },
  { at: 600, name: 'HUSTLER' },
  { at: 1200, name: 'SHOT CALLER' },
  { at: 2000, name: 'KINGPIN' },
];

// The story: Rico "Rook" Marlow, ex-wheelman, back in Solmar Bay to settle a
// debt with Dominic Kessler, the Commodore who owns the docks. Nadia Reyes
// talks him through it on the radio; Tia runs the garage; Bishop fixes jobs.
export const MISSIONS = [
  {
    id: 1, title: 'Welcome to Solmar', giver: 'NADIA',
    brief: ['Rook, you are back. Kessler thinks you are gone for good.', 'Meet me at the end of Solmar Pier. Walk — the city needs to see your face again.'],
    type: 'goto', x: 2330, y: 900, radius: 70, reward: 150, respect: 100,
    objective: 'Go to Solmar Pier',
  },
  {
    id: 2, title: 'First Wheels', giver: 'TIA',
    brief: ['A wheelman on foot is a joke, Rook. Take any car on the street —', 'the cops will notice, so be quick — and bring it to my garage.'],
    type: 'steal', x: 520, y: 1320, radius: 80, reward: 250, respect: 150,
    objective: "Steal a car (E), then drive it to Tia's Garage",
  },
  {
    id: 3, title: 'The Drop', giver: 'BISHOP',
    brief: ['A package is waiting at the Docks. Marina, 75 seconds, no stops.', "Kessler's boys watch the coast road. Take the back streets."],
    type: 'deliver', pickX: 120, pickY: 1500, x: 1950, y: 1500, radius: 80, seconds: 75, reward: 400, respect: 200,
    objective: 'Pick up the package at the Docks, deliver to the Marina (75s)',
  },
  {
    id: 4, title: 'Heat Wave', giver: 'NADIA',
    brief: ['Kessler put a price on you. Two stars and climbing.', 'Stay alive for 60 seconds. Lose them or outrun them — your call.'],
    type: 'survive', seconds: 60, minStars: 2, reward: 500, respect: 200,
    objective: 'Survive 60s with at least 2 wanted stars',
  },
  {
    id: 5, title: 'Dockside Debt', giver: 'BISHOP',
    brief: ["Three of Kessler's enforcers are shaking down the Docks.", 'Make it loud. Make it final.'],
    type: 'kill', count: 3, spawnX: 120, spawnY: 1500, reward: 650, respect: 250,
    objective: 'Take out 3 enforcers at the Docks',
  },
  {
    id: 6, title: 'Coast Run', giver: 'TIA',
    brief: ['The Coast Run. Four gates down Palm Row, 90 seconds.', 'Win it and every crew in Solmar knows your name.'],
    type: 'race', seconds: 90, reward: 800, respect: 300,
    points: [{ x: 1950, y: 200 }, { x: 1950, y: 760 }, { x: 1950, y: 1320 }, { x: 1950, y: 1560 }],
    objective: 'Race through 4 gates down Palm Row (90s)',
  },
  {
    id: 7, title: 'Silent Partner', giver: 'NADIA',
    brief: ["Kessler's courier drives the loop every night. Tail him.", 'Stay close enough to see, far enough not to be seen. 20 seconds.'],
    type: 'tail', seconds: 20, reward: 900, respect: 300,
    objective: 'Tail the courier for 20s — stay within range, do not lose him',
  },
  {
    id: 8, title: 'Bay Heist: Gear Up', giver: 'BISHOP',
    brief: ['The big one needs gear: three crates stashed around the city.', 'Grab all three, bring them to the hideout. No cops, no noise.'],
    type: 'collect', x: 840, y: 480, radius: 80, reward: 1100, respect: 350,
    crates: [{ x: 200, y: 480 }, { x: 1480, y: 1040 }, { x: 1800, y: 200 }],
    objective: 'Collect 3 crates, deliver them to the Hideout',
  },
  {
    id: 9, title: "The Commodore's Convoy", giver: 'TIA',
    brief: ["Kessler's convoy car is rolling through Downtown.", 'Stop it. Ram it, shoot it — just stop it before it reaches the Docks.'],
    type: 'chase', seconds: 120, reward: 1400, respect: 400,
    objective: 'Stop the convoy car — smash it until it stalls',
  },
  {
    id: 10, title: 'King of Solmar', giver: 'NADIA',
    brief: ['This is it. Kessler\'s guards hold the Tower. Take them down,', 'then survive the storm. When the heat fades, Solmar is yours.'],
    type: 'finale', count: 5, spawnX: 1160, spawnY: 620, seconds: 45, reward: 2500, respect: 600,
    objective: 'Clear 5 guards at Kessler Tower, then survive 45s at 4 stars',
  },
];

export const PALETTE = {
  sky: '#1c2b4a',
  grass: '#3f7a4a',
  grassDark: '#356b40',
  sand: '#d9b77c',
  water: '#1d6f8e',
  waterDeep: '#155a75',
  road: '#2e3138',
  roadEdge: '#4a4f5a',
  lane: '#e8d44d',
  sidewalk: '#6b6f78',
  building: '#8a6f5c',
  roof: '#a8876d',
  text: '#f2f0e8',
  muted: '#b9b3a4',
  accent: '#ffb020',
  danger: '#ff5a4e',
  good: '#37d67a',
  police: '#4fc3f7',
  panel: 'rgba(12,16,26,0.88)',
  panelEdge: '#ffb020',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-heat.save.v1';
export const BEST_KEY = 'solmar-heat.best.v1';

export const RADIO = [
  { name: 'SOLMAR FM 88.1', show: 'Sunset Drive', tracks: ['Palm Shadows — The Marinas', 'Gold Hour — Vega Ray', 'Neon Coast — Lumen Bay'] },
  { name: 'BAY 104', show: 'Neon Nights', tracks: ['Midnight Overdrive — Kessler Kids', 'Chrome Hearts — Nadia', 'Afterglow — The Commodores'] },
  { name: 'DOCKS 96.5', show: 'Bassline', tracks: ['Heavy Water — Dockside', 'Low Tide — Rook', 'Sirens — Blue Line'] },
];
