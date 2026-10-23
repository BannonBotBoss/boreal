/**
 * T-0009 run 4 (grok-gait, on 37b1fbc): each pair's duty fitted on its own (bounding.ts boundPlan), the pika pelvis excursion
 * (GIRDLE.spineMax 42°: Schilling & Hackert 2006), the slow half-bound's sweeps at the chord ends so the hind prints land a
 * print ahead (bounding.ts hindSlack / foreSlack), and limbRange taking the girdle it is given.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { boundPlan, reachOf, limbRange, GIRDLE, CHORD_USE } from '../src/animals/locomotion/bounding';
import { HOST_GAIT, planFor, poseFor } from '../tools/bound-plans';
import { runScore } from '../tools/bound-score';

const RAD = Math.PI / 180;

test('girdle: pelvis ±21° (pika leading stance 109° → 151°), blade ±17° (pika 46° → 80°)', () => {
  assert.ok(Math.abs(2 * GIRDLE.spineMax / RAD - 42) < .1);
  assert.ok(Math.abs(2 * GIRDLE.scapulaMax / RAD - 34) < .5);
});

test('duty fit: each pair on its own — the hind is no longer cut with the fore at 11.6 m/s; neither exceeds its data duty', () => {
  const sk = planFor('hare'), r = reachOf(sk, GIRDLE, poseFor('hare'), HOST_GAIT);
  const p = boundPlan(HOST_GAIT, 11.6, r, 'gallop-lagomorph');
  assert.ok(p.duty <= p.dutyData + 1e-9 && p.foreDuty <= p.foreDutyData + 1e-9);
  assert.ok(p.duty / p.dutyData > p.foreDuty / p.foreDutyData + .05, `hind ${p.duty} fore ${p.foreDuty}`); // v3: the same share
  assert.ok(p.duty >= .18, `hind duty ${p.duty} under the bound-checks floor`);
  // the fore stays reach-limited: its sweep fits CHORD_USE x its chord
  assert.ok(p.foreDuty * p.stride <= CHORD_USE * r.fore.chord + 1e-3);
});

test('limbRange takes the girdle passed: a wider blade gives a fore chord >= the default one', () => {
  const sk = planFor('hare'), lim = sk.plan.limits;
  const a = limbRange(sk.legs, false, true, undefined, lim, undefined, GIRDLE), b = limbRange(sk.legs, false, true, undefined, lim, undefined, { ...GIRDLE, scapulaMax: .5 });
  assert.ok(b.chord > a.chord + 1e-3, `${a.chord} vs ${b.chord}`);
});

test('bound-checks: hare >= 98.4 % (37b1fbc), the slow half-bound hind prints land >= one 12 cm print ahead', () => {
  const r = runScore('hare');
  assert.ok(r.score >= 98.4, `hare ${r.score}`);
  const slow = r.speeds.find(s => s.speed === 1.68)!, ov = slow.checks.find(c => c.name === 'overtake')!;
  assert.ok(ov.pass, ov.value);
  const worst = Number(/worst (-?[\d.]+)/.exec(ov.value)![1]);
  assert.ok(worst >= 12, `worst ${worst} cm`);
});
