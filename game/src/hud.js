// hud.js: the HUD — cash, health, respect, wanted stars, radio, objective —
// plus a live minimap drawn on a 2D canvas every frame. The wanted stars are
// redrawn EVERY frame from the live value: updating them only on change left
// them stale in an earlier build (a real bug caught in the screenshot pass).
export function createHud() {
  const el = (id) => document.getElementById(id);
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div id="hud-top">
      <div id="hud-stars" aria-label="wanted level"></div>
      <div id="hud-cash">$0</div>
      <div id="hud-rank">Nobody</div>
    </div>
    <div id="hud-health"><div id="hud-health-bar"></div><span id="hud-health-num">100</span></div>
    <div id="hud-objective"></div>
    <div id="hud-trial"></div>
    <div id="hud-radio">DELTA FM</div>
    <div id="hud-hint"></div>
    <div id="hud-toast"></div>
    <canvas id="minimap" width="180" height="180"></canvas>
    <div id="hud-district">Tideline</div>
  `;
  document.body.appendChild(root);
  const mm = el('minimap').getContext('2d');

  let toastT = 0;
  let lastStars = -1;

  function drawMinimap(world) {
    const W = 180, S = 560;
    const to = (x, z) => [((x + S / 2) / S) * W, ((z + S / 2) / S) * W];
    mm.fillStyle = 'rgba(10, 14, 26, 0.82)';
    mm.fillRect(0, 0, W, W);
    // Water: canals + marina basin.
    mm.fillStyle = '#27354d';
    for (const c of world.canals) {
      const [x1, y1] = to(-280, c.z - c.w / 2);
      const [x2, y2] = to(280, c.z + c.w / 2);
      mm.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
    // Roads.
    mm.strokeStyle = '#5a5560';
    mm.lineWidth = 2;
    for (const r of world.roads) {
      const [x1, y1] = to(r.x1, r.z1);
      const [x2, y2] = to(r.x2, r.z2);
      mm.beginPath(); mm.moveTo(x1, y1); mm.lineTo(x2, y2); mm.stroke();
    }
    // Trial buoys.
    mm.fillStyle = '#ff8c42';
    for (const b of world.trialBuoys) {
      const [x, y] = to(b.x, b.z);
      mm.beginPath(); mm.arc(x, y, 3.5, 0, Math.PI * 2); mm.fill();
    }
    // Mission marker: pulsing yellow diamond.
    if (world.mission) {
      const [x, y] = to(world.mission.x, world.mission.z);
      const p = 1 + Math.sin(performance.now() * 0.006) * 0.25;
      mm.fillStyle = '#ffe14d';
      mm.save();
      mm.translate(x, y); mm.rotate(Math.PI / 4); mm.scale(p, p);
      mm.fillRect(-4, -4, 8, 8);
      mm.restore();
    }
    // Police dots.
    mm.fillStyle = '#4d8dff';
    for (const c of world.cops) {
      const [x, y] = to(c.x, c.z);
      mm.beginPath(); mm.arc(x, y, 2.5, 0, Math.PI * 2); mm.fill();
    }
    // Player arrow, rotated to heading.
    const [px, py] = to(world.player.x, world.player.z);
    mm.save();
    mm.translate(px, py);
    mm.rotate(Math.atan2(Math.sin(world.player.heading), Math.cos(world.player.heading)) + Math.PI);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4.5, 5); mm.lineTo(-4.5, 5); mm.closePath(); mm.fill();
    mm.restore();
  }

  return {
    root,
    update(dt, s) {
      // Stars: redrawn every frame from the live value — never stale.
      const stars = Math.max(0, Math.min(5, Math.round(s.stars)));
      if (stars !== lastStars || true) {
        let html = '';
        for (let i = 0; i < 5; i++) html += `<span class="star${i < stars ? ' on' : ''}">★</span>`;
        el('hud-stars').innerHTML = html;
        lastStars = stars;
      }
      el('hud-cash').textContent = `$${Math.floor(s.cash).toLocaleString('en-US')}`;
      el('hud-rank').textContent = s.rank;
      // The bar is a fraction of max HP (150 with Muscle), not of 100:
      // showing raw hp as a percent overflowed the bar past its frame.
      const hpMax = s.maxHp > 0 ? s.maxHp : 100;
      el('hud-health-bar').style.width = `${Math.max(0, Math.min(100, (s.hp / hpMax) * 100))}%`;
      el('hud-health-num').textContent = `${Math.max(0, Math.round(s.hp))}`;
      el('hud-objective').textContent = s.objective || '';
      el('hud-trial').textContent = s.trial || '';
      el('hud-radio').textContent = s.radio || '';
      el('hud-district').textContent = s.district || '';
      el('hud-hint').textContent = s.hint || '';
      if (s.toast) { el('hud-toast').textContent = s.toast; toastT = 3; }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) el('hud-toast').textContent = ''; }
      drawMinimap(s.world);
    },
  };
}
