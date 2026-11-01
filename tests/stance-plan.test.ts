// T-0044 run 15 (grok-gait): stancePlan.ts (fore root sink: reach term + hind-phase gather term) - hand-worked values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reachDrop, gatherWeight, stanceWeight, gatherDrop, stanceDropStep } from '../src/animals/locomotion/stancePlan';
const close = (a: number, b: number, e = 1e-12) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const P = { k: .9, maxDrop: .02, gather: .01, extend: .004, peak: .8, rate: .3 };
test('reach: inside k x R no sink; straight below sinks to k x R; out of reach sideways sinks to the paw level', () => {
  close(reachDrop(0, -.8, 1, .9), 0);
  close(reachDrop(0, -1, 1, .9), .1);            // 1 - .9
  close(reachDrop(.6, -.8, 1, .9), .8 - Math.sqrt(.81 - .36)); // 3-4-5 triangle at k .9
  close(reachDrop(.95, -.3, 1, .9), .3);
  close(reachDrop(0, -1, 0, .9), 0);
});
test('gather weight: 0 in stance, 1 at the peak, 0 at both swing ends; stance weight sin bump', () => {
  close(gatherWeight(.1, .2, .8), 0); close(gatherWeight(.2, .2, .8), 0); close(gatherWeight(.2 + .8 * .8, .2, .8), 1); close(gatherWeight(1, .2, .8), 0);
  close(stanceWeight(.1, .2), 1); close(stanceWeight(.5, .2), 0);
});
test('gather drop: both hinds at the peak -> +gather; both mid stance -> -extend', () => {
  close(gatherDrop(.84, .84, .2, P), .01); close(gatherDrop(.1, .1, .2, P), -.004);
});
test('rate limit and cap', () => {
  close(stanceDropStep(0, .05, P, .01), .003); close(stanceDropStep(.019, .05, P, 1), .02); close(stanceDropStep(.01, 0, P, .01), .007); close(stanceDropStep(.01, .0105, P, .01), .0105);
});