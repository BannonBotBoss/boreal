import test from 'node:test';
import assert from 'node:assert/strict';
import { treeLineM, iceLineM, zoneAt, treeIceLinesM, plantsGrowAt, gameAltitudeM, siteMaritimeWeight, treeLineAtM, iceLineAtM, siteCoastM } from '../src/core/altitudeZones';
import { surfaceColour, vegetationWeight, fromLatLon, type Surface } from '../src/world/globe/planet';
import { setSite, clearSite } from '../src/core/sitePhase';
import { coverKind } from '../src/world/globe/coverKind';
import { LEVEL } from '../src/core/tuning';

test('T-0072: tree and ice lines from latitude temperature + lapse rate', () => {
  assert.ok(Math.abs(treeLineM(0) - 3470) < 150, `equator tree line ${treeLineM(0)}`); // observed tropical tree line ~3500-4000 m
  assert.ok(Math.abs(iceLineM(0) - 4460) < 200, `equator ice line ${iceLineM(0)}`);      // tropical snow line ~4500-5000 m
  assert.ok(treeLineM(49.77) < treeLineM(0) && iceLineM(49.77) > treeLineM(49.77));
  for (let l = 0; l <= 90; l += 10) assert.ok(iceLineM(l) >= treeLineM(l));
});
test('T-0072: zones and the game hook', () => {
  assert.equal(zoneAt(200, 49.77), 'forest'); assert.equal(zoneAt(1200, 49.77), 'forest'); assert.equal(zoneAt(1800, 49.77), 'rock'); assert.equal(zoneAt(3000, 49.77), 'ice');
  assert.ok(plantsGrowAt(0)); // home terrain (~370 m a.s.l.) is forest
  assert.ok(!plantsGrowAt(1000)); assert.ok(gameAltitudeM(0) > 300);
});
test('T-0072: globe colour turns to rock then ice with height', () => {
  const s: any = { h: 300, kind: '', level: 0, hill: 0, mottle: .5, home: 0, soil: null, soilW: [0, 0, 0, -1], soilB: false, wet: -1 };
  const d: [number, number, number] = [Math.cos(.87), Math.sin(.87), 0];
  const low = surfaceColour({ ...s }, d), high = surfaceColour({ ...s, h: 5000 }, d);
  assert.ok(high[0] > low[0] * 4, 'ice is bright');
});

test('zoneAt inland continentality: 64.5N @ 300 m / 156 km coast is forest (not zonal rock)', () => {
  // Zonal tree line ~146 m → rock; continental tree line ~814 m → forest. coverKind already uses liveCoastM.
  assert.equal(zoneAt(300, 64.5), 'rock');
  assert.equal(zoneAt(300, 64.5, 156_000), 'forest');
  assert.ok(coverKind(64.5, 300, 0.5, false, 156_000) !== 'rock');
  const w = siteMaritimeWeight(156_000)!;
  assert.ok(treeLineAtM(64.5, w) > 300 && iceLineAtM(64.5, w) > 300);
});

test('zoneAt cool coast: 60N @ 50 m / 100 m coast matches coverKind ice', () => {
  assert.equal(coverKind(60, 50, 0.5, false, 100), 'ice');
  assert.equal(zoneAt(50, 60, 100), 'ice');
  // Unknown coast keeps the prior zonal forest (tree line ~485 m).
  assert.equal(zoneAt(50, 60), 'forest');
  assert.equal(zoneAt(50, 60, Number.NaN), 'forest');
});

test('plantsGrowAt / siteCoastM follow landed coast (game plant gate)', () => {
  // Game height 0 at datum 300 m a.s.l. → alt = 300 when h = LEVEL.waterSurface.
  setSite({ latDeg: 64.5, lonDeg: -125, datumM: 300, salt: 1, dir: [1, 0, 0], east: [0, 0, 1], north: [0, 1, 0], coastM: 156_000 });
  try {
    assert.equal(siteCoastM(), 156_000);
    assert.ok(plantsGrowAt(LEVEL.waterSurface), 'inland continental landing grows plants at datum');
  } finally { clearSite(); }
  assert.ok(Number.isNaN(siteCoastM()));
  // Same site without coast keeps zonal rock → no plants.
  setSite({ latDeg: 64.5, lonDeg: -125, datumM: 300, salt: 1, dir: [1, 0, 0], east: [0, 0, 1], north: [0, 1, 0] });
  try {
    assert.ok(Number.isNaN(siteCoastM()));
    assert.ok(!plantsGrowAt(LEVEL.waterSurface), 'zonal rock landing has no plants at datum');
  } finally { clearSite(); }
});

const inlandSurf = (h: number): Surface => ({
  h, water: -Infinity, level: 0, kind: '', home: 0, x: 0, z: 0, soil: '', wet: -1,
  soilW: [0, 0, 0, -1], soilB: false, mottle: 0.5, hill: 0,
});

test('vegetationWeight / surfaceColour follow continentality when coast is given', () => {
  // 64.5N @ 300 m: zonal tree line ~146 m → rock fade; continental (156 km coast) tree line ~814 m → forest.
  const d = fromLatLon(64.5 * Math.PI / 180, -125 * Math.PI / 180);
  const s = inlandSurf(300);
  const zonal = vegetationWeight(s, d);
  const continental = vegetationWeight(s, d, 156_000);
  // Lat 60–66 still blends toward tundra colour weight; continentality only lifts the tree-line fade.
  assert.ok(continental > zonal * 3, `continental veg ${continental} vs zonal ${zonal}`);
  assert.ok(continental > 0.1, `continental keeps some canopy weight ${continental}`);
  const cz = surfaceColour({ ...s }, d);
  const cc = surfaceColour({ ...s }, d, [0, 0, 0], 156_000);
  // Rock mix pulls RGB toward grey; forest stays greener (higher G share).
  const greenZ = cz[1] / (cz[0] + cz[1] + cz[2] + 1e-9);
  const greenC = cc[1] / (cc[0] + cc[1] + cc[2] + 1e-9);
  assert.ok(greenC > greenZ, `continental greener ${greenC} vs zonal ${greenZ}`);
});

test('zoneAt boundaries are exactly treeIceLinesM (one source for the lines)', () => {
  for (const [lat, coast] of [[49.77, undefined], [64.5, 156_000], [60, 100], [20, NaN]] as [number, number | undefined][]) {
    const { tree, ice } = treeIceLinesM(lat, coast);
    assert.equal(zoneAt(ice, lat, coast), 'ice');
    if (tree > 1 && ice - tree > 2) {
      assert.equal(zoneAt(tree - 1, lat, coast), 'forest');
      assert.notEqual(zoneAt(tree + 1, lat, coast), 'forest');
    }
  }
});
