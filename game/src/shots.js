// Screenshot scenes behind ?shot=start|drive|chase|heist. Each one stages a real
// game state (real city, real traffic, real police, real crew) and lets the
// normal loop run it, so the frame is what playing really looks like and the
// same seed always gives the same frame.
export function stageShot(G, name) {
  const s = G.state;
  G.hud.hideAllOverlays();
  // Start from a fresh game so the HUD numbers are deterministic.
  G.state.cash = 2450;
  G.state.respect = 320;
  G.state.health = 100;
  G.state.armor = 50;
  G.state.pistol = true;
  G.state.ammo = 48;

  if (name === 'start') {
    s.player.x = 60; s.player.z = 200; s.player.heading = Math.PI;
    G.screen = 'title';
    const cont = document.getElementById('btn-continue');
    if (cont) cont.style.display = 'none';
    G.hud.show('title');
    return;
  }

  G.screen = 'play';
  if (name === 'drive') {
    // Driving up road x=60 toward the bridge over the east-west canal.
    const car = G.vehicles.makePlayerCar(60, -70, 0, 0xd64545);
    car.speed = 12;
    s.player.vehicle = { type: 'car', ref: car };
    s.player.onFoot = false;
    s.player.x = 60; s.player.z = -70; s.player.heading = 0;
    s.missionIndex = 2;
    s.missionStep = 0;
    s.missionTimer = 74;
    G.crew.recruit('mara', 60, -74);
    return;
  }

  if (name === 'chase') {
    const car = G.vehicles.makePlayerCar(0, -70, 0, 0x4578d6);
    car.speed = 20;
    s.player.vehicle = { type: 'car', ref: car };
    s.player.onFoot = false;
    s.player.x = 0; s.player.z = -70; s.player.heading = 0;
    s.wanted = 3;
    s.missionIndex = 3;
    s.missionStep = 0;
    s.missionTimer = 41;
    G.crew.recruit('mara', 2, -74);
    G.crew.recruit('juno', -2, -74);
    // Let the police system spawn its chase cars and run them in for 1.5s,
    // then pull two of them up alongside the player so the chase is in frame.
    for (let i = 0; i < 90; i++) G.police.step(G, 1 / 60);
    if (G.police.cars[0]) { G.police.cars[0].x = -9; G.police.cars[0].z = -45; }
    if (G.police.cars[1]) { G.police.cars[1].x = 11; G.police.cars[1].z = -38; }
    return;
  }

  // heist (default for anything else): the Marina Heist in progress with crew.
  // Player faces +z, toward the Marina water, docks and boats.
  s.player.x = -60; s.player.z = 205; s.player.heading = 0;
  s.missionIndex = 7;
  s.missionStep = 0;
  s.collected = 1;
  s.wanted = 0;
  s.heistPlan = { heist: 'marina', approach: 'quiet', crew: ['mara', 'juno', 'tayo'], getaway: 'boat' };
  G.crew.recruit('mara', -63, 202);
  G.crew.recruit('juno', -57, 202);
  // No Muscle here: Tayo would shoot the enforcers dead during staging.
  for (let i = 0; i < 3; i++) {
    const e = G.combat.spawnEnemy(-60 + i * 9 - 9, 222);
    e.shootTimer = 10; // hold fire while the shot is taken
  }
  for (let i = 0; i < 3; i++) G.combat.spawnPickup(-60 + i * 4 - 4, 215, 'cash');
  G.hud.flash('MARINA HEIST: GRAB 3 VAULT CRATES');
}
