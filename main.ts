// TIDELINE — Delta Kings: the entry program (Node 22, standard library only).
// It hands the game in: copies game/ and screenshots/ from beside this file
// to the output directory and writes /output/dossier.json with the kit's
// buildDossier. The game itself is plain static files a desktop browser
// loads offline — no build step, no network request at play time.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: 4 screenshots at most 256 KiB each, game/ at most
// 993 files and 48 MiB, every path under game/ at most 1000 bytes.
const dossierText = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierText);
console.log(`tideline: wrote ${join(out, 'dossier.json')} (${dossierText.length} bytes)`);
