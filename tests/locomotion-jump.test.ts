import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocomotion, referenceLayout, apexHeight, jumpSeconds, airSeconds, JUMP, lodAt, LOCO_LOD, type LegPose, type TerrainFn } from '../src/animals/locomotion';
import { gallopBob } from '../src/core/animalBehavior';
import { gravity } from '../src/proc/physics';

const DT = 1 / 240, layout = referenceLayout(), flat: TerrainFn = () => 0;

function pounce(speed: number, ground: TerrainFn = flat) {
  let z = 0; const loco = createLocomotion(layout, ground, { x: 0, z, heading: 0 }); const out: { t: number; pose: LegPose; jumping: boolean }[] = [];
  for (let t = 0; t < 3; t += DT) { z -= speed * DT; const start = Math.abs(t - 1) < DT / 2;
    out.push({ t, pose: loco.update({ x: 0, z, heading: 0, speed, intent: start ? { kind: 'pounce' } : undefined }, DT), jumping: loco.jumping() }); }
  return out;
}

test('pounce: ballistic apex from gravity(), all four feet airborne in flight, lasts PHYS.jumpSeconds, then lands', () => {
  const run = pounce(6), jump = run.filter(r => r.jumping);
  const dur = jump.length * DT; assert.ok(Math.abs(dur - jumpSeconds()) < 2 * DT, `duration ${dur}`);
  const apex = Math.max(...jump.map(r => r.pose.height));
  const expected = gravity() * airSeconds() ** 2 / 8;
  assert.ok(Math.abs(expected - apexHeight()) < 1e-12);
  assert.ok(Math.abs(apex - expected) < .03, `apex ${apex} vs ${expected}`);
  const t0 = run.find(r => r.jumping)!.t, T = jumpSeconds();
  const flight = jump.filter(r => r.t - t0 > JUMP.crouch * T + .02 && r.t - t0 < (JUMP.crouch + JUMP.flight) * T - .02);
  assert.ok(flight.length > 20 && flight.every(r => r.pose.contacts.every(c => !c)), 'airborne in flight');
  const crouch = jump.filter(r => r.t - t0 < JUMP.crouch * T * .9);
  assert.ok(Math.min(...crouch.map(r => r.pose.height)) < -.5 * JUMP.depth * layout.legs.hip, 'crouches before launch');
  const after = run.filter(r => r.t > t0 + T + .3);
  assert.ok(after.every(r => [...r.pose.legs, ...r.pose.knees, r.pose.height].every(Number.isFinite)));
  assert.ok(after.some(r => r.pose.contacts.some(Boolean)), 'back on its feet');
});

test('pounce reaches the fore feet ahead of the shoulders before touchdown; feet never below ground', () => {
  const run = pounce(6), t0 = run.find(r => r.jumping)!.t, T = jumpSeconds();
  const late = run.filter(r => r.t - t0 > (JUMP.crouch + .9 * JUMP.flight) * T && r.t - t0 < (JUMP.crouch + JUMP.flight) * T);
  for (const r of late) { const fz = (r.pose.feet[0].z + r.pose.feet[2].z) / 2, hz = (r.pose.feet[1].z + r.pose.feet[3].z) / 2; assert.ok(hz - fz > .4, `spread ${hz - fz}`); }
  for (const r of run) r.pose.feet.forEach(f => assert.ok(f.y >= -1e-6));
});

test('gallop bounce follows Claude\'s gallopBob on the LH phase', () => {
  let z = 0; const loco = createLocomotion(layout, flat, { x: 0, z, heading: 0 }); let worst = 0, peak = 0;
  for (let t = 0; t < 4; t += DT) { z -= 8 * DT; const p = loco.update({ x: 0, z, heading: 0, speed: 8 }, DT);
    if (t > 2) { const exp = gallopBob(p.phases[1], layout.legs.hip, p.duty); worst = Math.max(worst, Math.abs(p.height - exp)); peak = Math.max(peak, p.height); } }
  assert.ok(peak > .02 * layout.legs.hip, `bounce ${peak}`); assert.ok(worst < 1e-3, `bounce error ${worst}`);
});

test('LOD radius constant picks near inside, mid outside', () => {
  assert.equal(lodAt(LOCO_LOD.nearRadius - 1), 'near'); assert.equal(lodAt(LOCO_LOD.nearRadius + 1), 'mid');
});
