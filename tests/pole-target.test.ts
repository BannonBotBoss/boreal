/**
 * T-0044: pole-target two-bone (Tolani, Goswami and Badler 2000, Graphical Models 62:353).
 * The known-bad is executed: the hare's plant frame, fore lock on, still folds the elbow by more than the
 * fore-lock omega gate. Wiring the pole into that frame is the open work; this test fails closed if someone
 * claims the pop is gone without the plant delta dropping under the gate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { poleTargetTwoBone } from '../src/core/animalBehavior';
import { createBounding, GIRDLE, limbPoints, selectRow } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';

const side = (shoulder: { z: number; y: number }, wrist: { z: number; y: number }, elbow: { z: number; y: number }) =>
  Math.sign((wrist.z - shoulder.z) * (elbow.y - shoulder.y) - (wrist.y - shoulder.y) * (elbow.z - shoulder.z));

test('pole target: opposite poles put the elbow on opposite sides of the shoulder-wrist axis', () => {
  const shoulder = { z: 0, y: 0.2 }, wrist = { z: 0.04, y: 0.05 }, upper = 0.12, lower = 0.11;
  const left = poleTargetTwoBone(shoulder, wrist, upper, lower, { z: -0.08, y: 0.15 });
  const right = poleTargetTwoBone(shoulder, wrist, upper, lower, { z: 0.12, y: 0.15 });
  assert.equal(side(shoulder, wrist, left), -1);
  assert.equal(side(shoulder, wrist, right), 1);
  // the previous elbow, used as the pole, stays on that elbow's side
  const again = poleTargetTwoBone(shoulder, wrist, upper, lower, left);
  assert.equal(side(shoulder, wrist, again), side(shoulder, wrist, left));
});

function interior(P: { x: number; y: number; z: number }[]) {
  const g = P[1], e = P[2], w = P[3];
  const ax = g.x - e.x, ay = g.y - e.y, az = g.z - e.z;
  const bx = w.x - e.x, by = w.y - e.y, bz = w.z - e.z;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz))))) * 180 / Math.PI;
}

test('T-0044 known-bad: 8.5 m/s at 60 Hz, the plant-frame elbow exceeds the fore-lock omega gate', () => {
  const sk = planFor('hare'), hz = 60, v = 8.5;
  const c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
  let last: any, plant = 0, gate = 0;
  for (let n = 0; n / hz < 3.5; n++) {
    const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
    gate = 2 * 88 / (f.plan.duties[0] / f.plan.hz) / hz;
    if (last && n / hz > 2) for (const i of [0, 2]) if (f.contact[i] && !last.contact[i])
      plant = Math.max(plant, Math.abs(interior(limbPoints(sk, f, i)) - interior(limbPoints(sk, last, i))));
    last = f;
  }
  assert.ok(plant > gate, `plant ${plant.toFixed(1)} deg should still exceed the ${gate.toFixed(1)} deg gate until the pole is wired`);
});
