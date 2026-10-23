// Numbers for the 08:21 inspection: slope, local-solar sun, plant mesh height.
// The sun helper is local solar hour at 49.5 N. weather.solar is civil time at the site longitude.
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { heightAt } from '../../../src/core/world.ts';
import { sunPosition, LATITUDE, DAY_OF_YEAR } from '../../../src/core/timeOfDay.ts';
import { solar } from '../../../src/core/weather.ts';
import { phenology } from '../../../src/core/treeSpecies.ts';
import { FLORA_BY_ID } from '../../../src/core/flora/plants.ts';
import { buildPlant } from '../../../src/render/flora/plant.ts';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

STAGES.on = true;
const RAD = Math.PI / 180;

function spencerDecl(day, hour) {
  const g = 2 * Math.PI / 365 * (day - 1 + (hour - 12) / 24);
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  return decl / RAD;
}
function localSolarEl(hour, day = DAY_OF_YEAR, lat = LATITUDE) {
  const d = spencerDecl(day, 12) * RAD, phi = lat * RAD, h = 15 * (hour - 12) * RAD;
  const sinEl = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
  return Math.asin(Math.max(-1, Math.min(1, sinEl))) / RAD;
}

const sun = {};
for (const hour of [7, 12, 19.16]) {
  const game = sunPosition(hour);
  const civil = solar(DAY_OF_YEAR, hour);
  sun[hour] = {
    gameEl: +game.elevation.toFixed(3),
    gameAz: +game.azimuth.toFixed(3),
    spencerNoonDeclEl: +localSolarEl(hour).toFixed(3),
    civilEl: +(90 - civil.zenith).toFixed(3),
    civilDecl: +civil.decl.toFixed(3),
  };
}

const grades = [];
for (let x = 80; x <= 240; x += 4) for (let z = 40; z <= 280; z += 4) {
  const h = heightAt(x, z);
  if (h < 0.5) continue;
  const e = heightAt(x + 2, z), n = heightAt(x, z + 2);
  grades.push(Math.hypot(e - h, n - h) / 2);
}
grades.sort((a, b) => a - b);
const pct = (p) => grades[Math.min(grades.length - 1, Math.floor(p * (grades.length - 1)))];
const share = (t) => grades.filter(g => g > t).length / grades.length;

const plants = {};
for (const id of ['fireweed', 'blueberry', 'rose', 'alder', 'juniper', 'bunchberry']) {
  const spec = FLORA_BY_ID[id];
  const g = buildPlant(spec, 0, 0);
  g.computeBoundingBox();
  const box = g.boundingBox;
  plants[id] = {
    maxY: +box.max.y.toFixed(3),
    mean: spec.height.mean,
    rowMax: spec.height.max,
    ratio: +(box.max.y / spec.height.mean).toFixed(3),
    insideRow: box.max.y <= spec.height.max + 1e-6,
  };
  g.dispose();
}

const out = {
  day: DAY_OF_YEAR,
  lat: LATITUDE,
  phenology227: phenology(227),
  phenology260: phenology(260),
  sun,
  slope: {
    n: grades.length,
    p50: +pct(.5).toFixed(3),
    p90: +pct(.9).toFixed(3),
    p99: +pct(.99).toFixed(3),
    shareAbove0129: +share(0.129).toFixed(3),
    shareAbove017: +share(0.17).toFixed(3),
    spot: { x: 144, z: 236, h: +heightAt(144, 236).toFixed(3), east2: +heightAt(146, 236).toFixed(3) },
  },
  plants,
};
const file = join(dirname(fileURLToPath(import.meta.url)), 'measure.json');
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
