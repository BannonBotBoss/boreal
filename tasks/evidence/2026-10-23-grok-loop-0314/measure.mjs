// Numeric checks for the 2026-10-23 03:14 PT loop. Terrain from the staged grid (seed 1400).
// Sun: Spencer 1971 series typed here, then compared with core/timeOfDay sunPosition.
// Speeds and the jump arc come from the same helpers the player uses.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES, ELEV, elevationGrid, sampleGrid, toWorld } from '../../../src/core/stages/elevation.ts';
import { heightAt } from '../../../src/core/world.ts';
import { LEVEL } from '../../../src/core/tuning.ts';
import { sunPosition, declination, DAY_OF_YEAR, LATITUDE } from '../../../src/core/timeOfDay.ts';
import { solar, SITE, shortwave } from '../../../src/core/weather.ts';
import { sunColour } from '../../../src/core/light.ts';
import { gravity, jumpArc } from '../../../src/proc/physics.ts';
import { playerSpeed } from '../../../src/core/playerTuning.ts';
import { apexHeight, airSeconds, jumpSeconds } from '../../../src/animals/locomotion/jump.ts';
import { gaitFor } from '../../../src/core/animalBehavior.ts';
import { WOLF_LEGS } from '../../../src/core/animalBehavior.ts';

STAGES.on = true;
const g = elevationGrid(STAGES.seed);
const n = g.n, cell = g.cell;
const hM = new Float32Array(n * n);
let land = 0, steep = 0;
const slopes = [];
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const e = g.h[j * n + i];
  const y = toWorld(g, e);
  hM[j * n + i] = y;
}
const slopeAt = (i, j) => {
  const i1 = (i + 1) % n, i0 = (i + n - 1) % n, j1 = (j + 1) % n, j0 = (j + n - 1) % n;
  const dx = (hM[j * n + i1] - hM[j * n + i0]) / (2 * cell);
  const dz = (hM[j1 * n + i] - hM[j0 * n + i]) / (2 * cell);
  return Math.hypot(dx, dz);
};
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  if (hM[j * n + i] <= LEVEL.waterSurface + 0.05) continue;
  land++;
  const s = slopeAt(i, j);
  slopes.push(s);
  if (s > 0.129) steep++;
}
slopes.sort((a, b) => a - b);
const pct = p => slopes[Math.min(slopes.length - 1, Math.floor(p * slopes.length))];
const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length;

// 1 km local relief on land, every 4th node (window radius 500 m).
const rad = Math.round(500 / cell);
const reliefs = [];
for (let j = 0; j < n; j += 4) for (let i = 0; i < n; i += 4) {
  if (hM[j * n + i] <= LEVEL.waterSurface + 0.05) continue;
  let lo = Infinity, hi = -Infinity;
  for (let dj = -rad; dj <= rad; dj += 2) for (let di = -rad; di <= rad; di += 2) {
    const y = hM[((j + dj + n) % n) * n + ((i + di + n) % n)];
    if (y < lo) lo = y; if (y > hi) hi = y;
  }
  reliefs.push(hi - lo);
}
reliefs.sort((a, b) => a - b);
const rp = p => reliefs[Math.min(reliefs.length - 1, Math.floor(p * reliefs.length))];

// Foot-scale residual: heightAt minus the 30 m bilinear stage-1 surface, dry land, 2 m grid over 400 m.
let res = [], fine = [], coarse = [];
for (let z = 200; z < 600; z += 2) for (let x = 200; x < 600; x += 2) {
  const base = toWorld(g, sampleGrid(g, x, z));
  if (base < LEVEL.waterSurface + 0.3) continue;
  const y = heightAt(x, z);
  res.push(y - base);
  const y2 = heightAt(x + 2, z);
  fine.push(Math.atan(Math.abs(y2 - y) / 2) * 180 / Math.PI);
  const b2 = toWorld(g, sampleGrid(g, x + 2, z));
  coarse.push(Math.atan(Math.abs(b2 - base) / 2) * 180 / Math.PI);
}
const rms = Math.sqrt(res.reduce((a, b) => a + b * b, 0) / res.length);
res.sort((a, b) => a - b);
const landHeights = [];
for (let k = 0; k < hM.length; k++) if (hM[k] > LEVEL.waterSurface + 0.05) landHeights.push(hM[k] - LEVEL.waterSurface);
landHeights.sort((a, b) => a - b);

