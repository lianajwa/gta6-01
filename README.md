# TIDELINE — Delta Kings

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/lianajwa/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/lianajwa/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

**Bounty:** [Make GTA 6](https://make.fun/c/gta6-01) (make.fun, gta6-01)

A 3D open-world crime game in a dusk river-delta canal city called **Tideline**.
Five districts, each with its own look: Old Town's pitched terracotta houses,
Market Row's colourful mid-rise and 14 stalls, the Neon Strip's stepped towers
and glowing signs, the Marina's white docks and moored boats, and the Canal
Quarter's brick warehouses. Two canals with bridges, 100+ procedural
buildings, palms, billboards, traffic lights and a low warm sun over rose fog.

## What you do

- **On foot, by car and by boat** — steal cars, take boats from the Marina,
  run the canals. Boats are Tideline's signature: no other entry sails.
- **Drive with weight** — speed-dependent steering, an accel curve, Space
  handbrake drift with slip angle, tyre smoke and an FOV kick.
- **5-star wanted** — roadblocks at 3 stars, a helicopter with a spotlight
  at 4+. Lay low and the heat decays; the Lookout makes it decay faster.
- **10 story missions** — from "First Light" in Old Town to "The Last Tide".
- **2 staged heists** — plan Loud (fast, hot, less pay) or Quiet (slow,
  fewer guards, more pay). Juno the Hacker cuts every heist timer 30%.
- **Tide Trial** — a boat time-trial through 5 orange buoys, best time saved.
- **Crew of four, each bonus real** — Mara (Driver: +12% top speed, +25%
  grip), Juno (Hacker: −30% heist timers), Bram (Muscle: +50 max HP),
  Sable (Lookout: wanted warning, faster decay).
- **Economy** — cash, 5 respect ranks (Nobody → Delta King), gun shop,
  garage, spray shop, clinic, safehouse, and standing in all 5 districts.
- **Save / autosave** — progress survives a reload.
- **HUD + live minimap** — cash, health, wanted stars (live every frame),
  mission objective, trial timer, district name, and 3 procedural WebAudio
  radio stations (DELTA FM, NEON 88, TIDE RADIO) — synthesized, no files.

## Screenshots

1. `1-start.jpg` — on foot in Old Town at dusk, mission 1 marker ahead.
2. `2-drive.jpg` — the red car on the south-canal bridge, Neon Strip behind.
3. `3-chase.jpg` — wanted level 3, a police car closing in.
4. `4-heist.jpg` — the Marina from above: docks, moored boats, heist site.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

WASD move / drive · Shift run · E enter car or boat · Space handbrake drift ·
F or click: fire pistol · 1/2/3 radio · M mute · Esc pause.

## Tech

three.js r160 vendored under `game/vendor/`, plain ES modules, no build
step, no network request at play time. Entry: `node main.ts` hands the game
in (dossier via the kit's `vendor/makefun-game.ts`).
