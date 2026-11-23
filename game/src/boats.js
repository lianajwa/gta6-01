// Boats: the third vehicle type. Boats live on the canals and the Marina basin,
// can be boarded with E at a dock, and are the getaway for the Marina Heist.
import * as THREE from 'three';
import { isWater, onBridge, clampWorld } from './city.js';

export function makeBoatMesh(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 6.5),
    new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.35; hull.castShadow = true; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 4),
    new THREE.MeshLambertMaterial({ color }));
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.35, 4.2); g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 2.4),
    new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
  cabin.position.set(0, 1.1, -0.6); cabin.castShadow = true; g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  mast.position.set(0, 2.6, -0.6); g.add(mast);
  return g;
}

export function createBoats(scene, rng) {
  const boats = [];
  const spots = [
    [-60, 30, 0], [60, 30, 0], [30, -60, 1], [30, 60, 1],
    [-90, 218, 0], [-30, 218, 0], [30, 218, 0], [90, 218, 0],
  ];
  const colors = [0xe8e8e8, 0x3498db, 0xe74c3c, 0xf2c14e];
  for (const [x, z, axis] of spots) {
    const mesh = makeBoatMesh(colors[boats.length % colors.length]);
    scene.add(mesh);
    boats.push({
      mesh, x, z, heading: axis === 0 ? 0 : Math.PI / 2,
      speed: 0, boarded: false, drift: rng.next() * Math.PI * 2,
    });
  }
  function step(dt, time) {
    for (const b of boats) {
      if (b.boarded) continue;
      // Idle boats bob gently at their mooring.
      b.mesh.position.set(b.x, -0.05 + Math.sin(time * 1.4 + b.drift) * 0.08, b.z);
      b.mesh.rotation.y = b.heading;
      b.mesh.rotation.z = Math.sin(time + b.drift) * 0.02;
    }
  }
  function stepPlayerBoat(b, input, dt) {
    const ax = input.axis();
    if (ax.f > 0) b.speed += 12 * dt;
    else if (ax.f < 0) b.speed -= 14 * dt;
    else b.speed *= Math.max(0, 1 - 0.6 * dt);
    b.speed = Math.max(-6, Math.min(24, b.speed));
    b.heading += ax.s * 1.4 * dt * Math.min(1, Math.abs(b.speed) / 6);
    const nx = b.x + Math.sin(b.heading) * b.speed * dt;
    const nz = b.z + Math.cos(b.heading) * b.speed * dt;
    // Boats stay on water: if the next spot is land, slide along the bank.
    if (isWater(nx, nz) || onBridge(nx, nz)) { b.x = nx; b.z = nz; }
    else if (isWater(nx, b.z)) { b.x = nx; }
    else if (isWater(b.x, nz)) { b.z = nz; }
    else b.speed *= 0.5;
    const cl = clampWorld(b.x, b.z, 2);
    b.x = cl.x; b.z = cl.z;
    b.mesh.position.set(b.x, Math.sin(performance.now() * 0.0016) * 0.06, b.z);
    b.mesh.rotation.y = b.heading;
    return b;
  }
  return { boats, step, stepPlayerBoat };
}

export function nearestBoat(boats, x, z, range = 7) {
  let best = null, bd = range;
  for (const b of boats) {
    if (b.boarded) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
