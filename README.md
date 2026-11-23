# TIDELINE — Delta Kings

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lianajwa/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lianajwa/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

https://make.fun/bounty/gta6-01

**A complete 3D open-world crime game for make.fun `gta6-01`, playable in a desktop browser from static files with zero network requests (three.js r160 is vendored under `game/vendor/`).**

You wash up in **Tideline**, a sun-soaked river-delta canal city of bridges, boats, markets and neon — with nothing but a name. The Commodore owns the docks and the cops. Build a crew, win the districts, pull the heists, and take the crown: **Delta King**.

## What it does

- **A living 3D delta city** — low-poly procedural three.js world: two canals crossed by road bridges, a marina basin with docks and moored boats, 5 districts (Old Town, Market Row, Neon Strip, Marina, Canal Quarter), 100+ buildings with lit windows, palms, lamps, a road grid, traffic and pedestrians.
- **On foot, by car, and by boat** — walk the streets, steal any traffic car with E (arcade driving: acceleration, braking, steering, damage, smoke, explosions), or board a boat at the marina and sail the canals. Boats are the getaway for the Marina Heist.
- **Traffic & pedestrians** — cars drive the road grid and turn at intersections; pedestrians wander the sidewalks and flee gunfire and police.
- **A 5-star wanted system** — stealing, shooting and running people over raise the heat. Police cars chase and ram, foot cops close in to bust you, roadblocks appear at 3+ stars, a helicopter with a spotlight watches from 4+ stars, and the heat fades when you hide. The Spray Shop sells a clean record.
- **A crew — the hook** — four recruitable specialists who follow you and fight beside you: **Mara Voss** (Driver, +15% car speed), **Juno Park** (Hacker, wanted fades twice as fast, unlocks Quiet heists), **Big Tayo** (Muscle, +50% gun damage), **Wren** (Lookout, police marked on the map). Manage them in the crew panel (C) and send them on side jobs that pay out.
- **District standing — the hook** — each of the 5 districts tracks your standing. Missions and jobs raise it where they happen; at 50+ standing shops there give up to 25% off, and the minimap shows district control.
- **Staged heists — the hook** — two big heists with a planning phase: pick **Loud vs Quiet**, pick your crew, pick the getaway (car or boat), then execute. The Marina Heist is story mission 8; the Neon Casino heist is on the safehouse heist board.
- **10 story missions** — First Tide, Hot Wheels, The Drop (timed delivery), Heat Wave (survive 2 stars), Dockside Debt (shootout), Canal Run (boat race checkpoints), Silent Partner (tail the courier), Marina Heist, The Commodore's Convoy, Delta King (finale: 6 enforcers + survive 4 stars). Each pays cash and respect; objectives, timers and the beacon are on the HUD.
- **Combat** — pistol (buy at Ironworks, click to shoot toward the mouse), punches, enemy enforcers who shoot back, health and armor, tracers and hit flashes.
- **Economy & progression** — cash, 5 respect ranks (Nobody → Deckhand → Hustler → Shot Caller → Delta King), gun shop, garage upgrades (Turbo Engine, Plated Armor, Grip Tires), spray shop, clinic, safehouse, street cash.
- **HUD with minimap** — cash, rank, respect, district + standing, wanted stars, health/armor bars, speed and vehicle, mission objective + timer, radio ticker, context prompts, and a live minimap with districts, water, roads, shops, the mission beacon, the player arrow, flashing police blips and crew dots.
- **Radio** — 3 stations (Tide FM 88.1, Neon 104, Canal 96.5), R to change, M to mute. All sound is procedural WebAudio; there are no audio files.
- **Start and save** — title screen with story intro, Continue from a save or New Game, autosave after every mission, pause menu (P) with save, and Wasted / Busted screens that cost you 10% of your cash.
- **All art is original** — every building, palm, car, boat, character and the whole city is generated procedurally. No Rockstar logos, artwork or fonts are used anywhere.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive, sail |
| Shift | Sprint |
| E | Enter / steal a car, board a boat, use a shop, get out |
| Click | Shoot the pistol toward the mouse |
| Space | Punch |
| C | Crew panel |
| R / M | Change radio station / mute |
| P / Esc | Pause (Save, Quit to title) |

## Screenshot scenes

`?shot=start` title over the 3D city · `?shot=drive` driving across the canal bridge · `?shot=chase` a 3-star police chase · `?shot=heist` the Marina Heist with crew. `?selftest=1` runs the rules headlessly and reports `window.__selftest`.

## Code layout

`game/src/` is split by job, one file per system: `main.js` (boot + loop + screens), `city.js` (procedural city), `vehicles.js` (cars + traffic), `boats.js`, `police.js` (wanted system), `missions.js` (story engine), `heists.js` (planning), `crew.js`, `districts.js`, `economy.js` (shops), `combat.js`, `hud.js` (HUD + minimap), `audio.js` (procedural radio), `input.js`, `save.js`, `config.js` (world data), `random.js`, `shots.js` (screenshot scenes).

---

<sub>Entered on [make.fun](https://make.fun/?ref=fbrvfx55&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