// A flat spawn and a sloped overlook, for the capture.
let flat = null, slopeView = null, shore = null;
for (let z = 40; z < 400 && (!flat || !slopeView || !shore); z += 4) for (let x = 40; x < 400 && (!flat || !slopeView || !shore); x += 4) {
  const y = heightAt(x, z);
  const s = Math.hypot(heightAt(x + 2, z) - heightAt(x - 2, z), heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
  const deg = Math.atan(s) * 180 / Math.PI;
  if (!flat && y > 1 && deg < 1.2) flat = { x, z, y: +y.toFixed(2), deg: +deg.toFixed(2) };
  if (!slopeView && y > 4 && deg > 6 && deg < 14) slopeView = { x, z, y: +y.toFixed(2), deg: +deg.toFixed(2) };
  if (!shore && y > LEVEL.waterSurface && y < LEVEL.waterSurface + 0.4 && deg < 8) shore = { x, z, y: +y.toFixed(2), deg: +deg.toFixed(2) };
}

// Independent Spencer 1971 declination (NOAA GML solareqns, the series in the PDF). Not a call into solar().
function spencerDecl(day, hour = 12) {
  const gg = 2 * Math.PI / 365 * (day - 1 + (hour - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(gg) + 0.070257 * Math.sin(gg) - 0.006758 * Math.cos(2 * gg)
    + 0.000907 * Math.sin(2 * gg) - 0.002697 * Math.cos(3 * gg) + 0.00148 * Math.sin(3 * gg);
  return decl * 180 / Math.PI;
}
function elev(lat, declDeg, hourAngleDeg) {
  const R = Math.PI / 180;
  const s = Math.sin(lat * R) * Math.sin(declDeg * R) + Math.cos(lat * R) * Math.cos(declDeg * R) * Math.cos(hourAngleDeg * R);
  return Math.asin(Math.max(-1, Math.min(1, s))) / R;
}
const day = DAY_OF_YEAR;
const declGame = declination(day);
const declIndep = spencerDecl(day, 12);
const hours = [];
for (const hour of [5, 6, 7, 8, 9, 12, 16, 18, 19, 20]) {
  const game = sunPosition(hour, day, LATITUDE);
  const indep = elev(LATITUDE, declIndep, 15 * (hour - 12));
  const civil = solar(day, hour); // Kenora civil clock: lon, tz
  const sc = sunColour(Math.sin(game.elevation * Math.PI / 180));
  hours.push({
    hour, gameEl: +game.elevation.toFixed(2), indepEl: +indep.toFixed(2),
    az: +game.azimuth.toFixed(1),
    civilZenith: +civil.zenith.toFixed(2), civilEl: +(90 - civil.zenith).toFixed(2),
    sunRgb: [sc.r, sc.g, sc.b].map(v => +v.toFixed(3)),
    shortwave: +shortwave(Math.sin(game.elevation * Math.PI / 180), 0).toFixed(1),
  });
}
const winter = sunPosition(12, 355, LATITUDE);
const winterIndep = elev(LATITUDE, spencerDecl(355, 12), 0);
let low = null;
for (let h = 4; h < 12; h += 0.05) {
  const el = sunPosition(h, day, LATITUDE).elevation;
  if (el > 18 && el < 24) { low = { hour: +h.toFixed(2), el: +el.toFixed(2), az: +sunPosition(h).azimuth.toFixed(2) }; break; }
}

const gms = gravity();
const speeds = ['walk', 'run', 'sprint', 'stealth'].map(mode => {
  const v = playerSpeed(mode);
  const gait = gaitFor('walk', v, WOLF_LEGS);
  return { mode, v: +v.toFixed(3), froude: +(v * v / (gms * WOLF_LEGS.hip)).toFixed(3), gait: gait?.name ?? null, duty: gait ? +gait.duty.toFixed(3) : null };
});
const arc = jumpArc(40, jumpSeconds());

const out = {
  seed: STAGES.seed,
  grid: { n, cell, worldM: n * cell, reliefM: ELEV.reliefM, k: +g.k.toFixed(4), water: LEVEL.waterSurface },
  terrain: {
    landFrac: +(land / (n * n)).toFixed(3),
    slopeMean: +mean.toFixed(4),
    slopeP50: +pct(0.5).toFixed(4),
    slopeP90: +pct(0.9).toFixed(4),
    slopeP99: +pct(0.99).toFixed(4),
    fracSteeperThan0129: +(steep / land).toFixed(3),
    landP99AboveWater: +landHeights[Math.floor(landHeights.length * 0.99)].toFixed(2),
    localRelief1kmP50: +rp(0.5).toFixed(2),
    localRelief1kmP90: +rp(0.9).toFixed(2),
    residualRm: +rms.toFixed(4),
    residualP05: +res[Math.floor(res.length * 0.05)].toFixed(4),
    residualP95: +res[Math.floor(res.length * 0.95)].toFixed(4),
    fineSlopeDegP50: +fine.sort((a, b) => a - b)[Math.floor(fine.length * 0.5)].toFixed(2),
    coarseSlopeDegP50: +coarse.sort((a, b) => a - b)[Math.floor(coarse.length * 0.5)].toFixed(2),
    samples: { flat, slopeView, shore },
  },
  sun: {
    day, lat: LATITUDE, site: SITE,
    declGame: +declGame.toFixed(3), declSpencer: +declIndep.toFixed(3),
    noonGame: +sunPosition(12).elevation.toFixed(3),
    noonIndep: +elev(LATITUDE, declIndep, 0).toFixed(3),
    noonPinnedDay227: +sunPosition(12, 227).elevation.toFixed(3),
    winterDay355Game: +winter.elevation.toFixed(3),
    winterDay355Spencer: +winterIndep.toFixed(3),
    lowSun: low,
    hours,
  },
  physics: {
    g: +gms.toFixed(5),
    speeds,
    jump: { seconds: jumpSeconds(), air: +airSeconds().toFixed(3), apex: +apexHeight().toFixed(3), arcApex: +arc.apex.toFixed(3), launch: +arc.launch.toFixed(3) },
    hip: WOLF_LEGS.hip,
  },
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'measure.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ terrain: out.terrain, sun: { declGame: out.sun.declGame, declSpencer: out.sun.declSpencer, noon: out.sun.noonGame, winter: out.sun.winterDay355Game, low: out.sun.lowSun }, physics: out.physics }, null, 2));
