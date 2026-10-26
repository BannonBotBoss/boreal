import test from 'node:test'; import assert from 'node:assert/strict';
import { CLOCK, clockRate, isPaused, loadClock, offlineSec, pauseClock, resumeClock, saveClock, setClockRate, timeCommand, worldSec } from '../src/core/worldClock';
test('offline gap: forward only, capped', () => {
  assert.equal(offlineSec(1000, 61000), 60); assert.equal(offlineSec(61000, 1000), 0, 'clock set back');
  assert.equal(offlineSec(0, 1e13), CLOCK.maxOfflineSec, 'clock set far ahead'); assert.equal(offlineSec(NaN, 5), 0);
});
test('clock persists across quits; offline credits only a forwards capped gap', () => {
  loadClock(null, 0, 0); assert.equal(worldSec(0), 0); assert.equal(worldSec(5000), 5);
  const raw = saveClock(10_000, 5000); const r = loadClock(raw, 70_000, 100);
  assert.equal(r.offlineSec, 60); assert.equal(worldSec(100), 65); assert.equal(worldSec(1100), 66);
  assert.equal(loadClock(raw, 0, 0).offlineSec, 0, 'backwards wall clock credits nothing');
});
test('menu pause freezes the global clock; resume continues from the exact snapshot', () => {
  loadClock(null, 0, 0);
  assert.equal(worldSec(10_000), 10); pauseClock(10_000); assert.ok(isPaused());
  assert.equal(worldSec(70_000), 10, 'frozen while menu is open'); assert.equal(worldSec(100_000), 10);
  resumeClock(100_000); assert.ok(!isPaused()); assert.equal(worldSec(100_000), 10); assert.equal(worldSec(101_000), 11);
  pauseClock(101_000); pauseClock(102_000); assert.equal(worldSec(200_000), 11, 'pause is idempotent');
  resumeClock(200_000); resumeClock(200_000); assert.equal(worldSec(200_000), 11, 'resume is idempotent'); assert.equal(worldSec(201_000), 12);
});
test('the in-game control drives the one clock: rate, pause and play', () => {
  loadClock(null, 0, 0);
  assert.equal(clockRate(), 1);
  assert.equal(timeCommand('faster', 0).rate, 2);
  assert.equal(worldSec(1000), 2);
  assert.equal(timeCommand('pause', 1000).paused, true);
  assert.equal(worldSec(5000), 2, 'HUD pause freezes the clock');
  assert.equal(timeCommand('play', 5000).paused, false);
  assert.equal(worldSec(6000), 4, 'play resumes at the same rate');
  assert.equal(timeCommand('slower', 6000).rate, 1);
  assert.equal(worldSec(7000), 5);
  pauseClock(7000);
  timeCommand('play', 8000); // play releases only the HUD hold
  assert.equal(isPaused(), true, 'the menu hold stays');
  assert.equal(worldSec(9000), 5);
  resumeClock(9000);
  assert.equal(worldSec(10_000), 6);
  setClockRate(4, 10_000);
  const raw = saveClock(10_000, 10_000);
  loadClock(raw, 10_000, 0);
  assert.equal(clockRate(), 4, 'the saved rate is the one rate');
  assert.equal(worldSec(1000) - worldSec(0), 4);
  loadClock(null, 0, 0);
});
