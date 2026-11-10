/**
 * Dry prairie horizon (D19).
 * The spawn is 49.77 N, 65.54 E, seed 1400: prairie, snow 0, day 227, 08:46.
 * A cell under the 8th-percentile line is not a sea. Open water is a lake, a pond, or a channel.
 * The frame check is the cool flat sheet, plus the sky luminance and the horizon brightness
 * profile, against the Comanche National Grassland horizon. The open-prairie pair is one pose:
 * main 66deb5e and this branch, seed 1400, x 65.4, z -18.6, yaw 5.140, day 227, 08:46.
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

/** Rec.709 luma. The same weights the sky and horizon scores use. */
export const rec709 = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Sky window. The game horizon sits near 0.34 of the frame. The title occupies the left of the
 * top and the status card the right, so the sample is the clear band between them. That same
 * fraction is sky on the Comanche frame, whose horizon is also near 0.35.
 */
export const SKY_BOX = { x0: 0.36, x1: 0.62, y0: 0.12, y1: 0.24 };

export function regionMean(rgb: Uint8Array, w: number, h: number, box = SKY_BOX) {
  const xa = Math.floor(w * box.x0), xb = Math.floor(w * box.x1);
  const ya = Math.floor(h * box.y0), yb = Math.floor(h * box.y1);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    const i = (y * w + x) * 3;
    r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; n++;
  }
  return { r: r / n, g: g / n, b: b / n, luma: rec709(r / n, g / n, b / n) };
}

/**
 * Twelve mean-luma bins down the centre of the frame, from above the horizon into the near ground.
 * x is 0.42–0.68 so the senses panel and the wolf are outside the strip.
 */
export function horizonBins(rgb: Uint8Array, w: number, h: number, bins = 12) {
  const xa = Math.floor(w * 0.42), xb = Math.floor(w * 0.68);
  const y0 = 0.22, y1 = 0.55;
  const out: number[] = [];
  for (let k = 0; k < bins; k++) {
    const ya = Math.floor(h * (y0 + (y1 - y0) * k / bins));
    const yb = Math.floor(h * (y0 + (y1 - y0) * (k + 1) / bins));
    let L = 0, n = 0;
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const i = (y * w + x) * 3;
      L += rec709(rgb[i], rgb[i + 1], rgb[i + 2]); n++;
    }
    out.push(L / n);
  }
  return out;
}

/** Largest drop between neighbouring bins. A hard horizon is a cliff. A hazed one is a slope. */
export function horizonDrop(bins: number[]) {
  let step = 0;
  for (let i = 1; i < bins.length; i++) step = Math.max(step, bins[i - 1] - bins[i]);
  return step;
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

test('the matched prairie frames keep the Comanche sky and horizon scores', () => {
  // Comanche National Grassland, 29 May 2015, snow-free shortgrass. Public domain, US National Park Service.
  // Same cover the game reports (prairie, snow 0). Not Kenora. Not these coordinates.
  // Calibration of this metric, measured on these files:
  //   known match, the reference: sky luma 189, blue (B−R 59), horizon drop 31, cool sheet 0.0025
  //   known mismatch, main 66deb5e at the same pose: sky luma 232, nearly white (B−R 5), drop 99, cool sheet 0
  // The branch frame has to sit on that mismatch. The white sky and the hard step are already on main.
  const ref = readPng('tasks/evidence/T-0194/ref-comanche-horizon.png');
  const main = readPng('tasks/evidence/T-0194/main-66deb5e.png');
  const before = readPng('tasks/evidence/T-0194/before-horizon.png');
  const after = readPng('tasks/evidence/T-0194/after-horizon.png');
  const refSky = regionMean(ref.rgb, ref.w, ref.h);
  const mainSky = regionMean(main.rgb, main.w, main.h);
  const afterSky = regionMean(after.rgb, after.w, after.h);
  const refDrop = horizonDrop(horizonBins(ref.rgb, ref.w, ref.h));
  const mainBins = horizonBins(main.rgb, main.w, main.h);
  const afterBins = horizonBins(after.rgb, after.w, after.h);
  const mainDrop = horizonDrop(mainBins);
  const afterDrop = horizonDrop(afterBins);
  assert.ok(refSky.luma > 160 && refSky.luma < 210 && refSky.b - refSky.r > 40, `reference sky ${refSky.luma.toFixed(1)} B-R ${(refSky.b - refSky.r).toFixed(1)}`);
  assert.ok(refDrop < 40, `reference horizon drop ${refDrop.toFixed(1)}`);
  assert.ok(coolSheetRows(ref.rgb, ref.w, ref.h) < 0.01);
  assert.ok(mainSky.luma > 220 && mainSky.b - mainSky.r < 15, `main sky ${mainSky.luma.toFixed(1)} is the known white mismatch`);
  assert.ok(mainDrop > 80, `main horizon drop ${mainDrop.toFixed(1)} is the known hard step`);
  assert.ok(coolSheetRows(main.rgb, main.w, main.h) < 0.02);
  assert.ok(Math.abs(afterSky.luma - mainSky.luma) < 1, `after sky ${afterSky.luma.toFixed(1)} main ${mainSky.luma.toFixed(1)}`);
  assert.ok(Math.abs(afterDrop - mainDrop) < 1, `after drop ${afterDrop.toFixed(1)} main ${mainDrop.toFixed(1)}`);
  const binGap = afterBins.reduce((s, v, i) => s + Math.abs(v - mainBins[i]), 0) / afterBins.length;
  assert.ok(binGap < 1, `horizon profile gap ${binGap.toFixed(2)}`);
  assert.ok(coolSheetRows(after.rgb, after.w, after.h) < 0.02);
  assert.ok(coolSheetRows(before.rgb, before.w, before.h) < 0.02);
  // The open view has no sheet on main either. The spawn heading still has the lake band, on both.
  const spawnMain = readPng('tasks/evidence/T-0194/spawn-main.png');
  const spawnBranch = readPng('tasks/evidence/T-0194/spawn-branch.png');
  const sheetMain = coolSheetRows(spawnMain.rgb, spawnMain.w, spawnMain.h);
  const sheetBranch = coolSheetRows(spawnBranch.rgb, spawnBranch.w, spawnBranch.h);
  assert.ok(sheetMain > 0.04 && sheetBranch > 0.04, `spawn sheet main ${sheetMain} branch ${sheetBranch}`);
  assert.ok(Math.abs(sheetMain - sheetBranch) < 0.005, `spawn sheet moved: main ${sheetMain} branch ${sheetBranch}`);
});
