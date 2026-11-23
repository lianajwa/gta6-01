// main.js: TIDELINE — Delta Kings. Boots the renderer, owns the game loop,
// the player, the camera, and wires every system together. Everything the
// self-test and the screenshot poses need hangs off the `game` object.
import * as THREE from 'three';
import { WORLD, DRIVE, TRIAL, SAFEHOUSE, SHOPS, MISSIONS, HEISTS, RADIO } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { buildCity, districtAt } from './city.js';
import { makeCarMesh, makeBoatMesh, createVehicle, driveVehicle, createTraffic, updateTraffic, createPedestrians, updatePedestrians } from './vehicles.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHeists } from './heists.js';
import { createCrew } from './crew.js';
import { createEconomy } from './economy.js';
import { saveGame, loadGame, createAutosave } from './save.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { parseShot, applyShot } from './shots.js';
import { runSelfTest } from './selftest.js';

// Log every network request so the self-test can prove none left the origin.
window.__netLog = [];
const realFetch = window.fetch.bind(window);
window.fetch = (...a) => { window.__netLog.push(String(a[0])); return realFetch(...a); };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(DRIVE.fovBase, window.innerWidth / window.innerHeight, 0.1, 2000);

const params = parseShot();
const rng = makeRng(params.seed || WORLD.seed);
const city = buildCity(scene, params.seed || WORLD.seed);
const input = createInput(canvas);
const combat = createCombat(scene, rng.fork('combat')); // seeded enemy timers
const police = createPolice(scene);
const crew = createCrew();
const economy = createEconomy();
const audio = createAudio();
const hud = createHud();
const autosave = createAutosave(30);

let toastMsg = '';
function toast(t) { toastMsg = t; }

// --- player ---------------------------------------------------------------
const playerMesh = new THREE.Group();
{
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.15, 10), new THREE.MeshLambertMaterial({ color: 0xd83a2e }));
  jacket.position.y = 0.95; playerMesh.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a67a }));
  head.position.y = 1.8; playerMesh.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x22222a }));
  cap.position.y = 2.02; playerMesh.add(cap);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.32), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
  legs.position.y = 0.36; playerMesh.add(legs);
}
scene.add(playerMesh);

const player = {
  x: SAFEHOUSE.x, z: SAFEHOUSE.z, heading: 0.5, hp: crew.maxHp(),
  speed: 0, onFoot: true, moving: false,
};

// --- parked cars + boats the player can steal ------------------------------
const parked = [];
{
  const spots = [
    [-100, -90, 0.3, 0xc23b2e], [-60, -150, 1.2, 0x2e6ac2], [90, -100, -0.8, 0xd8a13c],
    [120, 40, 2.1, 0x4a9a5a], [-160, 60, 0.9, 0x8a8a92], [30, 120, -1.4, 0x5a3a7a],
    [-40, 180, 0.2, 0xd8d8d8], [200, -20, 1.8, 0xc23b2e],
  ];
  for (const [x, z, h, color] of spots) {
    const mesh = makeCarMesh(color, rng);
    mesh.position.set(x, 0.1, z);
    mesh.rotation.y = h;
    scene.add(mesh);
    parked.push({ mesh, x, z, heading: h, color, taken: false });
  }
}
const boats = [];
for (const s of city.boatSpots) {
  const mesh = makeBoatMesh(0x2e6ac2);
  mesh.position.set(s.x, 0.02, s.z);
  mesh.rotation.y = s.angle;
  scene.add(mesh);
  boats.push({ mesh, x: s.x, z: s.z, heading: s.angle, color: 0x2e6ac2, taken: false });
}

// --- traffic + pedestrians -------------------------------------------------
const traffic = createTraffic(scene, city.roads, city.colliders, 14);
const peds = createPedestrians(scene, 22);

