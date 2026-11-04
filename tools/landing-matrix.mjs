// Ten-site in-page descent for issue #192. Each site is a SEAM_LOCATIONS click after pickSite
// (tools/globe-seam-baseline.ts). fall-shot.mjs does the embody. This only points it and keeps the landed frames.
//
//   BASE=http://127.0.0.1:5173 PW=... node tools/landing-matrix.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = join(root, process.env.EVIDENCE ?? 'tasks/evidence/T-0125');
mkdirSync(evidence, { recursive: true });

/** pickSite results on the seeded planet, 2026-10-31. Names are the Earth labels; the cover class is whatever the sim says. */
const SITES = [
  { slug: 'boreal', name: 'boreal forest', lat: 52, lon: -97 },
  { slug: 'tundra', name: 'tundra', lat: 64.5, lon: -119.7 },
  { slug: 'alpine', name: 'alpine', lat: 0.5, lon: 54 },
  { slug: 'coast', name: 'coast', lat: 44.3, lon: -122.2 },
  { slug: 'desert', name: 'desert', lat: 27.4, lon: 27.7 },
  { slug: 'tropics', name: 'tropics', lat: -7.1, lon: -67 },
  { slug: 'ocean', name: 'ocean edge', lat: 36.6, lon: -121.9 },
  { slug: 'polar', name: 'polar', lat: 74.2, lon: 50.6 },
  { slug: 'prairie', name: 'prairie', lat: 51, lon: -107 },
  { slug: 'wetland', name: 'wetland (lake)', lat: 47.9, lon: -104.9 },
];

function runShot(site) {
  const out = `/tmp/shots-${site.slug}`;
  mkdirSync(out, { recursive: true });
  const env = {
    ...process.env,
    OUT: out,
    Q: `&latlon=${site.lat},${site.lon}`,
    EMBODY: process.env.EMBODY ?? '2',
    // The filmstrip is not the evidence. One frame after the glide is enough; the phase waits live in fall-shot.
    N: process.env.N ?? '1',
    STEP: process.env.STEP ?? '4000',
  };
  return new Promise((resolve) => {
    const child = spawn('node', ['tools/fall-shot.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; process.stdout.write(d); });
    child.stderr.on('data', d => { log += d; process.stderr.write(d); });
    child.on('close', code => resolve({ code, log, out }));
  });
}

function lastCast(log) {
  let cast = null, rafMs = null, hud = null, picture = null, renderer = null, heap = null, time = '', date = '', errs = [];
  for (const line of log.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const row = JSON.parse(line);
      if (row.landed) {
        cast = row.cast ?? cast; rafMs = row.rafMs ?? rafMs; hud = row.hud ?? hud;
        picture = row.picture ?? picture; renderer = row.renderer ?? renderer; heap = row.heap ?? heap;
        time = row.time ?? time; date = row.date ?? date;
        if (Array.isArray(row.errs)) errs = row.errs;
      }
    } catch { /* screenshots share the log with other lines */ }
  }
  return { cast, rafMs, hud, picture, renderer, heap, time, date, errs };
}

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const rows = [];
for (const site of SITES) {
  if (only && !only.includes(site.slug)) continue;
  console.log(`\n== ${site.name} ${site.lat},${site.lon} ==`);
  const shot = await runShot(site);
  const { cast, rafMs, hud, picture, renderer, heap, time, date, errs } = lastCast(shot.log);
  const dir = join(evidence, site.slug);
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(shot.out)) {
    if (name.startsWith('landed-')) copyFileSync(join(shot.out, name), join(dir, name));
  }
  const row = {
    site: site.name, slug: site.slug, clickLat: site.lat, clickLon: site.lon,
    landedLat: cast?.lat ?? null, landedLon: cast?.lon ?? null, biome: cast?.biome ?? null,
    water: cast?.water ?? null, shore: cast?.shore ?? false,
    elevM: cast?.elevM ?? null, vegetation: cast?.vegetation ?? null,
    censusLat: cast?.censusLat ?? null, censusLon: cast?.censusLon ?? null,
    census: cast?.census ?? [], shown: cast?.shown ?? [],
    simStepMs: cast?.frameMs ?? null,
    /** One requestAnimationFrame under SwiftShader. Software-rendering only. Not a hardware FPS. */
    frameMs: rafMs, softwareRendering: true,
    lighting: cast?.lighting ?? null, clock: time, clockDate: date,
    picture, renderer, heap, consoleErrors: errs,
    /** Filled after looking at the landed frames. Empty until then. */
    seams: '',
    hud, exit: shot.code, note: cast?.note ?? '',
  };
  rows.push(row);
  writeFileSync(join(dir, 'landing.json'), JSON.stringify(row, null, 2));
  writeFileSync(join(evidence, 'matrix.json'), JSON.stringify(rows, null, 2));
}
console.log('\nMATRIX');
console.log(JSON.stringify(rows, null, 2));
