// The city of Tideline: a river-delta canal city built procedurally from boxes.
// Ground, two crossing canals + marina water, a road grid with bridges over the
// canals, blocks of varied buildings, palms, lamps, shop markers and docks.
// Returns meshes plus the data the gameplay needs: building AABBs (colliders),
// road lines, bridge spans and water rectangles.
import * as THREE from 'three';
import { ROADS, WORLD, SHOPS } from './config.js';

const BUILDING_COLORS = [0xd8c49a, 0xc98f5f, 0x8fa8bf, 0xb5654a, 0x7fb069, 0xe0a458, 0x6d6875, 0xf4d58d, 0x9db4c0];
const ROOF_COLORS = [0x8a5a3b, 0x5a6b7a, 0x7a4a3a, 0x4a5a4a];

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function isWater(x, z) {
  if (z >= 200 && z <= 240 && x >= -120 && x <= 120) return true; // marina basin
  if (Math.abs(z - 30) <= WORLD.canalHalf && Math.abs(x) <= 240) return true; // east-west canal
  if (Math.abs(x - 30) <= WORLD.canalHalf && Math.abs(z) <= 240) return true; // north-south canal
  return false;
}
export function onBridge(x, z) {
  // A road crossing a canal counts as a bridge: cars and feet may cross there.
  const nearRoadX = ROADS.some((r) => Math.abs(x - r) <= 6);
  const nearRoadZ = ROADS.some((r) => Math.abs(z - r) <= 6);
  if (Math.abs(z - 30) <= WORLD.canalHalf && nearRoadX) return true;
  if (Math.abs(x - 30) <= WORLD.canalHalf && nearRoadZ) return true;
  return false;
}
export function inWaterOrBlocked(x, z) { return isWater(x, z) && !onBridge(x, z); }

