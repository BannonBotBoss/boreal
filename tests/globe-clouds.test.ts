/**
 * T-0221. The straight coasts are not in the planet field. This checks the
 * zoom-0 DEM the globe samples: a real map has no meridian that is a coastline
 * for most of its length. The rendered disc is judged by the frames, not by
 * matching Apollo's mean colour (that check passed a poster).
 *
 * Clouds: NASA Visible Earth, Blue Marble clouds, cloud_combined_2048.jpg,
 * https://visibleearth.nasa.gov/images/57747/blue-marble-clouds
 * https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/cloud_combined_2048.jpg
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { coarseMetresLinear } from '../src/world/globe/coarseRelief';

test('the planet land mask is a world map, not coasts cut along meridians', () => {
  const W = 360, H = 180;
  const land: boolean[] = [];
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / H * 180;
    for (let i = 0; i < W; i++) {
      const lon = -180 + (i + 0.5) / W * 360;
      land.push(coarseMetresLinear(lat, lon) >= 0);
    }
  }
  let meridianCuts = 0;
  for (let i = 1; i < W; i++) {
    let flips = 0;
    for (let j = 0; j < H; j++) if (land[j * W + i] !== land[j * W + i - 1]) flips++;
    if (flips > H * 0.35) meridianCuts++;
  }
  assert.equal(meridianCuts, 0, `${meridianCuts} longitudes are a coastline for most of their length`);
  const africa = coarseMetresLinear(10, 20) >= 0;
  const atlantic = coarseMetresLinear(0, -30) < 0;
  assert.ok(africa && atlantic, 'Africa is land and the central Atlantic is ocean');
  const mask = PNG.sync.read(readFileSync('tasks/evidence/T-0221/land-mask-dem.png'));
  assert.ok(mask.width >= 360 && mask.height >= 180, 'the lat/lon land mask is saved with the evidence');
});
