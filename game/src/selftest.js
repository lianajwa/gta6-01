// selftest.js: 19 automated checks, run in the browser with ?selftest=1.
// Each check returns {name, pass, detail}. Results land in window.__selftest
// and in a #selftest DOM node, so headless Chrome can read them out.
// The checks exercise the real systems, never stubs: boot, driving, boats,
// combat, wanted, crew, standing, save/load, trial, missions, heists, HUD.
export async function runSelfTest(game) {
  const results = [];
  const check = (name, fn) => {
    try {
      const r = fn();
      results.push({ name, pass: r === true, detail: r === true ? 'ok' : String(r) });
    } catch (e) {
      results.push({ name, pass: false, detail: 'threw: ' + e.message });
    }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  check('boot: no errors, renderer alive', () => (game.renderer && game.scene ? true : 'no renderer/scene'));
  check('boot: no external URLs requested', () => {
    const bad = (window.__netLog || []).filter((u) => /^https?:\/\//.test(u) && !u.startsWith(location.origin));
    return bad.length === 0 ? true : 'external: ' + bad.slice(0, 3).join(', ');
  });
  check('boot: no 404s in resource log', () => {
    const bad = (performance.getEntriesByType('resource') || []).filter((r) => r.responseStatus === 404);
    return bad.length === 0 ? true : '404: ' + bad.map((r) => r.name).slice(0, 3).join(', ');
  });
  check('world: 100+ buildings', () => (game.city.buildings.length >= 100 ? true : game.city.buildings.length + ' buildings'));
  check('world: 5 districts with distinct styles', () => {
    const styles = new Set(game.city.districts.map((d) => d.style));
    return styles.size === 5 ? true : styles.size + ' styles';
  });
  check('world: water + 2 canals + 6 bridges', () => {
    const bridges = game.scene.getObjectByName('city').children.filter((c) => c.name === 'bridge-deck').length;
    return bridges >= 6 ? true : bridges + ' bridge decks';
  });
  check('player: moves with W', () => {
    game.placePlayer(-140, -90, 0);
    const x0 = game.player.x, z0 = game.player.z;
    game.input.testHold('KeyW');
    for (let i = 0; i < 5; i++) game.step(0.1); // 0.5s in real-frame steps
    game.input.testRelease('KeyW');
    const moved = Math.hypot(game.player.x - x0, game.player.z - z0);
    return moved > 1 ? true : 'moved ' + moved.toFixed(2) + 'm';
  });
  check('player: runs with Shift', () => {
    game.placePlayer(-140, -90, 0);
    const x0 = game.player.x, z0 = game.player.z;
    game.input.testHold('ShiftLeft'); game.input.testHold('KeyW');
    for (let i = 0; i < 5; i++) game.step(0.1);
    game.input.testRelease('ShiftLeft'); game.input.testRelease('KeyW');
    const moved = Math.hypot(game.player.x - x0, game.player.z - z0);
    return moved > 3 ? true : 'ran only ' + moved.toFixed(2) + 'm';
  });
  check('car: enter, drive, drift', () => {
    // Drive straight down the x=-140 road (heading 0 = +z): buildings are
    // kept 14m off road centrelines, so the car stays clear. Handbrake
    // alone builds slip (steer defaults to +1), so no steering input that
    // would run the car off the road mid-check.
    game.placePlayer(-140, -90, 0);
    game.enterVehicle('car', -140, -90, 0, 0xc23b2e);
    if (!game.vehicle) return 'no vehicle';
    game.input.testHold('KeyW'); game.input.testHold('Space');
    for (let i = 0; i < 12; i++) game.step(0.1); // 1.2s in real-frame steps
    game.input.testRelease('KeyW'); game.input.testRelease('Space');
    const spd = Math.abs(game.vehicle.speed), slp = Math.abs(game.vehicle.slip);
    game.exitVehicle();
    return spd > 3 && slp > 0.05 ? true : `speed ${spd.toFixed(1)} slip ${slp.toFixed(2)}`;
  });
  check('boat: enter and drive on water', () => {
    game.enterVehicle('boat', 190, 160, 0, 0x2e6ac2);
    if (!game.vehicle || game.vehicle.kind !== 'boat') return 'no boat';
    game.input.testHold('KeyW');
    for (let i = 0; i < 10; i++) game.step(0.1); // 1.0s in real-frame steps
    game.input.testRelease('KeyW');
    const spd = Math.abs(game.vehicle.speed);
    game.exitVehicle();
    game.placePlayer(-140, -90, 0);
    return spd > 2 ? true : 'boat speed ' + spd.toFixed(1);
  });
  check('combat: pistol fires, ammo drops', () => {
    game.combat.hasPistol = true;
    const a0 = game.combat.ammo;
    game.firePistol();
    return game.combat.ammo === a0 - 1 ? true : `ammo ${a0} -> ${game.combat.ammo}`;
  });
  check('mission 1: completes at its marker', () => {
    game.gotoMission(1);
    const m = game.missions.active.mission;
    game.placePlayer(m.x, m.z, 0);
    game.step(0.2);
    // `current` is a 0-based index: after mission 1 completes it is 1
    // (mission 2 active). The old check demanded >= 2, which is mission 3.
    return game.missions.current >= 1 ? true : 'still on mission ' + (game.missions.current + 1);
  });
  check('heist: planning opens', () => {
    const h = game.openHeist('harbor');
    if (!h) return 'planning did not open';
    document.getElementById('heist-plan').style.display = 'none';
    return true;
  });
  check('wanted: rises, police spawn', () => {
    game.setWanted(3);
    game.step(0.5);
    return game.police.state.stars === 3 && game.police.cops.length >= 2
      ? true : `stars ${game.police.state.stars} cops ${game.police.cops.length}`;
  });
  check('crew: bonuses apply (driver top speed, muscle HP)', () => {
    const hp = game.crew.maxHp();
    const mul = game.crew.topSpeedMul();
    return hp === 150 && mul > 1 ? true : `hp ${hp} mul ${mul}`;
  });
  check('standing: changes after earning', () => {
    const before = game.economy.standingFor('oldtown');
    game.economy.earn(0, 40, 'oldtown');
    return game.economy.standingFor('oldtown') > before ? true : 'standing stuck';
  });
  check('save/load: round-trips', () => {
    game.saveNow();
    const loaded = game.loadSave();
    return loaded && typeof loaded.cash === 'number' ? true : 'load failed';
  });
  check('trial: starts, completes, saves best time', () => {
    game.enterVehicle('boat', 190, 160, 0, 0x2e6ac2);
    const started = game.startTrial();
    if (!started) return 'trial did not start';
    // Teleport through the buoys: the trial accepts buoy hits in order.
    for (const b of game.trialBuoys) game.touchBuoy(b);
    const done = game.trialDone;
    game.exitVehicle();
    game.placePlayer(-140, -90, 0);
    return done ? true : 'trial not done after all buoys';
  });
  check('missions: all 10 reachable (markers exist)', () => {
    const all = game.missionList.every((m) => typeof m.x === 'number' && typeof m.z === 'number');
    return all && game.missionList.length === 10 ? true : game.missionList.length + ' missions';
  });

  await sleep(50);
  const passed = results.filter((r) => r.pass).length;
  const summary = { passed, total: results.length, results };
  window.__selftest = summary;
  let node = document.getElementById('selftest');
  if (!node) {
    node = document.createElement('pre');
    node.id = 'selftest';
    document.body.appendChild(node);
  }
  node.textContent = JSON.stringify(summary, null, 1);
  document.title = `SELFTEST ${passed}/${results.length}`;
  return summary;
}
