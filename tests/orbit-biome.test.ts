/**
 * Orbit land is the cover class, not one boreal green.
 *
 * Calibration: a flat green field is the known mismatch (the 2026-11-18
 * orbit frame, tasks/evidence/T-0254/before-orbit-home.png, Sahara and Congo
 * the same olive). Apollo 17 AS17-148-22727 is the known match for the
 * geography: Sahara tan, Congo green, a thin coast, the Caspian not a grey
 * ocean wedge.
 * https://images.nasa.gov/details/as17-148-22727
 *
 * Vegetation thresholds: data/earth/cover-density.json (desert below 0.28,
 * prairie below 0.62). Hadley belts: Holton & Hakim, the same latitudes as
 * ORBIT_ZONAL in cloudCover.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOrbitCover, coverPixel } from '../src/render/globe/orbitCover';
import { loadOrbitVegetation, orbitVegetation } from '../src/render/globe/orbitVeg';
import { coarseMetresLinear } from '../src/world/globe/coarseRelief';

await loadOrbitVegetation(readFileSync('public/wasm/boreal_sim.wasm'));
const cover = buildOrbitCover(512, 256);

test('Hadley moisture: the Sahara is dry and the Congo is not', () => {
  const sahara = orbitVegetation(24, 1800);
  const congo = orbitVegetation(1, 800);
  const florida = orbitVegetation(27, 40);
  assert.ok(sahara < 0.28, `Sahara vegetation ${sahara.toFixed(3)} should be desert`);
  assert.ok(congo > 0.62, `Congo vegetation ${congo.toFixed(3)} should be forest`);
  assert.ok(florida > sahara + 0.15, `a subtropical coast stays wetter than the Sahara (${florida.toFixed(3)} vs ${sahara.toFixed(3)})`);
});

test('the cover map colours the Sahara tan, the Congo green, and Antarctica ice', () => {
  const sahara = coverPixel(cover, 24, 12);
  const congo = coverPixel(cover, 1, 20);
  const ice = coverPixel(cover, -88, 174);
  const pacific = coverPixel(cover, 0, -160);
  assert.ok(sahara.r > sahara.g * 1.25, `Sahara should be tan, got ${sahara.r},${sahara.g},${sahara.b}`);
  assert.ok(congo.g > congo.r * 1.4, `Congo should be green, got ${congo.r},${congo.g},${congo.b}`);
  assert.ok(sahara.r > congo.r + 10, 'desert is lighter and redder than rainforest');
  assert.ok(ice.r > 140 && ice.g > 140 && ice.b > 140, `Antarctica should be ice, got ${ice.r},${ice.g},${ice.b}`);
  assert.ok(pacific.a < 40, `central Pacific is ocean, alpha ${pacific.a}`);
  assert.ok(pacific.b > pacific.r, 'ocean is blue');
});

test('the Caspian is a lake, not the grey ocean smear', () => {
  assert.ok(coarseMetresLinear(42, 51) < 0, 'the Caspian surface is below sea level');
  const pix = coverPixel(cover, 42, 51);
  assert.ok(pix.a > 180, `enclosed basin stays land/lake, alpha ${pix.a}`);
  assert.ok(pix.b > pix.r, `lake colour, got ${pix.r},${pix.g},${pix.b}`);
});

test('the Antarctic coast is a soft edge, not a run of identical blocks', () => {
  const { rgba, width, height } = cover;
  const row = Math.floor(((-72 + 90) / 180) * height);
  let partial = 0;
  let hard = 0;
  let prev = 0;
  for (let x = 0; x < width; x++) {
    const a = rgba[(row * width + x) * 4 + 3];
    const bin = a < 30 ? 0 : a > 225 ? 2 : 1;
    if (bin === 1) partial++;
    if ((prev === 0 && bin === 2) || (prev === 2 && bin === 0)) hard++;
    prev = bin;
  }
  assert.ok(partial > 8, `the coast should carry intermediate alphas, partial ${partial}`);
  assert.equal(hard, 0, 'no one-pixel stair from ocean to land');
});

test('the orbit shader draws this map instead of the vertex green', () => {
  const frag = readFileSync('src/world/globe/orbitAlbedo.ts', 'utf8');
  const draw = readFileSync('src/render/globe/orbitDraw.ts', 'utf8');
  const view = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.ok(draw.includes('buildOrbitCover'), 'the bake is the cover map');
  assert.ok(draw.includes('texture2D(uOrbitTex'), 'the fragment samples it');
  assert.ok(frag.includes('uploadOrbitAlbedo'), 'the cloud load uploads the cover');
  assert.ok(view.includes('loadBlueMarbleClouds'), 'the globe starts that load');
});
