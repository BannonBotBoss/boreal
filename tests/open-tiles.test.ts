/** Open elevation tiles and the chunk-square fade (T-0110). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blendDem, blendPhoto, globeMatch, photoCoverage, resetOpenTiles, sampleDem, samplePhoto, slippy, srgbByteToLinear,
  storePhoto, storeTerrarium, terrariumMetres, tileMetres, tileRing,
} from '../src/world/globe/openTiles';

test('terrarium height is (R*256 + G + B/256) - 32768', () => {
  assert.equal(terrariumMetres(128, 0, 0), 0);
  assert.ok(Math.abs(terrariumMetres(131, 232, 0) - 1000) < 1e-6);
  assert.ok(terrariumMetres(1, 0, 0) < 0);
});

test('a stored tile is sampled in metres, and a hole falls back to null', () => {
  resetOpenTiles();
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) {
    rgba[i * 4] = 131; rgba[i * 4 + 1] = 232; rgba[i * 4 + 2] = 0; rgba[i * 4 + 3] = 255;
  }
  // Slippy z=8 tile that contains 27.99 N, 86.93 E (Everest's tile neighbourhood is not required:
  // store the tile the sampler will ask for).
  const z = 8;
  const n = 2 ** z;
  const lon = 86.925, lat = 27.988;
  const x = Math.floor((lon + 180) / 360 * n);
  const latR = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  storeTerrarium(z, x, y, { w: 256, h: 256, rgba });
  const h = sampleDem(lat, lon);
  assert.ok(h != null && Math.abs(h - 1000) < 1, `height ${h}`);
  assert.equal(sampleDem(0, 0), null);
  assert.equal(samplePhoto(lat, lon), null);
});

test('DEM replaces the planet away from the camera and leaves water alone', () => {
  assert.equal(blendDem(10, 800, 0, false), 10);
  assert.ok(Math.abs(blendDem(10, 800, 5000, false) - 800) < 1e-6);
  assert.equal(blendDem(2, -40, 5000, true), 2);
});

test('a photograph is linear and the close grain is stronger than the far pixel', () => {
  resetOpenTiles();
  assert.ok(srgbByteToLinear(255) > 0.99);
  assert.ok(srgbByteToLinear(0) === 0);
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) { rgba[i * 4] = 40; rgba[i * 4 + 1] = 90; rgba[i * 4 + 2] = 30; rgba[i * 4 + 3] = 255; }
  const z = 8, lat = 45, lon = 10;
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latR = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  storePhoto(z, x, y, { w: 256, h: 256, rgba });
  const pic = samplePhoto(lat, lon);
  assert.ok(pic);
  assert.ok(pic[1] > pic[0] && pic[1] > pic[2]);
  const near = blendPhoto(pic, 0, 0.7);
  const far = blendPhoto(pic, 2000, 0.7);
  assert.ok(near[1] < pic[1]);
  assert.ok(Math.abs(far[1] - pic[1]) < 1e-6);
});

test('a missing photo lifts the globe albedo instead of leaving a black vertex', () => {
  const spruce: [number, number, number] = [0.028, 0.045, 0.022];
  const lifted = globeMatch(spruce);
  assert.ok(lifted[1] > spruce[1] * 4);
  assert.ok(lifted.every(v => v <= 1));
  assert.equal(tileRing('photo', 8), 2);
  assert.equal(tileRing('photo', 12), 2);
});

test('zoom 8 covers a point 40 km out, and a coarse tile fills a missing fine tile', () => {
  const lat = 49.77, lon = 65.54;
  const east = lon + 40 / (111.32 * Math.cos(lat * Math.PI / 180));
  const home = slippy(lat, lon, 8);
  const far = slippy(lat, east, 8);
  const ring = tileRing('photo', 8, lat);
  assert.ok(Math.abs(Math.floor(far.x) - Math.floor(home.x)) <= ring);
  assert.ok(Math.abs(Math.floor(far.y) - Math.floor(home.y)) <= ring);
  assert.ok(tileMetres(8, lat) > 50_000);
  resetOpenTiles();
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) { rgba[i * 4] = 80; rgba[i * 4 + 1] = 120; rgba[i * 4 + 2] = 40; rgba[i * 4 + 3] = 255; }
  storePhoto(8, Math.floor(home.x), Math.floor(home.y), { w: 256, h: 256, rgba });
  const pic = samplePhoto(lat, lon);
  assert.ok(pic && pic[1] > 0.1, 'the coarse mosaic colours a point the fine zoom has not fetched');
  assert.ok(photoCoverage(lat, lon) > 0 && photoCoverage(lat, lon) < 1);
});
