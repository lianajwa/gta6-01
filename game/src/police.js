// police.js: the wanted system. Stars rise with crime and decay when the
// player lays low. Roadblocks appear at 3 stars, a helicopter at 4+.
// A Lookout in the crew warns the player early and speeds the decay.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeCarMesh } from './vehicles.js';

export function createPolice(scene) {
  const cops = [];
  const state = {
    stars: 0, heat: 0, // heat is the float behind the stars
    roadblocks: [], heli: null, heliAngle: 0,
    warned: false,
  };

  function spawnCop(x, z) {
    const mesh = makeCarMesh(0x1a1a22, null);
    // Police livery: white doors + light bar.
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    door.position.y = 0.55; mesh.add(door);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    bar.position.set(0, 1.45, -0.2); mesh.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    bar2.position.set(0, 1.45, 0.3); mesh.add(bar2);
    mesh.position.set(x, 0.1, z);
    scene.add(mesh);
    const cop = { mesh, x, z, heading: 0, speed: 0, stuck: 0 };
    cops.push(cop);
    return cop;
  }

  function spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
    glass.position.set(0, 0.2, 1.8); g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222226 }));
    rotor.position.y = 1.1; g.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
    tail.position.set(0, 0.2, -4); g.add(tail);
    const spot = new THREE.PointLight(0xfff2b0, 60, 60);
    spot.position.y = -2; g.add(spot);
    g.position.set(0, 55, 0);
    scene.add(g);
    state.heli = { mesh: g, rotor, angle: 0 };
  }

  function setRoadblocks(on, playerX, playerZ) {
    for (const r of state.roadblocks) scene.remove(r);
    state.roadblocks = [];
    if (!on) return;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const g = new THREE.Group();
      for (let k = -1; k <= 1; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.7), new THREE.MeshLambertMaterial({ color: k === 0 ? 0xff6a00 : 0xf2f2f2 }));
        bar.position.set(k * 3.6, 0.45, 0);
        g.add(bar);
      }
      g.position.set(playerX + Math.cos(a) * 46, 0, playerZ + Math.sin(a) * 46);
      g.rotation.y = a + Math.PI / 2;
      scene.add(g);
      state.roadblocks.push(g);
    }
  }

  return {
    state, cops,
    addHeat(n, lookout) {
      state.heat = Math.min(WANTED.maxStars, state.heat + n);
      if (lookout) state.warned = true;
      this.sync();
    },
    sync() {
      // Stars are the CEILING of heat: 3.0 heat is 3 stars until it decays
      // below 2.0, and a single pistol shot (heat 1.0) shows 1 star until
      // heat reaches 0. Flooring here dropped 2.995 heat to 2 stars.
      const want = Math.min(WANTED.maxStars, Math.ceil(state.heat - 0.001));
      if (want !== state.stars) {
        state.stars = want;
        const need = want >= 2 ? Math.min(want, 4) : want;
        while (cops.length < need) {
          const a = Math.random() * Math.PI * 2;
          spawnCop(0 + Math.cos(a) * WANTED.spawnRadius, 0 + Math.sin(a) * WANTED.spawnRadius);
        }
        while (cops.length > need) {
          const c = cops.pop();
          scene.remove(c.mesh);
        }
        setRoadblocks(want >= WANTED.roadblockAt, 0, 0);
        if (want >= WANTED.heliAt && !state.heli) spawnHeli();
        if (want < WANTED.heliAt && state.heli) {
          scene.remove(state.heli.mesh);
          state.heli = null;
        }
      }
    },
    update(dt, playerX, playerZ, playerSpeed, inVehicle, lookout) {
      // Decay when slow and out of sight; Lookout doubles it.
      const decay = WANTED.decayPerSec * (lookout ? 2 : 1) * (playerSpeed < 4 ? 1.6 : 0.5);
      state.heat = Math.max(0, state.heat - decay * dt);
      this.sync();
      // Reposition roadblocks around the player as they move.
      if (state.stars >= WANTED.roadblockAt) {
        const moved = state.roadblocks.length && Math.hypot(state.roadblocks[0].position.x - playerX, state.roadblocks[0].position.z - playerZ) > 70;
        if (moved) setRoadblocks(true, playerX, playerZ);
      }
      // Cop cars chase the player; they are slower than a good getaway car.
      for (const c of cops) {
        const dx = playerX - c.x, dz = playerZ - c.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let dh = want - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += THREE.MathUtils.clamp(dh, -2.2 * dt, 2.2 * dt);
        c.speed += ((d > 12 ? WANTED.copCarSpeed : 0) - c.speed) * Math.min(1, dt);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.mesh.position.set(c.x, 0.1, c.z);
        c.mesh.rotation.y = c.heading;
        // Busted when a cop car touches the player on foot at low speed.
        if (d < 3.2 && !inVehicle && playerSpeed < 2) return 'busted';
      }
      // Helicopter circles above, its spotlight tracking the player.
      if (state.heli) {
        state.heli.angle += dt * 0.5;
        const hx = playerX + Math.cos(state.heli.angle) * 26;
        const hz = playerZ + Math.sin(state.heli.angle) * 26;
        state.heli.mesh.position.set(hx, 52 + Math.sin(performance.now() * 0.001) * 2, hz);
        state.heli.rotor.rotation.y += dt * 18;
        state.heli.mesh.lookAt(playerX, 0, playerZ);
      }
      return null;
    },
  };
}
