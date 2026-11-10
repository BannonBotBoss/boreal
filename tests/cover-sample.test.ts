/**
 * D27: the HUD biome and the picture read one sample.
 * The spawn photograph is the measured Sentinel-2 cloudless pixel at 49.77 N, 65.54 E
 * (EOX, CC BY 4.0): linear RGB about 0.242, 0.138, 0.060, vegetation about 0.33.
 * The DEM there is about 216 m (Mapzen terrarium). The Kenora stand and the open-water
 * plane are a different world. This test fails while they still disagree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAGES } from '../src/core/stages/elevation';
import { LEVEL } from '../src/core/tuning';
import { generateChunk, heightAt, setPictureFit } from '../src/core/world';
import { installPictureGate } from '../src/render/pictureGate';
import { landingContext } from '../src/render/landingCast';
import { coverSampleAt, drawOpenWater } from '../src/world/globe/coverSample';
import { OPEN_TILES, clearCachedTiles, slippy, storePhoto, storeTerrarium, type RgbaTile } from '../src/world/globe/openTiles';

function srgbByte(linear: number) {
  const x = Math.min(1, Math.max(0, linear));
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, s * 255)));
}

function solid(r: number, g: number, b: number): RgbaTile {
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) {
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
  }
  return { w: 256, h: 256, rgba };
}

function paint(lat: number, lon: number, photo: RgbaTile, dem: RgbaTile) {
  const dLat = 120 / 111320;
  const dLon = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  for (const [a, o] of [[0, 0], [dLat, 0], [-dLat, 0], [0, dLon], [0, -dLon]] as const) {
    for (const z of OPEN_TILES.photoZoom) {
      const s = slippy(lat + a, lon + o, z);
      storePhoto(z, Math.floor(s.x), Math.floor(s.y), photo);
    }
    for (const z of OPEN_TILES.demZoom) {
      const s = slippy(lat + a, lon + o, z);
      storeTerrarium(z, Math.floor(s.x), Math.floor(s.y), dem);
    }
  }
}

/** 216 m in terrarium: (R * 256 + G + B / 256) - 32768. */
function dem216(): RgbaTile {
  return solid(128, 216, 0);
}

const STEPPE: [number, number, number] = [0.242, 0.138, 0.060];
const FOREST: [number, number, number] = [0.02, 0.08, 0.02];
const POINTS: [number, number][] = [[30, 0], [0, 0], [80, -40], [-60, 90]];

function spruceIn(range = 2) {
  let n = 0;
  const scales: number[] = [];
  for (let a = -range; a <= range; a++) for (let b = -range; b <= range; b++) {
    for (const e of generateChunk(a, b)) if (e.kind === 'spruce' || e.kind === 'log') { n++; scales.push(e.scale); }
  }
  return { n, scales };
}

test('the HUD and the picture name the same biome, vegetation and water', () => {
  const prev = STAGES.on;
  STAGES.on = true;
  clearCachedTiles();
  setPictureFit(null);
  try {
    const steppe = solid(srgbByte(STEPPE[0]), srgbByte(STEPPE[1]), srgbByte(STEPPE[2]));
    const dem = dem216();
    for (const [x, z] of POINTS) {
      const at = coverSampleAt(x, z);
      paint(at.lat, at.lon, steppe, dem);
    }
    installPictureGate();
    for (const [x, z] of POINTS) {
      const hud = landingContext(x, z);
      const drawn = coverSampleAt(x, z);
      assert.equal(drawn.biome, hud.biome, `${x},${z} biome`);
      assert.equal(drawn.water, hud.water, `${x},${z} water`);
      assert.ok(Math.abs(drawn.vegetation - hud.vegetation) < 1e-9, `${x},${z} vegetation`);
      assert.equal(hud.biome, 'prairie', `${x},${z} is the steppe sample, not a spruce stand`);
      assert.ok(hud.vegetation > 0.28 && hud.vegetation < 0.62, `vegetation ${hud.vegetation}`);
      assert.equal(hud.water, false);
      assert.equal(drawOpenWater(x, z), false);
      assert.ok(drawn.treeShare < 0.1);
      assert.ok(drawn.heightM < 2, `prairie clumps are ${drawn.heightM} m, not a spruce`);
      assert.ok(drawn.scaleMul < 0.2);
    }
    // The staged home is under the water plane here. The sample still says dry, so the teal plane stays off.
    assert.ok(heightAt(0, 0) < LEVEL.waterSurface, 'the Kenora grid is wet at the origin');
    assert.equal(drawOpenWater(0, 0), landingContext(0, 0).water);

    const thin = spruceIn();
    assert.ok(thin.n < 40, `prairie kept ${thin.n} stems in 25 chunks`);
    assert.ok(thin.scales.every(s => s < 0.25), `a kept stem is still spruce-tall: ${thin.scales.filter(s => s >= 0.25).slice(0, 4)}`);

    clearCachedTiles();
    const forest = solid(srgbByte(FOREST[0]), srgbByte(FOREST[1]), srgbByte(FOREST[2]));
    for (const [x, z] of POINTS) {
      const at = coverSampleAt(x, z);
      paint(at.lat, at.lon, forest, dem);
    }
    const closed = coverSampleAt(30, 0);
    assert.equal(closed.biome, 'boreal');
    assert.equal(closed.treeShare, 1);
    assert.equal(closed.scaleMul, 1);
    assert.equal(landingContext(30, 0).biome, 'boreal');
    const full = spruceIn();
    assert.ok(full.n > thin.n * 4, `boreal ${full.n} should dwarf prairie ${thin.n}`);
  } finally {
    clearCachedTiles();
    setPictureFit(null);
    STAGES.on = prev;
  }
});

test('the scene actually asks the sample before it draws water or a stand', () => {
  const scene = readFileSync(new URL('../src/render/buildScene.ts', import.meta.url), 'utf8');
  const horizon = readFileSync(new URL('../src/render/horizonCover.ts', import.meta.url), 'utf8');
  const far = readFileSync(new URL('../src/render/flora/fartrees.ts', import.meta.url), 'utf8');
  assert.match(scene, /drawOpenWater\(/);
  assert.match(scene, /installPictureGate\(/);
  assert.match(horizon, /coverSampleAt\(/);
  assert.match(far, /coverSampleAt\(/);
});
