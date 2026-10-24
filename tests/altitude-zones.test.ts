import test from 'node:test';
import assert from 'node:assert/strict';
import { treeLineM, iceLineM, zoneAt, plantsGrowAt, gameAltitudeM } from '../src/core/altitudeZones';
import { surfaceColour } from '../src/world/globe/planet';

test('T-0072: tree and ice lines from latitude temperature + lapse rate', () => {
  assert.ok(Math.abs(treeLineM(0) - 3470) < 150, `equator tree line ${treeLineM(0)}`); // observed tropical tree line ~3500-4000 m
  assert.ok(Math.abs(iceLineM(0) - 4460) < 200, `equator ice line ${iceLineM(0)}`);      // tropical snow line ~4500-5000 m
  assert.ok(treeLineM(49.77) < treeLineM(0) && iceLineM(49.77) > treeLineM(49.77));
  for (let l = 0; l <= 90; l += 10) assert.ok(iceLineM(l) >= treeLineM(l));
});
test('T-0072: zones and the game hook', () => {
  assert.equal(zoneAt(200, 49.77), 'forest'); assert.equal(zoneAt(1200, 49.77), 'rock'); assert.equal(zoneAt(3000, 49.77), 'ice');
  assert.ok(plantsGrowAt(0)); // home terrain (~370 m a.s.l.) is forest
  assert.ok(!plantsGrowAt(1000)); assert.ok(gameAltitudeM(0) > 300);
});
test('T-0072: globe colour turns to rock then ice with height', () => {
  const s: any = { h: 300, kind: '', level: 0, hill: 0, mottle: .5, home: 0, soil: null, soilW: [0, 0, 0, -1], soilB: false, wet: -1 };
  const d: [number, number, number] = [Math.cos(.87), Math.sin(.87), 0];
  const low = surfaceColour({ ...s }, d), high = surfaceColour({ ...s, h: 5000 }, d);
  assert.ok(high[0] > low[0] * 4, 'ice is bright');
});
