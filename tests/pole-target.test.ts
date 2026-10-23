/**
 * T-0044: pole-target two-bone (Tolani, Goswami and Badler 2000, Graphical Models 62:353).
 * The pole only picks the side of the bend. The plant-frame length is the FORE_REACH floor in bounding.ts.
 * This test checks one cell: 8.5 m/s at 60 Hz, fore lock on, shoulder-wrist at or above 0.103 m and the
 * interior drop inside that cell's omega gate. The other speeds and rates are still outside their gates.
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

const span = (P: { x: number; y: number; z: number }[]) => Math.hypot(P[3].x - P[1].x, P[3].y - P[1].y, P[3].z - P[1].z);

test('T-0044: 8.5 m/s at 60 Hz, the plant frame keeps shoulder-wrist at or above 0.103 m', () => {
  const sk = planFor('hare'), hz = 60, v = 8.5;
  const c = createBounding(sk, HOST_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, { pose: poseFor('hare'), foreLock: true });
  let last: any, plant = 0, gate = 0, swMin = Infinity;
  for (let n = 0; n / hz < 3.5; n++) {
    const f: any = c.update(1 / hz, Math.min(v, v * n / hz / 1.5), 0, null, selectRow(v));
    gate = 2 * 88 / (f.plan.duties[0] / f.plan.hz) / hz;
    if (last && n / hz > 2) for (const i of [0, 2]) if (f.contact[i] && !last.contact[i]) {
      const B = limbPoints(sk, f, i);
      plant = Math.max(plant, Math.abs(interior(B) - interior(limbPoints(sk, last, i))));
      swMin = Math.min(swMin, span(B));
    }
    last = f;
  }
  assert.ok(swMin >= 0.103, `shoulder-wrist ${swMin.toFixed(4)} m`);
  assert.ok(plant <= gate, `plant ${plant.toFixed(2)} deg, gate ${gate.toFixed(2)}`);
});
