// SOLMAR HEAT — the game's rules and state, with no drawing and no browser
// in it: the city, the player on foot and in cars, traffic, pedestrians,
// police and the wanted system, combat, shops, the 10-mission story, saves.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react without the world knowing about screens or sound.
import {
  AVENUES, STREETS, ROAD_W, WORLD, BEACH_X, WATER_X, STEP, PLAYER, CAR,
  UPGRADES, GUN, SHOPS, MISSIONS, RANKS, SAVE_KEY,
} from './config.js';
import { pick, range } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION = 8;
export const EVENT_OVER = 16;
export const EVENT_BUSTED = 32;
export const EVENT_CRASH = 64;
export const EVENT_WANTED = 128;

const CAR_COLORS = ['#e8e8e8', '#c0392b', '#2e86c1', '#f1c40f', '#7d3c98', '#16a085', '#e67e22', '#5d6d7e', '#ec7063', '#48c9b0'];
const PED_COLORS = ['#f39c12', '#8e44ad', '#3498db', '#e74c3c', '#1abc9c', '#d35400', '#7f8c8d', '#c0c0c0', '#f5b7b1', '#a9dfbf'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function onRoad(x, y) {
  for (const a of AVENUES) if (Math.abs(x - a) < ROAD_W / 2 + 8) return true;
  for (const s of STREETS) if (Math.abs(y - s) < ROAD_W / 2 + 8) return true;
  return false;
}

function nearestRoadPoint(random, x, y) {
  // A point on a sidewalk beside a road, near (x, y).
  const avenue = AVENUES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const street = STREETS.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  if (Math.abs(x - avenue) < Math.abs(y - street)) {
    return { x: avenue + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14), y: clamp(y + range(random, -160, 160), 60, WORLD.height - 60) };
  }
  return { x: clamp(x + range(random, -160, 160), 60, BEACH_X - 40), y: street + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14) };
}

