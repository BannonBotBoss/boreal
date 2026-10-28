/** T-0108 / issue #156. The double-click anchors the forest on the click, stops in a glide, and fades animals by distance. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIMAL_LADDER, arrestGlide, descentCrossesClouds, descentFloorY, detailShares, playerDiving } from '../src/render/animalLadder';
import { bodyMetres } from '../src/render/animalModels';
import { clearLanding, engageLanding } from '../src/world/globe/landingSite';
import { SITE } from '../src/core/sitePhase';
import { heightAt } from '../src/core/world';
import { plantsGrowAt } from '../src/core/altitudeZones';
import { FALL_END_M } from '../src/world/globe/flight';
import { CLOUDS } from '../src/world/globe/atmosphere';
import { LOCAL_CLOUDS } from '../src/world/globe/localClouds';
import { fromLatLon } from '../src/world/globe/planet';

test('detail shares sum to 1 and fade across the three steps', () => {
  for (let d = 0; d <= 400; d += 2) {
    const s = detailShares(d);
    assert.ok(Math.abs(s.full + s.low + s.speck - 1) < 1e-9, `sum at ${d}`);
    assert.ok(s.full >= 0 && s.low >= 0 && s.speck >= 0);
  }
  assert.ok(detailShares(0).full > 0.99);
  assert.ok(detailShares(ANIMAL_LADDER.speckM + 20).speck > 0.99);
  const mid = (ANIMAL_LADDER.fullM + ANIMAL_LADDER.lowM) / 2;
  const band = detailShares(mid);
  assert.ok(band.full > 0.05 && band.low > 0.05 && band.speck < 0.05);
});

test('a double-click holds a few hundred metres up unless the player flies down', () => {
  const ground = 2, floor = 2.3;
  assert.equal(descentFloorY(ground, floor, false), ground + ANIMAL_LADDER.mapHoldM);
  assert.equal(descentFloorY(ground, floor, true), floor);
  assert.equal(playerDiving(0, 0, -0.6), false);
  assert.equal(playerDiving(-0.2, 0, -0.6), true);
  assert.equal(playerDiving(0, 0.4, -0.6), true);
  const held = arrestGlide({ x: 0, y: -80, z: 0 }, 0, true, false);
  assert.equal(held.y, 0);
  assert.ok(Math.abs(held.z + ANIMAL_LADDER.glideMs) < 1e-9);
  const again = arrestGlide(held, 0, true, false);
  assert.equal(again.z, held.z);
});

test('the drop crosses the cloud decks the sky already draws', () => {
  assert.ok(descentCrossesClouds(CLOUDS.heightKm * 1000, LOCAL_CLOUDS.topM, FALL_END_M, ANIMAL_LADDER.mapHoldM));
  const page = readFileSync('src/world/globe/inpage.ts', 'utf8');
  const view = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.match(page, /stepCarriedFly\(/);
  assert.match(page, /descentFloorY\(/);
  assert.match(view, /dropAt\(/);
  assert.match(readFileSync('src/world/globe/flight.ts', 'utf8'), /through the clouds/);
  assert.match(readFileSync('src/world/globe/flight.ts', 'utf8'), /10,000 ft/);
});

test('a click off the home square moves the frame; home does not', () => {
  const homeH = heightAt(0, 0);
  assert.equal(engageLanding(fromLatLon(49.77 * Math.PI / 180, -94 * Math.PI / 180), 1), false);
  assert.equal(SITE.remote, false);
  assert.equal(heightAt(0, 0), homeH);
  try {
    const north = fromLatLon(62 * Math.PI / 180, -90 * Math.PI / 180);
    assert.equal(engageLanding(north, 0), true);
    assert.ok(SITE.remote);
    assert.ok(Math.abs(SITE.latDeg - 62) < 0.05, `lat ${SITE.latDeg}`);
    assert.equal(plantsGrowAt(0.5), false, '62 N is past the tree line at this height');
    assert.notEqual(heightAt(0, 0), homeH);
  } finally {
    clearLanding();
  }
  assert.equal(SITE.remote, false);
  assert.equal(plantsGrowAt(0.5), true);
  assert.equal(heightAt(0, 0), homeH);
});

test('the wolf proof is the only stored model, and other species keep a body size', () => {
  assert.equal(bodyMetres('Gray Wolf'), 0.74);
  assert.equal(bodyMetres('White-tailed Deer'), 1);
  assert.equal(bodyMetres('Snowshoe Hare'), 0.22);
  assert.equal(bodyMetres('not an animal'), null);
  const manifest = JSON.parse(readFileSync('public/models/animals/manifest.json', 'utf8')) as Record<string, { full?: string; low?: string }>;
  assert.equal(manifest['Gray Wolf'].full, 'wolf.glb');
  assert.ok(manifest['Gray Wolf'].low);
  assert.equal(manifest['White-tailed Deer'], undefined);
});
