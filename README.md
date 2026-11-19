# SOLMAR HEAT — Open-World Crime in Solmar Bay

**A complete open-world crime game for make.fun `gta6-01`, playable in a desktop browser from static files with zero network requests.**

Rico "Rook" Marlow is back in Solmar Bay — an invented coastal city of avenues, beaches, a pier, a marina and the Docks — and Dominic Kessler, the Commodore who owns the docks, wants him gone. Ten jobs stand between Rook and the crown.

## What it does

- **A living city on foot and by car** — 6 avenues × 6 streets, 40+ buildings, palms, beach and ocean, a pier, traffic that drives the roads and turns at crossroads, pedestrians who wander the sidewalks and flee gunfire.
- **Cars to steal** — walk up to any traffic car, press E, and it's yours (the cops notice). Driving has acceleration, braking, reverse, steering, damage, smoke and explosions.
- **A 5-star wanted system** — stealing, shooting and running people over raise the heat. Police cars chase and ram, foot cops close in to bust you, the heat fades when you hide, a helicopter watches from 4 stars, and the Spray Shop sells a clean record.
- **10 story missions** — Welcome to Solmar, First Wheels, The Drop (timed delivery), Heat Wave (survive 2 stars), Dockside Debt (shootout), Coast Run (checkpoint race), Silent Partner (tail the courier), Bay Heist: Gear Up (collect 3 crates), The Commodore's Convoy (stop the car), King of Solmar (finale shootout + 4-star survival). Each pays cash and respect.
- **Combat** — pistol (buy at Ironworks, click to shoot at the mouse), punches, enemy enforcers who shoot back, health and armor.
- **Economy & progression** — cash, 5 respect ranks (Nobody → Street → Hustler → Shot Caller → Kingpin), garage upgrades (Turbo Engine, Plated Armor, Grip Tires), gun shop, spray shop, clinic, street cash.
- **HUD with minimap** — cash, rank, missions, wanted stars, health/armor, speed and car damage, mission objective + timer, radio ticker, context prompts, and a live minimap with roads, shops, the mission beacon, the player arrow and flashing police blips.
- **Radio** — 3 stations (Solmar FM 88.1, Bay 104, Docks 96.5), R to change, M to mute. All sound is procedural WebAudio; there are no audio files.
- **Start and save** — title screen with story intro, Continue from a save or New Game, autosave after every mission, pause menu (P) with save, and Wasted / Busted screens that cost you a cut of your cash.
- **All art is original** — every building, palm, car, character and the whole city is drawn procedurally in canvas. No Rockstar logos, artwork or fonts are used anywhere.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Sprint |
| E | Enter / steal a car, get out, use a shop |
| Click | Shoot the pistol toward the mouse (Space punches) |
| 1 / 2 / 3 | Garage upgrades near Tia's Garage |
| G / H | Buy pistol / ammo at Ironworks |
| R / M | Change radio station / mute |
| P / Esc | Pause (S save, Q quit to title) |

## Screenshot scenes

`?shot=start` title over the living city · `?shot=play` on foot in Downtown · `?shot=drive` stealing a car down Palm Row · `?shot=wanted` a 3-star police chase · `?shot=mission` the Dockside Debt shootout · `?shot=end` the King of Solmar crown. `?selftest=1` runs the rules headlessly and reports `window.__selftest`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fbrvfx55&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
