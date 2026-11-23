// buildCity: the whole of Tideline, generated fresh from one seed.
// Dusk delta city: two canals, a marina, five districts that each look
// different, 100+ buildings, street props, bridges whose decks sit FLUSH with
// the road (a raised deck hides the car — checked in the screenshot pass).
import * as THREE from 'three';
import { WORLD, DUSK, DISTRICTS, CANALS, BRIDGES, MARINA } from './config.js';
import { makeRng } from './random.js';

function skyDome() {
  // Big inverted sphere, vertex colours from orange at the horizon to deep
  // blue at the zenith. No texture, no network: pure geometry + colour.
  const geo = new THREE.SphereGeometry(900, 24, 12);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const top = new THREE.Color(DUSK.skyTop);
  const hor = new THREE.Color(DUSK.skyHorizon);
  const pos = geo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 900; // -1..1
    const t = THREE.MathUtils.clamp((y + 0.08) / 0.7, 0, 1);
    c.copy(hor).lerp(top, t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky';
  return dome;
}

function sunDisc() {
  // Low warm sun: a glowing disc just above the horizon, due west.
  const geo = new THREE.CircleGeometry(34, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.95 });
  const disc = new THREE.Mesh(geo, mat);
  disc.position.set(-520, 78, -260);
  disc.lookAt(0, 40, 0);
  disc.name = 'sun-disc';
  return disc;
}

