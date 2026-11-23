// combat.js: the pistol. Raycast-free on purpose — a hit test against the
// nearest enemy inside a forward cone keeps it deterministic and cheap.
// Shooting raises the wanted level; killing an enemy pays a little respect.
// Enemy fire timers run on a SEEDED rng (passed in), never Math.random, so
// a run is reproducible from the seed.
import * as THREE from 'three';
import { makeRng } from './random.js';

export function createCombat(scene, rng = makeRng(9917)) {
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  const tracers = [];
  return {
    ammo: 12, hasPistol: false, cooldown: 0,
    enemies: [], // {mesh, x, z, hp, alive}
    spawnEnemy(sceneRef, x, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.15, 8), new THREE.MeshLambertMaterial({ color: 0x3a3a40 }));
      body.position.y = 0.95; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
      head.position.y = 1.78; g.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x14141a }));
      gun.position.set(0.3, 1.1, 0.4); g.add(gun);
      g.position.set(x, 0, z);
      sceneRef.add(g);
      const e = { mesh: g, x, z, hp: 3, alive: true, shootT: 2 + rng.range(0, 2) };
      this.enemies.push(e);
      return e;
    },
    clearEnemies(sceneRef) {
      for (const e of this.enemies) sceneRef.remove(e.mesh);
      this.enemies = [];
    },
    // Fire from (ox, oz) along heading. Returns 'hit' | 'kill' | 'miss' | 'empty'.
    fire(ox, oz, heading, dt) {
      if (this.cooldown > 0) return 'cooling';
      if (!this.hasPistol) return 'unarmed';
      if (this.ammo <= 0) return 'empty';
      this.cooldown = 0.28;
      this.ammo--;
      const dirX = Math.sin(heading), dirZ = Math.cos(heading);
      let best = null, bestD = 26;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - ox, dz = e.z - oz;
        const along = dx * dirX + dz * dirZ;
        if (along < 1 || along > bestD) continue;
        const perp = Math.abs(dx * dirZ - dz * dirX);
        if (perp < 1.6 && along < bestD) { best = e; bestD = along; }
      }
      // Tracer: a thin bright box from the muzzle to the hit point.
      const endX = ox + dirX * (best ? bestD : 24);
      const endZ = oz + dirZ * (best ? bestD : 24);
      const len = Math.hypot(endX - ox, endZ - oz);
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), tracerMat);
      tr.position.set((ox + endX) / 2, 1.35, (oz + endZ) / 2);
      tr.rotation.y = Math.atan2(endX - ox, endZ - oz);
      scene.add(tr);
      tracers.push({ mesh: tr, life: 0.09 });
      if (best) {
        best.hp--;
        if (best.hp <= 0) {
          best.alive = false;
          best.mesh.visible = false;
          return 'kill';
        }
        return 'hit';
      }
      return 'miss';
    },
    update(dt, playerX, playerZ) {
      if (this.cooldown > 0) this.cooldown -= dt;
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].mesh);
          tracers.splice(i, 1);
        }
      }
      // Enemies shuffle toward the player and shoot back (badly).
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = playerX - e.x, dz = playerZ - e.z;
        const d = Math.hypot(dx, dz);
        if (d > 3 && d < 40) {
          e.x += (dx / d) * 2.2 * dt;
          e.z += (dz / d) * 2.2 * dt;
          e.mesh.position.set(e.x, 0, e.z);
          e.mesh.rotation.y = Math.atan2(dx, dz);
        }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 30) {
          e.shootT = 2.5 + rng.range(0, 2);
          return { enemyShot: true, from: e };
        }
      }
      return null;
    },
  };
}
