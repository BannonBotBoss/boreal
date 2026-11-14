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
    // 62 N, 90 W is Hudson Bay (zoom-0 bathymetry -151 m). Sea level is below that latitude's 331 m tree line.
    // 400 m is above it, and still below the home latitude's 1345 m line, so the moved frame is what changed the answer.
    assert.equal(plantsGrowAt(0.5), true, 'Hudson Bay stands at sea level');
    assert.equal(plantsGrowAt(400), false, '62 N tree line is 331 m');
    assert.notEqual(heightAt(0, 0), homeH);
  } finally {
    clearLanding();
  }
  assert.equal(SITE.remote, false);
  assert.equal(plantsGrowAt(0.5), true);
  assert.equal(heightAt(0, 0), homeH);
});

test('stored models are the manifest, and a species with no file keeps a body size', () => {
  assert.equal(bodyMetres('Gray Wolf'), 0.74);
  assert.equal(bodyMetres('White-tailed Deer'), 1);
  assert.equal(bodyMetres('Snowshoe Hare'), 0.22);
  assert.equal(bodyMetres('not an animal'), null);
  const manifest = JSON.parse(readFileSync('public/models/animals/manifest.json', 'utf8')) as Record<string, { full?: string; as?: string } | string>;
  const wolf = manifest['Gray Wolf'];
  const deer = manifest['White-tailed Deer'];
  const hare = manifest['Snowshoe Hare'];
  assert.equal(typeof wolf === 'object' && wolf.full, 'gray-wolf.glb');
  assert.equal(typeof deer === 'object' && deer.full, 'white-tailed-deer.glb');
  assert.equal(typeof hare === 'object' && hare.full, 'snowshoe-hare.glb');
  assert.equal(manifest['Canada Lynx'], undefined);
});

test('#192 T-0127: the landing cover class thins near trees (desert keeps almost none, boreal keeps the stand)', async () => {
  const { coverTreeShare } = await import('../src/world/globe/coverKind');
  const { generateChunk } = await import('../src/core/world');
  assert.equal(coverTreeShare('boreal'), 1);
  assert.equal(coverTreeShare('tropical'), 1);
  for (const k of ['water', 'ice', 'tundra', 'rock'] as const) assert.equal(coverTreeShare(k), 0);
  assert.ok(coverTreeShare('desert') < coverTreeShare('prairie') && coverTreeShare('prairie') < coverTreeShare('wetland') && coverTreeShare('wetland') < 1);
  // Desert landing (Libyan desert, T-0127 site): the chunk around the spawn draws no trees or logs.
  const desert = fromLatLon(27.4 * Math.PI / 180, 27.7 * Math.PI / 180);
  assert.ok(engageLanding(desert, 0));
  try {
    const trees = (s: number) => { SITE.treeShare = s; let n = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) n += generateChunk(a, b).filter(e => e.kind === 'spruce' || e.kind === 'log').length; return n; };
    const all = trees(1), none = trees(0), some = trees(.5);
    assert.equal(none, 0);
    assert.ok(some <= all, `${some} vs ${all}`);
    // Thinning never moves the rocks or animals that stay (own random stream).
    SITE.treeShare = 1; const keep = generateChunk(0, 0).filter(e => e.kind !== 'spruce' && e.kind !== 'log').map(e => e.key);
    SITE.treeShare = 0; const kept = generateChunk(0, 0).filter(e => e.kind !== 'spruce' && e.kind !== 'log').map(e => e.key);
    assert.deepEqual(kept, keep);
  } finally { clearLanding(); }
  assert.equal(SITE.treeShare, 1);
});