export function createWorld(random) {
  // ---- city generation (seeded, so every run builds the same Solmar) ----
  const buildings = [];
  const palms = [];
  const towerColors = ['#7a5a44', '#8a6f5c', '#6b4f3a', '#93755c', '#5d4a3a', '#a8876d'];
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      if (x1 > BEACH_X - 30) continue; // beach blocks stay open
      const downtown = Math.abs((x0 + x1) / 2 - 1160) < 420 && Math.abs((y0 + y1) / 2 - 760) < 420;
      const count = downtown ? 1 : 2 + Math.floor(random() * 2);
      for (let b = 0; b < count; b += 1) {
        const w = range(random, 90, Math.min(190, (x1 - x0) / count - 16));
        const h = range(random, 80, Math.min(170, y1 - y0 - 16));
        const bx = x0 + ((x1 - x0) / count) * b + range(random, 4, Math.max(5, (x1 - x0) / count - w - 8));
        const by = y0 + range(random, 4, Math.max(5, y1 - y0 - h - 8));
        // Keep clear of the Kessler Tower's footprint.
        if (bx < 1110 && bx + w > 940 && by < 710 && by + h > 540) continue;
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(random, towerColors),
          roof: pick(random, ['#b08d6a', '#c9a06a', '#7d8a96', '#9c7b54']),
          tall: downtown && random() < 0.6,
        });
      }
    }
  }
  // Kessler Tower: the tall landmark in Downtown, placed INSIDE its block —
  // never on a road. (An earlier draft put it on avenue 1160, where every
  // car drove straight into it.)
  buildings.push({ x: 960, y: 560, w: 130, h: 130, color: '#3a3f4a', roof: '#ffb020', tall: true, tower: true });
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: range(random, 2060, 2240), y: range(random, 80, 1720) });
  }
  for (let i = 0; i < 14; i += 1) {
    const a = pick(random, AVENUES);
    const s = pick(random, STREETS);
    palms.push({ x: a + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12), y: s + range(random, -120, 120) });
  }

  const state = {
    time: 0,
    player: {
      x: 1160, y: 900, angle: -Math.PI / 2, hp: PLAYER.hp, armor: 0,
      inCar: false, carId: -1, cash: 200, respect: 0, hasGun: false, ammo: 0,
      upgrades: { engine: false, armor: false, tires: false },
      fireCd: 0, punchCd: 0, bustedTimer: 0, sprinting: false,
    },
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    buildings,
    palms,
    wanted: 0,
    hiddenTimer: 0,
    heli: null,
    heliTimer: 0,
    missionIndex: 0,
    mission: null,
    briefing: null,
    missionDelay: 0,
    storyDone: false,
    prompt: '',
    objective: 'Explore Solmar Bay',
    target: null,
    message: '',
    messageTimer: 0,
    stats: { missionsDone: 0, carsStolen: 0, cashEarned: 0, shotsFired: 0 },
    events: 0,
    sirenTimer: 0,
    spawnTimer: 0,
    cashTimer: 8,
  };

  function rankName() {
    let name = RANKS[0].name;
    for (const r of RANKS) if (state.player.respect >= r.at) name = r.name;
    return name;
  }

  function buildingHit(x, y, r) {
    for (const b of state.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  function inWater(x, y) {
    if (x < WATER_X) return false;
    // The pier is walkable: a boardwalk out into the bay.
    if (y > 860 && y < 940 && x < 2480) return false;
    return true;
  }

  function blocked(x, y, r) {
    if (x < 20 + r || x > WORLD.width - 20 - r || y < 20 + r || y > WORLD.height - 20 - r) return true;
    if (inWater(x, y)) return true;
    return buildingHit(x, y, r) !== null;
  }

  function moveBody(body, dx, dy, r) {
    if (!blocked(body.x + dx, body.y, r)) body.x += dx;
    if (!blocked(body.x, body.y + dy, r)) body.y += dy;
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x, y,
        vx: range(random, -speed, speed), vy: range(random, -speed, speed),
        life: range(random, 0.25, 0.6), max: 0.6, color, size: range(random, 2, 5),
      });
    }
  }

  function setMessage(text, seconds = 3) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function addWanted(amount) {
    const before = Math.ceil(state.wanted);
    state.wanted = clamp(state.wanted + amount, 0, 5);
    if (Math.ceil(state.wanted) > before) state.events |= EVENT_WANTED;
    state.hiddenTimer = 0;
  }

  // ---- entities ----
  function spawnTrafficCar(x, y, heading) {
    const color = pick(random, CAR_COLORS);
    const cruise = range(random, 90, 150);
    return {
      x, y, heading, speed: cruise, cruise, color, kind: 'traffic',
      hp: CAR.hp, maxHp: CAR.hp, angle: heading === 0 ? 0 : heading === 1 ? Math.PI : heading === 2 ? Math.PI / 2 : -Math.PI / 2,
      target: null, dead: false, smoke: 0,
    };
  }

  function spawnPed(x, y) {
    const t = nearestRoadPoint(random, x, y);
    return { x, y, tx: t.x, ty: t.y, speed: range(random, 40, 70), color: pick(random, PED_COLORS), flee: 0, fx: 0, fy: 0, dead: false };
  }

  function spawnCopCar() {
    const angle = random() * Math.PI * 2;
    const x = clamp(state.player.x + Math.cos(angle) * 560, 80, BEACH_X - 80);
    const y = clamp(state.player.y + Math.sin(angle) * 560, 80, WORLD.height - 80);
    const road = nearestRoadPoint(random, x, y);
    return {
      x: road.x, y: road.y, heading: 0, speed: 0, color: '#20242c', kind: 'police',
      hp: 120, maxHp: 120, angle: 0, target: null, dead: false, smoke: 0, siren: 0,
    };
  }

  function spawnFootCop() {
    const angle = random() * Math.PI * 2;
    const x = clamp(state.player.x + Math.cos(angle) * 320, 80, BEACH_X - 80);
    const y = clamp(state.player.y + Math.sin(angle) * 320, 80, WORLD.height - 80);
    return { x, y, tx: x, ty: y, speed: 150, color: '#20242c', cop: true, flee: 0, fx: 0, fy: 0, dead: false, bustedHold: 0 };
  }

  function spawnEnemy(x, y) {
    return { x, y, hp: 100, shootCd: range(random, 0.4, 1.2), angle: 0, dead: false };
  }

  function reset() {
    const p = state.player;
    p.x = 1160; p.y = 900; p.angle = -Math.PI / 2; p.hp = PLAYER.hp; p.armor = 0;
    p.inCar = false; p.carId = -1; p.cash = 200; p.respect = 0; p.hasGun = false; p.ammo = 0;
    p.upgrades = { engine: false, armor: false, tires: false };
    p.fireCd = 0; p.punchCd = 0; p.bustedTimer = 0;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.wanted = 0;
    state.hiddenTimer = 0;
    state.heli = null;
    state.missionIndex = 0;
    state.mission = null;
    state.briefing = null;
    state.missionDelay = 0.5;
    state.storyDone = false;
    state.time = 0;
    state.stats = { missionsDone: 0, carsStolen: 0, cashEarned: 0, shotsFired: 0 };
    state.objective = 'Explore Solmar Bay';
    state.target = null;
    state.message = '';
    state.messageTimer = 0;
    state.sirenTimer = 0;
    state.spawnTimer = 0;
    state.cashTimer = 8;
    state._colliding = new Set();
    // Traffic: 16 cars spread over the avenues and streets.
    for (let i = 0; i < 16; i += 1) {
      if (i % 2 === 0) {
        const a = pick(random, AVENUES);
        state.cars.push(spawnTrafficCar(a + (random() < 0.5 ? -16 : 16), range(random, 80, WORLD.height - 80), random() < 0.5 ? 2 : 3));
      } else {
        const s = pick(random, STREETS);
        state.cars.push(spawnTrafficCar(range(random, 80, BEACH_X - 80), s + (random() < 0.5 ? -16 : 16), random() < 0.5 ? 0 : 1));
      }
    }
    for (let i = 0; i < 26; i += 1) {
      state.peds.push(spawnPed(range(random, 120, BEACH_X - 100), range(random, 120, WORLD.height - 120)));
    }
  }

  // ---- missions ----
  function startMission(index) {
    const def = MISSIONS[index];
    if (!def) { state.storyDone = true; state.objective = 'Story complete — Solmar is yours. Free roam!'; return; }
    const m = {
      def, stage: 0, timer: def.seconds || 0, kills: 0, crates: 0,
      raceIndex: 0, tailTime: 0, loseTimer: 0, targetId: -1, phase: 0, phaseTimer: 0,
    };
    state.mission = m;
    state.briefing = { lines: [`${def.giver}: ${def.title}`, ...def.brief], t: 7 };
    state.objective = def.objective;
    if (def.type === 'kill' || def.type === 'finale') {
      for (let i = 0; i < def.count; i += 1) {
        state.enemies.push(spawnEnemy(def.spawnX + range(random, -90, 90), def.spawnY + range(random, -90, 90)));
      }
    }
    if (def.type === 'survive') {
      state.wanted = Math.max(state.wanted, def.minStars);
    }
    if (def.type === 'tail') {
      const car = spawnTrafficCar(1160, 760, 0);
      car.kind = 'target';
      car.color = '#8e44ad';
      car.speed = 170;
      car.hp = 9999;
      state.cars.push(car);
      m.targetId = state.cars.length - 1;
    }
    if (def.type === 'chase') {
      const car = spawnTrafficCar(1160, 480, 1);
      car.kind = 'target';
      car.color = '#1a1a1a';
      car.speed = 250;
      car.hp = 70;
      car.maxHp = 70;
      state.cars.push(car);
      m.targetId = state.cars.length - 1;
    }
    if (def.type === 'collect') {
      for (const c of def.crates) state.pickups.push({ x: c.x, y: c.y, kind: 'crate' });
    }
    if (def.type === 'deliver') {
      state.pickups.push({ x: def.pickX, y: def.pickY, kind: 'package' });
    }
    updateTarget();
  }

  function updateTarget() {
    const m = state.mission;
    if (!m) { state.target = null; return; }
    const def = m.def;
    const p = state.player;
    if (def.type === 'goto' || def.type === 'steal') state.target = { x: def.x, y: def.y };
    else if (def.type === 'deliver') state.target = m.stage === 0 ? { x: def.pickX, y: def.pickY } : { x: def.x, y: def.y };
    else if (def.type === 'collect') {
      const left = state.pickups.find((pk) => pk.kind === 'crate');
      state.target = left ? { x: left.x, y: left.y } : { x: def.x, y: def.y };
    } else if (def.type === 'race') state.target = def.points[Math.min(m.raceIndex, def.points.length - 1)];
    else if (def.type === 'kill' || def.type === 'finale') {
      const e = state.enemies.find((en) => !en.dead);
      state.target = e ? { x: e.x, y: e.y } : { x: def.spawnX, y: def.spawnY };
    } else if (def.type === 'tail' || def.type === 'chase') {
      const car = state.cars[m.targetId];
      state.target = car && !car.dead ? { x: car.x, y: car.y } : { x: p.x, y: p.y };
    } else state.target = { x: p.x, y: p.y };
  }

  function completeMission() {
    const m = state.mission;
    if (!m) return;
    const def = m.def;
    const p = state.player;
    p.cash += def.reward;
    p.respect += def.respect;
    state.stats.missionsDone += 1;
    state.stats.cashEarned += def.reward;
    setMessage(`MISSION COMPLETE: ${def.title}  +$${def.reward}  +${def.respect} respect`, 4);
    state.events |= EVENT_MISSION;
    state.mission = null;
    state.target = null;
    state.missionIndex += 1;
    state.missionDelay = 2.5;
    state.objective = state.missionIndex >= MISSIONS.length ? 'Story complete — Solmar is yours. Free roam!' : 'Next job incoming…';
    saveGame();
  }

  function failMission(reason) {
    const m = state.mission;
    if (!m) return;
    setMessage(`MISSION FAILED: ${reason} — try again (drive to the marker)`, 4);
    state.events |= EVENT_MISSION;
    state.enemies = state.enemies.filter((e) => e.dead);
    state.pickups = state.pickups.filter((pk) => pk.kind === 'cash');
    const idx = state.missionIndex;
    state.mission = null;
    state.target = null;
    state.missionIndex = idx;
    state.missionDelay = 2.5;
    state.objective = 'Job failed — next attempt incoming…';
  }

  function updateMission(dt) {
    if (state.missionDelay > 0) {
      state.missionDelay -= dt;
      if (state.missionDelay <= 0) {
        if (state.missionIndex >= MISSIONS.length) { state.storyDone = true; state.objective = 'Story complete — Solmar is yours. Free roam!'; }
        else startMission(state.missionIndex);
      }
      return;
    }
    const m = state.mission;
    if (!m) return;
    const def = m.def;
    const p = state.player;
    if (state.briefing) {
      state.briefing.t -= dt;
      if (state.briefing.t <= 0) state.briefing = null;
    }
    if (def.type === 'goto') {
      if (dist(p.x, p.y, def.x, def.y) < def.radius) completeMission();
    } else if (def.type === 'steal') {
      if (m.stage === 0 && p.inCar) { m.stage = 1; setMessage('Now drive it to Tia\'s Garage', 3); }
      if (m.stage === 1 && p.inCar && dist(p.x, p.y, def.x, def.y) < def.radius) completeMission();
    } else if (def.type === 'deliver') {
      m.timer -= dt;
      if (m.timer <= 0) { failMission('Out of time'); return; }
      if (m.stage === 0 && dist(p.x, p.y, def.pickX, def.pickY) < 45) {
        m.stage = 1;
        state.pickups = state.pickups.filter((pk) => pk.kind !== 'package');
        setMessage('Package picked up — go!', 2.5);
      } else if (m.stage === 1 && dist(p.x, p.y, def.x, def.y) < def.radius) completeMission();
    } else if (def.type === 'survive') {
      if (state.wanted >= def.minStars) m.timer -= dt;
      else state.objective = `${def.objective} — get the cops back on you!`;
      if (m.timer <= 0) completeMission();
    } else if (def.type === 'kill') {
      if (m.kills >= def.count) completeMission();
    } else if (def.type === 'race') {
      m.timer -= dt;
      if (m.timer <= 0) { failMission('Out of time'); return; }
      const pt = def.points[m.raceIndex];
      if (pt && dist(p.x, p.y, pt.x, pt.y) < 75) {
        m.raceIndex += 1;
        state.events |= EVENT_PICKUP;
        if (m.raceIndex >= def.points.length) completeMission();
        else setMessage(`Gate ${m.raceIndex + 1} of ${def.points.length}`, 2);
      }
    } else if (def.type === 'tail') {
      const car = state.cars[m.targetId];
      if (!car || car.dead) { failMission('Lost the courier'); return; }
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < 300) m.tailTime += dt;
      if (d > 430) {
        m.loseTimer += dt;
        if (m.loseTimer > 3) { failMission('Lost the courier'); return; }
      } else m.loseTimer = 0;
      if (m.tailTime >= def.seconds) completeMission();
    } else if (def.type === 'collect') {
      if (m.crates >= def.crates.length && dist(p.x, p.y, def.x, def.y) < def.radius) completeMission();
    } else if (def.type === 'chase') {
      m.timer -= dt;
      const car = state.cars[m.targetId];
      if (!car || car.dead) { completeMission(); return; }
      if (m.timer <= 0) { failMission('The convoy got away'); return; }
      if (dist(p.x, p.y, car.x, car.y) > 950) {
        m.loseTimer += dt;
        if (m.loseTimer > 5) { failMission('The convoy got away'); return; }
      } else m.loseTimer = 0;
    } else if (def.type === 'finale') {
      if (m.phase === 0) {
        if (m.kills >= def.count) {
          m.phase = 1;
          m.timer = def.seconds;
          state.wanted = 4;
          setMessage('Kessler\'s whole force is coming — survive!', 4);
        }
      } else {
        m.timer -= dt;
        if (m.timer <= 0) completeMission();
      }
    }
    updateTarget();
  }

  // ---- save / load ----
  function saveGame() {
    try {
      const p = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: p.cash, respect: p.respect, missionIndex: state.missionIndex,
        upgrades: p.upgrades, hasGun: p.hasGun, ammo: p.ammo,
        x: p.x, y: p.y, hp: p.hp, storyDone: state.storyDone,
        stats: state.stats,
      }));
    } catch { /* storage can be off; the game still runs */ }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      const p = state.player;
      p.cash = s.cash ?? 200;
      p.respect = s.respect ?? 0;
      p.upgrades = s.upgrades ?? p.upgrades;
      p.hasGun = !!s.hasGun;
      p.ammo = s.ammo ?? 0;
      p.x = s.x ?? 1160;
      p.y = s.y ?? 900;
      p.hp = s.hp ?? PLAYER.hp;
      state.missionIndex = s.missionIndex ?? 0;
      state.storyDone = !!s.storyDone;
      state.stats = s.stats ?? state.stats;
      state.missionDelay = 0.5;
      state.objective = 'Welcome back to Solmar Bay';
      return true;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try { return window.localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
  }

  // ---- combat ----
  function fireBullet(from, x, y, angle, dmg, speed) {
    state.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.1, from, dmg });
  }

  function playerShoot(aimX, aimY) {
    const p = state.player;
    if (p.fireCd > 0 || p.inCar) return;
    if (!p.hasGun || p.ammo <= 0) {
      // Bare hands: punch toward the aim.
      if (p.punchCd > 0) return;
      p.punchCd = 0.45;
      p.angle = Math.atan2(aimY - p.y, aimX - p.x);
      state.events |= EVENT_SHOT;
      const hx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
      const hy = p.y + Math.sin(p.angle) * PLAYER.punchRange;
      for (const e of state.enemies) {
        if (!e.dead && dist(e.x, e.y, p.x, p.y) < PLAYER.punchRange + 14) {
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          let d = Math.abs(a - p.angle);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < PLAYER.punchArc) hurtEnemy(e, PLAYER.punchDamage);
        }
      }
      for (const ped of state.peds) {
        if (!ped.dead && !ped.cop && dist(ped.x, ped.y, p.x, p.y) < PLAYER.punchRange + 10) {
          ped.dead = true;
          addParticles(ped.x, ped.y, '#c0392b', 8, 90);
          addWanted(1);
        }
      }
      void hx; void hy;
      return;
    }
    p.fireCd = GUN.fireDelay;
    p.ammo -= 1;
    p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    state.stats.shotsFired += 1;
    state.events |= EVENT_SHOT;
    fireBullet('player', p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle, GUN.damage, 720);
    addParticles(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, '#ffd76a', 3, 60);
    for (const ped of state.peds) {
      if (!ped.dead && dist(ped.x, ped.y, p.x, p.y) < 260) { ped.flee = 2.5; ped.fx = p.x; ped.fy = p.y; }
    }
    if (state.cops.length > 0 || state.wanted > 0) addWanted(0.5);
    else addWanted(0.5);
  }

  function hurtEnemy(e, dmg) {
    e.hp -= dmg;
    addParticles(e.x, e.y, '#c0392b', 6, 80);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      const m = state.mission;
      if (m && (m.def.type === 'kill' || m.def.type === 'finale')) {
        m.kills += 1;
        setMessage(`Target down — ${m.kills} of ${m.def.count}`, 2);
      }
      state.player.cash += 40;
      state.stats.cashEarned += 40;
    }
  }

  function hurtPlayer(dmg) {
    const p = state.player;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, dmg);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.hp -= dmg;
    state.events |= EVENT_HIT;
    if (p.hp <= 0) {
      p.hp = 0;
      state.events |= EVENT_OVER;
    }
  }

  // ---- cars ----
  function carTopSpeed(car) {
    let top = CAR.topSpeed;
    if (state.player.upgrades.engine) top += 55;
    return top;
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.dead) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = { car: c, index: i, dist: d }; }
    }
    return best;
  }

  function enterCar(found) {
    const p = state.player;
    const car = found.car;
    if (car.kind === 'traffic') {
      car.kind = 'player';
      state.stats.carsStolen += 1;
      addWanted(1);
      setMessage('Car stolen! The cops saw that.', 2.5);
    }
    p.inCar = true;
    p.carId = found.index;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  }

  function exitCar() {
    const p = state.player;
    const car = state.cars[p.carId];
    if (!car) { p.inCar = false; p.carId = -1; return; }
    const side = car.angle + Math.PI / 2;
    const nx = car.x + Math.cos(side) * 34;
    const ny = car.y + Math.sin(side) * 34;
    if (!blocked(nx, ny, PLAYER.radius)) { p.x = nx; p.y = ny; }
    else { p.x = car.x - Math.cos(side) * 34; p.y = car.y - Math.sin(side) * 34; }
    p.inCar = false;
    p.carId = -1;
    p.angle = car.angle;
  }

  function damageCar(car, amount, fromPlayer) {
    if (car.dead) return;
    car.hp -= amount;
    car.smoke = 1;
    if (car.hp <= 0) {
      car.hp = 0;
      car.dead = true;
      car.speed = 0;
      addParticles(car.x, car.y, '#ff8c42', 26, 160);
      addParticles(car.x, car.y, '#333333', 18, 110);
      state.events |= EVENT_CRASH;
      if (car.kind === 'target') setMessage('Target vehicle stopped!', 2.5);
      if (state.player.inCar && state.cars[state.player.carId] === car) {
        // The player's car blew up: bail out, hurt.
        exitCar();
        hurtPlayer(25);
      }
    } else if (fromPlayer && car.kind === 'traffic') {
      addWanted(0.5);
    }
  }

  function carAhead(car, distAhead) {
    // Is another car sitting in the lane ahead? Traffic brakes for it.
    const d = DIRS[car.heading];
    const ax = car.x + d[0] * distAhead;
    const ay = car.y + d[1] * distAhead;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      if (Math.abs(other.x - ax) < 30 && Math.abs(other.y - ay) < 30) return true;
    }
    return false;
  }

  function carsOverlap(a, b) {
    // Oriented overlap: a car is 46 long and 22 wide, so two cars passing in
    // opposite lanes (32 px apart) must NOT touch, while a head-on or a
    // T-bone must. A circle test cannot tell those apart; test the offset in
    // each car's own frame instead.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const ca = Math.cos(a.angle);
    const sa = Math.sin(a.angle);
    if (Math.abs(dx * ca + dy * sa) < 42 && Math.abs(-dx * sa + dy * ca) < 20) return true;
    const cb = Math.cos(b.angle);
    const sb = Math.sin(b.angle);
    if (Math.abs(dx * cb + dy * sb) < 42 && Math.abs(-dx * sb + dy * cb) < 20) return true;
    return false;
  }

  function stepTrafficCar(car, dt) {
    // Drive along its road; brake for the car ahead; at a crossroads
    // sometimes turn; U-turn at the edge.
    if (carAhead(car, 62)) car.speed = Math.max(0, car.speed - 240 * dt);
    else if (car.speed < (car.cruise || 120)) car.speed = Math.min(car.cruise || 120, car.speed + 120 * dt);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const d = dirs[car.heading];
    let nx = car.x + d[0] * car.speed * dt;
    let ny = car.y + d[1] * car.speed * dt;
    const atCross = (car.heading < 2)
      ? AVENUES.some((a) => Math.abs(nx - a) < 30)
      : STREETS.some((s) => Math.abs(ny - s) < 30);
    if (atCross && random() < 0.25) {
      const turn = random() < 0.5 ? 2 : 3;
      car.heading = turn;
      const nd = dirs[turn];
      // Snap onto the cross road's lane.
      if (turn === 2 || turn === 3) {
        const a = AVENUES.reduce((x, y) => (Math.abs(y - car.x) < Math.abs(x - car.x) ? y : x));
        car.x = a + (turn === 2 ? 16 : -16);
        car.y = Math.round(car.y / 10) * 10;
      } else {
        const s = STREETS.reduce((x, y) => (Math.abs(y - car.y) < Math.abs(x - car.x) ? y : x));
        car.y = s + (turn === 0 ? 16 : -16);
      }
      car.angle = turn === 0 ? 0 : turn === 1 ? Math.PI : turn === 2 ? Math.PI / 2 : -Math.PI / 2;
      void nd;
      return;
    }
    if (nx < 70 || nx > BEACH_X - 30 || ny < 70 || ny > WORLD.height - 70) {
      car.heading = car.heading === 0 ? 1 : car.heading === 1 ? 0 : car.heading === 2 ? 3 : 2;
      car.angle += Math.PI;
      return;
    }
    // Stay in lane: nudge back onto the road centreline.
    if (car.heading < 2) {
      const s = STREETS.reduce((x, y) => (Math.abs(y - car.y) < Math.abs(x - car.y) ? y : x));
      ny = s + (car.heading === 0 ? 16 : -16);
    } else {
      const a = AVENUES.reduce((x, y) => (Math.abs(y - car.x) < Math.abs(x - car.x) ? y : x));
      nx = a + (car.heading === 2 ? 16 : -16);
    }
    car.x = nx;
    car.y = ny;
    car.angle = car.heading === 0 ? 0 : car.heading === 1 ? Math.PI : car.heading === 2 ? Math.PI / 2 : -Math.PI / 2;
  }

  function stepTargetCar(car, dt, mode) {
    const p = state.player;
    if (mode === 'tail') {
      // The courier loops the avenues: drive a fixed rectangular loop.
      const loop = [{ x: 520, y: 480 }, { x: 1480, y: 480 }, { x: 1480, y: 1320 }, { x: 520, y: 1320 }];
      if (!car.target) car.target = 0;
      const wp = loop[car.target];
      const dx = wp.x - car.x;
      const dy = wp.y - car.y;
      const want = Math.atan2(dy, dx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
      car.speed = 170;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (dist(car.x, car.y, wp.x, wp.y) < 60) car.target = (car.target + 1) % loop.length;
      return;
    }
    // Chase mode: the convoy flees from the player along the roads.
    const away = Math.atan2(car.y - p.y, car.x - p.x);
    let diff = away - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
    car.speed = 250;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (buildingHit(car.x, car.y, CAR.radius)) {
      car.x -= Math.cos(car.angle) * car.speed * dt;
      car.y -= Math.sin(car.angle) * car.speed * dt;
      car.angle += Math.PI / 2;
      damageCar(car, 4, false);
    }
    car.x = clamp(car.x, 60, BEACH_X - 60);
    car.y = clamp(car.y, 60, WORLD.height - 60);
  }

  function stepPoliceCar(car, dt) {
    const p = state.player;
    unstickCar(car);
    // After a ram, a cop backs off and recovers instead of staying glued to
    // the player's bumper forever.
    if (car.ramCd > 0) {
      car.ramCd -= dt;
      car.speed = Math.max(0, car.speed - 320 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      return;
    }
    // Chase the player, but weave a little so the ram is a sideswipe, not a
    // dead-on pin.
    const wobble = Math.sin(state.time * 0.8 + car.x * 0.01) * 0.3;
    const want = Math.atan2(p.y - car.y, p.x - car.x) + wobble;
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = 3.2;
    car.angle += clamp(diff, -turnRate * dt, turnRate * dt);
    const d = dist(car.x, car.y, p.x, p.y);
    const top = 300 + Math.ceil(state.wanted) * 8;
    car.speed = Math.min(top, car.speed + 260 * dt);
    if (d < 70) car.speed = Math.max(60, car.speed - 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (buildingHit(car.x, car.y, CAR.radius)) {
      car.x -= Math.cos(car.angle) * car.speed * dt * 2;
      car.y -= Math.sin(car.angle) * car.speed * dt * 2;
      car.angle += (random() < 0.5 ? 1 : -1) * 0.9;
      car.speed *= 0.5;
      damageCar(car, 2, false);
    }
    car.x = clamp(car.x, 40, WORLD.width - 40);
    car.y = clamp(car.y, 40, WORLD.height - 40);
    car.siren = (car.siren || 0) + dt;
  }

  function unstickCar(car, clearance) {
    // A shove can leave a car inside a wall; walk it out to the nearest free
    // point instead of leaving it trapped there forever. With a clearance
    // the car is also rescued when it sits flush against a wall — touching,
    // but unable to move forward — which a plain overlap test misses.
    const r = CAR.radius + (clearance || 0);
    if (!buildingHit(car.x, car.y, r)) return;
    for (let d = 4; d <= 56; d += 4) {
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        const nx = car.x + Math.cos(a) * d;
        const ny = car.y + Math.sin(a) * d;
        if (!buildingHit(nx, ny, r) && !inWater(nx, ny)) { car.x = nx; car.y = ny; return; }
      }
    }
  }

  function stepPlayerCar(car, dt, ctrl) {
    const p = state.player;
    unstickCar(car);
    const top = carTopSpeed(car);
    const turnBoost = p.upgrades.tires ? 1.35 : 1;
    if (ctrl.move.y < 0) car.speed += CAR.accel * dt;
    else if (ctrl.move.y > 0) {
      if (car.speed > 5) car.speed -= CAR.brake * dt;
      else car.speed = Math.max(-CAR.reverseMax, car.speed - CAR.accel * 0.6 * dt);
    } else {
      car.speed -= car.speed * CAR.drag * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CAR.reverseMax, top);
    if (Math.abs(car.speed) > 2) {
      const steer = ctrl.move.x * CAR.turn * turnBoost * (car.speed >= 0 ? 1 : -1);
      car.angle += steer * dt * clamp(Math.abs(car.speed) / 120, 0.35, 1);
    }
    // Slide along walls instead of stopping dead on a corner: try each axis
    // on its own, so a car rounds a building instead of wedging into it.
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    let hitWall = false;
    if (!buildingHit(nx, car.y, CAR.radius) && !inWater(nx, car.y)) car.x = nx;
    else hitWall = true;
    if (!buildingHit(car.x, ny, CAR.radius) && !inWater(car.x, ny)) car.y = ny;
    else hitWall = true;
    if (hitWall) {
      if (Math.abs(car.speed) > 60) {
        damageCar(car, Math.abs(car.speed) * 0.04, false);
        state.events |= EVENT_CRASH;
        addParticles(nx, ny, '#e8d44d', 6, 90);
      }
      car.speed *= 0.5;
      // Wedged flush against a wall at crawling speed: after a moment, walk
      // the car out to a point with clearance instead of grinding forever.
      car.stuckTimer = (car.stuckTimer || 0) + dt;
      if (car.stuckTimer > 0.4 && Math.abs(car.speed) < 25) {
        unstickCar(car, 3);
        car.stuckTimer = 0;
      }
    } else car.stuckTimer = 0;
    car.x = clamp(car.x, 40, WORLD.width - 40);
    car.y = clamp(car.y, 40, WORLD.height - 40);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Run over a pedestrian: it counts, and the cops notice.
    for (const ped of state.peds) {
      if (!ped.dead && dist(ped.x, ped.y, car.x, car.y) < 30 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        addParticles(ped.x, ped.y, '#c0392b', 10, 100);
        addWanted(1);
      }
    }
  }

  function stepPlayerOnFoot(dt, ctrl) {
    const p = state.player;
    const mx = ctrl.move.x;
    const my = ctrl.move.y;
    const len = Math.hypot(mx, my);
    p.sprinting = ctrl.sprint && len > 0;
    const speed = p.sprinting ? PLAYER.sprint : PLAYER.walk;
    if (len > 0) {
      const nx = (mx / len) * speed * dt;
      const ny = (my / len) * speed * dt;
      moveBody(p, nx, ny, PLAYER.radius);
      p.angle = Math.atan2(my, mx);
    }
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (ctrl.fire) playerShoot(ctrl.aimX, ctrl.aimY);
  }

  function nearestShop(maxD) {
    const p = state.player;
    let best = null;
    let bestD = maxD;
    for (const s of SHOPS) {
      const d = dist(p.x, p.y, s.x, s.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  function useShop(shop, key) {
    const p = state.player;
    if (shop.id === 'garage') {
      const map = { Digit1: 'engine', Digit2: 'armor', Digit3: 'tires' };
      const up = map[key];
      if (!up) { setMessage('Garage: press 1 Engine $400 · 2 Armor $350 · 3 Tires $250', 3); return; }
      if (p.upgrades[up]) { setMessage('Already installed.', 2); return; }
      if (p.cash < UPGRADES[up].cost) { setMessage('Not enough cash for that upgrade.', 2); return; }
      p.cash -= UPGRADES[up].cost;
      p.upgrades[up] = true;
      if (up === 'armor' && p.inCar) {
        const car = state.cars[p.carId];
        if (car) { car.maxHp += 80; car.hp += 80; }
      }
      setMessage(`${UPGRADES[up].name} installed — ${UPGRADES[up].desc}`, 3);
      state.events |= EVENT_PICKUP;
      return;
    }
    if (shop.id === 'guns') {
      if (key === 'KeyG') {
        if (p.hasGun) { setMessage('You already own a pistol. Buy ammo with H.', 2); return; }
        if (p.cash < GUN.cost) { setMessage('Pistol costs $250.', 2); return; }
        p.cash -= GUN.cost;
        p.hasGun = true;
        p.ammo += GUN.ammoPack;
        setMessage('Pistol bought. Click to shoot, Space to punch.', 3);
        state.events |= EVENT_PICKUP;
      } else if (key === 'KeyH') {
        if (!p.hasGun) { setMessage('Buy the pistol first (G).', 2); return; }
        if (p.cash < GUN.ammoCost) { setMessage('Ammo costs $50.', 2); return; }
        p.cash -= GUN.ammoCost;
        p.ammo += GUN.ammoPack;
        setMessage(`+${GUN.ammoPack} rounds.`, 2);
        state.events |= EVENT_PICKUP;
      } else setMessage('Ironworks: Pistol $250 (G) · Ammo $50 (H)', 3);
      return;
    }
    if (shop.id === 'spray') {
      if (p.cash < 150) { setMessage('A respray costs $150.', 2); return; }
      if (state.wanted < 1) { setMessage('No heat on you — save your money.', 2); return; }
      p.cash -= 150;
      state.wanted = 0;
      state.cops = [];
      setMessage('Fresh paint, clean record. Wanted cleared.', 3);
      state.events |= EVENT_PICKUP;
      return;
    }
    if (shop.id === 'clinic') {
      if (p.hp >= PLAYER.hp) { setMessage('You are already at full health.', 2); return; }
      if (p.cash < 100) { setMessage('Treatment costs $100.', 2); return; }
      p.cash -= 100;
      p.hp = PLAYER.hp;
      setMessage('Patched up — full health.', 2.5);
      state.events |= EVENT_PICKUP;
    }
  }

  // ---- the step ----
  function step(dt, ctrl) {
    state.events = 0;
    state.time += dt;
    const p = state.player;

    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }

    // Interact: enter/exit a car, or use a shop.
    if (ctrl.actions && ctrl.actions.interact) {
      const shop = nearestShop(90);
      if (shop && !p.inCar) useShop(shop, 'KeyE');
      else if (p.inCar) exitCar();
      else {
        const found = nearestCar(p.x, p.y, 58);
        if (found) enterCar(found);
      }
    }
    if (ctrl.key) {
      const shop = nearestShop(110);
      if (shop) useShop(shop, ctrl.key);
    }

    // Player movement / driving.
    if (p.inCar) {
      const car = state.cars[p.carId];
      if (car && !car.dead) stepPlayerCar(car, dt, ctrl);
      else { p.inCar = false; p.carId = -1; }
      if (ctrl.fire && p.fireCd <= 0) {
        // Honk / no gun from a car: Space punches nothing. Ignore.
      }
    } else {
      stepPlayerOnFoot(dt, ctrl);
    }
    if (p.fireCd > 0 && p.inCar) p.fireCd -= dt;

    // Traffic and mission cars.
    for (let i = 0; i < state.cars.length; i += 1) {
      const car = state.cars[i];
      if (car.dead) continue;
      if (car.kind === 'traffic') stepTrafficCar(car, dt);
      else if (car.kind === 'police') stepPoliceCar(car, dt);
      else if (car.kind === 'target') {
        const m = state.mission;
        stepTargetCar(car, dt, m && m.def.type === 'tail' ? 'tail' : 'chase');
      }
      if (car.smoke > 0) {
        car.smoke -= dt;
        if (random() < 0.3) state.particles.push({ x: car.x, y: car.y, vx: range(random, -20, 20), vy: -40, life: 0.7, max: 0.7, color: '#555555', size: 5 });
      }
    }
    // Car-car collisions: push apart, damage on hard hits. Damage fires once
    // per contact, not once per step — two cars passing each other overlap
    // for many steps, and per-step damage would shred them both.
    const colliding = new Set();
    for (let i = 0; i < state.cars.length; i += 1) {
      const a = state.cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const b = state.cars[j];
        if (b.dead) continue;
        if (!carsOverlap(a, b)) continue;
        const key = `${i}-${j}`;
        colliding.add(key);
        const playerCar = state.player.inCar ? state.cars[state.player.carId] : null;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0.01 && d < 36) {
          const push = (36 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const ax0 = a.x; const ay0 = a.y; const bx0 = b.x; const by0 = b.y;
          // The player's car keeps its line: it takes a quarter of the shove
          // and hands the rest to the other car, so a ram cannot shove the
          // player off the road and into a wall.
          const aShare = a === playerCar ? 0.25 : b === playerCar ? 1.75 : 1;
          const bShare = b === playerCar ? 0.25 : a === playerCar ? 1.75 : 1;
          a.x -= nx * push * aShare; a.y -= ny * push * aShare;
          b.x += nx * push * bShare; b.y += ny * push * bShare;
          // A shove must never park a car inside a wall: undo it instead.
          if (buildingHit(a.x, a.y, CAR.radius)) { a.x = ax0; a.y = ay0; }
          if (buildingHit(b.x, b.y, CAR.radius)) { b.x = bx0; b.y = by0; }
        }
        if (!state._colliding.has(key)) {
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 150) {
            // Police rams are meant to push, not shred: they deal half damage.
            const scale = (a.kind === 'police' || b.kind === 'police') ? 0.015 : 0.03;
            damageCar(a, impact * scale, false);
            damageCar(b, impact * scale, false);
            state.events |= EVENT_CRASH;
            addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, '#e8d44d', 5, 80);
            // Only a hard hit kills momentum; resting contact must not.
            a.speed *= 0.85;
            b.speed *= 0.85;
          }
          // A cop that just rammed the player's car backs off to recover.
          if (playerCar && (a === playerCar || b === playerCar)) {
            const cop = a.kind === 'police' ? a : b.kind === 'police' ? b : null;
            if (cop) cop.ramCd = 1.2;
          }
        }
      }
    }
    state._colliding = colliding;

    // Pedestrians wander the sidewalks and flee gunfire.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const away = Math.atan2(ped.y - ped.fy, ped.x - ped.fx);
        const nx = ped.x + Math.cos(away) * 130 * dt;
        const ny = ped.y + Math.sin(away) * 130 * dt;
        if (!blocked(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
        continue;
      }
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        const t = nearestRoadPoint(random, ped.x, ped.y);
        ped.tx = t.x; ped.ty = t.y;
        continue;
      }
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      const nx = ped.x + Math.cos(a) * ped.speed * dt;
      const ny = ped.y + Math.sin(a) * ped.speed * dt;
      if (!blocked(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
      else { ped.tx = ped.x; ped.ty = ped.y; }
    }

    // Enemies hunt the player and shoot.
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 200) {
        const nx = e.x + Math.cos(e.angle) * 120 * dt;
        const ny = e.y + Math.sin(e.angle) * 120 * dt;
        if (!blocked(nx, ny, 12)) { e.x = nx; e.y = ny; }
      }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 380) {
        e.shootCd = range(random, 0.9, 1.5);
        fireBullet('enemy', e.x + Math.cos(e.angle) * 16, e.y + Math.sin(e.angle) * 16, e.angle + range(random, -0.12, 0.12), 8, 380);
        state.events |= EVENT_SHOT;
      }
    }

    // Bullets fly, hit buildings, people and cars.
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (buildingHit(b.x, b.y, 1) || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) {
        b.life = 0;
        addParticles(b.x, b.y, '#e8d44d', 3, 50);
        continue;
      }
      if (b.from === 'player') {
        let hit = false;
        for (const e of state.enemies) {
          if (!e.dead && dist(b.x, b.y, e.x, e.y) < 16) { hurtEnemy(e, b.dmg); b.life = 0; hit = true; break; }
        }
        if (hit) continue;
        for (const ped of state.peds) {
          if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 12) {
            ped.dead = true;
            addParticles(ped.x, ped.y, '#c0392b', 8, 90);
            addWanted(1);
            b.life = 0; hit = true; break;
          }
        }
        if (hit) continue;
        for (const cop of state.cops) {
          if (!cop.dead && cop.foot && dist(b.x, b.y, cop.x, cop.y) < 14) {
            cop.dead = true;
            addParticles(cop.x, cop.y, '#4fc3f7', 8, 90);
            addWanted(1);
            b.life = 0; hit = true; break;
          }
        }
        if (hit) continue;
        for (const car of state.cars) {
          if (!car.dead && dist(b.x, b.y, car.x, car.y) < 24) {
            damageCar(car, b.dmg, true);
            b.life = 0;
            break;
          }
        }
      } else {
        if (dist(b.x, b.y, p.x, p.y) < (p.inCar ? 24 : 14)) {
          if (p.inCar) {
            const car = state.cars[p.carId];
            if (car) damageCar(car, b.dmg, false);
          } else hurtPlayer(b.dmg);
          b.life = 0;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);

    // Cash pickups on the street.
    state.cashTimer -= dt;
    if (state.cashTimer <= 0) {
      state.cashTimer = range(random, 9, 16);
      const t = nearestRoadPoint(random, range(random, 100, BEACH_X - 100), range(random, 100, WORLD.height - 100));
      if (state.pickups.filter((pk) => pk.kind === 'cash').length < 5) state.pickups.push({ x: t.x, y: t.y, kind: 'cash' });
    }
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 42) {
        pk.taken = true;
        if (pk.kind === 'cash') {
          p.cash += 25;
          state.stats.cashEarned += 25;
          setMessage('Found $25 on the street', 2);
          state.events |= EVENT_PICKUP;
        } else if (pk.kind === 'crate') {
          const m = state.mission;
          if (m && m.def.type === 'collect') {
            m.crates += 1;
            setMessage(`Crate ${m.crates} of ${m.def.crates.length} secured`, 2.5);
            state.events |= EVENT_PICKUP;
          }
        }
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken || pk.kind === 'package');

    // ---- wanted & police ----
    const stars = Math.ceil(state.wanted);
    if (stars > 0) {
      // Spawn police cars up to the star count; foot cops at 1-2 stars.
      state.spawnTimer -= dt;
      const policeCars = state.cars.filter((c) => c.kind === 'police' && !c.dead).length;
      const wantCars = Math.min(stars, 5);
      if (state.spawnTimer <= 0 && policeCars < wantCars) {
        state.spawnTimer = 1.2;
        state.cars.push(spawnCopCar());
      }
      const footCops = state.cops.filter((c) => !c.dead).length;
      if (stars <= 2 && footCops < 2 && state.cars.length < 40) {
        state.cops.push(spawnFootCop());
      }
      // Hide and the heat fades: no police close for a while.
      const nearestPolice = Math.min(
        ...state.cars.filter((c) => c.kind === 'police' && !c.dead).map((c) => dist(c.x, c.y, p.x, p.y)),
        ...state.cops.filter((c) => !c.dead).map((c) => dist(c.x, c.y, p.x, p.y)),
        9999,
      );
      if (nearestPolice > 480) {
        state.hiddenTimer += dt;
        if (state.hiddenTimer > 6) {
          state.wanted = Math.max(0, state.wanted - dt * 0.25);
          if (state.wanted < 0.01) state.wanted = 0;
        }
      } else state.hiddenTimer = 0;
      // Helicopter from 4 stars: it watches, police spawn faster.
      if (stars >= 4) {
        state.heli = { x: p.x + 40, y: p.y - 90 };
        state.spawnTimer -= dt * 0.5;
      } else state.heli = null;
      state.sirenTimer -= dt;
      if (state.sirenTimer <= 0 && nearestPolice < 600) {
        state.sirenTimer = 2.4;
        state.events |= EVENT_WANTED;
      }
    } else {
      state.heli = null;
      // Cops stand down once the heat is gone.
      state.cops = state.cops.filter((c) => !c.dead && dist(c.x, c.y, p.x, p.y) < 700);
      for (const car of state.cars) if (car.kind === 'police') car.dead = true;
    }

    // Foot cops chase on foot; get too close for too long and you are busted.
    for (const cop of state.cops) {
      if (cop.dead) continue;
      cop.foot = true;
      const d = dist(cop.x, cop.y, p.x, p.y);
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      const nx = cop.x + Math.cos(a) * cop.speed * dt;
      const ny = cop.y + Math.sin(a) * cop.speed * dt;
      if (!blocked(nx, ny, 10)) { cop.x = nx; cop.y = ny; }
      if (!p.inCar && d < 30) {
        cop.bustedHold += dt;
        p.bustedTimer = cop.bustedHold;
        if (cop.bustedHold > 1.6) state.events |= EVENT_BUSTED;
      } else {
        cop.bustedHold = Math.max(0, cop.bustedHold - dt);
        p.bustedTimer = 0;
      }
    }
    // A police car ramming the player on foot can bust them too.
    if (!p.inCar) {
      for (const car of state.cars) {
        if (car.kind === 'police' && !car.dead && dist(car.x, car.y, p.x, p.y) < 34) {
          p.bustedTimer += dt;
          if (p.bustedTimer > 2.2) state.events |= EVENT_BUSTED;
        }
      }
    }

    // Particles fade.
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // Respawn traffic and pedestrians so the city never empties.
    if (state.cars.filter((c) => c.kind === 'traffic').length < 14) {
      const a = pick(random, AVENUES);
      state.cars.push(spawnTrafficCar(a + 16, range(random, 80, WORLD.height - 80), 2));
    }
    state.cars = state.cars.filter((c) => !c.dead || c.kind === 'player' || c.kind === 'target');
    state.cops = state.cops.filter((c) => !c.dead);
    if (state.peds.filter((pd) => !pd.dead).length < 20) {
      state.peds.push(spawnPed(range(random, 120, BEACH_X - 100), range(random, 120, WORLD.height - 120)));
    }
    state.peds = state.peds.filter((pd) => !pd.dead || random() < 0.2);

    // Prompt: what E does right now.
    if (!p.inCar) {
      const shop = nearestShop(90);
      const car = nearestCar(p.x, p.y, 58);
      if (shop) state.prompt = `E — ${shop.name} · ${shop.blurb}`;
      else if (car) state.prompt = car.kind === 'traffic' ? 'E — Steal car' : 'E — Get in car';
      else state.prompt = '';
    } else {
      const shop = nearestShop(90);
      state.prompt = shop && shop.id === 'spray' ? 'E — Spray Shop: clear wanted $150' : 'E — Get out  ·  WASD drive  ·  Space handbrake';
    }

    updateMission(dt);
    return state.events;
  }

  function wastedOrBusted() {
    // Lose a cut of the cash, wake up at the Clinic, heat gone.
    const p = state.player;
    const lost = Math.min(p.cash, Math.max(50, Math.floor(p.cash * 0.1)));
    p.cash -= lost;
    p.hp = PLAYER.hp;
    p.armor = 0;
    p.ammo = Math.floor(p.ammo / 2);
    p.x = 200;
    p.y = 820;
    p.inCar = false;
    p.carId = -1;
    state.wanted = 0;
    state.cops = [];
    for (const car of state.cars) if (car.kind === 'police') car.dead = true;
    state.enemies = [];
    if (state.mission) failMission('You went down');
    setMessage(`You lost $${lost}. The Clinic patched you up.`, 4);
    saveGame();
    return lost;
  }

  reset();
  return {
    state, reset, step, startMission, completeMission, failMission,
    saveGame, loadGame, hasSave, wastedOrBusted, rankName, addWanted,
  };
}
