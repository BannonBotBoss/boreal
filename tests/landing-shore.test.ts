/** #192 ten-site finding 3 (grokbot-3): a lake or sea landing got an empty census. The landing now censuses the
 *  nearest shore point inside the same 5 km square; open water still returns nothing. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestShore, SHORE_RINGS_M } from '../src/core/landingShore';

const M = 111_320;

test('a round 500 m lake returns the first ring outside it', () => {
  const lat = 47.9, lon = -104.9, cos = Math.cos(lat * Math.PI / 180);
  const s = nearestShore(lat, lon, (la, lo) => ({ lat: la, lon: lo, water: Math.hypot((la - lat) * M, (lo - lon) * M * cos) < 500 }));
  assert.ok(s);
  assert.ok(Math.abs(Math.hypot((s.lat - lat) * M, (s.lon - lon) * M * cos) - 600) < 1);
});

test('the search stays inside half the 5 km census square', () => {
  assert.ok(Math.max(...SHORE_RINGS_M) <= 2500);
});

test('open water returns null, so the census stays empty', () => {
  assert.equal(nearestShore(30, -150, (la, lo) => ({ lat: la, lon: lo, water: true })), null);
});

test('a dry first sample stops the search', () => {
  let calls = 0;
  nearestShore(50, -100, (la, lo) => { calls++; return { lat: la, lon: lo, water: false }; });
  assert.equal(calls, 1);
});
