// vehicles.js: cars and boats. Procedural meshes (no assets), weighty arcade
// driving physics, and simple traffic that follows the road grid.
import * as THREE from 'three';
import { DRIVE, BOAT } from './config.js';
import { makeRng } from './random.js';

export function makeCarMesh(color, rng) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2432 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2); g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.0), bodyMat);
  hood.position.set(0, 0.9, 1.7); g.add(hood);
  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    l.position.set(x, 0.62, 2.22); g.add(l);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    l.position.set(x, 0.62, -2.22); g.add(l);
  }
  g.userData.rng = rng;
  return g;
}

export function makeBoatMesh(color) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 6.4), hullMat);
  hull.position.y = 0.4; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 4), hullMat);
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(0, 0.4, 3.9); g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 4.4), new THREE.MeshLambertMaterial({ color: 0xe8ddc8 }));
  deck.position.y = 0.85; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
  cabin.position.set(0, 1.4, -0.6); g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.18, 6.0), new THREE.MeshBasicMaterial({ color: 0xff8c42 }));
  stripe.position.y = 0.62; g.add(stripe);
  return g;
}

// A drivable vehicle: position, heading, speed, slip (drift) state.
export function createVehicle(mesh, kind, opts = {}) {
  return {
    mesh, kind,
    x: opts.x ?? 0, z: opts.z ?? 0, heading: opts.heading ?? 0,
    speed: 0, slip: 0, steering: 0, damaged: 0, smoke: 0,
    topSpeedMul: opts.topSpeedMul ?? 1, gripMul: opts.gripMul ?? 1,
  };
}

// Weighty driving: speed-dependent steering, accel curve, handbrake drift.
export function driveVehicle(v, input, dt, colliders, isWater) {
  const tune = v.kind === 'boat' ? BOAT : DRIVE;
  const fwd = input.axis('KeyS', 'KeyW');
  const steerIn = input.axis('KeyA', 'KeyD');
  const handbrake = input.down('Space');
  const top = (v.kind === 'boat' ? BOAT.maxSpeed : DRIVE.maxSpeed) * v.topSpeedMul;

  // Steering tightens at low speed, loosens at high speed (weighty feel).
  const speedN = Math.abs(v.speed) / top;
  const steerTarget = steerIn * (v.kind === 'boat' ? BOAT.steer : DRIVE.steerMax) * (1 - speedN * 0.55);
  v.steering += (steerTarget - v.steering) * Math.min(1, DRIVE.steerSpeed * dt * 3);

  if (fwd > 0) v.speed += tune.accel * (1 - speedN * 0.75) * dt * fwd;
  else if (fwd < 0) {
    if (v.speed > 0.5) v.speed -= DRIVE.brake * dt; // brake first
    else v.speed -= DRIVE.reverseAccel * dt; // then reverse
  } else {
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), tune.drag * 2.4 * dt);
  }
  v.speed = THREE.MathUtils.clamp(v.speed, -DRIVE.maxReverse, top);

  // Drift: handbrake cuts grip, builds slip, bleeds speed, throws smoke.
  const grip = (handbrake ? DRIVE.driftGrip : DRIVE.grip) * v.gripMul;
  if (handbrake && Math.abs(v.speed) > 6) {
    v.slip += (Math.sign(steerIn || 1) * 0.55 - v.slip) * Math.min(1, 4 * dt);
    v.speed *= 1 - DRIVE.handbrakeBleed * dt;
    v.smoke = 1;
  } else {
    v.slip += (0 - v.slip) * Math.min(1, grip * dt);
    v.smoke = Math.max(0, v.smoke - dt * 2);
  }

  const turnRate = v.steering * (v.speed / 12) * (v.kind === 'boat' ? BOAT.turn : 1);
  v.heading += turnRate * dt * (v.speed >= 0 ? 1 : -1);
  const dirX = Math.sin(v.heading + v.slip * 0.5);
  const dirZ = Math.cos(v.heading + v.slip * 0.5);
  let nx = v.x + dirX * v.speed * dt;
  let nz = v.z + dirZ * v.speed * dt;

  // Building collision: AABB push-out, costs most of the speed + damage.
  if (v.kind !== 'boat') {
    for (const c of colliders) {
      const dx = nx - c.x, dz = nz - c.z;
      if (Math.abs(dx) < c.hw + 1.2 && Math.abs(dz) < c.hd + 1.2) {
        const px = c.hw + 1.2 - Math.abs(dx);
        const pz = c.hd + 1.2 - Math.abs(dz);
        if (px < pz) nx = c.x + Math.sign(dx) * (c.hw + 1.2);
        else nz = c.z + Math.sign(dz) * (c.hd + 1.2);
        if (Math.abs(v.speed) > 8) {
          v.damaged += DRIVE.hitDamage;
          v.speed *= 1 - DRIVE.hitSpeedLoss;
        }
        v.speed *= 0.55;
      }
    }
    nx = THREE.MathUtils.clamp(nx, -275, 275);
    nz = THREE.MathUtils.clamp(nz, -275, 275);
  }
  v.x = nx; v.z = nz;
  v.mesh.position.set(v.x, v.kind === 'boat' ? 0.02 + Math.sin(performance.now() * 0.0012) * 0.04 : 0.1, v.z);
  v.mesh.rotation.y = v.heading + v.slip * 0.4;
  return v;
}

