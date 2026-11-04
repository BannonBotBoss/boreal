// T-0044 run 13 (grok-gait): softIK.ts (Nicholas 2006 soft IK, equation as transcribed in pmSoftIK) - hand-worked values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { softSplit, softDistance, bendForDistance, distanceForBend, softBendMin, softExcess, softTwoBone } from '../src/animals/locomotion/softIK';
const close = (a: number, b: number, e = 1e-12) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('Nicholas example: chain 3, soft distance 1 (hard 2)', () => {
  const { soft, hard } = softSplit(3, 1 / 3); close(soft, 1); close(hard, 2);
  close(softDistance(1.5, hard, soft), 1.5); close(softDistance(2, hard, soft), 2);
  close(softDistance(3, hard, soft), 1 * (1 - Math.exp(-1)) + 2); // 2.632...
  assert.ok(softDistance(10, hard, soft) < 3);
  // continuous slope 1 at hard
  close((softDistance(2 + 1e-6, hard, soft) - 2) / 1e-6, 1, 1e-5);
});
test('soft 0 is hard IK (clamped to the chain)', () => { close(softDistance(5, 3, 0), 3); close(softDistance(2, 3, 0), 2); });
test('bend / distance are inverse (law of cosines)', () => {
  close(bendForDistance(.15, .07, .08), 0, 1e-6); close(bendForDistance(Math.sqrt(.07 ** 2 + .08 ** 2), .07, .08), Math.PI / 2);
  for (const b of [.1, .7, 1.5, 2.5]) close(bendForDistance(distanceForBend(b, .07, .08), .07, .08), b, 1e-9);
});
test('softBendMin / softExcess', () => {
  const U = .0712, L = .0803, r = .1, bmin = softBendMin(U, L, r);
  close(distanceForBend(bmin, U, L), .9 * (U + L), 1e-12); close(softExcess(bmin, U, L, r), 0, 1e-9); close(softExcess(0, U, L, r), 1, 1e-12);
});
test('softTwoBone: wrist lands at the soft distance along the aim, either fold side', () => {
  const U = .0712, L = .0803, dir = (t: number) => ({ z: -Math.sin(t), y: -Math.cos(t) });
  for (const sign of [1, -1]) for (const [wz, wy] of [[.02, -.2], [-.1, -.05], [.01, -.12]]) {
    const r = softTwoBone(0, 0, wz, wy, U, L, .1, sign), u = dir(r.a1), l = dir(r.a1 + r.knee);
    const W = { z: U * u.z + L * l.z, y: U * u.y + L * l.y }, d = Math.hypot(wz, wy);
    close(Math.hypot(W.z, W.y), r.dSoft, 1e-9); close(W.z * wy - W.y * wz, 0, 1e-9); assert.ok(W.z * wz + W.y * wy > 0);
    assert.ok(r.dSoft <= d + 1e-12 && r.dSoft < U + L); assert.equal(Math.sign(r.knee), sign);
  }
});