/** Vegetated land from above is a stand mosaic, not one fill. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landMosaic, standField } from '../src/world/globe/landMosaic';

const spruce: [number, number, number] = [0.028, 0.045, 0.022];

test('the same place is stable, and stands a few hundred metres apart are not one colour', () => {
  const a = landMosaic(1000, 2000, spruce);
  assert.deepEqual(landMosaic(1000, 2000, spruce), a);
  const near = landMosaic(1002, 2001, spruce);
  assert.ok(Math.abs(near[1] - a[1]) < 0.01, 'two metres does not flip the stand');
  let minG = Infinity, maxG = 0, sumG = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const g = landMosaic(i * 180, (i * 97) % 4000, spruce)[1];
    minG = Math.min(minG, g); maxG = Math.max(maxG, g); sumG += g; n++;
  }
  assert.ok(maxG / minG > 1.25, `green ${minG.toFixed(3)}..${maxG.toFixed(3)} should show stands`);
  const mean = sumG / n;
  assert.ok(Math.abs(mean - spruce[1]) / spruce[1] < 0.2, `mean green ${mean} stays near the albedo`);
  assert.ok(standField(0, 0) >= 0 && standField(0, 0) <= 1);
});

test('the globe tiles and the skirt use the same stand waves', () => {
  const tile = readFileSync('src/world/globe/tile.ts', 'utf8');
  const skirt = readFileSync('src/render/horizonMesh.ts', 'utf8');
  for (const wave of ['40.0', '160.0', '640.0']) {
    assert.ok(tile.includes(wave), wave);
    assert.ok(skirt.includes(wave), wave);
  }
  assert.ok(!skirt.includes('1.4, 0.96'), 'the neon green gain is gone');
});
