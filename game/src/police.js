// The 5-star wanted system: police cars chase and ram, foot cops close in to
// bust, roadblocks appear at 3+ stars, a helicopter watches from 4+ stars.
// Wanted fades when the player stays out of sight with no new crime.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { ROADS } from './config.js';

export function createPolice(scene, rng) {
  const cars = [];
  const cops = [];
  let heli = null;
  let heliLight = null;
  let quietTimer = 0;

  function spawnCar(x, z) {
    const mesh = makeCarMesh(0x1a1a2e, true);
    scene.add(mesh);
    const c = { mesh, x, z, heading: 0, speed: 0, flash: 0 };
    cars.push(c);
    return c;
  }
  function spawnCop(x, z) {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a6b }));
    body.position.y = 1.1; mesh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 2.2; mesh.add(head);
    scene.add(mesh);
    const cop = { mesh, x, z, speed: 6.5 };
    cops.push(cop);
    return cop;
  }
  function spawnHeli() {
    if (heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x222831 }));
    g.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x555555 }));
    rotor.position.y = 1; g.add(rotor);
    g.userData.rotor = rotor;
    const spot = new THREE.SpotLight(0xfff2b0, 60, 60, 0.4, 0.5);
    spot.position.set(0, -1, 0);
    g.add(spot); g.add(spot.target);
    heliLight = spot;
    scene.add(g);
    heli = g;
  }
  function removeHeli() {
    if (!heli) return;
    scene.remove(heli); heli = null; heliLight = null;
  }

  function wantedCount(stars) {
    if (stars <= 0) return { cars: 0, cops: 0 };
    return { cars: Math.min(4, stars), cops: stars >= 2 ? Math.min(4, stars - 1) : 0 };
  }

  function step(G, dt) {
    const s = G.state;
    const px = s.player.x, pz = s.player.z;
    // Decay: no crime for a while and no police close by -> stars fall.
    if (s.wanted > 0) {
      quietTimer += dt;
      const nearPolice = cars.some((c) => Math.hypot(c.x - px, c.z - pz) < 45)
        || cops.some((c) => Math.hypot(c.x - px, c.z - pz) < 30);
      const decayRate = s.crew.find((c) => c.id === 'juno' && c.recruited) ? 2 : 1;
      if (quietTimer > 14 && !nearPolice) {
        s.wanted = Math.max(0, s.wanted - dt * 0.12 * decayRate);
        if (s.wanted < 0.5) { s.wanted = 0; }
      }
    }
    const stars = Math.ceil(s.wanted);
    const want = wantedCount(stars);
    // Spawn to match the wanted level.
    while (cars.length < want.cars) {
      const ang = rng.next() * Math.PI * 2;
      spawnCar(px + Math.cos(ang) * 70, pz + Math.sin(ang) * 70);
    }
    while (cops.length < want.cops) {
      const ang = rng.next() * Math.PI * 2;
      spawnCop(px + Math.cos(ang) * 30, pz + Math.sin(ang) * 30);
    }
    // Despawn extras when wanted falls.
    while (cars.length > want.cars) { const c = cars.pop(); scene.remove(c.mesh); }
    while (cops.length > want.cops) { const c = cops.pop(); scene.remove(c.mesh); }
    if (stars >= 4) spawnHeli(); else removeHeli();

    // Police cars chase and ram.
    for (const c of cars) {
      const dx = px - c.x, dz = pz - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      c.speed = Math.min(30 + stars * 1.5, c.speed + 12 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.flash += dt;
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(Math.floor(c.flash * 6) % 2 === 0 ? 0xff0000 : 0x0000ff);
      }
      if (dist < 3.2) {
        // Ram: damage the player's car, or knock the player down on foot.
        if (s.player.vehicle) s.player.vehicle.damage += 12 * dt;
        else { s.health -= 14 * dt; G.hud.flash('RAMMED BY POLICE'); }
        if (s.player.vehicle && s.player.vehicle.damage > 100) G.explodeVehicle();
      }
    }
    // Foot cops close in; touching one starts the busted timer.
    for (const c of cops) {
      const dx = px - c.x, dz = pz - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      c.x += (dx / dist) * c.speed * dt;
      c.z += (dz / dist) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist < 2 && !s.player.vehicle) {
        s.bustedTimer = (s.bustedTimer || 0) + dt;
        if (s.bustedTimer > 2.5) G.busted();
      } else if (dist > 4) s.bustedTimer = 0;
    }
    // Helicopter hovers above the player, spotlight on.
    if (heli) {
      heli.position.set(px + 12, 34, pz - 10);
      heli.userData.rotor.rotation.y += dt * 18;
      if (heliLight) heliLight.target.position.set(px, 0, pz);
    }
    // Roadblocks at 3+ stars: two police cars parked across the road ahead.
    G.roadblock = stars >= 3;
  }

  function addWanted(G, amount) {
    const s = G.state;
    s.wanted = Math.min(5, s.wanted + amount);
    quietTimer = 0;
  }
  function clear(G) {
    for (const c of cars) scene.remove(c.mesh);
    for (const c of cops) scene.remove(c.mesh);
    cars.length = 0; cops.length = 0;
    removeHeli();
    quietTimer = 0;
  }
  return { step, addWanted, clear, cars, cops, get heli() { return heli; } };
}

export function roadblockAhead(G) {
  // A roadblock is a pair of stopped police cars on the player's road ahead.
  return G.roadblock && G.state.wanted >= 3;
}
