import test from 'node:test';
import assert from 'node:assert/strict';
import { createCpg, stepCpg, phases, phaseDiff, GAIT_TABLE, planGait, referenceLayout } from '../src/animals/locomotion';
import { stream } from '../src/proc/rng';
import { gaitFor, WOLF_LEGS } from '../src/core/animalBehavior';

const DT = 1 / 120;
const offsetError = (theta: number[], offsets: readonly number[]) =>
  Math.max(...[1, 2, 3].map(i => Math.abs(phaseDiff(phaseDiff(theta[i], theta[0]), offsets[i] - offsets[0]))));

test('CPG phase differences converge to every gait table row within 2 strides from random starts', () => {
  for (const [id, row] of Object.entries(GAIT_TABLE)) for (let k = 0; k < 5; k++) {
    const r = stream(k, `cpg-test:${id}`), c = createCpg([0, 0, 0, 0]);
    c.theta = c.theta.map(() => r());
    const freq = 2; for (let t = 0; t < 2 / freq; t += DT) stepCpg(c, row.offsets, freq, DT);
    assert.ok(offsetError(c.theta, row.offsets) < .02, `${id} seed ${k}: error ${offsetError(c.theta, row.offsets)}`);
  }
});

test('gait change glides: no phase jumps, settles to the new offsets', () => {
  const c = createCpg(GAIT_TABLE.walk.offsets), freq = 1.5;
  for (let t = 0; t < 2; t += DT) stepCpg(c, GAIT_TABLE.walk.offsets, freq, DT);
  let maxStep = 0, prev = c.theta.slice();
  for (let t = 0; t < 2 / freq; t += DT) {
    stepCpg(c, GAIT_TABLE.trot.offsets, freq, DT);
    c.theta.forEach((v, i) => { maxStep = Math.max(maxStep, Math.abs(v - prev[i] - freq * DT)); }); prev = c.theta.slice();
  }
  assert.ok(maxStep < .02, `largest per-step phase change beyond ω·dt: ${maxStep}`);
  assert.ok(offsetError(c.theta, GAIT_TABLE.trot.offsets) < .02);
});

test('phases always advance (never run backward) and are deterministic', () => {
  const run = () => { const c = createCpg(GAIT_TABLE.gallop.offsets); const out: number[][] = []; let ok = true;
    for (let t = 0; t < 3; t += DT) { const before = c.theta.slice(); stepCpg(c, t < 1.5 ? GAIT_TABLE.gallop.offsets : GAIT_TABLE.walk.offsets, 2.5, DT); ok &&= c.theta.every((v, i) => v >= before[i]); out.push(phases(c)); }
    return { out, ok }; };
  const a = run(), b = run();
  assert.ok(a.ok); assert.deepEqual(a.out, b.out);
});

test('Hopf amplitude: μ = 0 lets it decay, μ = 1 brings it back to 1', () => {
  const c = createCpg(GAIT_TABLE.trot.offsets);
  for (let t = 0; t < 3; t += DT) stepCpg(c, GAIT_TABLE.trot.offsets, 0, DT, 0);
  assert.ok(c.r < .25, `r after stopping ${c.r}`);
  for (let t = 0; t < 2; t += DT) stepCpg(c, GAIT_TABLE.trot.offsets, 2, DT, 1);
  assert.ok(Math.abs(c.r - 1) < .01);
});

test('auto gait plan agrees with core/animalBehavior gaitFor for the reference body', () => {
  const { legs } = referenceLayout();
  for (const v of [.6, 1.5, 2.5, 4, 7, 10]) {
    const p = planGait(v, legs), g = gaitFor('walk', v, WOLF_LEGS)!;
    assert.equal(p.id, g.name); assert.equal(p.cycle, g.cycle); assert.equal(p.duty, g.duty); assert.deepEqual([...p.offsets], [...g.offsets]);
  }
  const pace = planGait(2.5, legs, 'pace');
  assert.equal(pace.id, 'pace'); assert.ok(pace.duty * pace.cycle <= gaitFor('walk', 2.5, WOLF_LEGS)!.duty * gaitFor('walk', 2.5, WOLF_LEGS)!.cycle + 1e-12);
});