export function buildCity(scene, rng) {
  const colliders = []; // {x0,z0,x1,z1}
  const group = new THREE.Group();
  scene.add(group);

  // Ground sits slightly below the water so the canals read as channels.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshLambertMaterial({ color: 0x9aa86b }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true;
  group.add(ground);

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2a7f9e });
  const waterGeoms = [
    [480, 24, 0, 30], [24, 480, 30, 0], [240, 40, 0, 220],
  ];
  for (const [w, d, x, z] of waterGeoms) {
    const wtr = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat);
    wtr.rotation.x = -Math.PI / 2; wtr.position.set(x, 0.04, z);
    group.add(wtr);
  }
  // Canal banks (quays) so the water reads as a channel, not a puddle.
  for (const [w, d, x, z] of [[480, 2, 0, 17], [480, 2, 0, 43], [2, 480, 17, 0], [2, 480, 43, 0]]) {
    group.add(box(w, 0.6, d, 0x8a7a5a, x, 0.3, z));
  }

  // Roads: dark strips along every grid line, plus pale sidewalks.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f44 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (const r of ROADS) {
    for (const [w, d, x, z] of [
      [WORLD.size, WORLD.roadWidth, 0, r], [WORLD.roadWidth, WORLD.size, r, 0],
      [WORLD.size, WORLD.roadWidth + 4, 0, r], [WORLD.roadWidth + 4, WORLD.size, r, 0],
    ]) {
      const mat = w === WORLD.roadWidth || d === WORLD.roadWidth ? roadMat : walkMat;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, w === WORLD.roadWidth || d === WORLD.roadWidth ? 0.06 : 0.03, z);
      strip.receiveShadow = true;
      group.add(strip);
    }
  }
  // Bridges: raised road decks over the canals, on every road including the
  // central ones, so cars and feet can cross the water anywhere a road does.
  const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x6b5d4f });
  for (const r of ROADS) {
    group.add(box(12, 0.8, 30, 0x6b5d4f, r, 0.4, 30));
    group.add(box(30, 0.8, 12, 0x6b5d4f, 30, 0.4, r));
  }
  void bridgeMat;

  // Buildings: one block per grid cell, 1-3 boxes, never on water or roads.
  const cells = [];
  for (let ix = 0; ix < ROADS.length - 1; ix++) {
    for (let iz = 0; iz < ROADS.length - 1; iz++) {
      const x0 = ROADS[ix] + 8, x1 = ROADS[ix + 1] - 8;
      const z0 = ROADS[iz] + 8, z1 = ROADS[iz + 1] - 8;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (isWater(cx, cz)) continue;
      if (Math.abs(cx) < 20 && Math.abs(cz) < 20) continue; // central plaza
      cells.push([x0, z0, x1, z1]);
    }
  }
  for (const [x0, z0, x1, z1] of cells) {
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const w = rng.int(14, 26), d = rng.int(14, 26);
      const x = x0 + w / 2 + rng.next() * Math.max(1, (x1 - x0) - w);
      const z = z0 + d / 2 + rng.next() * Math.max(1, (z1 - z0) - d);
      const h = rng.int(8, 42);
      const color = rng.pick(BUILDING_COLORS);
      const b = box(w, h, d, color, x, h / 2, z);
      group.add(b);
      group.add(box(w + 1, 1.2, d + 1, rng.pick(ROOF_COLORS), x, h + 0.6, z));
      // Lit windows: a few small emissive planes on the front face.
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      const rows = Math.min(4, Math.floor(h / 8));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 3; c++) {
          if (rng.next() < 0.45) continue;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), winMat);
          win.position.set(x - w / 2 + 4 + c * (w / 3), 4 + r * 7, z + d / 2 + 0.06);
          group.add(win);
        }
      }
      colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    }
  }

  // Palms along roads and the marina.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  function palm(x, z) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    t.position.set(x, 3.5, z); t.castShadow = true; group.add(t);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 7, 5), leafMat);
    top.position.set(x, 7.6, z); top.scale.y = 0.6; top.castShadow = true; group.add(top);
  }
  for (let i = 0; i < 90; i++) {
    const r = rng.pick(ROADS);
    const along = rng.int(-220, 220);
    if (rng.next() < 0.5) palm(r + 9, along); else palm(along, r + 9);
  }
  for (let i = 0; i < 10; i++) palm(-110 + i * 22, 196);

  // Street lamps.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 60; i++) {
    const r = rng.pick(ROADS);
    const along = rng.int(-220, 220);
    const side = rng.next() < 0.5 ? 7 : -7;
    // Lamps stand on the sidewalk, 7 units off the road centre — never in the road.
    const x = rng.next() < 0.5 ? r + side : along;
    const z = x === along ? r + side : along;
    if (isWater(x, z)) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.5, 6), lampMat);
    pole.position.set(x, 2.75, z); group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), glowMat);
    bulb.position.set(x, 5.6, z); group.add(bulb);
  }

  // Shop markers: coloured kiosk + floating sign block.
  const shopMeshes = [];
  for (const s of SHOPS) {
    const kiosk = box(8, 4, 6, new THREE.Color(s.color).getHex(), s.x, 2, s.z);
    group.add(kiosk);
    const sign = box(7, 1.6, 0.6, 0x222222, s.x, 5.4, s.z);
    group.add(sign);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color).getHex() }));
    glow.position.set(s.x, 5.4, s.z + 0.35);
    group.add(glow);
    shopMeshes.push({ ...s, mesh: kiosk });
  }

  // Marina docks: wooden piers into the basin.
  for (const x of [-90, -30, 30, 90]) {
    group.add(box(6, 0.5, 26, 0x8a6b45, x, 0.4, 212));
  }

  return { group, colliders, shopMeshes };
}

// Push a circle (x,z,r) out of building colliders; returns corrected {x,z}.
export function collideBuildings(colliders, x, z, r) {
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r; z = nz + (dz / d) * r;
    } else if (d2 <= 0.0001 && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) {
      // Inside a building: push out along the smallest penetration.
      const l = x - c.x0, rr = c.x1 - x, t = z - c.z0, b = c.z1 - z;
      const m = Math.min(l, rr, t, b);
      if (m === l) x = c.x0 - r; else if (m === rr) x = c.x1 + r;
      else if (m === t) z = c.z0 - r; else z = c.z1 + r;
    }
  }
  return { x, z };
}

export function clampWorld(x, z, margin = 4) {
  const h = WORLD.half - margin;
  return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
}
