// Combat: the pistol (bought at Ironworks), enemy enforcers who shoot back,
// punches, health and armor, tracers and hit flashes.
import * as THREE from 'three';

export function createCombat(scene) {
  const enemies = [];
  const tracers = [];
  const pickups = [];

  function spawnEnemy(x, z, hp = 3) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x8b1a1a }));
    body.position.y = 1.2; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 2.4; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.3, 0.4); g.add(gun);
    scene.add(g);
    const e = { mesh: g, x, z, hp, shootTimer: 1 + Math.random() * 2, dead: false };
    enemies.push(e);
    return e;
  }
  function spawnPickup(x, z, kind = 'cash') {
    const color = kind === 'health' ? 0x2ecc71 : 0xf2c14e;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, 0.8, z);
    scene.add(m);
    const p = { mesh: m, x, z, kind };
    pickups.push(p);
    return p;
  }
  function tracer(from, to, color = 0xffe9a8) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
    scene.add(line);
    tracers.push({ line, life: 0.12 });
  }
  function step(G, dt) {
    const s = G.state;
    const px = s.player.x, pz = s.player.z;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = px - e.x, dz = pz - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      // Enforcers advance to firing range, then shoot with inaccuracy.
      if (dist > 14) {
        e.x += (dx / dist) * 5 * dt;
        e.z += (dz / dist) * 5 * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 40) {
        e.shootTimer = 1.2 + Math.random() * 1.2;
        tracer({ x: e.x, y: 1.4, z: e.z }, { x: px + (Math.random() - 0.5) * 2, y: 1.2, z: pz + (Math.random() - 0.5) * 2 }, 0xff5555);
        const hit = Math.random() < 0.45;
        if (hit) {
          const dmg = 7;
          if (s.armor > 0) { const ab = Math.min(s.armor, dmg); s.armor -= ab; s.health -= (dmg - ab); }
          else s.health -= dmg;
          G.hud.flash('HIT!');
          if (s.health <= 0) G.wasted();
        }
      }
    }
    for (const p of pickups) {
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.8 + Math.sin(performance.now() * 0.003 + p.x) * 0.15;
      if (Math.hypot(p.x - px, p.z - pz) < 2.2) {
        if (p.kind === 'health') { s.health = Math.min(100, s.health + 40); G.hud.flash('+40 HEALTH'); }
        else if (p.kind === 'heist') { s.heistCollected = (s.heistCollected || 0) + 1; G.hud.flash(`HEIST CRATE ${s.heistCollected}/3`); }
        else { s.cash += 150; s.collected = (s.collected || 0) + 1; G.hud.flash('+$150 STREET CASH'); }
        scene.remove(p.mesh);
        p.taken = true;
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].taken) pickups.splice(i, 1);
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
    }
  }
  // Shoot from the player toward the aim point. Returns the enemy hit, if any.
  function shoot(G, aimX, aimZ) {
    const s = G.state;
    if (!s.pistol) { G.hud.flash('NO PISTOL — BUY ONE AT IRONWORKS'); return null; }
    if (s.ammo <= 0) { G.hud.flash('NO AMMO — BUY AMMO AT IRONWORKS'); return null; }
    s.ammo -= 1;
    G.audio.shot();
    const px = s.player.x, pz = s.player.z;
    const dx = aimX - px, dz = aimZ - pz;
    const len = Math.hypot(dx, dz) || 1;
    const dirX = dx / len, dirZ = dz / len;
    tracer({ x: px, y: 1.4, z: pz }, { x: px + dirX * 45, y: 1.4, z: pz + dirZ * 45 });
    let best = null, bd = 45;
    const muscle = s.crew.find((c) => c.id === 'tayo' && c.recruited);
    const dmg = muscle ? 1.5 : 1;
    for (const e of enemies) {
      if (e.dead) continue;
      // Distance from the enemy to the shot ray.
      const ex = e.x - px, ez = e.z - pz;
      const along = ex * dirX + ez * dirZ;
      if (along < 0 || along > 45) continue;
      const perp = Math.abs(ex * dirZ - ez * dirX);
      if (perp < 1.6 && along < bd) { bd = along; best = e; }
    }
    if (best) {
      best.hp -= dmg;
      best.mesh.children[0].material.color.setHex(0xffcc00);
      window.setTimeout(() => { if (!best.dead) best.mesh.children[0].material.color.setHex(0x8b1a1a); }, 120);
      if (best.hp <= 0) {
        best.dead = true;
        scene.remove(best.mesh);
        G.onEnemyKilled(best);
      }
    }
    return best;
  }
  function clear() {
    for (const e of enemies) scene.remove(e.mesh);
    for (const p of pickups) scene.remove(p.mesh);
    for (const t of tracers) scene.remove(t.line);
    enemies.length = 0; pickups.length = 0; tracers.length = 0;
  }
  function aliveCount() { return enemies.filter((e) => !e.dead).length; }
  return { spawnEnemy, spawnPickup, step, shoot, clear, aliveCount, enemies, pickups };
}
