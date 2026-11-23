// TIDELINE — Delta Kings: all tuning, world layout and story data in one place.
// The city is "Tideline", a river-delta canal city at dusk. Everything the other
// modules need — districts, prices, crew, missions, heists, radio — lives here so
// a single edit retunes the whole game.

export const WORLD = {
  size: 560, // playable square, metres; ground plane is a little larger
  waterLevel: 0.02, // water sits just below the land slabs (0.06) so it only
  // shows through the canal gaps; roads (0.12) and bridges (0.14) stay dry
  groundY: 0,
  seed: 1,
};

export const DUSK = {
  skyTop: 0x1d2f66, // deep blue zenith
  skyHorizon: 0xff8c42, // orange horizon
  fogColor: 0xe8907a, // rose fog
  fogNear: 120,
  fogFar: 520,
  sunColor: 0xffb36b,
  sunIntensity: 2.4,
  sunPosition: [-180, 55, -120],
  hemiSky: 0x8a7fd0,
  hemiGround: 0x3a2a22,
  hemiIntensity: 0.75,
  ambient: 0x604a55,
};

// Five districts, each with its own look. x/z are the district centres, r the radius.
export const DISTRICTS = [
  {
    id: 'oldtown', name: 'Old Town', x: -150, z: -120, r: 95,
    style: 'terracotta', roof: 'pitched', palette: [0xc96f3f, 0xd98a4e, 0xb45a34, 0xe0a45e],
    roofColor: 0x8a4a2a, floors: [1, 2], density: 30,
  },
  {
    id: 'market', name: 'Market Row', x: 40, z: -140, r: 90,
    style: 'midrise', roof: 'flat', palette: [0xe8b13c, 0x4fae8d, 0xd95f4b, 0x5b8dd9, 0xe07ba8],
    roofColor: 0x5a4a3a, floors: [2, 4], density: 26, stalls: 14,
  },
  {
    id: 'neon', name: 'Neon Strip', x: 160, z: -40, r: 85,
    style: 'tower', roof: 'stepped', palette: [0x2e3a5c, 0x3a2a55, 0x24344a, 0x4a2a4a],
    roofColor: 0x1a1a26, floors: [5, 9], density: 20,
    neon: [0xff2e88, 0x00e5ff, 0xffe14d, 0x7cff5e, 0xff6a00],
  },
  {
    id: 'marina', name: 'Marina', x: 150, z: 130, r: 95,
    style: 'lowwhite', roof: 'flat', palette: [0xf2ede2, 0xdfe9ef, 0xffffff, 0xcfe0ea],
    roofColor: 0x7a8a99, floors: [1, 2], density: 24, docks: true,
  },
  {
    id: 'canal', name: 'Canal Quarter', x: -140, z: 130, r: 90,
    style: 'warehouse', roof: 'gable', palette: [0x9a5a3c, 0x7a4a34, 0xa86a44, 0x8a5a40],
    roofColor: 0x4a3a2e, floors: [1, 3], density: 26,
  },
];

// Two canals cut the city; bridges cross them. Boats live on the water.
export const CANALS = [
  { id: 'north', x: -60, z: -40, w: 26, len: 560, axis: 'x' }, // east-west canal
  { id: 'south', x: 40, z: 80, w: 22, len: 560, axis: 'x' },
];
export const BRIDGES = [
  { x: -190, z: -40, w: 14 }, { x: -20, z: -40, w: 14 }, { x: 150, z: -40, w: 14 },
  { x: -190, z: 80, w: 12 }, { x: -30, z: 80, w: 12 }, { x: 170, z: 80, w: 12 },
];
export const MARINA = { x: 190, z: 170, boats: 6 };

// Driving feel: weighty, arcade, driftable.
export const DRIVE = {
  accel: 16, brake: 34, reverseAccel: 10, maxSpeed: 46, maxReverse: 12,
  steerMax: 0.62, steerSpeed: 2.6, grip: 3.4, driftGrip: 1.15,
  handbrakeBleed: 0.55, drag: 0.35, offroadDrag: 1.4,
  hitSpeedLoss: 0.72, hitDamage: 18, cameraShake: 0.5,
  fovBase: 62, fovKick: 11, lookAhead: 7,
};
export const BOAT = { accel: 9, maxSpeed: 26, steer: 1.1, drag: 0.5, turn: 1.6 };
export const PLAYER = { walk: 6, run: 10, hp: 100, jump: 0 };

export const WANTED = {
  decayPerSec: 0.06, stealCar: 1, shoot: 1, kill: 1, speedNearCop: 0.5,
  roadblockAt: 3, heliAt: 4, maxStars: 5,
  copCarSpeed: 34, heliSpeed: 40, spawnRadius: 60,
};

