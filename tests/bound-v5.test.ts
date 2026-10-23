/**
 * T-0009 v5 (grok-gait, on 02e1ebc): the body's height through the bound from the stride's ground forces (bounding.ts
 * heightCurve: ballistic g·t²/8 flights + the stance dip) and the deep hind-limb fold in swing (bounding.ts SWING), bounded by
 * the sourced joint ranges (LEPORID_LIMITS) and by the hind sole never rising above its own hip joint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBounding, limbPoints, boundPlan, heightCurve, selectRow, GIRDLE, type BoundFrame } from '../src/animals/locomotion/bounding';
import { suspensionRise } from '../src/core/gaitData';
import { gravity } from '../src/proc/physics';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

function run(plan: string, v: number, seconds = 4, dt = 1 / 240) {
  const sk = planFor(plan), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor(plan) }), out: { t: number; f: BoundFrame }[] = [];
  for (let t = 0; t < seconds; t += dt) out.push({ t, f: c.update(dt, Math.min(v, v * t / 1.5), 0, null, selectRow(v)) });
  return { sk, c, out };
}

test('heightCurve: never below 0 while a foot is down, ballistic (-g) in every suspension, highest in the extended flight, at least the flight-only rise', () => {
  const { c } = run('hare', 8.5, .1), p = boundPlan(HOST_GAIT, 8.5, c.reach, 'half-bound'), y = heightCurve(p), n = y.length, T = 1 / p.hz, dt = T / n;
  for (let k = 0; k < n; k++) if (p.offsets.some((o, i) => (k / n + o) % 1 < p.duties[i])) assert.ok(y[k] >= -1e-12, `stance at ${k / n}: ${y[k]}`);
  assert.ok(Math.max(...y) > .005, 'the flights rise above the running rise');
  for (const s of p.suspensions) for (let k = Math.ceil(s.from * n) + 2; k < Math.floor(s.to * n) - 2; k++) {
    const acc = (y[(k + 1) % n] - 2 * y[k % n] + y[(k - 1 + n) % n]) / (dt * dt); assert.ok(Math.abs(acc + gravity()) < .05 * gravity(), `${s.kind} at ${k / n}: ${acc}`); }
  const top = y.indexOf(Math.max(...y)) / n, ext = p.suspensions.find(s => s.kind === 'extended')!;
  assert.ok(top >= ext.from && top <= ext.to, `highest at ${top}, extended ${ext.from}-${ext.to}`);
  const span = Math.max(...y) - Math.min(...y), flight = Math.max(...p.suspensions.map(s => suspensionRise(s.to - s.from, p.hz)));
  assert.ok(span >= flight && span < .05, `span ${span} vs flight-only ${flight}`);
});

test('the running body rises and falls by the derived span; standing it does not', () => {
  const { out } = run('hare', 8.5), steady = out.filter(o => o.t > 3).map(o => o.f.lift);
  assert.ok(Math.max(...steady) - Math.min(...steady) > .012, `lift span ${Math.max(...steady) - Math.min(...steady)}`);
  const sk = planFor('hare'), c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare') });
  for (let t = 0; t < 1; t += 1 / 60) assert.equal(c.update(1 / 60, 0, 0, null).lift, 0);
});

test('hind swing fold: the knee reaches the rabbit knee flexion end (30 deg), the hind sole never rises above its hip joint', () => {
  for (const v of [5, 8.5, 11.6]) {
    const { sk, out } = run('hare', v); let knee = 180, above = -1;
    for (const { t, f } of out) { if (t < 2.5) continue;
      for (const i of [1, 3]) if (!f.contact[i]) { const P = limbPoints(sk, f, i); knee = Math.min(knee, 180 - Math.abs(f.limbs[i].knee) * 180 / Math.PI);
        above = Math.max(above, ...P.slice(4).map(q => q.y - P[1].y)); } }
    assert.ok(knee < 31, `${v} m/s: deepest swing knee ${knee.toFixed(1)} deg`);
    assert.ok(above < 0, `${v} m/s: hind sole ${(above * 1000).toFixed(0)} mm above the hip`);
  }
});
