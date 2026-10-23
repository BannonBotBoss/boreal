// Scout for the 07:17 PT loop. Staged seed 1400. Picks a water entry, a spruce, and the steepest dry grade.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { surfaceAt } from '../../../src/core/stages/surfaceAt.ts';
import { heightAt, generateChunk, CHUNK_SIZE } from '../../../src/core/world.ts';
import { LEVEL, BLOCK } from '../../../src/core/tuning.ts';
import { sunPosition, declination } from '../../../src/core/timeOfDay.ts';
import { solar } from '../../../src/core/weather.ts';

STAGES.on = true;
const dir = dirname(fileURLToPath(import.meta.url));

function surface(x: number, z: number) {
  const p = surfaceAt(x, z);
  const h = heightAt(x, z);
  const waterY = p.lake?.surface ?? (h < LEVEL.waterSurface ? LEVEL.waterSurface : null);
  return { h: +h.toFixed(3), waterY: waterY === null ? null : +waterY.toFixed(3), depth: waterY === null ? 0 : +(waterY - h).toFixed(3), lake: p.lake?.kind ?? null };
}

// Independent Spencer 1971 declination (NOAA General Solar Position Calculations), not sunPosition's return.
function spencerDecl(day: number) {
  const g = 2 * Math.PI * (day - 1) / 365;
  const d = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return d * 180 / Math.PI;
}
function spencerEl(hour: number, day: number, lat: number) {
  const dec = spencerDecl(day) * Math.PI / 180, phi = lat * Math.PI / 180, h = 15 * (hour - 12) * Math.PI / 180;
  const s = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h);
  return Math.asin(Math.max(-1, Math.min(1, s))) * 180 / Math.PI;
}

const sunHours = [12, 18, 19, 19.5, 20, 20.5, 21, 22];
const sun = sunHours.map(hour => {
  const game = sunPosition(hour);
  const indep = spencerEl(hour, 227, 49.5);
  const weather = solar(227, hour);
  return {
    hour,
    gameEl: +game.elevation.toFixed(3),
    gameAz: +game.azimuth.toFixed(2),
    spencerEl: +indep.toFixed(3),
    deltaDeg: +(game.elevation - indep).toFixed(4),
    weatherZenith: +weather.zenith.toFixed(3),
    weatherEl: +(90 - weather.zenith).toFixed(3),
    declGame: +declination(227).toFixed(3),
    declSpencer: +spencerDecl(227).toFixed(3),
  };
});
let sunset = 12;
for (let h = 12; h < 24; h += 0.01) if (spencerEl(h, 227, 49.5) <= 0) { sunset = +h.toFixed(2); break; }
let civil = sunset;
for (let h = sunset; h < 24; h += 0.01) if (spencerEl(h, 227, 49.5) <= -6) { civil = +h.toFixed(2); break; }

// Water: ring from the known shore until a dry cell looks into water deeper than 0.8 m within 25 m.
let water: Record<string, unknown> | null = null;
outer: for (let r = 0; r <= 80; r += 4) {
  const n = Math.max(8, Math.round(2 * Math.PI * Math.max(r, 1) / 8));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const x = 200 + Math.cos(a) * r, z = 250 + Math.sin(a) * r;
    const here = surface(x, z);
    if (here.depth > 0.05 || here.h < LEVEL.shore) continue;
    for (let aim = 0; aim < 16; aim++) {
      const hdg = aim / 16 * Math.PI * 2;
      const samples = [];
      let deep = null;
      for (let d = 0; d <= 28; d += 0.5) {
        const px = x - Math.sin(hdg) * d, pz = z - Math.cos(hdg) * d;
        const s = surface(px, pz);
        if (d % 2 === 0) samples.push({ d, ...s });
        if (s.depth >= 0.8 && !deep) deep = { d, ...s, x: +px.toFixed(2), z: +pz.toFixed(2) };
      }
      if (deep && deep.d < 22) {
        water = { start: { x: +x.toFixed(2), z: +z.toFixed(2), hdg: +hdg.toFixed(3), h: here.h }, deep, samples };
        break outer;
      }
    }
  }
}

// Spruce on dry ground with 4 m of dry approach straight at the trunk.
let spruce: Record<string, unknown> | null = null;
const trees: { x: number; z: number; scale: number; key: string; h: number }[] = [];
for (let cx = 3; cx <= 7; cx++) for (let cz = 4; cz <= 8; cz++) {
  for (const e of generateChunk(cx, cz)) if (e.kind === 'spruce') {
    const s = surface(e.x, e.z);
    if (s.depth > 0 || s.h < LEVEL.shore) continue;
    trees.push({ x: +e.x.toFixed(2), z: +e.z.toFixed(2), scale: +e.scale.toFixed(3), key: e.key, h: s.h });
  }
}
for (const t of trees) {
  for (let aim = 0; aim < 8; aim++) {
    const hdg = aim / 8 * Math.PI * 2;
    let dry = true;
    for (let d = 1; d <= 6; d++) {
      const s = surface(t.x + Math.sin(hdg) * d, t.z + Math.cos(hdg) * d);
      if (s.depth > 0 || s.h < 0) dry = false;
    }
    if (!dry) continue;
    // approach from 5 m out, heading toward the trunk (forward is -sin, -cos of heading)
    const sx = t.x + Math.sin(hdg) * 5, sz = t.z + Math.cos(hdg) * 5;
    const heading = Math.atan2(-(t.x - sx), -(t.z - sz));
    spruce = { ...t, start: { x: +sx.toFixed(2), z: +sz.toFixed(2), heading: +heading.toFixed(3) }, trunkClearance: BLOCK.wolf.trunk };
    break;
  }
  if (spruce) break;
}

// Steepest 2 m grade on dry land in the same window.
let steep = { grade: 0, x: 0, z: 0, hdg: 0, dh: 0 };
for (let x = 140; x <= 280; x += 4) for (let z = 180; z <= 320; z += 4) {
  const h0 = heightAt(x, z);
  if (h0 < LEVEL.shore) continue;
  for (const [dx, dz] of [[2, 0], [0, 2], [1.4, 1.4], [-2, 0]]) {
    const h1 = heightAt(x + dx, z + dz);
    if (h1 < LEVEL.shore) continue;
    const run = Math.hypot(dx, dz), grade = Math.abs(h1 - h0) / run;
    if (grade > steep.grade) steep = { grade: +grade.toFixed(3), x, z, hdg: +Math.atan2(-dx, -dz).toFixed(3), dh: +(h1 - h0).toFixed(3) };
  }
}
const stepProbe = BLOCK.wolf.step; // m over the 0.25 s autonomous probe
const out = {
  water, spruce, steep, treesSeen: trees.length,
  block: BLOCK, level: { waterSurface: LEVEL.waterSurface, shore: LEVEL.shore, wolfWater: LEVEL.wolfWater },
  sun, sunsetHourLocalSolar: sunset, civilTwilightHour: civil,
  chunk: CHUNK_SIZE,
  note: 'Player steerWolf does not read BLOCK or LEVEL. Autonomous wolf does. Drawn y is max(heightAt, -0.2); the water mesh is at waterSurface -0.25.',
  stepLimitGrade: +(stepProbe / 0.5).toFixed(3),
};
writeFileSync(join(dir, 'scout.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ water: water && { start: (water as { start: unknown }).start, deep: (water as { deep: unknown }).deep }, spruce, steep, sunset, civil, sunDelta: sun.map(s => s.deltaDeg) }, null, 2));
