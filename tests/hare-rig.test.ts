/** T-0009 run 5 (grok): the game hare takes the grok-gait v3 contract (split hind foot, shoulder blade, LEPORID_LIMITS, level
 * trunk, turn in place) and stays >= 95 % on bound-checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HARE_BODY, HARE_PLAN, HARE_RIG } from '../src/animals/hare';
import { LEPORID_LIMITS } from '../src/animals/locomotion/ik';
import { RUN_POSE_LEVEL } from '../src/animals/locomotion/bounding';
import { planFor, poseFor, V3_PLAN, SPLIT, BLADE } from '../tools/bound-plans';
import { runScore } from '../tools/bound-score';

test('game hare = v3 contract: split foot + blade + leporid limits, level trunk, turn in place', () => {
  assert.equal(HARE_PLAN.hindToes, .056); assert.equal(HARE_PLAN.scapula, .063); assert.equal(HARE_PLAN.limits, LEPORID_LIMITS);
  assert.equal(SPLIT.hindToes, HARE_BODY.hindToes); assert.equal(BLADE.scapula, HARE_BODY.scapula);
  for (const k of Object.keys(V3_PLAN) as (keyof typeof V3_PLAN)[]) assert.deepEqual(HARE_PLAN[k], V3_PLAN[k], k);
  assert.equal(HARE_RIG.pose, RUN_POSE_LEVEL); assert.equal(HARE_RIG.turnInPlace, true); assert.equal(poseFor('hare'), RUN_POSE_LEVEL);
  const sk = planFor('hare'); assert.equal(sk.legs.girdle, .063); assert.ok(Math.abs(sk.toes - .056) < 1e-12);
});

test('bound-checks: the game hare >= 95 %', () => { const s = runScore('hare'); assert.ok(s.score >= 95, `hare ${s.score}`); });
