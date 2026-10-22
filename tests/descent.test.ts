import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dryStart, dryStartSteps } from '../src/core/stages/surfaceAt';
import { landSpawn, landSpawnSteps } from '../src/world/globe/handoff';
import { TRANSITION, globePitch } from '../src/world/globe/transition';

// T-0034: the globe -> game descent must keep rendering (the landing search spreads over frames) and never swing the pitch.
const drain = <T>(g: Generator<unknown, T>) => { let n = 0, r = g.next(); while (!r.done) { n++; r = g.next(); } return { v: r.value, n }; };
test('descent: the dry-land search runs in small resumable steps and lands where dryStart does', () => {
  const wet = { x: 0, z: 1992 }; // seed 1400: a lake point whose ring search took 1.4 s in one call (T-0034 profile)
  const one = dryStart(wet.x, wet.z, 1400), steps = drain(dryStartSteps(wet.x, wet.z, 1400));
  assert.deepEqual(steps.v, one); assert.ok(steps.n > 200, `${steps.n} steps`);
  const a = drain(landSpawnSteps(wet, true)); assert.deepEqual(a.v, landSpawn(wet, true));
  assert.deepEqual(drain(landSpawnSteps(wet, false)).v, wet);
});
test('descent: in-page globe pitch goes from straight down in orbit to the 45-degree glide at the band top, smoothly', () => {
  const deg = (a: number) => a * 180 / Math.PI;
  assert.ok(deg(globePitch(14e6)) < -89); assert.ok(Math.abs(deg(globePitch(TRANSITION.bandTop)) + 45) < .1);
  assert.ok(Math.abs(deg(globePitch(TRANSITION.bandTop * 1.05)) + 45) < .5); // the ascent's top pose
  let prev = globePitch(14e6), worst = 0;
  for (let a = 14e6; a > TRANSITION.bandTop; a *= .99) { const p = globePitch(a); assert.ok(p >= prev - 1e-9, `monotone at ${a}`); worst = Math.max(worst, Math.abs(deg(p - prev))); prev = p; }
  assert.ok(worst < 1, `worst step ${worst.toFixed(2)} deg per 1 % of altitude`);
});