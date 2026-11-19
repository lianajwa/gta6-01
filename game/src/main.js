// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, wasted, busted and the win screen.
//
// ?seed=N fixes the city's pattern. ?shot=start|play|drive|wanted|mission|end
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot. ?selftest=1 runs the
// rules headlessly for a few seconds and reports window.__selftest.
import { AVENUES, BEST_KEY, RADIO, ROAD_W, SAVE_KEY, STEP, STREETS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_OVER, EVENT_SHOT, EVENT_WANTED } from './world.js';
import { ACTION_CONFIRM, ACTION_FIRE, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_RADIO, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// Debug handle for headless play-testing (read-only from the outside).
window.__solmar = { world, STEP };

function readBest() {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? '{"missions":0,"cash":0}');
  } catch {
    return { missions: 0, cash: 0 };
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(scene.screen, world.state, { best: scene.best, hasSave: false, rank: world.rankName(), station: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runSelftest() {
  // Headless smoke test: play the real rules forward with scripted input
  // and report whether the city, the missions and the save round-trip hold.
  const report = { ok: true, checks: {} };
  function check(name, value) {
    report.checks[name] = !!value;
    if (!value) report.ok = false;
  }
  try {
    check('buildings', world.state.buildings.length > 40);
    // No building may sit on a road: every building must clear every avenue
    // and street band, or traffic drives straight into a wall.
    const roadClear = world.state.buildings.every((b) => {
      for (const a of AVENUES) if (b.x < a + ROAD_W / 2 && b.x + b.w > a - ROAD_W / 2) return false;
      for (const s of STREETS) if (b.y < s + ROAD_W / 2 && b.y + b.h > s - ROAD_W / 2) return false;
      return true;
    });
    check('buildings-clear-of-roads', roadClear);
    check('traffic', world.state.cars.length >= 16);
    check('pedestrians', world.state.peds.length >= 20);
    check('missions', world.state.mission === null);
    world.startMission(0);
    check('mission1-starts', world.state.mission !== null && world.state.mission.def.id === 1);
    // Walk Rook onto the pier: mission 1 must complete (60 steps covers the
    // half-second start delay, then the goto check).
    const s = world.state;
    s.player.x = 2330;
    s.player.y = 900;
    for (let i = 0; i < 60; i += 1) {
      world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: {}, key: '', aimX: 0, aimY: 0, fire: false });
    }
    check('mission1-completes', s.stats.missionsDone === 1 && s.player.cash >= 350);
    // Steal a car, drive, wanted rises, police spawn.
    const car = s.cars.find((c) => c.kind === 'traffic');
    s.player.x = car.x;
    s.player.y = car.y;
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: { interact: true }, key: '', aimX: car.x, aimY: car.y, fire: false });
    check('steal-car', s.player.inCar === true && Math.ceil(s.wanted) >= 1);
    for (let i = 0; i < 60 * 4; i += 1) {
      world.step(STEP, { move: { x: 0, y: -1 }, sprint: false, actions: {}, key: '', aimX: 0, aimY: 0, fire: false });
    }
    check('police-spawn', s.cars.some((c) => c.kind === 'police'));
    check('no-crash-after-240-steps', true);
    // Save round-trips through localStorage.
    world.saveGame();
    const raw = window.localStorage.getItem(SAVE_KEY);
    check('save-writes', typeof raw === 'string' && raw.length > 20);
    world.reset();
    check('load-restores', world.loadGame() && world.state.player.cash >= 350);
    report.cash = world.state.player.cash;
    report.buildings = world.state.buildings.length;
    report.missionsDone = world.state.stats.missionsDone;
  } catch (error) {
    report.ok = false;
    report.error = String(error && error.message ? error.message : error);
  }
  window.__selftest = report;
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let station = 0;
  let accumulator = 0;
  let last = performance.now();
  let winShown = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function extra() {
    return { best, hasSave: world.hasSave(), rank: world.rankName(), station };
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      world.startMission(0);
    } else if (!world.loadGame()) {
      world.reset();
      world.startMission(0);
    }
    winShown = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the gold marker — your next job is waiting.');
  }

  function toTitle() {
    screen = SCREEN_TITLE;
    announce('Solmar Heat. Press Enter to continue, Space for a new game.');
  }

  function endRun(kind) {
    const lost = world.wastedOrBusted();
    if (world.state.stats.missionsDone > best.missions) {
      best = { missions: world.state.stats.missionsDone, cash: world.state.stats.cashEarned };
      saveBest(best);
    }
    screen = kind === 'busted' ? SCREEN_BUSTED : SCREEN_OVER;
    announce(kind === 'busted' ? `Busted. You lost $${lost}. Press Enter to get back out there.` : `Wasted. You lost $${lost}. Press Enter to get back out there.`);
    if (kind === 'busted') audio.busted();
    else audio.fail();
  }

  // One read of the one-shot input per frame: handleActions takes the frame's
  // actions and key, stashes what the world needs, and buildControl spends it.
  let frameActions = 0;
  let frameKey = '';

  function handleActions(actions, key) {
    frameActions = actions;
    frameKey = key;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
    }
    if (actions & ACTION_RADIO) {
      station = (station + 1) % RADIO.length;
      audio.setStation(station);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame(key === 'Space');
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused. P resumes, S saves, Q quits to title.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (key === 'KeyS') {
        world.saveGame();
        announce('Saved.');
      } else if (key === 'KeyQ') {
        world.saveGame();
        toTitle();
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        if (screen === SCREEN_WIN) {
          screen = SCREEN_PLAY;
          announce('Free roam — Solmar Bay is yours.');
        } else {
          screen = SCREEN_PLAY;
          announce('Playing.');
        }
      }
    }
  }

  function buildControl() {
    const actions = frameActions;
    frameActions = 0;
    const key = frameKey;
    frameKey = '';
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x, mouse.y);
    return {
      move: input.move(),
      sprint: input.sprint(),
      actions: {
        interact: !!(actions & ACTION_INTERACT),
      },
      key,
      aimX: aim.x,
      aimY: aim.y,
      fire: !!(actions & ACTION_FIRE) || mouse.down,
    };
  }

  function step() {
    const ctrl = buildControl();
    const events = world.step(STEP, ctrl);
    if (events & EVENT_OVER) endRun('wasted');
    else if (events & EVENT_BUSTED) endRun('busted');
    else if (events & EVENT_MISSION && world.state.storyDone && !winShown) {
      winShown = true;
      screen = SCREEN_WIN;
      audio.mission();
      announce('King of Solmar. The city is yours.');
    }
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_WANTED) audio.siren();
    if (events & EVENT_MISSION) audio.mission();
    audio.step(STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions(), input.takeKey());
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
      // The crown: the last mission's completion only sets storyDone once its
      // delay runs out, so check it after the steps, not on the event.
      if (world.state.storyDone && !winShown) {
        winShown = true;
        screen = SCREEN_WIN;
        audio.mission();
        announce('King of Solmar. The city is yours.');
      }
    } else if (screen === SCREEN_TITLE) {
      // The title lives over a slowly simmering city.
      while (accumulator >= STEP) {
        world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: {}, key: '', aimX: 0, aimY: 0, fire: false });
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(screen, world.state, extra());
  }

  // Leaving the tab pauses a running game rather than letting the city run on unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter to continue, Space for a new game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (selftest) runSelftest();
else runGame();
