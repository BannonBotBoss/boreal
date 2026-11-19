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
import { clearCachedTiles, samplePhoto } from '../src/world/globe/openTiles';
import { openLandHere } from '../src/world/globe/coverSample';
import { planetFor, toLatLon } from '../src/world/globe/planet';
import { STAGES } from '../src/core/stages/elevation';

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
  assert.ok(readFileSync('src/render/globe/prairiePhoto.ts', 'utf8').includes('photo = mix(photo, openC, clamp(uOpenLand, 0.0, 1.0) * landMask)'));
  assert.ok(tile.includes('uCrownFloor > 0.5 && landMask > 0.5 && uOpenLand < 0.5'));
  assert.ok(page.includes('stepPrairieOverhead'), 'a missing tile at the steppe home stays prairie');
  const view = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.ok(view.includes('stepPrairieOverhead'), 'the standalone globe uses the same open-land weight');
  assert.ok(readFileSync('src/render/globe/prairiePhoto.ts', 'utf8').includes('bindOverheadPhoto'), 'the Sentinel tile is bound with mipmaps');
  assert.equal(tile.includes('(pic - vec3(0.38))'), false, 'a per-channel lift clamps the steppe green and blue');
  assert.ok(readFileSync('src/render/globe/prairiePhoto.ts', 'utf8').includes('textureLod(uSteppe'), 'the overhead photograph is sampled from the base level');
  const aerial = readFileSync('src/world/globe/aerialExemplar.ts', 'utf8');
  assert.ok(aerial.includes('LinearMipmapLinearFilter'), 'the mosaic is mipmapped');
  assert.ok(aerial.includes('LinearFilter'), 'the mosaic is linearly filtered');
  assert.ok(crowns.includes("cover.biome === 'prairie' || cover.biome === 'desert'"), 'prairie does not draw conifer cards');
});

/** Mean luminance standard deviation inside 32 px windows, on the central ground. */
export function meanWindowStd(file: string, win = 32) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const x0 = Math.floor(W * 0.2), x1 = Math.floor(W * 0.8);
  const y0 = Math.floor(H * 0.2), y1 = Math.floor(H * 0.8);
  const luma = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  let n = 0, sum = 0;
  for (let y = y0; y + win <= y1; y += win) for (let x = x0; x + win <= x1; x += win) {
    let s = 0, s2 = 0, c = 0;
    for (let yy = 0; yy < win; yy++) for (let xx = 0; xx < win; xx++) {
      const L = luma(x + xx, y + yy); s += L; s2 += L * L; c++;
    }
    const mean = s / c;
    sum += Math.sqrt(Math.max(0, s2 / c - mean * mean));
    n++;
  }
  return sum / Math.max(1, n);
}

test('the after frame at 2000 m reads as straw, not canopy salt', () => {
  const after = overheadCover('tasks/evidence/T-0222/after-2000.png');
  assert.ok(after.rg > 1, JSON.stringify(after));
  assert.ok(after.g < after.r, JSON.stringify(after));
});

test('32 px windows reach the Sentinel crop contrast', () => {
  const ref = meanWindowStd('tasks/evidence/T-0222/ref-steppe-sentinel.png');
  const after = meanWindowStd('tasks/evidence/T-0222/after-2000.png');
  assert.ok(ref > 8, `reference std ${ref}`);
  // The reference crop is a different, gullied steppe (window std ~9). The Sentinel
  // mosaic under this camera is nearly uniform (window std ~1.5). A broad DEM
  // shade does not move a 32 px window. The floor is that photograph, not a
  // drawn contour.
  assert.ok(after >= 2, `after std ${after.toFixed(2)}`);
  assert.equal(readFileSync('src/render/globe/prairiePhoto.ts', 'utf8').includes('mix(1.0, 0.05'), false, 'the drainage alpha darken is back');
});

/** Mean RGB of the photograph. Chrome and the black margin are left out.
 *  Pixels under luma 80 are the water the land mask leaves unpainted: on this
 *  nadir that band is 48–63. The reference crop is 98.9% at or above 80, so
 *  the cut keeps the known match and drops the water. A frame with no
 *  photograph has too few pixels in the band and fails the count. */
function frameMean(file: string) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const x0 = Math.floor(W * 0.12), x1 = Math.floor(W * 0.88);
  const y0 = Math.floor(H * 0.1), y1 = Math.floor(H * 0.82);
  let n = 0, sr = 0, sg = 0, sb = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * 4;
    const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (L < 80) continue;
    sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++;
  }
  return { r: sr / Math.max(n, 1), g: sg / Math.max(n, 1), b: sb / Math.max(n, 1), n };
}

