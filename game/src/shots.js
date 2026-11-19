// The screenshot scenes behind ?shot=start|play|drive|wanted|mission|end.
// Each one drives the real game forward from a fresh world with a scripted
// autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame.
import { AVENUES, STREETS, STEP, WORLD } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function nearest(list, value) {
  return list.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
}

/**
 * Waypoints from (fx, fy) to (tx, ty) that stay on the roads: snap onto the
 * nearest avenue or street, run along it to the cross road nearest the
 * target, then along that road to the target. The last leg may cross open
 * ground (beach, pier approach) where there are no buildings.
 */
function roadWaypoints(fx, fy, tx, ty) {
  const pts = [];
  const onAvenue = Math.abs(fx - nearest(AVENUES, fx)) <= Math.abs(fy - nearest(STREETS, fy));
  if (onAvenue) {
    pts.push({ x: nearest(AVENUES, fx), y: fy });
    pts.push({ x: nearest(AVENUES, fx), y: nearest(STREETS, ty) });
  } else {
    pts.push({ x: fx, y: nearest(STREETS, fy) });
    pts.push({ x: nearest(AVENUES, tx), y: nearest(STREETS, fy) });
  }
  pts.push({ x: nearest(AVENUES, tx), y: nearest(STREETS, ty) });
  pts.push({ x: tx, y: ty });
  return pts;
}

function driveTo(world, tx, ty, seconds) {
  const steps = Math.floor(seconds / STEP);
  const s = world.state;
  let waypoints = roadWaypoints(s.player.x, s.player.y, tx, ty);
  // Debug trace of the drive (kept on the state for headless play-testing).
  s.driveTrace = [{ start: { x: Math.round(s.player.x), y: Math.round(s.player.y) }, waypoints }];
  let wi = 0;
  let lastX = s.player.x;
  let lastY = s.player.y;
  let stuckTime = 0;
  let reverseSteps = 0;
  for (let i = 0; i < steps; i += 1) {
    const p = s.player;
    if (!p.inCar) break;
    const car = s.cars[p.carId];
    if (!car) break;
    if (wi >= waypoints.length) break;
    const wp = waypoints[wi];
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    if (Math.hypot(dx, dy) < 50) { wi += 1; continue; }
    // Stuck against something (a ram, a wall, a pile-up)? Reverse out for a
    // second, then carry on — never grind in place.
    if (i % 30 === 0) {
      if (Math.hypot(p.x - lastX, p.y - lastY) < 12 && Math.abs(car.speed) < 40) stuckTime += 0.5;
      else stuckTime = 0;
      lastX = p.x;
      lastY = p.y;
      if (stuckTime >= 1.5) {
        reverseSteps = 60;
        stuckTime = 0;
        // Re-plan from where the car actually is: the old route may run
        // straight through the building it is wedged against. From inside a
        // block the new route snaps to the nearest street and out.
        waypoints = roadWaypoints(p.x, p.y, tx, ty);
        wi = 0;
      }
    }
    if (reverseSteps > 0) {
      reverseSteps -= 1;
      world.step(STEP, {
        move: { x: 0, y: 1 }, sprint: false, actions: {}, key: '',
        aimX: p.x - dx, aimY: p.y - dy, fire: false,
      });
      continue;
    }
    if (i % 30 === 0) {
      s.driveTrace.push({ t: +(i / 60).toFixed(1), x: Math.round(p.x), y: Math.round(p.y), speed: Math.round(car.speed), angle: +car.angle.toFixed(2), hp: Math.round(car.hp), wi, near: s.cars.filter((c) => !c.dead && c !== car && Math.hypot(c.x - p.x, c.y - p.y) < 70).map((c) => c.kind) });
    }
    // Steer the car toward the waypoint: compare the wanted heading with the
    // car's heading, turn toward it, drive while roughly aligned, and brake
    // for a sharp turn instead of ploughing through a building.
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
    // Slow down before a turn: at full speed the turning circle is ~130 px
    // wide and swings straight through the corner buildings. Brake to ~110
    // (a ~40 px circle) while approaching a waypoint, but keep driving —
    // braking to a stop while facing the wrong way is a deadlock.
    const dToWp = Math.hypot(dx, dy);
    const throttle = (dToWp < 220 && Math.abs(car.speed) > 110) || (Math.abs(diff) > 2.2 && Math.abs(car.speed) > 120) ? 1 : -1;
    world.step(STEP, {
      move: { x: steer, y: throttle }, sprint: false, actions: {}, key: '',
      aimX: p.x + dx, aimY: p.y + dy, fire: false,
    });
  }
}

