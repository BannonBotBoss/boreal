/**
 * Prairie and desert overheads are cured grass, not the boreal canopy crop.
 *
 * The crop is NAIP, 1.5954 m per pixel (public/aerial/meta.json). At 2000 m
 * and a 45° lens the pixel is about 1.3 m, so that crop aliases. The HUD
 * class is coverSampleAt. Prairie is vegetation below 0.62
 * (data/earth/cover-density.json). Short grass albedo is 0.16–0.26 and
 * conifer forest is 0.05–0.15 (Oke 1987, Boundary Layer Climates, Table 1.1).
 *
 * Calibration: the 2026-11-12 path frame at 2000 m (green salt) is the known
 * mismatch. A flat straw field is the known match.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

export function overheadCover(file: string) {
  const png = PNG.sync.read(readFileSync(file));
  const { width: w, height: h, data } = png;
  const x0 = Math.floor(w * 0.3), x1 = Math.floor(w * 0.7);
  const y0 = Math.floor(h * 0.25), y1 = Math.floor(h * 0.7);
  let n = 0, sr = 0, sg = 0, sb = 0, adj = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      sr += r; sg += g; sb += b; n++;
      if (x + 1 < x1) {
        const j = i + 4;
        adj += Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
      }
    }
  }
  const r = sr / n, g = sg / n, b = sb / n;
  return { r, g, b, rg: r / g, adj: adj / n };
}

/** Tan, and not the 1.6 m salt. The mismatch frame scores about rg 0.86 and adj 24. */
export function prairieOverheadOk(s: { rg: number; adj: number }) {
  return s.rg > 1 && s.adj < 16;
}

test('the canopy salt fails and a straw field passes', () => {
  const bad = overheadCover('tasks/evidence/T-0222/before-2000.png');
  assert.equal(prairieOverheadOk(bad), false, JSON.stringify(bad));
  assert.ok(bad.g > bad.r + 8, JSON.stringify(bad));
  assert.ok(bad.adj > 18, JSON.stringify(bad));

  const good = overheadCover('tasks/evidence/T-0222/straw-match.png');
  assert.equal(prairieOverheadOk(good), true, JSON.stringify(good));
});

test('open land replaces the conifer crop and the crown floor', () => {
  const tile = readFileSync('src/world/globe/tile.ts', 'utf8');
  const page = readFileSync('src/world/globe/inpage.ts', 'utf8');
  const crowns = readFileSync('src/render/trees/overheadCrowns.ts', 'utf8');
  assert.ok(tile.includes('uOpenLand'), 'the aerial shader has the open-land weight');
  assert.ok(tile.includes('photo = mix(photo, openC, clamp(uOpenLand, 0.0, 1.0) * landMask)'));
  assert.ok(tile.includes('uCrownFloor > 0.5 && landMask > 0.5 && uOpenLand < 0.5'));
  assert.ok(page.includes("biome === 'prairie' || biome === 'desert'"), 'the weight follows coverSampleAt');
  assert.ok(crowns.includes("cover.biome === 'prairie' || cover.biome === 'desert'"), 'prairie does not draw conifer cards');
});

test('the after frame at 2000 m reads as straw, not canopy salt', () => {
  const after = overheadCover('tasks/evidence/T-0222/after-2000.png');
  assert.equal(prairieOverheadOk(after), true, JSON.stringify(after));
});
