/**
 * D28. The drop at 8.487 N, 129.334 W stood on a seeded mountain (sampleSurface h = 5074.6 m,
 * kind land). The zoom-0 Mapzen terrarium pixel there is -4589 m (ETOPO1 via joerd). The HUD
 * then said ice. The sea surface is 0, and the landing stays on the aim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coarseMetres, coarseReliefOn } from '../src/world/globe/coarseRelief';
import { coverSampleLatLon } from '../src/world/globe/coverSample';
import { figureRadius } from '../src/world/globe/figure';
import { clearLanding, engageLanding } from '../src/world/globe/landingSite';
import { createPlanet, fromLatLon, planetFor, PLANET, vegetationWeight } from '../src/world/globe/planet';
import { surfaceRadius } from '../src/world/globe/radial';
import { WORLD_SEED } from '../src/core/world';
import { LEVEL } from '../src/core/tuning';
import { remoteGameHeight } from '../src/core/siteHeight';
import { SITE } from '../src/core/sitePhase';
import { landingContext } from '../src/render/landingCast';

const LAT = 8.487003131472033;
const LON = -129.334407962844;
const dir = () => fromLatLon(LAT * Math.PI / 180, LON * Math.PI / 180);

test('zoom-0 bathymetry at the drop is ocean, and the seeded relief there is a mountain', () => {
  assert.equal(coarseMetres(LAT, LON), -4589);
  coarseReliefOn(false);
  try {
    const seeded = createPlanet(1400).sampleSurface(dir());
    assert.ok(seeded.h > 5000, `seeded height ${seeded.h}`);
    assert.equal(seeded.kind, '');
    assert.ok(surfaceRadius(createPlanet(1400), dir()) - figureRadius(dir()) > 5000);
  } finally {
    coarseReliefOn(true);
  }
});

test('the landing surface is the sea, and the HUD agrees with the ocean mask', () => {
  const planet = planetFor(WORLD_SEED, undefined, '', true);
  const s = planet.sampleSurface(dir());
  assert.equal(s.kind, 'ocean');
  assert.equal(s.water, 0);
  assert.ok(s.h < -4000, `bathymetry ${s.h}`);
  const radius = surfaceRadius(planet, dir());
  assert.ok(Math.abs(radius - figureRadius(dir())) < 1, `sea surface is ${radius - figureRadius(dir())} m, not the mountain`);
  const cover = coverSampleLatLon(LAT, LON, dir(), planet);
  assert.equal(cover.water, true);
  assert.equal(cover.biome, 'water');
  assert.equal(cover.elevM, 0);
  assert.equal(cover.vegetation, 0);
  assert.equal(vegetationWeight(s, dir()), 0);
  // A clipped white sheet is snow albedo 0.8 (pbr.ts, Oke 1987) under the ice class. Water is not that.
  assert.notEqual(cover.biome, 'ice');
});

test('the drop stays on the aim: open ocean is the water surface, not a snap to invented land', () => {
  try {
    const moved = engageLanding(dir(), 0);
    assert.equal(moved, true);
    assert.ok(Math.abs(SITE.latDeg - LAT) < 0.01, `lat ${SITE.latDeg}`);
    assert.ok(Math.abs(SITE.lonDeg - LON) < 0.01, `lon ${SITE.lonDeg}`);
    assert.equal(SITE.datumM, 0);
    assert.equal(SITE.treeShare, 0);
    const y = remoteGameHeight(0, 0);
    assert.equal(y, LEVEL.waterSurface - 2);
    // 1.6 km of this pixel is still ocean, so the feet stay at the aim (landingShore: no dry point means open water).
    assert.equal(remoteGameHeight(400, 0)! < LEVEL.shore, true);
    const hud = landingContext(0, 0);
    assert.equal(hud.biome, 'water');
    assert.equal(hud.water, true);
    assert.equal(hud.elevM, 0);
    assert.equal(hud.vegetation, 0);
    assert.ok(Math.abs(hud.lat - LAT) < 0.02 && Math.abs(hud.lon - LON) < 0.02);
  } finally {
    clearLanding();
  }
});

test('real land outside the home lift stays land, and the home square is still the game terrain', () => {
  const p = createPlanet(1400);
  const everest = fromLatLon(27.99 * Math.PI / 180, 86.93 * Math.PI / 180);
  const land = p.sampleSurface(everest);
  assert.ok(land.h >= 0 && land.kind !== 'ocean', `Everest pixel ${land.h} ${land.kind}`);
  const home = p.sampleSurface(p.fromLocal(0, 0));
  assert.equal(home.home, 1);
  assert.ok(Math.abs(home.h - PLANET.home.elevation) < 50 || home.h > 0);
});
