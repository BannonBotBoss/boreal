/**
 * T-0002 (grok-gait): wolf gait timing against canid data. Cadence and stride of gaitFor(WOLF_LEGS) within ±15 % of:
 * - Bryce & Williams 2017, JEB 220:312, doi:10.1242/jeb.144188, Table S2 "Northern" (wolf-like) breeds: walk, trot, gallop.
 * - Heglund & Taylor 1988, JEB 138:301, doi:10.1242/jeb.138.1.301: trot-gallop transition 1.54·M^0.216 m/s at
 *   4.19·M^-0.150 Hz; for a 40 kg wolf 3.42 m/s and 2.41 Hz.
 * - Fast gallop (plan T-0002): about 2.7 Hz / 2.2 m at 6 m/s and about 3 Hz / 3.4 m at 10.5 m/s; within a gallop frequency
 *   rises only gently, so speed comes from stride (Heglund & Taylor 1988; Maes et al. 2008, JEB 211:138).
 * - Maes et al. 2008: duty factor below 0.5 above 2.0 m/s.
 * - Walter & Carrier 2007, JEB 210:208: 71-75 ms contact per limb at 9.2 m/s, a stance sweep of about 0.65-0.69 m.
 * Until the stride work lands these are marked todo (they run and report, and fail on today's reach-capped gaitFor).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { WOLF_LEGS, gaitFor, type Motion } from '../src/core/animalBehavior';
import { gaitReadout } from '../src/core/gaitReadout';

const TODO = { todo: 'fails on the current gaitFor (stride capped at maxStance / duty) until the T-0002 stride work lands' };
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
for (const r of ROWS) test(`wolf ${r.v} m/s matches ${r.src}`, TODO, () => {
  const g = gaitFor(r.motion, r.v, WOLF_LEGS)!;
  if (r.gait) assert.equal(g.name, r.gait);
  within(r.v / g.cycle, r.hz, 'cadence Hz');
  if (r.stride) within(g.cycle, r.stride, 'stride m');
});
test('duty factor below 0.5 above 2 m/s (Maes et al. 2008)', () => {
  for (const v of [2.2, 2.7, 3.5, 5, 7, 10.5]) assert.ok(gaitFor('run', v, WOLF_LEGS)!.duty < .5, `${v} m/s`);
});
test('fast-gallop stance sweep about 0.67 m at 9.2 m/s (Walter & Carrier 2007)', TODO, () => {
  const g = gaitFor('run', 9.2, WOLF_LEGS)!; within(g.duty * g.cycle, .67, 'stance sweep m');
});
test('gait readout: cadence × stride = speed; walk is never airborne', () => {
  for (const v of [1.27, 2.7, 6, 10.5]) { const r = gaitReadout('run', v, WOLF_LEGS, .3); assert.ok(Math.abs(r.hz * r.stride - v) < 1e-9); }
  for (let p = 0; p < 1; p += .01) assert.equal(gaitReadout('walk', 1.27, WOLF_LEGS, p).airborne, false);
});