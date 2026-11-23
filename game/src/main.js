// TIDELINE — Delta Kings: boot, the one game loop, the player, pedestrians,
// the third-person camera, screens (title / play / pause / wasted / busted /
// shop / crew / heist planning) and the ?shot= / ?selftest=1 harnesses.
import * as THREE from 'three';
import { STEP, MISSIONS, SHOPS, ROADS } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_RADIO, ACTION_MUTE, ACTION_CREW, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, collideBuildings, clampWorld, inWaterOrBlocked, isWater } from './city.js';
import { createVehicles, nearestCar } from './vehicles.js';
import { createBoats, nearestBoat } from './boats.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHeists } from './heists.js';
import { createCrew } from './crew.js';
import { createDistricts } from './districts.js';
import { createEconomy } from './economy.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;
const selftest = params.get('selftest') === '1';

window.addEventListener('error', (e) => { window.__error = String(e.message || e.error); });

const rng = createRandom(seed);
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 180, 420);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

// Sun + sky light.
const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
sun.position.set(120, 160, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xbfd4e6, 0.9));

const city = buildCity(scene, rng);
const G = {
  scene, camera, renderer, rng,
  city, state: null, hud: null, audio: createAudio(),
  vehicles: null, boats: null, police: null, combat: null,
  missions: createMissions(), heists: createHeists(), crew: null,
  districts: createDistricts(), economy: createEconomy(),
  input: null, screen: 'title', nearestShop: null, roadblock: false,
  shotMode: shotName, time: 0, camOrbit: 0, recentShot: 0,
};

G.vehicles = createVehicles(scene, rng, city.colliders);
G.boats = createBoats(scene, rng);
G.police = createPolice(scene, rng);
G.combat = createCombat(scene);
G.crew = createCrew(scene);
G.hud = createHud();
G.input = createInput(canvas);

// ---- Player ---------------------------------------------------------------
function makePlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.5, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1 }));
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  head.position.y = 2.15; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xf2c14e }));
  cap.position.y = 2.45; g.add(cap);
  return g;
}
const playerMesh = makePlayerMesh();
scene.add(playerMesh);

// Mission beacon: a pulsing yellow pillar marking the objective.
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
);
scene.add(beacon);

// ---- Pedestrians ----------------------------------------------------------
const peds = [];
function spawnPed(i) {
  const colors = [0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.5, 0.5),
    new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  head.position.y = 2.1; g.add(head);
  scene.add(g);
  const road = ROADS[i % ROADS.length];
  peds.push({
    mesh: g, x: road + 8, z: -200 + i * 34, heading: rng.next() * Math.PI * 2,
    speed: 2 + rng.next() * 1.5, flee: 0, down: false,
  });
}
for (let i = 0; i < 12; i++) spawnPed(i);

function stepPeds(dt) {
  const s = G.state;
  for (const p of peds) {
    if (p.down) continue;
    const dx = p.x - s.player.x, dz = p.z - s.player.z;
    const dist = Math.hypot(dx, dz);
    let speed = p.speed;
    if ((s.wanted > 0 || G.recentShot > 0) && dist < 22) { p.flee = 1; speed = 7; }
    if (p.flee > 0) {
      p.heading = Math.atan2(dx, dz);
      p.flee -= dt;
    } else if (rng.next() < 0.005) p.heading += (rng.next() - 0.5) * 2;
    p.x += Math.sin(p.heading) * speed * dt;
    p.z += Math.cos(p.heading) * speed * dt;
    const cl = clampWorld(p.x, p.z);
    p.x = cl.x; p.z = cl.z;
    if (inWaterOrBlocked(p.x, p.z)) { p.heading += Math.PI; p.x -= Math.sin(p.heading) * speed * dt * 2; p.z -= Math.cos(p.heading) * speed * dt * 2; }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Run over by the player's car: wanted +1, sometimes drops cash.
    if (s.player.vehicle && s.player.vehicle.type === 'car' && Math.abs(s.player.vehicle.speed) > 6 && dist < 2.6) {
      p.down = true;
      p.mesh.rotation.x = Math.PI / 2;
      p.mesh.position.y = 0.4;
      G.police.addWanted(G, 1);
      if (rng.next() < 0.6) G.economy.streetCash(G, p.x, p.z);
      G.hud.flash('PEDESTRIAN DOWN — WANTED +1');
      window.setTimeout(() => {
        p.down = false; p.mesh.rotation.x = 0; p.mesh.position.y = 0;
        p.x = s.player.x + 60; p.z = s.player.z + 40;
      }, 15000);
    }
  }
}