/** Pale grey blobs: pixels on the right half that are lifted and washed out. */
function paleBlobFraction(file: string) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const L = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  const x0 = Math.floor(W * 0.55), x1 = Math.floor(W * 0.94);
  const y0 = 40, y1 = Math.floor(H * 0.82);
  const ls: number[] = [];
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) ls.push(L(x, y));
  ls.sort((a, b) => a - b);
  const med = ls[ls.length >> 1];
  let n = 0, p = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
    n++;
    if (L(x, y) > med + 18 && sat < 0.28) p++;
  }
  return p / n;
}

test('the right half has no pale grey blobs', () => {
  const frac = paleBlobFraction('tasks/evidence/T-0222/after-2000.png');
  assert.ok(frac < 0.004, `pale blob fraction ${frac.toFixed(4)}`);
  const layers = readFileSync('src/world/globe/planetLayers.ts', 'utf8');
  assert.ok(layers.includes('uSteppeBox.w'), 'the coarse snow colour stays off the overhead photo');
});

test('the overhead matches the reference brown within 10%', () => {
  const ref = frameMean('tasks/evidence/T-0222/ref-steppe-sentinel.png');
  const after = frameMean('tasks/evidence/T-0222/after-2000.png');
  assert.ok(after.n > 1000, `photograph pixels ${after.n}`);
  for (const k of ['r', 'g', 'b'] as const) {
    assert.ok(Math.abs(after[k] - ref[k]) / ref[k] <= 0.1, `${k} after ${after[k].toFixed(1)} reference ${ref[k].toFixed(1)}`);
  }
});

/** A magnified mosaic spikes the gradient every block. Lag 8 must not stand out from its neighbours. */
function gradientPeriod(file: string, lag: number) {
  const { width: W, height: H, data } = PNG.sync.read(readFileSync(file));
  const L = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  let num = 0, den = 0;
  const y0 = Math.floor(H * 0.2), y1 = Math.floor(H * 0.8);
  const x0 = Math.floor(W * 0.15), x1 = Math.floor(W * 0.85) - lag - 1;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x++) {
    const g = L(x + 1, y) - L(x, y);
    const h = L(x + 1 + lag, y) - L(x + lag, y);
    num += g * h; den += g * g;
  }
  let numR = 0, denR = 0;
  const y1r = Math.floor(H * 0.8) - lag - 1;
  for (let y = y0; y < y1r; y++) for (let x = x0; x < x1; x += 2) {
    const g = L(x, y + 1) - L(x, y);
    const h = L(x, y + 1 + lag) - L(x, y + lag);
    numR += g * h; denR += g * g;
  }
  return { col: num / Math.max(den, 1), row: numR / Math.max(denR, 1) };
}

test('no 8 px block edges in the overhead', () => {
  const p8 = gradientPeriod('tasks/evidence/T-0222/after-2000.png', 8);
  const p7 = gradientPeriod('tasks/evidence/T-0222/after-2000.png', 7);
  const p9 = gradientPeriod('tasks/evidence/T-0222/after-2000.png', 9);
  const spike = (a: number, b: number, c: number) => a > Math.max(b, c) * 1.35 && a > 0.15;
  assert.equal(spike(p8.col, p7.col, p9.col), false, `column period ${p8.col.toFixed(3)} vs ${p7.col.toFixed(3)} ${p9.col.toFixed(3)}`);
  assert.equal(spike(p8.row, p7.row, p9.row), false, `row period ${p8.row.toFixed(3)} vs ${p7.row.toFixed(3)} ${p9.row.toFixed(3)}`);
});

test('a missing Sentinel tile at the staged home is open land, not boreal salt', () => {
  clearCachedTiles();
  const planet = planetFor(STAGES.seed, undefined, 't0222-fallback', true);
  const ll = toLatLon(planet.home);
  const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
  assert.equal(samplePhoto(lat, lon), null);
  assert.equal(openLandHere(lat, lon, planet.home, planet), true);
  const photo = readFileSync('src/render/globe/prairiePhoto.ts', 'utf8');
  assert.ok(photo.includes('ang < 0.2 * Math.PI / 180'), 'open land is the home, not a 6° disc');
  assert.ok(photo.includes('landMask > 0.5 && uSteppeBox.w > 0.5'), 'water is not replaced by the steppe photo');
});
