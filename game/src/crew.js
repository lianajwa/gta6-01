// Crew: four recruitable specialists who follow you, ride with you, give
// bonuses, and can be sent on side jobs that pay out over time.
import * as THREE from 'three';
import { CREW_DEFS } from './config.js';

export function createCrew(scene) {
  const members = CREW_DEFS.map((d) => ({
    ...d, recruited: false, onJob: false, jobTimer: 0, x: 0, z: 0, mesh: null,
  }));
  function recruit(id, x, z) {
    const m = members.find((c) => c.id === id);
    if (!m || m.recruited) return m;
    m.recruited = true;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.7, 0.5),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(m.color).getHex() }));
    body.position.y = 1.1; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 2.2; g.add(head);
    g.position.set(x + 2, 0, z + 2);
    scene.add(g);
    m.mesh = g; m.x = x + 2; m.z = z + 2;
    return m;
  }
  function step(G, dt) {
    const s = G.state;
    for (const m of members) {
      if (!m.recruited || !m.mesh || m.onJob) continue;
      // Followers trail the player at a short distance; Muscle also shoots.
      const tx = s.player.x - Math.sin(s.player.heading) * 3 + (m.id === 'mara' ? 2 : -2);
      const tz = s.player.z - Math.cos(s.player.heading) * 3;
      const dx = tx - m.x, dz = tz - m.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        const sp = Math.min(dist * 2.5, 9);
        m.x += (dx / dist) * sp * dt;
        m.z += (dz / dist) * sp * dt;
      }
      m.mesh.position.set(m.x, 0, m.z);
      m.mesh.rotation.y = Math.atan2(s.player.x - m.x, s.player.z - m.z);
      if (m.id === 'tayo' && G.combat.aliveCount() > 0) {
        // Muscle fires at the nearest enemy on his own.
        const e = G.combat.enemies.find((en) => !en.dead);
        if (e && Math.hypot(e.x - m.x, e.z - m.z) < 30) {
          e.hp -= 0.5 * dt;
          if (e.hp <= 0) { e.dead = true; scene.remove(e.mesh); G.onEnemyKilled(e); }
        }
      }
    }
    // Side jobs: a crew member away on a job pays out after 45 seconds.
    for (const m of members) {
      if (!m.recruited || !m.onJob) continue;
      m.jobTimer -= dt;
      if (m.jobTimer <= 0) {
        m.onJob = false;
        const pay = 250 + Math.floor(Math.random() * 250);
        s.cash += pay;
        G.hud.flash(`${m.name.toUpperCase()} FINISHED A SIDE JOB: +$${pay}`);
        if (m.mesh) m.mesh.visible = true;
      }
    }
  }
  function sendOnJob(id) {
    const m = members.find((c) => c.id === id);
    if (!m || !m.recruited || m.onJob) return false;
    m.onJob = true; m.jobTimer = 45;
    if (m.mesh) m.mesh.visible = false;
    return true;
  }
  function teleportToPlayer(G) {
    const s = G.state;
    for (const m of members) {
      if (!m.recruited || !m.mesh || m.onJob) continue;
      m.x = s.player.x + 2; m.z = s.player.z + 2;
      m.mesh.position.set(m.x, 0, m.z);
    }
  }
  return { members, recruit, step, sendOnJob, teleportToPlayer };
}