// --- trial buoys -----------------------------------------------------------
const trialBuoys = [];
{
  const buoyGeo = new THREE.TorusGeometry(2.2, 0.55, 10, 20);
  const buoyMat = new THREE.MeshBasicMaterial({ color: 0xff8c42 });
  for (const b of TRIAL.buoys) {
    const m = new THREE.Mesh(buoyGeo, buoyMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(b.x, 0.35, b.z);
    scene.add(m);
    trialBuoys.push({ ...b, mesh: m, hit: false });
  }
}
const trial = { active: false, t: 0, next: 0, best: null, done: false };
{
  const s = loadGame();
  if (s && typeof s.trialBest === 'number') trial.best = s.trialBest;
}

// --- missions / heists ------------------------------------------------------
const missions = createMissions((ev) => {
  if (ev.type === 'mission-complete') {
    economy.earn(ev.pay, ev.rep, missions.active ? missions.active.mission.district : null);
    toast(`Mission done: ${ev.mission.name} — $${ev.pay} +${ev.rep} respect`);
    audio.blip(990, 0.15, 0.15);
    saveNow();
  } else if (ev.type === 'mission-start') {
    toast(`New mission: ${ev.mission.name}`);
  } else if (ev.type === 'story-done') {
    toast('STORY COMPLETE — you are the Delta King!');
  }
});
missions.start(0);

const heists = createHeists((ev) => {
  if (ev.type === 'heist-done') {
    economy.earn(ev.pay, 120);
    toast(`Heist done: ${ev.heist.name} — $${ev.pay}`);
    saveNow();
  } else if (ev.type === 'heist-failed') {
    toast(`Heist failed: ${ev.heist.name}`);
    police.addHeat(2, crew.lookout);
  }
});

// --- heist planning overlay -------------------------------------------------
const planEl = document.createElement('div');
planEl.id = 'heist-plan';
planEl.style.display = 'none';
planEl.innerHTML = `
  <h2 id="plan-title">Heist</h2>
  <p id="plan-text"></p>
  <button id="plan-loud">LOUD</button>
  <button id="plan-quiet">QUIET</button>
  <button id="plan-cancel">Cancel</button>
`;
document.body.appendChild(planEl);
planEl.querySelector('#plan-loud').onclick = () => { heists.startPlan('loud', crew.hacker); planEl.style.display = 'none'; };
planEl.querySelector('#plan-quiet').onclick = () => { heists.startPlan('quiet', crew.hacker); planEl.style.display = 'none'; };
planEl.querySelector('#plan-cancel').onclick = () => { heists.closePlanning(); planEl.style.display = 'none'; };

// --- start screen -----------------------------------------------------------
const startEl = document.createElement('div');
startEl.id = 'start-screen';
startEl.innerHTML = `
  <h1>TIDELINE</h1>
  <h2>— Delta Kings —</h2>
  <p>A 3D open-world crime game in a dusk river-delta city.</p>
  <p class="controls">WASD move / drive &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; E enter car or boat &nbsp;·&nbsp; Space handbrake drift<br>
  F or click: fire pistol &nbsp;·&nbsp; 1/2/3 radio &nbsp;·&nbsp; M mute &nbsp;·&nbsp; Esc pause</p>
  <p class="controls">10 story missions · 2 heists · Tide Trial boat race · crew of 4 · 5 respect ranks</p>
  <p class="controls">${crew.bonusText()}</p>
  <button id="start-btn">START ENGINE</button>
`;
document.body.appendChild(startEl);
let started = false;
if (params.selftest) { started = true; startEl.style.display = 'none'; }
if (params.shot) { startEl.style.display = 'none'; } // screenshots show the
// game, not the start screen; the simulation stays paused so the pose holds
startEl.querySelector('#start-btn').onclick = () => {
  started = true;
  startEl.style.display = 'none';
  audio.unlock();
  toast('Welcome to Tideline. Mission 1: meet Mara in Old Town.');
};

// --- camera ------------------------------------------------------------------
let camYaw = player.heading + Math.PI;
let camPitch = 0.32;
let camDist = 9;
let cameraMode = 'follow';
let fovCur = DRIVE.fovBase;
let shake = 0;

// --- vehicle state ------------------------------------------------------------
let vehicle = null; // createVehicle() result or null

function nearestParked(maxD) {
  let best = null, bd = maxD;
  for (const p of parked) {
    if (p.taken) continue;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function nearestBoat(maxD) {
  let best = null, bd = maxD;
  for (const b of boats) {
    if (b.taken) continue;
    const d = Math.hypot(b.x - player.x, b.z - player.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function enterVehicle(kind, x, z, heading, color) {
  let mesh;
  if (kind === 'boat') {
    mesh = makeBoatMesh(color ?? 0x2e6ac2);
  } else {
    mesh = makeCarMesh(color ?? 0xc23b2e, rng);
  }
  scene.add(mesh);
  vehicle = createVehicle(mesh, kind, {
    x: x ?? player.x + 2, z: z ?? player.z, heading: heading ?? player.heading,
    topSpeedMul: crew.topSpeedMul(), gripMul: crew.gripMul(),
  });
  // Position the mesh NOW, not only in driveVehicle: driveVehicle runs in
  // the gameplay block, which is skipped while paused (start screen, shot
  // poses) — without this the mesh sat at (0,0,0) and the car was invisible
  // in every screenshot pose.
  mesh.position.set(vehicle.x, kind === 'boat' ? 0.02 : 0.1, vehicle.z);
  mesh.rotation.y = vehicle.heading;
  player.onFoot = false;
  return vehicle;
}
function exitVehicle() {
  if (!vehicle) return;
  player.x = vehicle.x + Math.sin(vehicle.heading + 1.4) * 2.5;
  player.z = vehicle.z + Math.cos(vehicle.heading + 1.4) * 2.5;
  player.heading = vehicle.heading;
  scene.remove(vehicle.mesh);
  vehicle = null;
  player.onFoot = true;
}

function firePistol() {
  if (!combat.hasPistol) { toast('No pistol — buy one at the Gun Shop.'); return 'unarmed'; }
  const r = combat.fire(player.x, player.z, player.heading, 0);
  if (r === 'hit' || r === 'kill' || r === 'miss') {
    audio.gunshot();
    police.addHeat(1, crew.lookout);
    if (r === 'kill') { missions.noteKill(); economy.earn(25, 5); }
  }
  return r;
}

// --- trial --------------------------------------------------------------------
function startTrial() {
  if (!vehicle || vehicle.kind !== 'boat') return false;
  trial.active = true; trial.t = 0; trial.next = 0; trial.done = false;
  for (const b of trialBuoys) b.hit = false;
  toast('Tide Trial started — hit all 5 buoys!');
  return true;
}
function touchBuoy(b) {
  const idx = trialBuoys.indexOf(b);
  if (trial.active && idx === trial.next) {
    b.hit = true;
    trial.next++;
    audio.blip(1200, 0.1, 0.12);
    if (trial.next >= trialBuoys.length) {
      trial.active = false;
      trial.done = true;
      const t = trial.t;
      if (trial.best === null || t < trial.best) trial.best = t;
      economy.earn(TRIAL.pay, TRIAL.respect);
      toast(`Trial done in ${t.toFixed(1)}s — best ${trial.best.toFixed(1)}s — $${TRIAL.pay} +${TRIAL.respect} respect`);
      saveNow();
    }
  }
}

// --- save ---------------------------------------------------------------------
function saveData() {
  return {
    cash: economy.state.cash, respect: economy.state.respect,
    mission: missions.current, trialBest: trial.best,
    standing: economy.state.standing,
    hp: player.hp, x: player.x, z: player.z,
  };
}
function saveNow() { autosave.saveNow(saveData); }

// --- game object (self-test + shots API) ---------------------------------------
const game = {
  renderer, scene, camera, city, input, combat, police, missions, heists, crew, economy,
  player, trialBuoys, get trialDone() { return trial.done; }, missionList: MISSIONS, heistList: HEISTS,
  get vehicle() { return vehicle; },
  get trial() { return trial; },
  step(dt) { update(dt); },
  enterVehicle, exitVehicle, firePistol, startTrial, touchBuoy, saveNow,
  loadSave: () => loadGame(),
  placePlayer(x, z, heading) {
    player.x = x; player.z = z; player.heading = heading ?? player.heading;
    camYaw = player.heading + Math.PI; // camera follows the new heading
    playerMesh.position.set(x, 0, z);
    playerMesh.rotation.y = player.heading;
  },
  gotoMission(n) { missions.start(n - 1); },
  openHeist(id) {
    const h = heists.openPlanning(id);
    if (h) {
      document.getElementById('plan-title').textContent = h.name;
      document.getElementById('plan-text').textContent = `${h.text} Loud: ${h.loud.time}s, ${h.loud.guards} guards, $${h.loud.pay}. Quiet: ${h.quiet.time}s, ${h.quiet.guards} guards, $${h.quiet.pay}.`;
      planEl.style.display = 'block';
    }
    return h;
  },
  setWanted(n) { police.state.heat = n; police.sync(); },
  get cameraMode() { return cameraMode; },
  set cameraMode(m) { cameraMode = m; },
  shotPose: null,
};
window.__game = game;

// Restore a save if one exists.
{
  const s = loadGame();
  if (s) {
    economy.state.cash = s.cash;
    economy.state.respect = s.respect;
    if (s.standing) economy.state.standing = { ...economy.state.standing, ...s.standing };
    if (typeof s.mission === 'number' && s.mission > 0 && s.mission < MISSIONS.length) missions.start(s.mission);
    if (typeof s.hp === 'number') player.hp = Math.min(s.hp, crew.maxHp());
    if (typeof s.x === 'number') { player.x = s.x; player.z = s.z; }
  }
}
combat.hasPistol = true; // the story hands Mara's pistol to the player in mission 1

// --- per-frame update ----------------------------------------------------------
let last = performance.now();
let sirenT = 0;

function update(dt) {
  // No clamp here: the real-time loop already clamps its own dt to 0.05,
  // and the self-test / shot poses drive update() with larger steps on
  // purpose — clamping here silently shrank every simulated second to 50ms,
  // so a 0.5s WALK only moved 0.30m and a 1.2s drive never got past 1 m/s.
  // Water shimmer: the low sun plays on the Phong water.
  const wt = performance.now() * 0.0006;
  city.water.material.specular.setHSL(0.08, 0.7, 0.55 + Math.sin(wt) * 0.12);
  city.water.position.y = WORLD.waterLevel + Math.sin(wt * 0.7) * 0.05;
  for (const b of trialBuoys) b.mesh.position.y = 0.35 + Math.sin(wt * 2 + b.x) * 0.08;

  // Mouse orbit.
  camYaw -= input.state.mouseDX * 0.004;
  camPitch = THREE.MathUtils.clamp(camPitch + input.state.mouseDY * 0.003, 0.08, 1.1);
  camDist = THREE.MathUtils.clamp(camDist + input.state.wheel * 0.005, 5, 16);

  const paused = !started;
  if (!paused) {
    // Radio + mute.
    if (input.wasPressed('Digit1')) { audio.setStation(0); toast('Radio: DELTA FM'); }
    if (input.wasPressed('Digit2')) { audio.setStation(1); toast('Radio: NEON 88'); }
    if (input.wasPressed('Digit3')) { audio.setStation(2); toast('Radio: TIDE RADIO'); }
    if (input.wasPressed('KeyM')) { audio.setMuted(!audio.muted); toast(audio.muted ? 'Muted' : 'Sound on'); }

    if (vehicle) {
      driveVehicle(vehicle, input, dt, city.colliders, false);
      if (input.wasPressed('KeyE')) exitVehicle();
      const speedN = Math.abs(vehicle.speed) / (DRIVE.maxSpeed * crew.topSpeedMul());
      audio.engine(speedN, true);
      // FOV kick with speed; shake on hard hits.
      const targetFov = DRIVE.fovBase + DRIVE.fovKick * Math.min(1, speedN);
      fovCur += (targetFov - fovCur) * Math.min(1, dt * 4);
      if (vehicle.damaged > 0) { shake = Math.max(shake, DRIVE.cameraShake * (vehicle.damaged / 100)); vehicle.damaged = 0; }
      // Trial buoys: touch them in order while in a boat.
      if (vehicle.kind === 'boat' && trial.active) {
        const b = trialBuoys[trial.next];
        if (b && Math.hypot(vehicle.x - b.x, vehicle.z - b.z) < 6) touchBuoy(b);
      }
      // Trial auto-start at the marina buoy.
      if (vehicle.kind === 'boat' && !trial.active && !trial.done) {
        if (Math.hypot(vehicle.x - TRIAL.start.x, vehicle.z - TRIAL.start.z) < 8 && input.wasPressed('KeyE')) startTrial();
      }
    } else {
      // On foot: camera-relative WASD, Shift to run.
      const run = input.down('ShiftLeft') || input.down('ShiftRight');
      const sp = (run ? 10 : 6);
      const f = input.axis('KeyS', 'KeyW');
      const s = input.axis('KeyA', 'KeyD');
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const mx = (sin * f + cos * s);
      const mz = (cos * f - sin * s);
      const len = Math.hypot(mx, mz);
      player.moving = len > 0.01;
      if (player.moving) {
        const nx = player.x + (mx / len) * sp * dt;
        const nz = player.z + (mz / len) * sp * dt;
        // Keep the player out of buildings.
        let blocked = false;
        for (const c of city.colliders) {
          if (Math.abs(nx - c.x) < c.hw + 0.5 && Math.abs(nz - c.z) < c.hd + 0.5) { blocked = true; break; }
        }
        if (!blocked) {
          player.x = THREE.MathUtils.clamp(nx, -275, 275);
          player.z = THREE.MathUtils.clamp(nz, -275, 275);
          player.heading = Math.atan2(mx, mz);
        }
      }
      playerMesh.position.set(player.x, 0, player.z);
      playerMesh.rotation.y = player.heading;
      playerMesh.position.y = player.moving ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.06 : 0;
      audio.engine(0, false);
      fovCur += (DRIVE.fovBase - fovCur) * Math.min(1, dt * 4);

      // Enter a parked car or a boat with E.
      if (input.wasPressed('KeyE')) {
        const car = nearestParked(4);
        const boat = nearestBoat(4);
        if (car) {
          car.taken = true;
          enterVehicle('car', car.x, car.z, car.heading, car.color);
          scene.remove(car.mesh);
          police.addHeat(1, crew.lookout);
          toast('Car stolen — wanted +1');
        } else if (boat) {
          boat.taken = true;
          enterVehicle('boat', boat.x, boat.z, boat.heading, boat.color);
          scene.remove(boat.mesh);
          toast('Boat taken — head for the canals');
        } else if (Math.hypot(player.x - TRIAL.start.x, player.z - TRIAL.start.z) < 8) {
          toast('Get in a boat and press E at the start buoy to run the Tide Trial.');
        }
      }
      // Fire with F or mouse click.
      if (input.wasPressed('KeyF') || (input.state.mouseDown && input.wasPressed('Mouse0'))) firePistol();
      if (input.down('Mouse0') && combat.cooldown <= 0) firePistol();
    }

    // Combat: enemies shoot back; getting shot hurts.
    const shot = combat.update(dt, player.x, player.z);
    if (shot && shot.enemyShot) {
      player.hp -= 7;
      audio.blip(220, 0.1, 0.1);
      if (player.hp <= 0) {
        player.hp = crew.maxHp();
        economy.spend(150);
        player.x = SHOPS.clinic.x; player.z = SHOPS.clinic.z;
        if (vehicle) { scene.remove(vehicle.mesh); vehicle = null; player.onFoot = true; }
        police.state.heat = 0; police.sync();
        toast('WASTED — patched up at the clinic (−$150)');
      }
    }

    // Missions + heists.
    const mres = missions.update(dt, player.x, player.z, {
      wanted: police.state.stars, kills: missions.kills,
      trialDone: trial.done, raceWon: false, defended: false,
    });
    if (mres && mres.completed && mres.completed.id === 5) {
      // Mission 5 done: the warehouse is clear; rivals were spawned on arrival.
    }
    if (missions.active && missions.active.mission.kind === 'combat' && combat.enemies.filter((e) => e.alive).length === 0 && missions.active.phase === 'go') {
      missions.active.phase = 'spawned';
      for (let i = 0; i < 4; i++) combat.spawnEnemy(scene, -140 + (i - 2) * 6, 130 + (i % 2) * 8);
      toast('Rivals in the warehouse — clear them out!');
    }
    heists.update(dt, { atEscape: missions.active ? Math.hypot(player.x - SAFEHOUSE.x, player.z - SAFEHOUSE.z) < 12 : false });

    // Wanted + police.
    const busted = police.update(dt, player.x, player.z, vehicle ? Math.abs(vehicle.speed) : (player.moving ? 6 : 0), !!vehicle, crew.lookout);
    if (busted === 'busted') {
      economy.spend(200);
      player.x = SAFEHOUSE.x; player.z = SAFEHOUSE.z;
      police.state.heat = 0; police.sync();
      toast('BUSTED — bailed out at the safehouse (−$200)');
    }
    // Siren blips while wanted.
    if (police.state.stars > 0) {
      sirenT -= dt;
      if (sirenT <= 0) { sirenT = 0.9; audio.siren(true); }
    }

    // Trial timer.
    if (trial.active) {
      trial.t += dt;
      if (trial.t > 180) { trial.active = false; toast('Trial timed out.'); }
    }

    // Traffic + pedestrians.
    updateTraffic(traffic, dt, player);
    updatePedestrians(peds, dt, { x: player.x, z: player.z, level: police.state.stars });

    // Autosave.
    autosave.tick(dt, saveData);
  }

  // --- camera -----------------------------------------------------------------
  const focus = vehicle ? { x: vehicle.x, z: vehicle.z, h: vehicle.heading } : { x: player.x, z: player.z, h: player.heading };
  let cx, cy, cz, lx, ly, lz;
  if (cameraMode === 'wide') {
    cx = focus.x + 26; cy = 20; cz = focus.z + 26; lx = focus.x; ly = 2; lz = focus.z;
  } else if (vehicle) {
    const back = 10 + Math.abs(vehicle.speed) * 0.08;
    const hx = Math.sin(vehicle.heading + vehicle.slip * 0.3);
    const hz = Math.cos(vehicle.heading + vehicle.slip * 0.3);
    cx = vehicle.x - hx * back; cz = vehicle.z - hz * back;
    cy = 4.2 + Math.abs(vehicle.speed) * 0.03;
    lx = vehicle.x + hx * DRIVE.lookAhead; ly = 1.6; lz = vehicle.z + hz * DRIVE.lookAhead;
  } else {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    cx = player.x - fx * camDist;
    cz = player.z - fz * camDist;
    cy = 3.2 + Math.sin(camPitch) * camDist;
    lx = player.x + fx * 4; ly = 1.6; lz = player.z + fz * 4;
  }
  if (shake > 0) {
    cx += (Math.random() - 0.5) * shake;
    cy += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.2);
  }
  camera.position.set(cx, cy, cz);
  camera.lookAt(lx, ly, lz);
  camera.fov = fovCur;
  camera.updateProjectionMatrix();

  // --- HUD (live every frame) --------------------------------------------------
  const district = districtAt(player.x, player.z);
  const rank = economy.rank();
  hud.update(dt, {
    stars: police.state.stars,
    cash: economy.state.cash,
    rank: rank.name,
    hp: player.hp,
    maxHp: crew.maxHp(),
    objective: missions.objectiveText(),
    trial: trial.active
      ? `TIDE TRIAL ${trial.t.toFixed(1)}s — buoy ${trial.next + 1}/5 — best ${trial.best === null ? '--' : trial.best.toFixed(1) + 's'}`
      : (trial.best !== null ? `Tide Trial best: ${trial.best.toFixed(1)}s` : ''),
    radio: `${audio.station.name} · ${audio.station.desc}`,
    district: district ? district.name : 'Tideline',
    hint: vehicle
      ? (vehicle.kind === 'boat' ? 'E exit boat · Space drift' : 'E exit car · Space handbrake')
      : (nearestParked(4) ? 'E steal car' : nearestBoat(4) ? 'E take boat' : ''),
    toast: toastMsg,
    world: {
      canals: [{ z: -40, w: 26 }, { z: 80, w: 22 }],
      roads: city.roads,
      trialBuoys,
      mission: missions.marker(),
      cops: police.cops,
      player: { x: player.x, z: player.z, heading: vehicle ? vehicle.heading : player.heading },
    },
  });
  toastMsg = '';
  input.consumeFrame();
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Screenshot pose first, then the loop. In self-test mode the test drives.
if (params.shot) applyShot(game, params.name);
// The heist pose opens the planning dialog; the screenshot should show the
// marina itself, not the dialog covering it.
if (params.name === 'heist') planEl.style.display = 'none';
requestAnimationFrame(loop);
if (params.selftest) {
  setTimeout(() => runSelfTest(game).catch((e) => { document.title = 'SELFTEST ERROR ' + e.message; }), 1200);
}