// Traffic: a handful of cars looping the road grid, plus a few parked cars
// the player can steal. All procedural, seeded.
export function createTraffic(scene, roads, colliders, count = 14) {
  const rng = makeRng(77);
  const cars = [];
  const colors = [0xc23b2e, 0x2e6ac2, 0xd8a13c, 0x4a9a5a, 0x8a8a92, 0x5a3a7a, 0xd8d8d8];
  for (let i = 0; i < count; i++) {
    const road = roads[Math.floor(rng.next() * roads.length)];
    const t = rng.next();
    const x = road.x1 + (road.x2 - road.x1) * t;
    const z = road.z1 + (road.z2 - road.z1) * t;
    const mesh = makeCarMesh(rng.pick(colors), rng);
    scene.add(mesh);
    const heading = road.x1 === road.x2 ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    cars.push({ mesh, x, z, heading, speed: rng.range(7, 13), road, t, dir: rng.chance(0.5) ? 1 : -1, wait: 0 });
  }
  return cars;
}

export function updateTraffic(cars, dt, playerPos) {
  for (const c of cars) {
    if (c.wait > 0) { c.wait -= dt; continue; }
    c.t += (c.dir * c.speed * dt) / 560;
    if (c.t > 1 || c.t < 0) { c.dir *= -1; c.t = THREE.MathUtils.clamp(c.t, 0, 1); }
    c.x = c.road.x1 + (c.road.x2 - c.road.x1) * c.t;
    c.z = c.road.z1 + (c.road.z2 - c.road.z1) * c.t;
    // Don't drive through the player: brake when close.
    const d = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
    if (d < 9) { c.wait = 0.6; continue; }
    c.mesh.position.set(c.x, 0.1, c.z);
    c.mesh.rotation.y = c.road.x1 === c.road.x2
      ? (c.dir > 0 ? 0 : Math.PI)
      : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

// Pedestrians: simple capsule people strolling the sidewalks.
export function createPedestrians(scene, count = 22) {
  const rng = makeRng(41);
  const peds = [];
  const colors = [0xd95f4b, 0x4fae8d, 0x5b8dd9, 0xe8b13c, 0xe07ba8, 0xd8d8d8, 0x3a3a40];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 8), new THREE.MeshLambertMaterial({ color: rng.pick(colors) }));
    body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a67a }));
    head.position.y = 1.75; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
    legs.position.y = 0.35; g.add(legs);
    g.position.set(rng.range(-240, 240), 0, rng.range(-240, 240));
    scene.add(g);
    peds.push({ mesh: g, x: g.position.x, z: g.position.z, heading: rng.next() * Math.PI * 2, speed: rng.range(0.8, 1.8), panic: 0 });
  }
  return peds;
}

export function updatePedestrians(peds, dt, danger) {
  for (const p of peds) {
    const dx = p.x - danger.x, dz = p.z - danger.z;
    const d = Math.hypot(dx, dz);
    if (danger.level > 0 && d < 26) {
      p.panic = 1;
      p.heading = Math.atan2(dx, dz);
      p.speed = 4.5;
    } else {
      p.panic = Math.max(0, p.panic - dt * 0.3);
      p.speed += (1.4 - p.speed) * dt;
      if (Math.random() < dt * 0.05) p.heading += (Math.random() - 0.5) * 1.6;
    }
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.x = THREE.MathUtils.clamp(p.x, -270, 270);
    p.z = THREE.MathUtils.clamp(p.z, -270, 270);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.006 + p.x)) * 0.05;
  }
}
