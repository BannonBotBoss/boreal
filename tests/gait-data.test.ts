/**
 * T-0002 (grok-gait): wolf gait timing against canid data, ±15 %.
 * - Bryce & Williams 2017, JEB 220:312, doi:10.1242/jeb.144188, Table S2 "Northern" (wolf-like) breeds: walk, trot, gallop.
 * - Heglund & Taylor 1988, JEB 138:301, doi:10.1242/jeb.138.1.301: trot-gallop transition 1.54·M^0.216 m/s at
 *   4.19·M^-0.150 Hz; for a 40 kg wolf 3.42 m/s and 2.41 Hz.
 * - Fast gallop (plan T-0002): about 2.7 Hz / 2.2 m at 6 m/s and about 3 Hz / 3.4 m at 10.5 m/s; within a gallop frequency
 *   rises only gently, so speed comes from stride (Heglund & Taylor 1988; Maes et al. 2008, JEB 211:138).
 * - Maes et al. 2008: duty factor below 0.5 above 2.0 m/s.
 * - Walter & Carrier 2007, JEB 210:208: 71-75 ms contact per limb at 9.2 m/s, a stance sweep of about 0.65-0.69 m.
 * - Hildebrand 1977 / Biancardi & Minetti 2012: rotary gallop LH → RH → RF → LF (or mirrored); gathered suspension after
 *   the fore pair lifts off (Bertram & Gutmann 2009).
 * Rows marked LIVE test the game's gaitFor (core/animalBehavior) and stay todo until it reads src/core/gaitData.ts
 * (see the contract in notes/grok-gait.md). Rows marked MODEL test gaitData itself and must pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { WOLF_LEGS, gaitFor, type Motion } from '../src/core/animalBehavior';
import { gaitReadout } from '../src/core/gaitReadout';
import { canidPlan, footfallOrder, selectGait, suspensions, type CanidGait } from '../src/core/gaitData';
import { random } from '../src/proc/rng';
import { gravity } from '../src/proc/physics';

const TODO = { todo: 'LIVE: gaitFor still caps the stride at maxStance / duty; passes once gaitFor reads src/core/gaitData.ts' };
const within = (got: number, want: number, what: string) =>
  assert.ok(Math.abs(got - want) <= .15 * want, `${what}: ${got.toFixed(2)} vs ${want} (±15 %)`);
const ROWS: Array<{ v: number; motion: Motion; gait?: string; hz: number; stride?: number; src: string }> = [
  { v: 1.27, motion: 'walk', gait: 'walk', hz: 1.50, stride: .84, src: 'Bryce & Williams 2017 walk' },
  { v: 2.70, motion: 'run', gait: 'trot', hz: 2.10, stride: 1.26, src: 'Bryce & Williams 2017 trot' },
  { v: 3.42, motion: 'run', hz: 2.41, src: 'Heglund & Taylor 1988 trot-gallop transition, 40 kg' },
  { v: 4.96, motion: 'run', gait: 'gallop', hz: 2.61, stride: 1.91, src: 'Bryce & Williams 2017 gallop' },
  { v: 6.0, motion: 'run', gait: 'gallop', hz: 2.7, stride: 2.2, src: 'fast gallop' },
  { v: 10.5, motion: 'run', gait: 'gallop', hz: 3.0, stride: 3.4, src: 'sprint gallop' },
];
const LH = 1, RH = 3, RF = 2, LF = 0;
const rotary = (o: readonly number[]) => { const f = footfallOrder(o), k = f.indexOf(LH); return [0, 1, 2, 3].map(j => f[(k + j) % 4]); };
const footsDown = (o: readonly number[], duty: number, p: number) => o.filter(x => ((p + x) % 1 + 1) % 1 < duty).length;

for (const r of ROWS) {
  test(`MODEL ${r.v} m/s matches ${r.src}`, () => {
    const p = canidPlan(r.v, WOLF_LEGS.hip);
    if (r.gait) assert.equal(p.gait, r.gait);
    within(p.hz, r.hz, 'cadence Hz'); if (r.stride) within(p.stride, r.stride, 'stride m');
  });
  test(`LIVE ${r.v} m/s matches ${r.src}`, TODO, () => {
    const g = gaitFor(r.motion, r.v, WOLF_LEGS)!;
    if (r.gait) assert.equal(g.name, r.gait);
    within(r.v / g.cycle, r.hz, 'cadence Hz'); if (r.stride) within(g.cycle, r.stride, 'stride m');
  });
}
test('MODEL + LIVE duty factor below 0.5 above 2 m/s (Maes et al. 2008)', () => {
  for (const v of [2.2, 2.7, 3.5, 5, 7, 10.5]) {
    assert.ok(gaitFor('run', v, WOLF_LEGS)!.duty < .5, `gaitFor ${v} m/s`); assert.ok(canidPlan(v, WOLF_LEGS.hip).duty < .5, `gaitData ${v} m/s`);
  }
});
test('MODEL fast-gallop stance sweep about 0.67 m at 9.2 m/s (Walter & Carrier 2007)', () => {
  const p = canidPlan(9.2, WOLF_LEGS.hip); within(p.duty * p.stride, .67, 'stance sweep m');
  within(p.duty / p.hz * 1000, 73, 'contact ms');
});
test('LIVE fast-gallop stance sweep about 0.67 m at 9.2 m/s (Walter & Carrier 2007)', TODO, () => {
  const g = gaitFor('run', 9.2, WOLF_LEGS)!; within(g.duty * g.cycle, .67, 'stance sweep m');
});
test('MODEL rotary gallop footfall LH → RH → RF → LF, mirrored RH → LH → LF → RF', () => {
  for (const v of [4.96, 6, 10.5]) assert.deepEqual(rotary(canidPlan(v, WOLF_LEGS.hip).offsets), [LH, RH, RF, LF]);
  const right = footfallOrder(canidPlan(6, WOLF_LEGS.hip, undefined, 'right').offsets), k = right.indexOf(RH);
  assert.deepEqual([0, 1, 2, 3].map(j => right[(k + j) % 4]), [RH, LH, LF, RF]);
});
test('LIVE rotary gallop footfall LH → RH → RF → LF', TODO, () => {
  for (const v of [4.96, 6, 10.5]) assert.deepEqual(rotary(gaitFor('run', v, WOLF_LEGS)!.offsets), [LH, RH, RF, LF]);
});
const gathered = (offsets: readonly number[], duty: number, hz: number) => {
  const g = suspensions(offsets, duty).filter(s => s.kind === 'gathered');
  assert.equal(g.length, 1, 'one gathered suspension per stride');
  const w = g[0], len = w.to - w.from;
  assert.ok(len >= .1, `gathered suspension ${len.toFixed(3)} of a stride (≥ 0.1)`);
  for (let p = w.from + .005; p < w.to - .005; p += .005) assert.equal(footsDown(offsets, duty, p), 0, `all four feet up at ${p.toFixed(3)}`);
  return gravity() * (len / hz) ** 2 / 8; // ballistic rise
};
test('MODEL gathered suspension after the fore pair lifts off, ≥ 0.1 stride, all feet up; extended flight only at speed', () => {
  for (const v of [4.96, 6, 10.5]) { const p = canidPlan(v, WOLF_LEGS.hip); assert.ok(gathered(p.offsets, p.duty, p.hz) > .004, `${v} m/s visible rise (m)`); }
  const sprint = canidPlan(10.5, WOLF_LEGS.hip).suspensions.find(s => s.kind === 'extended');
  assert.ok(sprint && sprint.to - sprint.from >= .08, 'extended suspension at a sprint');
});
test('LIVE gathered suspension after the fore pair lifts off', TODO, () => {
  for (const v of [4.96, 6, 10.5]) { const g = gaitFor('run', v, WOLF_LEGS)!; gathered(g.offsets, g.duty, v / g.cycle); }
});
test('MODEL no flicker: a slow seeded-jitter speed ramp switches gait exactly once per threshold crossing, up and down', () => {
  const h = WOLF_LEGS.hip, r = random(2002), Fr = (v: number) => v * v / (gravity() * h);
  for (const [lo, hi] of [[.8, 2.2], [3.0, 4.3]] as const) {
    for (const dir of [1, -1]) {
      let prev: CanidGait = selectGait(Fr(dir > 0 ? lo : hi)), switches = 0;
      for (let k = 0; k <= 2000; k++) {
        const base = dir > 0 ? lo + (hi - lo) * k / 2000 : hi - (hi - lo) * k / 2000, v = base + .1 * (r() * 2 - 1);
        const g = selectGait(Fr(Math.max(.05, v)), prev); if (g !== prev) switches++; prev = g;
      }
      assert.equal(switches, 1, `${lo}-${hi} m/s ${dir > 0 ? 'up' : 'down'}: ${switches} switches`);
    }
  }
});
test('gait readout: cadence × stride = speed; walk is never airborne', () => {
  for (const v of [1.27, 2.7, 6, 10.5]) { const r = gaitReadout('run', v, WOLF_LEGS, .3); assert.ok(Math.abs(r.hz * r.stride - v) < 1e-9); }
  for (let p = 0; p < 1; p += .01) assert.equal(gaitReadout('walk', 1.27, WOLF_LEGS, p).airborne, false);
});