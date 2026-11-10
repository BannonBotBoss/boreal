/**
 * Dry prairie horizon (D19).
 * The spawn is 49.77 N, 65.54 E, seed 1400: prairie, snow 0, day 227, morning.
 * A cell under the 8th-percentile line is not a sea. Open water is a lake, a pond, or a channel.
 * The frame check is a cool flat sheet across the view, the shape of that sea, compared with a
 * snow-free prairie horizon. It is not a mean-luma or a variance score.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { STAGES, elevationGrid, lakeGrid, toWorld, sampleGrid } from '../src/core/stages/elevation';
import { baseSeaPlane, heightAt, stagedOpenWater, terrainBand } from '../src/core/world';
import { soilAt } from '../src/core/stages/soils';
import { LEVEL } from '../src/core/tuning';

function readPng(file: string) {
  const buf = readFileSync(file);
  let o = 8, w = 0, h = 0, color = 0;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.subarray(o, o + 4).toString('ascii'); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9]; }
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
  }
  const bpp = color === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(w * h * 3);
  const prior = new Uint8Array(stride), row = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p++], a = i >= bpp ? row[i - bpp] : 0, b = prior[i], c = i >= bpp ? prior[i - bpp] : 0;
      let v = x;
      if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const pr = a + b - c, pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c);
        v = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[i] = v;
    }
    prior.set(row);
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3, i = x * bpp;
      rgb[s] = row[i]; rgb[s + 1] = row[i + 1]; rgb[s + 2] = row[i + 2];
    }
  }
  return { w, h, rgb };
}

/** Share of rows, in the middle of the frame, that contain a cool flat run across the view. */
export function coolSheetRows(rgb: Uint8Array, w: number, h: number) {
  const x0 = Math.floor(w * 0.18), x1 = Math.floor(w * 0.82), span = x1 - x0;
  let rows = 0;
  for (let y = Math.floor(h * 0.25); y < Math.floor(h * 0.72); y++) {
    let run = 0, best = 0;
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      const water = b + 6 >= r && (Math.max(r, g, b) - Math.min(r, g, b)) < 40 && (r + g + b) / 3 > 70 && (r + g + b) / 3 < 190 && g < r + 25;
      if (water) { run++; if (run > best) best = run; } else run = 0;
    }
    if (best > span * 0.22) rows++;
  }
  return rows / h;
}

test('a dry basin under the water line is soil, and a real lake stays water', () => {
  STAGES.on = true; STAGES.seed = 1400;
  const yWolf = heightAt(30, 0);
  assert.ok(yWolf > LEVEL.waterSurface, 'the wolf stands on dry ground');
  assert.equal(stagedOpenWater(30, 0), false);
  const yBasin = heightAt(30, 200);
  assert.ok(yBasin < LEVEL.waterSurface, 'the view ahead is under the percentile line');
  assert.equal(stagedOpenWater(30, 200), false, 'that basin is not a lake, pond, or channel');
  assert.equal(baseSeaPlane(true), false);
  assert.equal(baseSeaPlane(false), true);
  assert.equal(terrainBand(yBasin, 30, 200), soilAt(1400, 30, 200).kind);
  const g = elevationGrid(1400), L = lakeGrid(1400), n = g.n;
  let lake: { x: number; z: number } | undefined;
  for (let c = 0; c < L.id.length && !lake; c++) {
    if (L.id[c] < 0) continue;
    const x = (c % n) * g.cell, z = ((c / n) | 0) * g.cell;
    if (toWorld(g, sampleGrid(g, x, z)) < L.bodies[L.id[c]].level) lake = { x, z };
  }
  assert.ok(lake, 'seed 1400 has a lake');
  assert.equal(stagedOpenWater(lake!.x, lake!.z), true);
  assert.equal(terrainBand(heightAt(lake!.x, lake!.z), lake!.x, lake!.z), 'water');
});

test('the prairie horizon sheet matches a dry grassland, and the old sea frame does not', () => {
  // Comanche National Grassland, 29 May 2015, snow-free shortgrass. Public domain, US National Park Service, NPGallery.
  // Same cover the game reports at the spawn (prairie, snow 0). Not Kenora. Not these coordinates.
  const ref = readPng('tasks/evidence/T-0194/ref-comanche-horizon.png');
  const before = readPng('tasks/evidence/T-0194/before-horizon.png');
  const after = readPng('tasks/evidence/T-0194/after-horizon.png');
  const refScore = coolSheetRows(ref.rgb, ref.w, ref.h);
  const beforeScore = coolSheetRows(before.rgb, before.w, before.h);
  const afterScore = coolSheetRows(after.rgb, after.w, after.h);
  assert.ok(refScore < 0.01, `reference sheet ${refScore}`);
  assert.ok(beforeScore > 0.04, `the sea frame must still fail, got ${beforeScore}`);
  assert.ok(afterScore < 0.02 && afterScore < beforeScore * 0.5, `after ${afterScore} ref ${refScore} before ${beforeScore}`);
});
