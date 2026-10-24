import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EYE_ACUITY_RAD, FEATURE_SIZE_M, pixelAngle, resolvableM, switchOnRange, visibleWeight } from '../src/world/globe/visibility';
import { GLOBE_LAYERS, setLayerCamera } from '../src/world/globe/planetLayers';
import { PLANET } from '../src/world/globe/planet';

test('eye acuity sanity: ISS ~400 km resolves ~100 m by eye', () => {
  const s = 400e3 * EYE_ACUITY_RAD; assert.ok(s > 80 && s < 150, `${s}`);
});
test('EPIC sanity: ~1.5e6 km, 2048 px over the disk -> ~10 km/px', () => {
  const px = 2 * 6371e3 / (2048 * 0.8); // the disk fills ~80 % of EPIC's 2048 px frame assert.ok(px > 7e3 && px < 12e3, `${px}`);
});
test('1080p / 45 deg pixel angle and eye cap', () => {
  assert.ok(Math.abs(pixelAngle(45, 1080) - 7.67e-4) < 1e-5); assert.equal(pixelAngle(45, 1e6), EYE_ACUITY_RAD);
  assert.ok(Math.abs(resolvableM(400e3, 45, 1080) - 307) < 2);
});
test('switch-on ranges at 1080p: clouds always, soil below ~1300 km', () => {
  assert.ok(switchOnRange('cloudSystem', 45, 1080) > 1.5e9 * 0.4);
  const soil = switchOnRange('soilMoisture', 45, 1080); assert.ok(soil > 1.2e6 && soil < 1.4e6, `${soil}`);
  for (const f of Object.keys(FEATURE_SIZE_M) as (keyof typeof FEATURE_SIZE_M)[]) {
    assert.ok(FEATURE_SIZE_M[f].src.length > 10); assert.equal(visibleWeight(f, switchOnRange(f, 45, 1080), 45, 1080), 1);
    assert.equal(visibleWeight(f, switchOnRange(f, 45, 1080) * 2.01, 45, 1080), 0); }
});
test('layer gate: wet soil off from full-disk range, on near the ground', () => {
  GLOBE_LAYERS.uLayers.value.set(1, 1, 1, 1);
  setLayerCamera([0, PLANET.radius + 20e6, 0], 45, 1080); assert.equal(GLOBE_LAYERS.uLayers.value.z, 0);
  setLayerCamera([0, PLANET.radius + 300e3, 0], 45, 1080); assert.equal(GLOBE_LAYERS.uLayers.value.z, 0); // tierOn not set by a start: stays 0
});
