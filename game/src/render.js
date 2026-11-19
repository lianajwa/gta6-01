// Drawing only: the world's state and the current screen in, pixels out. A
// camera follows the player over Solmar Bay; the HUD, the minimap, the mission
// banner, the briefing panel and every screen are drawn here in canvas, so a
// screenshot always shows exactly what a player sees.
import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_X, WATER_X, FONT, PALETTE, SHOPS, LANDMARKS, RADIO } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const VIEW_W = 1280;
const VIEW_H = 720;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  const labels = new Map();
  let vw = VIEW_W;
  let vh = VIEW_H;
  let scale = 1;
  let camX = 0;
  let camY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * ratio);
    canvas.height = Math.round(vh * ratio);
    scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  }

  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', bold = false, outline = false) {
    context.font = font(size, bold);
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    if (outline) {
      context.lineWidth = Math.max(2, size / 7);
      context.strokeStyle = 'rgba(0,0,0,0.85)';
      context.strokeText(value, x, y);
    }
    context.fillStyle = color;
    context.fillText(value, x, y);
  }

  function cached(key, value) {
    const k = `${key}:${value}`;
    if (!labels.has(k)) labels.set(k, value);
    return labels.get(k);
  }

  function screenToWorld(sx, sy) {
    return { x: camX + sx / scale, y: camY + sy / scale };
  }

  function drawCity(state, time) {
    const p = state.player;
    // Camera: follow the player, clamped to the world — and applied to the
    // transform, so world coordinates land on screen where they belong.
    camX = clamp(p.x - VIEW_W / 2, 0, WORLD.width - VIEW_W);
    camY = clamp(p.y - VIEW_H / 2, 0, WORLD.height - VIEW_H);
    context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    const x0 = camX - 40;
    const y0 = camY - 40;
    const x1 = camX + VIEW_W + 40;
    const y1 = camY + VIEW_H + 40;

    // Ground: grass, then sand and ocean on the east edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    context.fillStyle = PALETTE.sand;
    context.fillRect(Math.max(x0, BEACH_X), y0, x1 - Math.max(x0, BEACH_X), y1 - y0);
    context.fillStyle = PALETTE.water;
    context.fillRect(Math.max(x0, WATER_X), y0, x1 - Math.max(x0, WATER_X), y1 - y0);
    // Animated water shimmer.
    context.fillStyle = PALETTE.waterDeep;
    for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
      for (let x = Math.max(x0, WATER_X + 8); x < x1; x += 92) {
        const wob = Math.sin((x + y) * 0.01 + time * 1.4) * 6;
        context.fillRect(x + wob, y, 44, 3);
      }
    }
    // The pier: boards out into the bay.
    context.fillStyle = '#8a6f4d';
    context.fillRect(2280, 866, 200, 68);
    context.fillStyle = '#a8876d';
    for (let x = 2284; x < 2476; x += 16) context.fillRect(x, 868, 8, 64);
    context.fillStyle = '#ffb020';
    context.fillRect(2462, 866, 8, 68);

    // Roads: asphalt, edge lines, dashed centrelines.
    context.fillStyle = PALETTE.road;
    for (const a of AVENUES) context.fillRect(a - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    for (const s of STREETS) context.fillRect(x0, s - ROAD_W / 2, x1 - x0, ROAD_W);
    context.fillStyle = PALETTE.roadEdge;
    for (const a of AVENUES) {
      context.fillRect(a - ROAD_W / 2, y0, 3, y1 - y0);
      context.fillRect(a + ROAD_W / 2 - 3, y0, 3, y1 - y0);
    }
    for (const s of STREETS) {
      context.fillRect(x0, s - ROAD_W / 2, x1 - x0, 3);
      context.fillRect(x0, s + ROAD_W / 2 - 3, x1 - x0, 3);
    }
    context.fillStyle = PALETTE.lane;
    for (const a of AVENUES) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) context.fillRect(a - 2, y, 4, 22);
    }
    for (const s of STREETS) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) context.fillRect(x, s - 2, 22, 4);
    }

    // Blocks: lawns between the roads.
    context.fillStyle = PALETTE.grassDark;
    for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
      for (let si = 0; si < STREETS.length - 1; si += 1) {
        const bx = AVENUES[ai] + ROAD_W / 2 + 4;
        const by = STREETS[si] + ROAD_W / 2 + 4;
        const bw = AVENUES[ai + 1] - ROAD_W / 2 - 4 - bx;
        const bh = STREETS[si + 1] - ROAD_W / 2 - 4 - by;
        if (bx + bw > BEACH_X) continue;
        context.fillRect(bx, by, bw, bh);
      }
    }

    // Buildings: walls, roof, a door, windows; tall ones throw a shadow.
    for (const b of state.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      if (b.tall) {
        context.fillStyle = 'rgba(0,0,0,0.28)';
        context.fillRect(b.x + 14, b.y + 18, b.w, b.h);
      }
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(20,26,38,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 16, 14);
        }
      }
      if (b.tower) {
        text('K', b.x + b.w / 2, b.y + b.h / 2 + 8, 34, PALETTE.accent, 'center', true, true);
      }
    }

    // Palms: trunk and a crown of fronds.
    for (const palm of state.palms) {
      if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
      context.strokeStyle = '#7a5230';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + 3, palm.y - 16);
      context.stroke();
      context.fillStyle = '#2e8b57';
      for (let f = 0; f < 6; f += 1) {
        const a = (f / 6) * Math.PI * 2 + 0.3;
        context.beginPath();
        context.ellipse(palm.x + 3 + Math.cos(a) * 10, palm.y - 16 + Math.sin(a) * 8, 12, 4, a, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Shops: coloured awning + letter.
    for (const shop of SHOPS) {
      if (shop.x < x0 || shop.x > x1 || shop.y < y0 || shop.y > y1) continue;
      const pulse = 1 + Math.sin(time * 3) * 0.08;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.arc(shop.x, shop.y, 24 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = shop.color;
      context.beginPath();
      context.arc(shop.x, shop.y, 20 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11141b';
      text(shop.id === 'garage' ? 'G' : shop.id === 'guns' ? 'W' : shop.id === 'spray' ? 'S' : '+', shop.x, shop.y + 7, 22, '#11141b', 'center', true);
      text(shop.name, shop.x, shop.y - 30, 13, '#ffffff', 'center', true, true);
    }

    // Pickups: cash glints, crates, the package.
    for (const pk of state.pickups) {
      if (pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
      const bob = Math.sin(time * 4 + pk.x) * 3;
      if (pk.kind === 'cash') {
        context.fillStyle = '#37d67a';
        context.beginPath();
        context.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
        context.fill();
        text('$', pk.x, pk.y + bob + 5, 15, '#062b16', 'center', true);
      } else if (pk.kind === 'crate') {
        context.fillStyle = '#b07a2a';
        context.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
        context.strokeStyle = '#5d3f14';
        context.lineWidth = 2;
        context.strokeRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
      } else {
        context.fillStyle = '#e8d44d';
        context.fillRect(pk.x - 9, pk.y - 7 + bob, 18, 14);
        context.strokeStyle = '#7a6a10';
        context.strokeRect(pk.x - 9, pk.y - 7 + bob, 18, 14);
      }
    }

    // Mission target: a pulsing beacon + a column of light.
    if (state.target) {
      const t = state.target;
      if (t.x > x0 - 60 && t.x < x1 + 60 && t.y > y0 - 60 && t.y < y1 + 60) {
        const pulse = 0.6 + Math.sin(time * 5) * 0.4;
        context.fillStyle = `rgba(255,176,32,${0.16 * pulse})`;
        context.fillRect(t.x - 14, t.y - 260, 28, 260);
        context.strokeStyle = `rgba(255,176,32,${0.9 * pulse})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(t.x, t.y, 26 + Math.sin(time * 5) * 5, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#ffb020';
        context.beginPath();
        context.moveTo(t.x, t.y - 12);
        context.lineTo(t.x + 9, t.y + 8);
        context.lineTo(t.x - 9, t.y + 8);
        context.closePath();
        context.fill();
      }
    }

    // Helicopter shadow + body when the heat is at 4 stars.
    if (state.heli) {
      const h = state.heli;
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath();
      context.ellipse(h.x, h.y + 26, 34, 16, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,220,0.10)';
      context.beginPath();
      context.moveTo(h.x - 8, h.y + 10);
      context.lineTo(h.x + 8, h.y + 10);
      context.lineTo(h.x + 60, h.y + 150);
      context.lineTo(h.x - 60, h.y + 150);
      context.closePath();
      context.fill();
      context.fillStyle = '#20242c';
      context.beginPath();
      context.ellipse(h.x, h.y, 22, 10, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#20242c';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(h.x - 30, h.y);
      context.lineTo(h.x + 30, h.y);
      context.stroke();
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const w = 46;
    const h = 22;
    if (car.hp < 40) {
      context.fillStyle = 'rgba(60,60,60,0.5)';
      context.beginPath();
      context.arc(-6 + Math.sin(time * 9) * 3, 0, 10, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-w / 2, -h / 2, w, h, 7);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.85)';
    context.fillRect(-4, -h / 2 + 3, 12, h - 6);
    context.fillStyle = car.color;
    context.fillRect(6, -h / 2 + 3, 10, h - 6);
    context.fillStyle = '#ffe9a8';
    context.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
    context.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
    context.fillStyle = '#ff5a4e';
    context.fillRect(-w / 2, -h / 2 + 2, 3, 5);
    context.fillRect(-w / 2, h / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      context.fillStyle = '#ffffff';
      context.fillRect(-8, -h / 2 - 1, 16, 4);
      const blink = Math.floor(time * 6) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#4fc3f7';
      context.beginPath();
      context.arc(-2, -h / 2 - 1, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = blink ? '#4fc3f7' : '#ff3b30';
      context.beginPath();
      context.arc(8, -h / 2 - 1, 5, 0, Math.PI * 2);
      context.fill();
      text('PD', 0, 5, 11, '#ffffff', 'center', true);
    }
    if (car.kind === 'target') {
      context.fillStyle = '#ff5a4e';
      context.beginPath();
      context.arc(0, -h / 2 - 12, 9, 0, Math.PI * 2);
      context.fill();
      text('!', 0, -h / 2 - 5, 12, '#ffffff', 'center', true);
    }
    context.restore();
    if (car.hp < car.maxHp && car.kind !== 'traffic') {
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(car.x - 22, car.y - 32, 44, 5);
      context.fillStyle = car.hp > 40 ? '#37d67a' : '#ff5a4e';
      context.fillRect(car.x - 22, car.y - 32, 44 * Math.max(0, car.hp / car.maxHp), 5);
    }
  }

  function drawPerson(x, y, angle, color, isPlayer, hasGun, time) {
    context.save();
    context.translate(x, y);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(0, 4, 12, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(angle);
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 12, 0, Math.PI * 2);
    context.fill();
    // Shoulders + facing wedge.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.arc(4, -7, 5, 0, Math.PI * 2);
    context.arc(4, 7, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(7, 0, 6, 0, Math.PI * 2);
    context.fill();
    if (hasGun) {
      context.fillStyle = '#222';
      context.fillRect(10, -2, 12, 4);
    }
    context.restore();
    if (isPlayer) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 17 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawEntities(state, time) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      drawPerson(ped.x, ped.y, Math.atan2(ped.ty - ped.y, ped.tx - ped.x), ped.color, false, false, time);
    }
    for (const cop of state.cops) {
      if (cop.dead) continue;
      drawPerson(cop.x, cop.y, Math.atan2(state.player.y - cop.y, state.player.x - cop.x), '#20242c', false, false, time);
      text('PD', cop.x, cop.y - 20, 11, '#4fc3f7', 'center', true, true);
    }
    for (const e of state.enemies) {
      if (e.dead) continue;
      drawPerson(e.x, e.y, e.angle, '#c0392b', false, true, time);
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(e.x - 16, e.y - 28, 32, 5);
      context.fillStyle = '#ff5a4e';
      context.fillRect(e.x - 16, e.y - 28, 32 * Math.max(0, e.hp / 100), 5);
    }
    for (const car of state.cars) {
      if (car.dead) continue;
      drawCar(car, time);
    }
    const p = state.player;
    if (!p.inCar) {
      const blink = p.hp < 30 && Math.floor(time * 6) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.angle, '#ffb020', true, p.hasGun, time);
    }
    // Bullets as bright tracers.
    for (const b of state.bullets) {
      context.strokeStyle = '#ffe9a8';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawMinimap(state) {
    const mw = 218;
    const mh = 150;
    const mx = VIEW_W - mw - 14;
    const my = VIEW_H - mh - 28;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.save();
    context.fillStyle = 'rgba(10,14,22,0.88)';
    context.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    context.beginPath();
    context.rect(mx, my, mw, mh);
    context.clip();
    context.fillStyle = '#2c5a34';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#1d6f8e';
    context.fillRect(mx + WATER_X * sx, my, mw - WATER_X * sx, mh);
    context.fillStyle = '#d9b77c';
    context.fillRect(mx + BEACH_X * sx, my, (WATER_X - BEACH_X) * sx, mh);
    context.strokeStyle = '#3a3f4a';
    context.lineWidth = 2;
    for (const a of AVENUES) {
      context.beginPath();
      context.moveTo(mx + a * sx, my);
      context.lineTo(mx + a * sx, my + mh);
      context.stroke();
    }
    for (const s of STREETS) {
      context.beginPath();
      context.moveTo(mx, my + s * sy);
      context.lineTo(mx + mw, my + s * sy);
      context.stroke();
    }
    context.fillStyle = '#ffb020';
    for (const shop of SHOPS) {
      context.fillRect(mx + shop.x * sx - 2, my + shop.y * sy - 2, 4, 4);
    }
    if (state.target) {
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      context.fillStyle = '#ffb020';
      context.beginPath();
      context.arc(mx + state.target.x * sx, my + state.target.y * sy, pulse, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.kind === 'police') {
        context.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff3b30' : '#4fc3f7';
        context.beginPath();
        context.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
        context.fill();
      } else if (car.kind === 'target') {
        context.fillStyle = '#ff5a4e';
        context.beginPath();
        context.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    const p = state.player;
    context.fillStyle = '#ffffff';
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.beginPath();
    context.moveTo(6, 0);
    context.lineTo(-4, -4);
    context.lineTo(-4, 4);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('SOLMAR BAY', mx + mw / 2, my + mh + 16, 11, PALETTE.muted, 'center', true);
  }

  function drawHud(state, extra) {
    // The HUD lives in screen coordinates, never in the camera's.
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const p = state.player;
    const stars = Math.ceil(state.wanted);
    // Top-left: cash, respect rank, missions done.
    context.fillStyle = PALETTE.panel;
    context.fillRect(12, 12, 250, 74);
    context.strokeStyle = 'rgba(255,176,32,0.5)';
    context.lineWidth = 1;
    context.strokeRect(12, 12, 250, 74);
    text(cached('cash', `$${p.cash.toLocaleString('en-US')}`), 26, 42, 26, '#37d67a', 'left', true, true);
    text(`RANK: ${extra.rank}  ·  MISSIONS ${state.stats.missionsDone}/10`, 26, 66, 14, PALETTE.text, 'left', false, true);
    if (p.hasGun) text(`PISTOL  ${p.ammo} rds`, 26, 82, 13, '#ffd76a', 'left', true, true);
    // Top-right: wanted stars.
    context.fillStyle = PALETTE.panel;
    context.fillRect(VIEW_W - 218, 12, 206, 44);
    context.strokeStyle = stars > 0 ? 'rgba(255,90,78,0.7)' : 'rgba(255,176,32,0.5)';
    context.strokeRect(VIEW_W - 218, 12, 206, 44);
    for (let i = 0; i < 5; i += 1) {
      const on = i < stars;
      const blink = on && stars >= 4 && Math.floor(state.time * 5) % 2 === 0;
      text('★', VIEW_W - 200 + i * 38, 44, 28, on ? (blink ? '#ff8a80' : '#ffd21f') : 'rgba(255,255,255,0.22)', 'left', true, true);
    }
    // Health / armor bars, bottom-left.
    context.fillStyle = PALETTE.panel;
    context.fillRect(12, VIEW_H - 64, 250, 52);
    text('HEALTH', 24, VIEW_H - 44, 12, PALETTE.muted, 'left', true);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(84, VIEW_H - 54, 164, 10);
    context.fillStyle = p.hp > 30 ? '#37d67a' : '#ff5a4e';
    context.fillRect(84, VIEW_H - 54, 164 * Math.max(0, p.hp / 100), 10);
    if (p.armor > 0) {
      text('ARMOR', 24, VIEW_H - 24, 12, PALETTE.muted, 'left', true);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(84, VIEW_H - 34, 164, 10);
      context.fillStyle = '#4fc3f7';
      context.fillRect(84, VIEW_H - 34, 164 * Math.max(0, p.armor / 100), 10);
    }
    if (p.inCar) {
      const car = state.cars[p.carId];
      if (car) {
        text(`SPEED ${Math.round(Math.abs(car.speed) * 0.36)} km/h`, 26, VIEW_H - 84, 16, PALETTE.text, 'left', true, true);
        context.fillStyle = 'rgba(255,255,255,0.18)';
        context.fillRect(12, VIEW_H - 76, 250, 8);
        context.fillStyle = car.hp > 40 ? '#ffb020' : '#ff5a4e';
        context.fillRect(12, VIEW_H - 76, 250 * Math.max(0, car.hp / car.maxHp), 8);
      }
    }
    // Mission objective banner, top-centre.
    const obj = state.objective || '';
    context.font = font(16, true);
    const ow = context.measureText(obj).width + 36;
    context.fillStyle = PALETTE.panel;
    context.fillRect((VIEW_W - ow) / 2, 12, ow, 34);
    context.strokeStyle = 'rgba(255,176,32,0.6)';
    context.strokeRect((VIEW_W - ow) / 2, 12, ow, 34);
    text(obj, VIEW_W / 2, 35, 16, PALETTE.accent, 'center', true);
    // Mission timer.
    if (state.mission && state.mission.timer > 0 && state.mission.def.seconds) {
      const t = Math.max(0, state.mission.timer);
      const label = state.mission.def.type === 'tail' ? `TAIL ${Math.ceil(state.mission.def.seconds - state.mission.tailTime)}s` : `${Math.ceil(t)}s`;
      text(label, VIEW_W / 2, 66, 22, t < 10 ? '#ff5a4e' : PALETTE.text, 'center', true, true);
    }
    // Radio ticker, bottom-centre.
    const station = RADIO[extra.station % RADIO.length];
    const track = station.tracks[Math.floor(state.time / 24) % station.tracks.length];
    text(`♪ ${station.name} — ${station.show}: “${track}”  ·  R radio  ·  M mute`, VIEW_W / 2, VIEW_H - 18, 13, 'rgba(242,240,232,0.75)', 'center', false, true);
    // Context prompt, above the health panel — clear of the radio line.
    if (state.prompt) {
      context.font = font(15, true);
      const pw = context.measureText(state.prompt).width + 28;
      context.fillStyle = 'rgba(12,16,26,0.85)';
      context.fillRect((VIEW_W - pw) / 2, VIEW_H - 92, pw, 28);
      text(state.prompt, VIEW_W / 2, VIEW_H - 72, 15, '#ffffff', 'center', true);
    }
    // Toast message.
    if (state.message) {
      context.font = font(17, true);
      const mw = context.measureText(state.message).width + 32;
      context.fillStyle = 'rgba(12,16,26,0.92)';
      context.fillRect((VIEW_W - mw) / 2, 58, mw, 32);
      context.strokeStyle = PALETTE.panelEdge;
      context.strokeRect((VIEW_W - mw) / 2, 58, mw, 32);
      text(state.message, VIEW_W / 2, 80, 17, '#ffffff', 'center', true);
    }
    // Busted progress ring around the player.
    if (p.bustedTimer > 0) {
      text('BUSTED?!', VIEW_W / 2, VIEW_H / 2 - 90, 34, '#ff5a4e', 'center', true, true);
    }
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 62, 44, accent || PALETTE.accent, 'center', true, true);
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 108 + i * 30, 19, PALETTE.text, 'center');
    });
    text(prompt, VIEW_W / 2, y + height - 26, 18, PALETTE.muted, 'center');
  }

  function drawTitle(state, best, hasSave) {
    // Golden-hour title over a live slice of the city.
    drawCity(state, state.time);
    drawEntities(state, state.time);
    // Back to screen coordinates for the overlay and the lettering.
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = 'rgba(10,14,26,0.55)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    text('SOLMAR BAY', VIEW_W / 2, 158, 30, '#ffd76a', 'center', true, true);
    text('SOLMAR HEAT', VIEW_W / 2, 248, 92, '#ffb020', 'center', true, true);
    text('AN OPEN-WORLD CRIME STORY  ·  10 MISSIONS  ·  5-STAR WANTED  ·  CREW, GARAGE & RADIO', VIEW_W / 2, 292, 17, PALETTE.text, 'center', true, true);
    const lines = [
      'Rico “Rook” Marlow is back in Solmar Bay — and Dominic Kessler, the Commodore',
      'who owns the docks, wants him gone. Ten jobs stand between Rook and the crown.',
      '',
      'WASD move / drive   ·   E enter & steal cars   ·   Click shoot (pistol) / Space punch',
      'Shift sprint   ·   R radio   ·   M mute   ·   P pause & save   ·   1/2/3 garage upgrades',
    ];
    drawPanelLines(lines, 330);
    const prompt = hasSave ? 'ENTER — Continue your story     SPACE — New game' : 'Press ENTER or click to start';
    text(prompt, VIEW_W / 2, 648, 20, '#ffffff', 'center', true, true);
    if (best && best.missions > 0) text(`Best so far: ${best.missions}/10 missions  ·  $${best.cash.toLocaleString('en-US')} earned`, VIEW_W / 2, 682, 15, PALETTE.muted, 'center');
  }

  function drawPanelLines(lines, top) {
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, top + i * 28, line.startsWith('WASD') || line.startsWith('Shift') ? 16 : 19, line.startsWith('WASD') || line.startsWith('Shift') ? PALETTE.muted : PALETTE.text, 'center', false, true);
    });
  }

  function drawBriefing(state) {
    const b = state.briefing;
    if (!b) return;
    const width = 680;
    const height = 120 + b.lines.length * 28;
    const x = (VIEW_W - width) / 2;
    const y = 96;
    context.fillStyle = 'rgba(12,16,26,0.93)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    b.lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 44 + i * 28, i === 0 ? 22 : 18, i === 0 ? PALETTE.accent : PALETTE.text, 'center', i === 0);
    });
    text('Press ENTER to keep playing', VIEW_W / 2, y + height - 16, 14, PALETTE.muted, 'center');
  }

  function draw(screen, state, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e16';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, extra.best, extra.hasSave);
      return;
    }
    drawCity(state, state.time);
    drawEntities(state, state.time);
    drawHud(state, extra);
    drawBriefing(state);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(10,14,26,0.6)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('PAUSED', [
        `Cash $${state.player.cash.toLocaleString('en-US')}  ·  Rank ${extra.rank}  ·  Missions ${state.stats.missionsDone}/10`,
        'Your progress saves automatically after every mission.',
        'P resume   ·   S save now   ·   Q quit to title',
      ], 'Solmar Bay waits for no one', '#4fc3f7');
    } else if (screen === SCREEN_OVER) {
      context.fillStyle = 'rgba(40,8,8,0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('WASTED', [
        'Rook went down. The Clinic patched him up —',
        'for a price. The story is still yours to finish.',
      ], 'Press ENTER to get back out there', '#ff5a4e');
    } else if (screen === SCREEN_BUSTED) {
      context.fillStyle = 'rgba(8,16,40,0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('BUSTED', [
        'The Solmar Bay PD took Rook in. Bail, a fine,',
        'and a long walk back to the streets.',
      ], 'Press ENTER to get back out there', '#4fc3f7');
    } else if (screen === SCREEN_WIN) {
      context.fillStyle = 'rgba(10,20,10,0.45)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel('KING OF SOLMAR', [
        'Kessler is finished. The docks, the bay, the city —',
        `all yours. ${state.stats.missionsDone}/10 missions, $${state.stats.cashEarned.toLocaleString('en-US')} earned.`,
        'Free roam continues: keep the crown warm.',
      ], 'Press ENTER to keep playing Solmar Bay', '#37d67a');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
