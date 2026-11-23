// Cars: the player's car and AI traffic. Arcade driving — accelerate, brake,
// steer — with damage, smoke and explosion. Traffic follows the road grid and
// turns at intersections; any traffic car can be stolen with E.
import * as THREE from 'three';
import { ROADS, WORLD } from './config.js';
import { collideBuildings, clampWorld, inWaterOrBlocked } from './city.js';

const CAR_COLORS = [0xd64545, 0x4578d6, 0xf2c14e, 0x7fb069, 0xe8e8e8, 0x222831, 0x9b59b6, 0x16a085];

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a2e : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f0f0 : 0x223344 }));
  cabin.position.set(0, 1.15, -0.2); cabin.castShadow = true; g.add(cabin);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    bar.position.set(0, 1.6, -0.2); g.add(bar);
    g.userData.lightBar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-1.05, 1.4], [1.05, 1.4], [-1.05, -1.4], [1.05, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  }
  return g;
}

export function createVehicles(scene, rng, colliders) {
  const traffic = [];
  function spawnTraffic(i) {
    const road = rng.pick(ROADS);
    const along = rng.int(-220, 220);
    const axis = rng.next() < 0.5 ? 'x' : 'z';
    const dir = rng.next() < 0.5 ? 1 : -1;
    const color = rng.pick(CAR_COLORS);
    const mesh = makeCarMesh(color);
    scene.add(mesh);
    const car = {
      mesh, axis, dir, speed: rng.int(8, 14), color,
      x: axis === 'x' ? along : road + (dir > 0 ? 2.5 : -2.5),
      z: axis === 'x' ? road + (dir > 0 ? 2.5 : -2.5) : along,
      heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      stolen: false, smoke: null,
    };
    traffic.push(car);
    return car;
  }
  for (let i = 0; i < 14; i++) spawnTraffic(i);

  function stepTraffic(dt, playerPos, wanted) {
    for (const c of traffic) {
      if (c.stolen) continue;
      // Flee: nearby traffic speeds away when the player is wanted.
      const dx = c.x - playerPos.x, dz = c.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      let sp = c.speed;
      if (wanted > 0 && dist < 30) sp = c.speed * 1.6;
      if (c.axis === 'x') c.x += c.dir * sp * dt; else c.z += c.dir * sp * dt;
      // At an intersection, sometimes turn onto the cross road.
      const nearRoad = ROADS.find((r) => Math.abs((c.axis === 'x' ? c.z : c.x) - r) < 1.2);
      if (nearRoad !== undefined) {
        const along = c.axis === 'x' ? c.x : c.z;
        if (ROADS.some((r) => Math.abs(along - r) < 1.2) && rng.next() < 0.02) {
          c.axis = c.axis === 'x' ? 'z' : 'x';
          c.dir = rng.next() < 0.5 ? 1 : -1;
          c.heading = c.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
        }
      }
      if (c.x > 232 || c.x < -232 || c.z > 232 || c.z < -232) {
        // Wrap to the far side of the same road.
        if (c.axis === 'x') c.x = -c.dir * 230; else c.z = -c.dir * 230;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
  }

  // The player's car (created on demand when the player steals / spawns one).
  function makePlayerCar(x, z, heading, color = 0xd64545) {
    const mesh = makeCarMesh(color);
    scene.add(mesh);
    return {
      mesh, x, z, heading, speed: 0, damage: 0, color,
      maxSpeed: 34, accel: 16, brake: 30, turn: 1.9,
    };
  }

  function stepPlayerCar(car, input, dt, upgrades) {
    const ax = input.axis();
    const turbo = upgrades.turbo ? 1.18 : 1;
    const max = car.maxSpeed * turbo;
    if (ax.f > 0) car.speed += car.accel * turbo * dt;
    else if (ax.f < 0) car.speed -= (car.speed > 0.5 ? car.brake : car.accel * 0.6) * dt;
    else car.speed *= Math.max(0, 1 - 0.8 * dt);
    car.speed = Math.max(-10, Math.min(max, car.speed));
    const steer = ax.s * (car.speed >= 0 ? 1 : -1) * (upgrades.grip ? 1.25 : 1);
    car.heading += steer * car.turn * dt * Math.min(1, Math.abs(car.speed) / 8);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (inWaterOrBlocked(nx, nz)) {
      // Water blocks cars except on bridges: bounce off the bank.
      car.speed *= -0.3;
    } else {
      const fixed = collideBuildings(colliders, nx, nz, 2.2);
      if (Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01) {
        car.damage += Math.abs(car.speed) * 0.35;
        car.speed *= 0.4;
      }
      const cl = clampWorld(fixed.x, fixed.z);
      car.x = cl.x; car.z = cl.z;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -ax.s * Math.min(0.06, Math.abs(car.speed) * 0.002);
    return car;
  }

  return { traffic, spawnTraffic, stepTraffic, makePlayerCar, stepPlayerCar };
}

// Nearest stealable traffic car within range of a point.
export function nearestCar(traffic, x, z, range = 6) {
  let best = null, bd = range;
  for (const c of traffic) {
    if (c.stolen) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
