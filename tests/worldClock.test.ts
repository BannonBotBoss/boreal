import test from 'node:test'; import assert from 'node:assert/strict';
import { CLOCK, loadClock, offlineSec, saveClock, worldSec, pause, resume, localSec, release, offset } from '../src/core/worldClock';
test('offline gap: forward only, capped', () => {
  assert.equal(offlineSec(1000, 61000), 60); assert.equal(offlineSec(61000, 1000), 0, 'clock set back');
  assert.equal(offlineSec(0, 1e13), CLOCK.maxOfflineSec, 'clock set far ahead'); assert.equal(offlineSec(NaN, 5), 0);
});
test('clock persists, keeps ticking on perf time and survives a reload', () => {
  loadClock(null, 0, 0); assert.equal(worldSec(0), 0); assert.equal(worldSec(5000), 5);
  const raw = saveClock(10_000, 5000); const r = loadClock(raw, 70_000, 100); // 60 s offline
  assert.equal(r.offlineSec, 60); assert.equal(worldSec(100), 65); assert.equal(worldSec(1100), 66);
  assert.equal(loadClock(raw, 0, 0).offlineSec, 0, 'backwards wall clock credits nothing');
});
test('pause snapshots in-radius objects; no catch-up on resume; others follow the world clock', () => {
  loadClock(null, 0, 0);
  pause(['player', 'deer:1'], 10_000);                       // paused at world 10 s
  assert.equal(localSec('player', 70_000), 10, 'frozen while paused'); assert.equal(localSec('hare:far', 70_000), 70, 'out of radius keeps ticking');
  assert.equal(resume(70_000), 60); assert.equal(offset('player'), 60);
  assert.equal(localSec('player', 71_000), 11, 'continues from the snapshot'); assert.equal(worldSec(71_000), 71);
  release('deer:1'); assert.equal(localSec('deer:1', 71_000), 71);
});
