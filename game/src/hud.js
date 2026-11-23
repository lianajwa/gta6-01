// HUD: DOM readouts (cash, rank, wanted stars, health/armor, speed, objective,
// radio, district) plus a live 2D minimap canvas showing districts, roads,
// water, shops, the mission beacon, the player, police and crew.
import { DISTRICTS, ROADS, WORLD, rankFor } from './config.js';

function el(id) { return document.getElementById(id); }

export function createHud() {
  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;
  let flashTimer = 0;
  let flashMsg = '';

  function stars(n) {
    const full = Math.ceil(n);
    let s = '';
    for (let i = 0; i < 5; i++) s += i < full ? '★' : '☆';
    return s;
  }
  function update(G) {
    const s = G.state;
    const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };
    set('cash', `$${s.cash}`);
    set('rank', rankFor(s.respect));
    set('respect', `${s.respect} respect`);
    const w = el('wanted');
    if (w) { w.textContent = stars(s.wanted); w.className = s.wanted > 0 ? 'wanted hot' : 'wanted'; }
    const hb = el('health-fill'); if (hb) hb.style.width = `${Math.max(0, s.health)}%`;
    const ab = el('armor-fill'); if (ab) ab.style.width = `${Math.max(0, s.armor)}%`;
    const sp = s.player.vehicle
      ? Math.round(Math.abs(s.player.vehicle.speed || 0) * 3.6) : Math.round(s.player.speed * 3.6);
    set('speed', s.player.vehicle ? `${sp} km/h · ${s.player.vehicle.type === 'boat' ? 'BOAT' : 'CAR'}` : `${sp} km/h · ON FOOT`);
    set('objective', G.missions.objectiveText(G));
    const d = G.districts.at(s.player.x, s.player.z);
    set('district', `${d.name} · standing ${G.districts.get(d.id)}`);
    set('radio', `${G.audio.stationName()}${G.audio.muted ? ' (muted)' : ''}`);
    const dmg = s.player.vehicle ? Math.round(s.player.vehicle.damage || 0) : 0;
    set('damage', s.player.vehicle ? `Damage ${dmg}%` : '');
    if (flashTimer > 0) {
      flashTimer -= 1 / 60;
      const f = el('flash');
      if (f) { f.textContent = flashMsg; f.style.opacity = Math.min(1, flashTimer).toFixed(2); }
    }
    drawMinimap(G);
  }
  function drawMinimap(G) {
    if (!mctx) return;
    const S = 200, scale = S / WORLD.size;
    const toMap = (x, z) => [(x + WORLD.half) * scale, (z + WORLD.half) * scale];
    mctx.clearRect(0, 0, S, S);
    // Districts.
    for (const d of DISTRICTS) {
      mctx.fillStyle = d.color + '44';
      const [x0, y0] = toMap(d.x0, d.z0);
      mctx.fillRect(x0, y0, (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
    }
    // Water: the two canals (centred on x=30 / z=30) and the Marina basin.
    mctx.fillStyle = '#2a7f9e';
    mctx.fillRect(0, (30 - 12 + WORLD.half) * scale, S, 24 * scale);
    mctx.fillRect((30 - 12 + WORLD.half) * scale, 0, 24 * scale, S);
    mctx.fillRect(toMap(-120, 200)[0], toMap(-120, 200)[1], 240 * scale, 40 * scale);
    // Roads.
    mctx.strokeStyle = '#666'; mctx.lineWidth = 2;
    for (const r of ROADS) {
      const [x] = toMap(r, 0);
      mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, S); mctx.stroke();
      const [, y] = toMap(0, r);
      mctx.beginPath(); mctx.moveTo(0, y); mctx.lineTo(S, y); mctx.stroke();
    }
    // Shops.
    for (const sh of G.city.shopMeshes) {
      const [x, y] = toMap(sh.x, sh.z);
      mctx.fillStyle = sh.color;
      mctx.fillRect(x - 3, y - 3, 6, 6);
    }
    // Mission beacon.
    const b = G.missions.beaconPos(G);
    if (b) {
      const [x, y] = toMap(b.x, b.z);
      mctx.fillStyle = '#ffff00';
      mctx.beginPath(); mctx.arc(x, y, 6 + Math.sin(performance.now() * 0.006) * 2, 0, Math.PI * 2); mctx.fill();
    }
    // Police blips (flashing red/blue).
    const police = G.police;
    mctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff0000' : '#0000ff';
    for (const c of police.cars) { const [x, y] = toMap(c.x, c.z); mctx.fillRect(x - 3, y - 3, 6, 6); }
    for (const c of police.cops) { const [x, y] = toMap(c.x, c.z); mctx.fillRect(x - 2, y - 2, 4, 4); }
    // Crew (green dots).
    for (const m of G.crew.members) {
      if (!m.recruited || m.onJob || !m.mesh) continue;
      const [x, y] = toMap(m.x, m.z);
      mctx.fillStyle = '#2ecc71';
      mctx.beginPath(); mctx.arc(x, y, 3, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const s = G.state;
    const [px, py] = toMap(s.player.x, s.player.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.atan2(Math.sin(s.player.heading), Math.cos(s.player.heading)));
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
  }
  function flash(msg) { flashMsg = msg; flashTimer = 3; }
  function setPrompt(text) {
    const p = el('prompt');
    if (p) p.textContent = text || '';
  }
  function show(id) { const e = el(id); if (e) e.style.display = 'block'; }
  function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }
  function hideAllOverlays() {
    for (const id of ['title', 'pause', 'shop', 'crew-panel', 'heist-plan', 'over', 'help']) hide(id);
  }
  return { update, flash, setPrompt, show, hide, hideAllOverlays, drawMinimap };
}