// Shared box geometry, scaled per building: one geometry, many meshes.
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
function box(parent, w, h, d, x, y, z, color, opts = {}) {
  const m = new THREE.Mesh(unitBox, mat(color, opts));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

export function buildCity(scene, seed = WORLD.seed) {
  const rng = makeRng(seed);
  const colliders = []; // {x, z, hw, hd} axis-aligned boxes for driving
  const roads = []; // road centre lines for traffic + minimap
  const buildings = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  scene.fog = new THREE.Fog(DUSK.fogColor, DUSK.fogNear, DUSK.fogFar);
  scene.add(skyDome());
  scene.add(sunDisc());

  const sun = new THREE.DirectionalLight(DUSK.sunColor, DUSK.sunIntensity);
  sun.position.set(...DUSK.sunPosition);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(DUSK.hemiSky, DUSK.hemiGround, DUSK.hemiIntensity));
  scene.add(new THREE.AmbientLight(DUSK.ambient, 0.6));

  // Ground: one big dark slab, plus lighter road ribbons on top.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size + 240, WORLD.size + 240),
    new THREE.MeshLambertMaterial({ color: 0x2e2a33 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = WORLD.groundY;
  group.add(ground);

  // Water: a Phong plane with high specular so the low sun shimmers on it.
  // It covers the whole map; canals and the marina are water, land is ground
  // drawn just above it. Animated in main.js (shimmer phase).
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x27354d, specular: 0xffc27a, shininess: 90,
    transparent: true, opacity: 0.92,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size + 240, WORLD.size + 240), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterLevel;
  water.name = 'water';
  group.add(water);

  // Land is drawn as big slabs just above the water, with the canals left as
  // gaps where the water shows through. Each canal is a water strip.
  const landMat = new THREE.MeshLambertMaterial({ color: 0x35302e });
  for (const canal of CANALS) {
    // Land north and south of the canal.
    const north = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size + 240, (WORLD.size + 240) / 2 - canal.w / 2), landMat);
    north.rotation.x = -Math.PI / 2;
    north.position.set(0, WORLD.groundY + 0.06, canal.z - canal.w / 2 - ((WORLD.size + 240) / 4 - canal.w / 4));
    group.add(north);
    const south = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size + 240, (WORLD.size + 240) / 2 - canal.w / 2), landMat);
    south.rotation.x = -Math.PI / 2;
    south.position.set(0, WORLD.groundY + 0.06, canal.z + canal.w / 2 + ((WORLD.size + 240) / 4 - canal.w / 4));
    group.add(south);
    // Canal banks: pale stone edges so the water reads as a canal, not a hole.
    box(group, WORLD.size + 240, 0.5, 1.2, 0, 0.35, canal.z - canal.w / 2, 0x8a7f72);
    box(group, WORLD.size + 240, 0.5, 1.2, 0, 0.35, canal.z + canal.w / 2, 0x8a7f72);
  }

  // Roads: a grid of dark ribbons with dashed centre lines, crossing the
  // canals only on bridges. Roads run every 70 m; the grid is the traffic net.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x232028 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c98a });
  for (let gx = -210; gx <= 210; gx += 70) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(10, WORLD.size), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(gx, 0.12, 0);
    group.add(r);
    roads.push({ x1: gx, z1: -280, x2: gx, z2: 280 });
    for (let gz = -260; gz <= 260; gz += 16) {
      if (CANALS.some((c) => Math.abs(gz - c.z) < c.w / 2 + 4)) continue;
      box(group, 0.5, 0.05, 7, gx, 0.16, gz, 0xd8c98a);
    }
  }
  for (let gz = -210; gz <= 210; gz += 70) {
    if (CANALS.some((c) => Math.abs(gz - c.z) < c.w / 2 + 6)) continue; // canal: bridge instead
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, 10), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.12, gz);
    group.add(r);
    roads.push({ x1: -280, z1: gz, x2: 280, z2: gz });
    for (let gx = -260; gx <= 260; gx += 16) {
      box(group, 7, 0.05, 0.5, gx, 0.16, gz, 0xd8c98a);
    }
  }
  void lineMat;

  // Bridges: deck FLUSH with the road surface (y = 0.14) so a car driving
  // over one stays visible and the camera does not clip under the deck.
  for (const b of BRIDGES) {
    const canal = CANALS.find((c) => Math.abs(b.z - c.z) < 40) ?? CANALS[0];
    const deck = box(group, b.w, 0.5, canal.w + 10, b.x, 0.14, b.z, 0x4a4440);
    deck.name = 'bridge-deck';
    // Low rails so the bridge reads, without hiding the car.
    box(group, 0.6, 1.0, canal.w + 10, b.x - b.w / 2 + 0.3, 0.7, b.z, 0x8a7f72);
    box(group, 0.6, 1.0, canal.w + 10, b.x + b.w / 2 - 0.3, 0.7, b.z, 0x8a7f72);
  }

  // Districts: each with its own building style, palette and roofline.
  const placed = [];
  function farFromRoads(x, z, pad) {
    return !roads.some((r) => {
      if (r.x1 === r.x2) return Math.abs(x - r.x1) < 8 + pad && z >= r.z1 - pad && z <= r.z2 + pad;
      return Math.abs(z - r.z1) < 8 + pad && x >= r.x1 - pad && x <= r.x2 + pad;
    });
  }
  function inCanal(x, z) {
    return CANALS.some((c) => Math.abs(z - c.z) < c.w / 2 + 6);
  }

  for (const d of DISTRICTS) {
    let made = 0, guard = 0;
    while (made < d.density && guard++ < 400) {
      const a = rng.next() * Math.PI * 2;
      const rr = Math.sqrt(rng.next()) * (d.r - 14);
      const x = d.x + Math.cos(a) * rr;
      const z = d.z + Math.sin(a) * rr;
      if (inCanal(x, z)) continue;
      if (!farFromRoads(x, z, 6)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 14)) continue;
      placed.push({ x, z });
      const w = rng.range(9, 16), dep = rng.range(9, 15);
      const floors = rng.int(d.floors[0], d.floors[1]);
      const h = floors * 4.2 + rng.range(0, 1.5);
      const color = rng.pick(d.palette);
      const b = box(group, w, h, dep, x, h / 2 + 0.1, z, color);
      b.name = `building-${d.id}-${made}`;
      // Roofs: pitched (Old Town), gable (Canal Quarter), stepped (Neon), flat.
      if (d.roof === 'pitched' || d.roof === 'gable') {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dep) * 0.72, 2.6, 4), mat(d.roofColor));
        roof.position.set(x, h + 1.4, z);
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
      } else if (d.roof === 'stepped') {
        box(group, w * 0.62, 2.2, dep * 0.62, x, h + 1.2, z, d.roofColor);
        box(group, w * 0.36, 2.0, dep * 0.36, x, h + 3.2, z, d.roofColor);
      } else {
        box(group, w * 0.9, 0.5, dep * 0.9, x, h + 0.35, z, d.roofColor);
      }
      // Windows: small emissive planes on the two street faces.
      const winMat = new THREE.MeshBasicMaterial({ color: d.id === 'neon' ? 0xffe9a8 : 0xffc46b });
      const winGeo = new THREE.PlaneGeometry(1.4, 1.8);
      const rows = Math.max(1, Math.floor(h / 4.2));
      for (let f = 0; f < rows; f++) {
        for (let k = -1; k <= 1; k += 2) {
          if (rng.chance(0.35)) continue;
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(x + k * (w / 2 + 0.06), 2.6 + f * 4.2, z);
          win.rotation.y = k > 0 ? Math.PI / 2 : -Math.PI / 2;
          group.add(win);
        }
      }
      // Neon signs on the Strip: glowing verticals + a sign board.
      if (d.id === 'neon' && rng.chance(0.7)) {
        const nc = rng.pick(d.neon);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, rng.range(4, 9)),
          new THREE.MeshBasicMaterial({ color: nc }),
        );
        sign.position.set(x + w / 2 + 0.15, h * 0.55, z);
        sign.rotation.y = Math.PI / 2;
        group.add(sign);
        const board = box(group, 0.4, 1.6, rng.range(4, 7), x, h * 0.75, z + dep / 2 + 0.2, nc, { emissive: nc, emissiveIntensity: 0.7 });
        board.name = 'neon-board';
      }
      // Rooftop props: AC boxes, vents, water tanks.
      if (rng.chance(0.6)) box(group, rng.range(1, 2.4), 1, rng.range(1, 2), x + rng.range(-2, 2), h + 0.9, z + rng.range(-2, 2), 0x6a625c);
      colliders.push({ x, z, hw: w / 2 + 0.4, hd: dep / 2 + 0.4 });
      buildings.push({ x, z, w, h, d: dep, district: d.id });
      made++;
    }
  }

  // Market Row stalls: 14 colourful stalls with striped awnings.
  const market = DISTRICTS.find((d) => d.id === 'market');
  for (let i = 0; i < 14; i++) {
    const x = market.x - 40 + (i % 7) * 13 + rng.range(-2, 2);
    const z = market.z + 34 + Math.floor(i / 7) * 12 + rng.range(-2, 2);
    box(group, 4.4, 2.6, 3.4, x, 1.3, z, rng.pick([0xd95f4b, 0x4fae8d, 0xe8b13c, 0x5b8dd9]));
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.8), new THREE.MeshLambertMaterial({ color: rng.pick([0xfff2d8, 0xff5a4e, 0x2fae7d]), side: THREE.DoubleSide }));
    awn.rotation.x = -Math.PI / 2.6;
    awn.position.set(x, 3.1, z - 0.4);
    group.add(awn);
    box(group, 1, 0.9, 1, x + 2.6, 0.45, z + 1.6, 0x7a5a34); // crate beside the stall
  }

  // Marina: wooden docks reaching into the water, moored boats, lamps.
  const marina = DISTRICTS.find((d) => d.id === 'marina');
  for (let i = 0; i < 4; i++) {
    const z = marina.z + 30 + i * 14;
    box(group, 26, 0.5, 3, MARINA.x - 4, 0.55, z, 0x6a4a2e); // dock planks
    for (let p = 0; p < 5; p++) box(group, 0.5, 1.1, 0.5, MARINA.x - 15 + p * 6, 0.8, z, 0x4a3a26);
  }
  const boatSpots = [];
  for (let i = 0; i < MARINA.boats; i++) {
    const x = MARINA.x - 8 + rng.range(-6, 26);
    const z = marina.z + 24 + i * 13 + rng.range(-3, 3);
    boatSpots.push({ x, z, angle: rng.range(-0.4, 0.4) });
  }

  // Street props: palms, lamps, benches, hydrants, crates, billboards, lights.
  for (let i = 0; i < 46; i++) {
    const x = rng.range(-240, 240), z = rng.range(-240, 240);
    if (inCanal(x, z)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 10)) continue;
    // Palm: trunk + a crown of flat fronds.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), mat(0x6a4a2e));
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshLambertMaterial({ color: 0x2f7a3a, side: THREE.DoubleSide }));
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.8, 7.2, z + Math.sin(a) * 1.8);
      frond.rotation.set(-0.5, a, 0.4);
      group.add(frond);
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-240, 240), z = rng.range(-240, 240);
    if (inCanal(x, z)) continue;
    box(group, 0.3, 5.4, 0.3, x, 2.7, z, 0x3a3a40); // lamp post
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    lamp.position.set(x, 5.6, z);
    group.add(lamp);
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-240, 240), z = rng.range(-240, 240);
    if (inCanal(x, z)) continue;
    box(group, rng.range(1, 2), rng.range(0.8, 1.4), rng.range(1, 2), x, 0.6, z, 0x7a5a34); // crate
    if (rng.chance(0.5)) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.5, 10), mat(rng.pick([0x8a2f2f, 0x2f5a8a, 0x3f6a3f])));
      barrel.position.set(x + 2.4, 0.75, z);
      group.add(barrel);
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = rng.range(-240, 240), z = rng.range(-240, 240);
    if (inCanal(x, z)) continue;
    box(group, 0.5, 1.1, 0.5, x, 0.55, z, 0xb03a2a); // hydrant
    box(group, 2.2, 0.5, 0.6, x + 4, 0.45, z, 0x5a4a3a); // bench
  }
  // Billboards: big lit panels on posts, facing the roads.
  const ads = ['TIDELINE', 'DELTA FM', 'NEON 88', 'TIDE TRIAL', 'KINGS'];
  for (let i = 0; i < 5; i++) {
    const x = -180 + i * 90, z = -180 + (i % 2) * 330;
    box(group, 1, 9, 1, x, 4.5, z, 0x3a3a40);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 5),
      new THREE.MeshBasicMaterial({ color: [0xff2e88, 0x00e5ff, 0xffe14d, 0x7cff5e, 0xff6a00][i] }),
    );
    panel.position.set(x, 10.5, z);
    panel.rotation.y = i % 2 ? 0 : Math.PI / 2;
    group.add(panel);
    void ads;
  }
  // Traffic lights at the main crossings.
  for (const [x, z] of [[-140, -140], [0, -140], [140, -140], [-140, 140], [0, 140], [140, 140]]) {
    box(group, 0.4, 6, 0.4, x, 3, z, 0x2a2a2e);
    const lampG = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2eff5e }));
    lampG.position.set(x, 5.6, z);
    group.add(lampG);
  }

  return { group, water, colliders, roads, buildings, boatSpots, districts: DISTRICTS };
}

export function districtAt(x, z) {
  let best = null, bd = 1e9;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(x - d.x, z - d.z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return bd < best.r + 40 ? best : null;
}
