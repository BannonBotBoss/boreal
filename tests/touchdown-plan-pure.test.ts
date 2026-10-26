// T-0044 run 11 (grok-gait): the pure, Rust-portable touchdown-plan helpers (src/animals/locomotion/touchdownPlan.ts)
// against hand-worked values (no reference to the sim).
import test from 'node:test';
import assert from 'node:assert/strict';
import { swingProgress, inLateSwing, timeToTouchdown, bodyAtTouchdown, landingAhead, forearmBelowDeg, inPlanBand, planBlendU, blendPlan } from '../src/animals/locomotion/touchdownPlan';
const near = (a: number, b: number, m: string) => assert.ok(Math.abs(a - b) < 1e-12, `${m}: ${a} vs ${b}`);
test('touchdownPlan: phase and timing', () => {
  assert.equal(swingProgress(.3, .4), -1); near(swingProgress(.88, .4), .8, 'sp');
  assert.equal(inLateSwing(.88, .4, .8), true); assert.equal(inLateSwing(.87, .4, .8), false);
  const t = timeToTouchdown(.75, 2.5); near(t.dphi, .25, 'dphi'); near(t.tRem, .1, 'tRem');
  const b = bodyAtTouchdown(1, 2, 0, 1, 5, .1); near(b.x, 1, 'x'); near(b.z, 2.5, 'z');
  near(landingAhead(.4, 1.5, .1, .25), .375, 'ahead');
});
test('touchdownPlan: forearm band (Schmidt 2008 Table 4, 12-35 used) and manus scan range', () => {
  near(forearmBelowDeg(0, 1, 0, 1, 0, 0), 45, '45');
  assert.equal(inPlanBand(20, .5, 12, 35, -.6, 1.2), true);
  assert.equal(inPlanBand(11.9, .5, 12, 35, -.6, 1.2), false);
  assert.equal(inPlanBand(20, 1.3, 12, 35, -.6, 1.2), false);
});
test('touchdownPlan: blend along the Cheetah cubic Bezier, deterministic', () => {
  assert.equal(planBlendU(.8, .8), 0); near(planBlendU(.9, .8), .5, 'u.5'); assert.equal(planBlendU(1.2, .8), 1);
  const q = blendPlan({ blade: 0, psi: 1 }, { blade: 2, psi: 3 }, .5); near(q.blade, 1, 'b'); near(q.psi, 2, 'p');
  assert.deepEqual(blendPlan({ blade: 0, psi: 1 }, { blade: 2, psi: 3 }, 1), { blade: 2, psi: 3 });
  assert.deepEqual(blendPlan({ blade: .1, psi: .2 }, { blade: .7, psi: -.3 }, .37), blendPlan({ blade: .1, psi: .2 }, { blade: .7, psi: -.3 }, .37));
});