export const ECONOMY = {
  startCash: 650, startRespect: 0,
  ranks: ['Nobody', 'Hustler', 'Runner', 'Kingpin', 'Delta King'],
  rankAt: [0, 150, 400, 800, 1400],
  prices: { pistol: 450, pistolAmmo: 40, repair: 120, spray: 90, clinic: 150, boat: 2500 },
  missionPay: [300, 450, 600, 750, 900, 1100, 1300, 1600, 2000, 2600],
  respectPay: [40, 55, 70, 85, 100, 120, 140, 160, 190, 240],
};

// Crew of four. Each bonus is real and applied in the systems that use it.
export const CREW = [
  { id: 'mara', name: 'Mara', role: 'Driver', bonus: 'handling', text: '+12% top speed, +25% grip' },
  { id: 'juno', name: 'Juno', role: 'Hacker', bonus: 'hacker', text: '−30% heist timers' },
  { id: 'bram', name: 'Bram', role: 'Muscle', bonus: 'muscle', text: '+50 max HP' },
  { id: 'sable', name: 'Sable', role: 'Lookout', bonus: 'lookout', text: 'wanted warning + faster decay' },
];

// Ten story missions, a chain across the delta.
export const MISSIONS = [
  { id: 1, name: 'First Light', giver: 'Mara', x: -150, z: -120, district: 'oldtown', text: 'Meet Mara in Old Town and take the courier job.', pay: 0, kind: 'goto' },
  { id: 2, name: 'Hot Wheels', giver: 'Mara', x: 40, z: -140, district: 'market', text: 'Steal a car from Market Row and bring it to the garage.', pay: 1, kind: 'steal' },
  { id: 3, name: 'River Run', giver: 'Juno', x: 150, z: 130, district: 'marina', text: 'Take a boat from the Marina and run the north canal.', pay: 2, kind: 'boat' },
  { id: 4, name: 'Neon Nights', giver: 'Sable', x: 160, z: -40, district: 'neon', text: 'Lose a 2-star tail on the Neon Strip.', pay: 3, kind: 'evade' },
  { id: 5, name: 'Warehouse Blues', giver: 'Bram', x: -140, z: 130, district: 'canal', text: 'Clear the Canal Quarter warehouse of rivals.', pay: 4, kind: 'combat' },
  { id: 6, name: 'The Fixer', giver: 'Mara', x: 40, z: -140, district: 'market', text: 'Collect the package in Market Row and deliver it to Old Town.', pay: 5, kind: 'deliver' },
  { id: 7, name: 'High Tide', giver: 'Juno', x: 150, z: 130, district: 'marina', text: 'Win the Tide Trial: 5 buoys, beat 75 seconds.', pay: 6, kind: 'trial' },
  { id: 8, name: 'King of the Strip', giver: 'Sable', x: 160, z: -40, district: 'neon', text: 'Win a street race across the Neon Strip.', pay: 7, kind: 'race' },
  { id: 9, name: 'Delta Kings', giver: 'Bram', x: -140, z: 130, district: 'canal', text: 'Defend the Canal Quarter safehouse from a raid.', pay: 8, kind: 'defend' },
  { id: 10, name: 'The Last Tide', giver: 'Mara', x: -150, z: -120, district: 'oldtown', text: 'The final job: hit the convoy and bring it home.', pay: 9, kind: 'finale' },
];

// Two staged heists with a planning phase: Loud or Quiet.
export const HEISTS = [
  {
    id: 'vault', name: 'The Vault Job', x: 160, z: -40, district: 'neon',
    loud: { time: 150, guards: 8, pay: 4200 }, quiet: { time: 240, guards: 3, pay: 5200 },
    text: 'Crack the Neon Strip vault. Loud is fast and hot; Quiet pays more.',
  },
  {
    id: 'harbor', name: 'Harbor Nights', x: 150, z: 130, district: 'marina',
    loud: { time: 120, guards: 6, pay: 3600 }, quiet: { time: 200, guards: 2, pay: 4600 },
    text: 'Lift the cargo off the Marina docks before the tide turns.',
  },
];

// Tide Trial: 5 orange buoys on a water-only course.
export const TRIAL = {
  buoys: [
    { x: 200, z: 150 }, { x: 210, z: 60 }, { x: 120, z: -40 },
    { x: -20, z: -40 }, { x: -120, z: -40 },
  ],
  start: { x: 190, z: 170 }, par: 75, pay: 300, respect: 25,
};

export const RADIO = [
  { id: 'delta', name: 'DELTA FM', desc: 'sunset synth', wave: 'sawtooth', bpm: 96, root: 110 },
  { id: 'neon', name: 'NEON 88', desc: 'night drive electro', wave: 'square', bpm: 122, root: 130.8 },
  { id: 'tide', name: 'TIDE RADIO', desc: 'lazy delta blues', wave: 'triangle', bpm: 72, root: 98 },
];

export const SAFEHOUSE = { x: -150, z: -100, district: 'oldtown' };
export const SHOPS = {
  gun: { x: 30, z: -120, name: 'Gun Shop' },
  garage: { x: 60, z: -150, name: 'Garage' },
  spray: { x: -120, z: -140, name: 'Spray Shop' },
  clinic: { x: 140, z: 110, name: 'Clinic' },
};
