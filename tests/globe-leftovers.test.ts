/**
 * Orbit leftovers on the cover map (T-0256).
 *
 * Land colour is the Blue Marble Next Generation image itself
 * (Stöckli et al. 2005, August 2004), not a class-constant paint.
 * The twilight gate and the clear-sky ocean live in src/render.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setMarble, buildOrbitCover, coverPixel } from '../src/render/globe/orbitCover';
import { TWILIGHT } from '../src/render/globe/orbitLight';
import { loadOrbitVegetation } from '../src/render/globe/orbitVeg';
import { antarcticClampLat, coarseMetresLinear, coarseReliefOn } from '../src/world/globe/coarseRelief';
import { ORBIT_FRAG } from '../src/world/globe/orbitAlbedo';

await loadOrbitVegetation(readFileSync('public/wasm/boreal_sim.wasm'));
setMarble(execFileSync('ffmpeg', ['-v', 'error', '-i', 'public/globe/blue-marble-200408.jpg', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 8_000_000 }), 1024, 512);
const cover = buildOrbitCover(512, 256);

function row(lat: number) {
  const n = 256;
  const land: boolean[] = [];
  for (let i = 0; i < n; i++) land.push(coarseMetresLinear(lat, -180 + (i + 0.5) / n * 360) >= 0);
  let flips = 0;
  for (let i = 1; i < n; i++) if (land[i] !== land[i - 1]) flips++;
  return { flips, land: land.filter(Boolean).length, key: land.map(v => (v ? '1' : '0')).join('') };
}

test('the Antarctic cap is one ice sheet, and it waits until the sheet is on', () => {
  const clamp = antarcticClampLat();
  assert.ok(clamp < -84 && clamp > -86, `clamp latitude ${clamp}`);
  coarseReliefOn(false);
  const off = coarseMetresLinear(-89, 0);
  coarseReliefOn(true);
  const on = coarseMetresLinear(-89, 0);
  assert.notEqual(off, on, 'southCap ran while the sheet was off');
  for (const lat of [clamp - 0.2, -86, -88, -89.5]) {
    const r = row(lat);
    assert.equal(r.flips, 0, `${lat} still has ${r.flips} straight coasts`);
    assert.equal(r.land, 256, `${lat} is not all land`);
  }
  const a = row(-78), b = row(-82);
  assert.notEqual(a.key, b.key, 'the real Antarctic coast is frozen too');
  assert.ok(a.flips > 8 && b.flips > 8, `coast flips ${a.flips} and ${b.flips}`);
});

test('orbit land is the Blue Marble image, not three flat class bands', () => {
  const planet = readFileSync('src/world/globe/planet.ts', 'utf8');
  assert.equal(planet.includes('zonalMoisture'), false);
  const sahara = coverPixel(cover, 24, 8);
  const congo = coverPixel(cover, 1, 23);
  const tibet = coverPixel(cover, 32, 88);
  const bangkok = coverPixel(cover, 14, 101);
  const caspian = coverPixel(cover, 42, 51);
  const steppe = coverPixel(cover, 48, 66);
  assert.ok(sahara.r > sahara.g + 10 && sahara.a > 200, `Sahara ${JSON.stringify(sahara)}`);
  assert.ok(congo.g > congo.r && congo.a > 200, `Congo ${JSON.stringify(congo)}`);
  assert.ok(bangkok.g > bangkok.r && bangkok.a > 200, `Bangkok ${JSON.stringify(bangkok)}`);
  assert.ok(tibet.r < 200 && tibet.g < 180, `Tibet is a white pancake ${JSON.stringify(tibet)}`);
  assert.ok(caspian.a > 200 && Math.max(caspian.r, caspian.g, caspian.b) < 40, `Caspian ${JSON.stringify(caspian)}`);
  assert.ok(steppe.a > 200 && steppe.b <= steppe.g, `steppe ${JSON.stringify(steppe)}`);
  const { rgba, width, height } = cover;
  const cx = Math.round(((8 + 180) / 360) * width);
  const cy = Math.round(((24 + 90) / 180) * height);
  let s = 0, s2 = 0, c = 0;
  for (let y = cy - 12; y < cy + 12; y++) for (let x = cx - 12; x < cx + 12; x++) {
    const i = (y * width + x) * 4;
    const L = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    s += L; s2 += L * L; c++;
  }
  const mean = s / c;
  const std = Math.sqrt(Math.max(0, s2 / c - mean * mean));
  assert.ok(std > 8, `Sahara window std ${std.toFixed(2)} is a flat band`);
});

test('the terminator is the twilight gate and orbit water is not a mirror', () => {
  const light = readFileSync('src/render/globe/orbitLight.ts', 'utf8');
  const atmos = readFileSync('src/world/globe/atmosphere.ts', 'utf8');
  const tile = readFileSync('src/world/globe/tile.ts', 'utf8');
  assert.equal(TWILIGHT.innerDeg, 6);
  assert.equal(TWILIGHT.outerDeg, 8);
  assert.ok(light.includes('mix(vec3(1.0), sunT, band)'));
  assert.ok(light.includes('TWILIGHT.innerDeg') && light.includes('TWILIGHT.outerDeg'));
  assert.equal(light.includes('TERMINATOR.gain'), false);
  assert.ok(atmos.includes('orbitAtmosphere'), 'the ceiling file applies the render patch');
  assert.equal(tile.includes('vec3(0.03, 0.08, 0.20)'), false, 'the post-tonemap navy paint is back');
  assert.ok(tile.includes('orbitWater') && tile.includes('float cloudDeck = 0.0'));
  assert.ok(light.includes('glintGate') && light.includes('(1.0 - cloudDeck)'));
  assert.ok(light.includes('uOceanRough, oceanHere'), 'a clouded ocean keeps the ocean roughness');
  assert.ok(light.includes('1.0 - clamp(uOrbit, 0.0, 1.0)'), 'the bright sky reflection is off at orbit');
  assert.match(ORBIT_FRAG, /landMask = mix\(landMask, alb\.a, ow\)/);
  assert.doesNotMatch(ORBIT_FRAG, /ouvW/);
});