// ---- State ----------------------------------------------------------------
function freshState() {
  return {
    cash: 200, respect: 0, health: 100, armor: 0, wanted: 0,
    missionIndex: 0, missionStep: 0, missionTimer: 0, missionKills: 0,
    collected: 0, racePoint: 0, missionDone: false, gameWon: false,
    pistol: false, ammo: 0, upgrades: { turbo: false, armor: false, grip: false },
    heistPlan: null, heistCollected: 0, sideHeist: null, bustedTimer: 0,
    player: { x: 60, z: 200, heading: Math.PI, speed: 0, onFoot: true, vehicle: null },
  };
}
G.state = freshState();
G.state.districts = G.districts;
G.state.crew = G.crew.members;

// ---- Game actions on G (used by police / combat / missions) ---------------
G.save = () => saveGame(G);
G.flash = (m) => G.hud.flash(m);
G.wasted = () => {
  const s = G.state;
  s.cash = Math.floor(s.cash * 0.9);
  s.health = 100; s.wanted = 0;
  G.police.clear(); G.combat.clear();
  exitVehicle(true);
  s.player.x = -180; s.player.z = -60; s.player.heading = 0;
  G.screen = 'wasted';
  document.getElementById('over-title').textContent = 'WASTED';
  document.getElementById('over-text').textContent = 'The tide took you. The clinic patched you up — for 10% of your cash.';
  G.hud.show('over');
};
G.busted = () => {
  const s = G.state;
  s.cash = Math.floor(s.cash * 0.9);
  s.wanted = 0;
  G.police.clear(); G.combat.clear();
  exitVehicle(true);
  s.player.x = -180; s.player.z = -180; s.player.heading = 0;
  G.screen = 'busted';
  document.getElementById('over-title').textContent = 'BUSTED';
  document.getElementById('over-text').textContent = 'The Tideline PD hauled you in. Bail cost 10% of your cash.';
  G.hud.show('over');
};
G.failMission = (why) => {
  const s = G.state;
  G.combat.clear();
  G.hud.flash(`${why} — MISSION RESTARTED`);
  G.missions.start(G, s.missionIndex);
};
G.onEnemyKilled = (e) => {
  const s = G.state;
  s.missionKills += 1;
  s.cash += 50;
  G.police.addWanted(G, 0.5);
  if (Math.random() < 0.4) G.combat.spawnPickup(e.x, e.z, 'health');
};
G.explodeVehicle = () => {
  const s = G.state;
  if (!s.player.vehicle) return;
  const v = s.player.vehicle;
  scene.remove(v.ref.mesh);
  if (v.type === 'car') v.ref.stolen = true;
  s.player.vehicle = null; s.player.onFoot = true;
  s.health -= 30;
  G.police.addWanted(G, 1);
  G.hud.flash('YOUR CAR EXPLODED!');
  if (s.health <= 0) G.wasted();
};
G.openHeistPlan = (heistId) => {
  G.state.pendingHeist = heistId;
  const h = G.heists.byId(heistId);
  document.getElementById('heist-title').textContent = `PLAN THE HEIST — ${h.name}`;
  document.getElementById('heist-desc').textContent = h.desc;
  // Crew checkboxes: only recruited members can be picked.
  const box = document.getElementById('heist-crew');
  box.innerHTML = '';
  for (const m of G.crew.members) {
    const label = document.createElement('label');
    label.style.display = 'block';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = m.id; cb.disabled = !m.recruited;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${m.name} — ${m.role}${m.recruited ? '' : ' (not recruited)'}`));
    box.appendChild(label);
  }
  G.screen = 'heistplan';
  G.hud.show('heist-plan');
};

function exitVehicle(force) {
  const s = G.state;
  const v = s.player.vehicle;
  if (!v) return;
  if (v.type === 'car') {
    s.player.x = v.ref.x - Math.sin(v.ref.heading) * 3;
    s.player.z = v.ref.z - Math.cos(v.ref.heading) * 3;
    s.player.heading = v.ref.heading;
  } else if (v.type === 'boat') {
    v.ref.boarded = false;
    // Step ashore: find the nearest dry spot around the boat.
    let placed = false;
    for (let r = 3; r <= 12 && !placed; r += 3) {
      for (let a = 0; a < 8; a++) {
        const x = v.ref.x + Math.cos((a / 8) * Math.PI * 2) * r;
        const z = v.ref.z + Math.sin((a / 8) * Math.PI * 2) * r;
        if (!isWater(x, z)) { s.player.x = x; s.player.z = z; placed = true; break; }
      }
    }
    if (!placed) { s.player.x = v.ref.x; s.player.z = v.ref.z; }
    s.player.heading = v.ref.heading;
  }
  s.player.vehicle = null;
  s.player.onFoot = true;
  s.player.speed = 0;
}

function enterCar(car) {
  const s = G.state;
  car.stolen = true;
  scene.remove(car.mesh);
  const pc = G.vehicles.makePlayerCar(car.x, car.z, car.heading, car.color);
  pc.damage = 0;
  s.player.vehicle = { type: 'car', ref: pc };
  s.player.onFoot = false;
  s.player.x = pc.x; s.player.z = pc.z; s.player.heading = pc.heading;
  G.police.addWanted(G, 1);
  G.hud.flash('CAR STOLEN — WANTED +1');
  G.audio.beep(520, 0.12);
}
function enterBoat(boat) {
  const s = G.state;
  boat.boarded = true;
  s.player.vehicle = { type: 'boat', ref: boat };
  s.player.onFoot = false;
  s.player.x = boat.x; s.player.z = boat.z; s.player.heading = boat.heading;
  G.hud.flash('ON THE BOAT — RIDE THE CANALS');
}

// ---- Shops / panels -------------------------------------------------------
function nearestShop() {
  const s = G.state;
  let best = null, bd = 9;
  for (const sh of SHOPS) {
    const d = Math.hypot(sh.x - s.player.x, sh.z - s.player.z);
    if (d < bd) { bd = d; best = sh; }
  }
  return best;
}
function openShop(shop) {
  G.nearestShop = shop;
  G.screen = 'shop';
  const s = G.state;
  document.getElementById('shop-title').textContent = shop.name;
  document.getElementById('shop-desc').textContent = shop.desc;
  const disc = G.districts.discount(shop.x, shop.z);
  document.getElementById('shop-discount').textContent =
    disc > 0 ? `District standing discount: ${Math.round(disc * 100)}% off` : 'Raise district standing to 50+ for discounts here.';
  const box = document.getElementById('shop-items');
  box.innerHTML = '';
  const items = {
    gun: [['pistol', 'Pistol'], ['ammo', 'Ammo (+24)']],
    garage: [['turbo', 'Turbo Engine'], ['armor', 'Plated Armor'], ['grip', 'Grip Tires']],
    spray: [['spray', 'Clean Record (clear wanted)']],
    clinic: [['heal', 'Full Heal']],
    safehouse: [],
  }[shop.id] || [];
  for (const [key, label] of items) {
    const owned = (key === 'pistol' && s.pistol) || (key !== 'pistol' && key !== 'ammo' && s.upgrades[key]);
    const b = document.createElement('button');
    b.textContent = `${label} — $${G.economy.price(G, key, shop.x, shop.z)}${owned ? ' (OWNED)' : ''}`;
    b.disabled = owned;
    b.onclick = () => { G.economy.buy(G, key); refreshShop(shop); };
    box.appendChild(b);
  }
  if (shop.id === 'safehouse') {
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Game';
    saveBtn.onclick = () => { G.save(); G.hud.flash('GAME SAVED'); };
    box.appendChild(saveBtn);
    const heistBtn = document.createElement('button');
    heistBtn.textContent = 'Heist Board — Neon Casino ($4,000)';
    heistBtn.onclick = () => {
      G.hud.hide('shop');
      G.state.sideHeist = { id: 'neon', collected: 0, target: 3 };
      G.openHeistPlan('neon');
    };
    box.appendChild(heistBtn);
    const crewBtn = document.createElement('button');
    crewBtn.textContent = 'Crew Panel (C)';
    crewBtn.onclick = () => { G.hud.hide('shop'); openCrewPanel(); };
    box.appendChild(crewBtn);
  }
  const close = document.createElement('button');
  close.textContent = 'Leave (Esc)';
  close.onclick = () => { G.hud.hide('shop'); G.screen = 'play'; };
  box.appendChild(close);
  G.hud.show('shop');
}
function refreshShop(shop) { openShop(shop); }
function openCrewPanel() {
  G.screen = 'crew';
  const box = document.getElementById('crew-list');
  box.innerHTML = '';
  for (const m of G.crew.members) {
    const div = document.createElement('div');
    div.className = 'crew-row';
    const status = !m.recruited ? `— ${m.recruit}` : m.onJob ? '— OUT ON A SIDE JOB' : '— follows you';
    div.innerHTML = `<b style="color:${m.color}">${m.name}</b> · ${m.role} · ${m.bonus} ${status}`;
    if (m.recruited && !m.onJob) {
      const b = document.createElement('button');
      b.textContent = 'Send on side job (+$250–500 in 45s)';
      b.onclick = () => { G.crew.sendOnJob(m.id); G.hud.flash(`${m.name.toUpperCase()} IS OUT ON A JOB`); openCrewPanel(); };
      div.appendChild(b);
    }
    box.appendChild(div);
  }
  G.hud.show('crew-panel');
}

// ---- Buttons --------------------------------------------------------------
function wireButtons() {
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
  on('btn-new', () => startNewGame());
  on('btn-continue', () => startContinue());
  on('btn-resume', () => { G.hud.hide('pause'); G.screen = 'play'; });
  on('btn-save', () => { G.save(); G.hud.flash('GAME SAVED'); });
  on('btn-quit', () => { G.hud.hide('pause'); toTitle(); });
  on('btn-over', () => { G.hud.hide('over'); G.screen = 'play'; });
  on('btn-crew-close', () => { G.hud.hide('crew-panel'); G.screen = 'play'; });
  on('btn-shop-close', () => { G.hud.hide('shop'); G.screen = 'play'; });
  on('btn-heist-start', () => {
    const approach = document.querySelector('input[name="approach"]:checked')?.value || 'loud';
    const crewPicked = [...document.querySelectorAll('#heist-crew input:checked')].map((c) => c.value);
    const getaway = document.getElementById('heist-getaway')?.value || 'car';
    const summary = G.heists.applyPlan(G, G.state.pendingHeist, { approach, crew: crewPicked, getaway });
    G.hud.hide('heist-plan');
    G.hud.flash(summary.toUpperCase());
    const s = G.state;
    if (s.sideHeist && s.sideHeist.id === G.state.pendingHeist) {
      // Side heist: crates appear on the Neon Strip, collect 3 for the cut.
      for (let i = 0; i < 3; i++) G.combat.spawnPickup(120 + i * 5 - 5, 120 + (i % 2) * 5, 'heist');
      G.hud.flash('NEON CASINO HEIST: GRAB 3 CRATES ON THE STRIP');
    } else {
      const m = MISSIONS[s.missionIndex];
      if (m) G.missions.setupStep(G, m.steps[s.missionStep]);
    }
    G.screen = 'play';
  });
  on('btn-heist-cancel', () => { G.hud.hide('heist-plan'); G.screen = 'play'; });
  on('btn-help', () => G.hud.show('help'));
  on('btn-help-close', () => G.hud.hide('help'));
}

function startNewGame() {
  G.state = freshState();
  G.state.districts = G.districts;
  G.state.crew = G.crew.members;
  G.police.clear(); G.combat.clear();
  G.crew.members.forEach((m) => { m.recruited = false; m.onJob = false; if (m.mesh) { scene.remove(m.mesh); m.mesh = null; } });
  G.hud.hideAllOverlays();
  G.screen = 'play';
  G.missions.start(G, 0);
  G.audio.unlock();
}
function startContinue() {
  const data = loadGame();
  if (!data) { startNewGame(); return; }
  G.state = freshState();
  Object.assign(G.state, {
    cash: data.cash, respect: data.respect, health: data.health, armor: data.armor,
    missionIndex: data.missionIndex, pistol: data.pistol, ammo: data.ammo,
    upgrades: data.upgrades || { turbo: false, armor: false, grip: false },
    heistPlan: data.heistPlan || null,
  });
  G.state.districts = G.districts;
  G.state.crew = G.crew.members;
  if (data.districts?.standing) Object.assign(G.districts.standing, data.districts.standing);
  if (data.crew) for (const c of data.crew) if (c.recruited) G.crew.recruit(c.id, G.state.player.x, G.state.player.z);
  if (data.player) { G.state.player.x = data.player.x; G.state.player.z = data.player.z; }
  G.hud.hideAllOverlays();
  G.screen = 'play';
  G.missions.start(G, G.state.missionIndex);
  G.audio.unlock();
}
function toTitle() {
  G.screen = 'title';
  G.hud.hideAllOverlays();
  const cont = document.getElementById('btn-continue');
  if (cont) cont.style.display = hasSave() ? 'inline-block' : 'none';
  G.hud.show('title');
}

// ---- One fixed step -------------------------------------------------------
function stepGame(dt) {
  const s = G.state;
  G.time += dt;
  if (G.recentShot > 0) G.recentShot -= dt;
  const input = G.input;
  const ax = G.shotMode ? shotAxis() : input.axis();
  const actions = G.shotMode ? 0 : input.takeActions();

  if (G.screen === 'play') {
    // Radio / mute / pause / crew panel.
    if (actions & ACTION_RADIO) G.hud.flash(`RADIO: ${G.audio.nextStation()}`);
    if (actions & ACTION_MUTE) G.hud.flash(G.audio.toggleMute() ? 'RADIO MUTED' : 'RADIO ON');
    if (actions & ACTION_PAUSE) { G.screen = 'paused'; G.hud.show('pause'); }
    if (actions & ACTION_CREW) openCrewPanel();
    if (actions & ACTION_PUNCH) punch();

    // Interact: shop / steal car / board boat / exit vehicle.
    if (actions & ACTION_INTERACT) {
      const shop = nearestShop();
      if (shop) openShop(shop);
      else if (s.player.vehicle) exitVehicle();
      else {
        const car = nearestCar(G.vehicles.traffic, s.player.x, s.player.z);
        const boat = nearestBoat(G.boats.boats, s.player.x, s.player.z);
        if (car && (!boat || Math.hypot(car.x - s.player.x, car.z - s.player.z) < Math.hypot(boat.x - s.player.x, boat.z - s.player.z))) enterCar(car);
        else if (boat) enterBoat(boat);
      }
    }

    // Shooting with the mouse.
    if (input.takeMouseDown() && s.player.onFoot) {
      const m = input.mouse();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(m.x * 2 - 1, -(m.y * 2 - 1)), camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.4);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        G.combat.shoot(G, hit.x, hit.z);
        G.recentShot = 1;
        G.police.addWanted(G, 0.4);
      }
    }

    // Movement.
    if (s.player.vehicle) {
      if (s.player.vehicle.type === 'car') {
        G.vehicles.stepPlayerCar(s.player.vehicle.ref, { axis: () => ax }, dt, s.upgrades);
        const v = s.player.vehicle.ref;
        s.player.x = v.x; s.player.z = v.z; s.player.heading = v.heading;
        s.player.vehicle.speed = v.speed;
        if (v.damage > 100) G.explodeVehicle();
      } else {
        G.boats.stepPlayerBoat(s.player.vehicle.ref, { axis: () => ax }, dt);
        const b = s.player.vehicle.ref;
        s.player.x = b.x; s.player.z = b.z; s.player.heading = b.heading;
        s.player.vehicle.speed = b.speed;
      }
    } else {
      const speed = input.sprint() || G.shotMode ? 9 : 5;
      if (ax.f > 0) s.player.speed = speed;
      else if (ax.f < 0) s.player.speed = -speed * 0.5;
      else s.player.speed = 0;
      s.player.heading += ax.s * 2.4 * dt * (ax.f >= 0 ? 1 : -1);
      const nx = s.player.x + Math.sin(s.player.heading) * s.player.speed * dt;
      const nz = s.player.z + Math.cos(s.player.heading) * s.player.speed * dt;
      if (!inWaterOrBlocked(nx, nz)) {
        const fixed = collideBuildings(city.colliders, nx, nz, 0.8);
        const cl = clampWorld(fixed.x, fixed.z);
        s.player.x = cl.x; s.player.z = cl.z;
      }
    }

    // World systems.
    G.vehicles.stepTraffic(dt, s.player, s.wanted);
    G.boats.step(dt, G.time);
    G.police.step(G, dt);
    G.combat.step(G, dt);
    G.crew.step(G, dt);
    stepPeds(dt);
    G.missions.step(G, dt);
    // Side heist completion.
    if (s.sideHeist && s.heistCollected >= s.sideHeist.target) {
      s.cash += 4000; s.respect += 150;
      s.districts.add(s.player.x, s.player.z, 20);
      G.hud.flash('NEON CASINO HEIST COMPLETE +$4,000');
      s.sideHeist = null; s.heistCollected = 0;
      G.save();
    }
    // Slow health regen out of combat.
    if (s.wanted === 0 && s.health > 0 && s.health < 100) s.health = Math.min(100, s.health + 1.5 * dt);
    // Context prompt.
    const shop = nearestShop();
    const car = s.player.onFoot ? nearestCar(G.vehicles.traffic, s.player.x, s.player.z) : null;
    const boat = s.player.onFoot ? nearestBoat(G.boats.boats, s.player.x, s.player.z) : null;
    G.hud.setPrompt(
      shop ? `E — Enter ${shop.name}` :
      s.player.vehicle ? 'E — Get out' :
      car ? 'E — Steal car' : boat ? 'E — Board boat' :
      s.pistol ? 'Click — shoot · Space — punch' : 'WASD — move · E — use · C — crew · R — radio',
    );
    // Mission beacon.
    const b = G.missions.beaconPos(G);
    if (b) {
      beacon.visible = true;
      beacon.position.set(b.x, 15, b.z);
      beacon.scale.set(1 + Math.sin(G.time * 3) * 0.15, 1, 1 + Math.sin(G.time * 3) * 0.15);
    } else beacon.visible = false;
    // Camera drag orbit.
    G.camOrbit += input.takeDrag() * 0.005;
  } else if (G.screen === 'title') {
    G.vehicles.stepTraffic(dt, s.player, 0);
    G.boats.step(dt, G.time);
    stepPeds(dt);
    beacon.visible = false;
  } else if (actions & ACTION_PAUSE && G.screen === 'paused') {
    G.hud.hide('pause'); G.screen = 'play';
  }

  // Player mesh follows the state.
  if (s.player.vehicle) {
    playerMesh.visible = false;
  } else {
    playerMesh.visible = true;
    playerMesh.position.set(s.player.x, 0, s.player.z);
    playerMesh.rotation.y = s.player.heading;
  }
  updateCamera(dt);
  G.hud.update(G);
}

function punch() {
  const s = G.state;
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - s.player.x, e.z - s.player.z) < 2.6) {
      e.hp -= 1;
      G.audio.beep(220, 0.08);
      if (e.hp <= 0) { e.dead = true; scene.remove(e.mesh); G.onEnemyKilled(e); }
      return;
    }
  }
}

function updateCamera(dt) {
  const s = G.state;
  const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
  if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  renderer.setSize(w, h, false);
  let yaw = s.player.heading;
  let dist = s.player.vehicle ? 17 : 12;
  let height = s.player.vehicle ? 8 : 6.5;
  if (G.screen === 'title' || G.shotMode === 'start') {
    const t = G.time * 0.05;
    camera.position.set(Math.cos(t) * 150, 70, Math.sin(t) * 150);
    camera.lookAt(0, 0, 40);
    return;
  }
  yaw += G.camOrbit;
  const cx = s.player.x - Math.sin(yaw) * dist;
  const cz = s.player.z - Math.cos(yaw) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(s.player.x + Math.sin(s.player.heading) * 6, 2, s.player.z + Math.cos(s.player.heading) * 6);
}

function shotAxis() {
  // Deterministic autopilot for screenshot scenes: drive straight ahead down
  // the road (any steering would drift the car into a building).
  if (shotName === 'drive' || shotName === 'chase') return { f: 1, s: 0 };
  return { f: 0, s: 0 };
}

// ---- Main loop ------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let acc = 0;
let frames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dtMs = Math.min(250, now - last);
  last = now;
  acc += dtMs / 1000;
  let n = 0;
  while (acc >= STEP && n < 5) { stepGame(STEP); acc -= STEP; n += 1; }
  renderer.render(scene, camera);
  frames += 1;
  if (G.shotMode && frames >= 40 && !window.__shotReady) window.__shotReady = true;
}

wireButtons();
if (shotName) {
  stageShot(G, shotName);
} else {
  toTitle();
}
if (selftest) {
  window.__selftest = runSelfTest();
  console.log('SELFTEST', JSON.stringify(window.__selftest));
}
requestAnimationFrame(loop);

// ---- Self test ------------------------------------------------------------
function runSelfTest() {
  const checks = [];
  const check = (name, ok) => { checks.push({ name, ok: !!ok }); return !!ok; };
  try {
    startNewGame();
    check('game starts on mission 1', G.state.missionIndex === 0 && G.screen === 'play');
    check('objective text exists', G.missions.objectiveText(G).length > 5);
    // Walk to the beacon: mission 1 completes.
    const b1 = G.missions.beaconPos(G);
    G.state.player.x = b1.x; G.state.player.z = b1.z;
    for (let i = 0; i < 10; i++) stepGame(STEP);
    check('mission 1 completes at beacon', G.state.missionIndex === 1);
    check('mara recruited after mission 1', G.crew.members.find((m) => m.id === 'mara').recruited);
    // Steal a car: mission 2 step 1 completes.
    const car = G.vehicles.traffic[0];
    G.state.player.x = car.x; G.state.player.z = car.z;
    enterCar(car);
    for (let i = 0; i < 10; i++) stepGame(STEP);
    check('steal advances mission 2', G.state.missionStep === 1);
    check('stealing raises wanted', G.state.wanted > 0);
    // Police spawn under wanted.
    for (let i = 0; i < 180; i++) stepGame(STEP);
    check('police cars spawn', G.police.cars.length > 0);
    // Combat: buy pistol, shoot an enemy.
    G.state.cash = 5000; G.state.pistol = true; G.state.ammo = 10;
    const e = G.combat.spawnEnemy(G.state.player.x + 5, G.state.player.z);
    const before = G.state.ammo;
    G.combat.shoot(G, e.x, e.z);
    check('shooting spends ammo', G.state.ammo === before - 1);
    // Boat boarding.
    const boat = G.boats.boats[0];
    G.state.player.x = boat.x; G.state.player.z = boat.z;
    exitVehicle(); enterBoat(boat);
    check('boat boards', G.state.player.vehicle?.type === 'boat');
    G.boats.stepPlayerBoat(boat, { axis: () => ({ f: 1, s: 0 }) }, 1);
    check('boat moves on water', Math.abs(boat.speed) > 0);
    exitVehicle();
    // Heist planning: quiet needs Juno.
    G.crew.recruit('juno', G.state.player.x, G.state.player.z);
    const summary = G.heists.applyPlan(G, 'marina', { approach: 'quiet', crew: ['juno'], getaway: 'boat' });
    check('quiet heist plan applies', G.state.heistPlan.approach === 'quiet' && summary.includes('Marina'));
    // District standing rises.
    const d0 = G.districts.get('marina');
    G.districts.add(-60, 215, 10);
    check('district standing rises', G.districts.get('marina') === d0 + 10);
    // Save / load round trip.
    G.save();
    const loaded = loadGame();
    check('save round-trips', loaded && loaded.cash === G.state.cash);
    // Minimap + HUD update without throwing.
    G.hud.update(G);
    check('hud updates', true);
    check('no page error', !window.__error);
  } catch (err) {
    checks.push({ name: `exception: ${err.message}`, ok: false });
  }
  const pass = checks.every((c) => c.ok);
  return { pass, checks };
}
