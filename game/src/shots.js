// shots.js: deterministic screenshot poses. The game reads ?shot=<name>&seed=1
// and, before the first rendered frame, teleports the player/camera and sets
// the world state for that shot — so headless Chromium produces the same
// frame every time. Poses show the game at its best: on foot, driving,
// a wanted chase, and a heist at the marina.
export const SHOTS = {
  start: {
    mode: 'foot', x: -140, z: -90, heading: 0.5, cam: 'follow',
    wanted: 0, mission: 1, text: 'dusk avenue, on foot',
  },
  drive: {
    mode: 'car', x: -30, z: 80, heading: Math.PI / 2, cam: 'chase',
    wanted: 0, speed: 30, text: 'red car on the bridge, water both sides',
  },
  chase: {
    mode: 'car', x: 60, z: -60, heading: -0.6, cam: 'chase',
    wanted: 3, speed: 34, text: 'wanted 3, police car ahead',
  },
  heist: {
    mode: 'foot', x: 175, z: 160, heading: -2.2, cam: 'wide',
    wanted: 0, heist: 'harbor', text: 'marina, boats, heist pillar, crew',
  },
};

export function parseShot() {
  const q = new URLSearchParams(location.search);
  const name = q.get('shot');
  const seed = Number(q.get('seed') || '1');
  const selftest = q.get('selftest') === '1';
  return { name: SHOTS[name] ? name : null, shot: SHOTS[name] || null, seed, selftest };
}

// Apply a pose to the live game state. Called once, before the first frame.
export function applyShot(game, shotName) {
  const s = SHOTS[shotName];
  if (!s || !game) return false;
  const g = game;
  if (s.mode === 'car') {
    g.enterVehicle('car', s.x, s.z, s.heading, 0xd83a2e);
    g.vehicle.speed = s.speed ?? 20;
  } else {
    g.placePlayer(s.x, s.z, s.heading);
  }
  if (s.wanted) g.setWanted(s.wanted);
  if (s.mission) g.gotoMission(s.mission);
  if (s.heist) g.openHeist(s.heist);
  g.cameraMode = s.cam;
  g.shotPose = shotName;
  return true;
}