function walkTo(world, tx, ty, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const s = world.state;
    const p = s.player;
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (Math.hypot(dx, dy) < 26) break;
    world.step(STEP, {
      move: { x: Math.abs(dx) > 12 ? Math.sign(dx) : 0, y: Math.abs(dy) > 12 ? Math.sign(dy) : 0 },
      sprint: true, actions: {}, key: '', aimX: p.x + dx, aimY: p.y + dy, fire: false,
    });
  }
}

function idle(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: {}, key: '', aimX: 0, aimY: 0, fire: false });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names fall back to the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  // The mission briefing is a gameplay nicety; in a staged shot it would
  // cover the middle of the frame, so it is dismissed here — the objective
  // banner at the top already states the job.
  function clearBriefing() {
    s.briefing = null;
  }
  if (name === 'start') {
    idle(world, 6);
    clearBriefing();
    return { screen: SCREEN_TITLE, best: { missions: 0, cash: 0 } };
  }
  if (name === 'play') {
    // On foot in Downtown, mid-morning: traffic and pedestrians around.
    s.player.x = 1160;
    s.player.y = 900;
    walkTo(world, 1160, 700, 4);
    idle(world, 1.5);
    clearBriefing();
    return { screen: SCREEN_PLAY, best: { missions: 0, cash: 0 } };
  }
  if (name === 'drive') {
    // Steal the nearest car and cruise the coast road. No idle at the end:
    // the shot is taken while the car is still moving.
    const car = s.cars[0];
    s.player.x = car.x;
    s.player.y = car.y;
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: { interact: true }, key: '', aimX: car.x, aimY: car.y, fire: false });
    // Face the first leg of the route: a stolen car can face the wrong way
    // down its avenue, and a 180° turn at speed leaves the road.
    const wps = roadWaypoints(car.x, car.y, 1950, 480);
    car.angle = Math.atan2(wps[1].y - car.y, wps[1].x - car.x);
    driveTo(world, 1950, 480, 10);
    clearBriefing();
    return { screen: SCREEN_PLAY, best: { missions: 1, cash: 400 } };
  }
  if (name === 'wanted') {
    // Three stars, a police chase on the avenues, player driving. Short
    // drive, no idle: the shot catches the chase before the pile-up.
    const car = s.cars[1];
    s.player.x = car.x;
    s.player.y = car.y;
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: { interact: true }, key: '', aimX: car.x, aimY: car.y, fire: false });
    world.addWanted(3);
    const wps = roadWaypoints(car.x, car.y, 840, 1040);
    car.angle = Math.atan2(wps[1].y - car.y, wps[1].x - car.x);
    driveTo(world, 840, 1040, 7);
    clearBriefing();
    return { screen: SCREEN_PLAY, best: { missions: 3, cash: 1200 } };
  }
  if (name === 'mission') {
    // Mission 5, Dockside Debt: Rook on foot with a pistol, enforcers ahead.
    // Pin the mission index too: the start delay would otherwise auto-start
    // mission 1 over the staged one.
    world.startMission(4);
    s.missionIndex = 4;
    s.missionDelay = 0;
    s.player.hasGun = true;
    s.player.ammo = 24;
    s.player.x = 520;
    s.player.y = 1500;
    walkTo(world, 300, 1500, 5);
    idle(world, 0.5);
    clearBriefing();
    return { screen: SCREEN_PLAY, best: { missions: 4, cash: 1650 } };
  }
  if (name === 'end') {
    // The crown: story complete.
    s.storyDone = true;
    s.stats.missionsDone = 10;
    s.stats.cashEarned = 8550;
    s.player.cash = 8750;
    s.player.respect = 2850;
    s.player.x = 1160;
    s.player.y = 900;
    idle(world, 3);
    clearBriefing();
    return { screen: SCREEN_WIN, best: { missions: 10, cash: 8750 } };
  }
  idle(world, 6);
  return { screen: SCREEN_TITLE, best: { missions: 0, cash: 0 } };
}

export { WORLD };
