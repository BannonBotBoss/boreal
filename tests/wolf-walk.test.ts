import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimalBrain, footTarget, gaitFor, touchdownsBetween, WOLF_LEGS, type Motion } from '../src/core/animalBehavior';
import { cadence } from '../src/core/gaitData';
import { drawBetween, DRAW_SNAP } from '../src/core/drawLerp';
import { PAW, pawGate, pawSound } from '../src/audio/footsteps';

const wolf = () => { const b = new AnimalBrain(1); b.legs = WOLF_LEGS; return b; };

test('gait phase follows the distance travelled, not ground cost (closes the T-0002 raw-distance item); cost only drains energy', () => {
  for (const [motion, speed] of [['walk', .8], ['walk', 2], ['run', 6]] as [Motion, number][]) {
    const hard = wolf(), soft = wolf(); hard.motion = soft.motion = motion;
    for (let k = 0; k < 90; k++) { hard.expend(1 / 30, speed / 30, 1); soft.expend(1 / 30, speed / 30, 1.5); }
    assert.ok(Math.abs(hard.phase - soft.phase) < 1e-12, `${motion}@${speed}: phase`);
    assert.ok(Math.abs(soft.gaitSpeed - speed) < 1e-9, `${motion}@${speed}: gait speed is the real speed`);
    assert.ok(soft.energy < hard.energy, `${motion}@${speed}: soft ground costs more energy`);
    // cadence = the measured canid curve at the real speed (3 s of steps)
    assert.ok(Math.abs(soft.phase / 3 - cadence(speed, WOLF_LEGS.hip)) < .02, `${motion}@${speed}: ${soft.phase / 3} Hz`);
  }
});

test('planted paws do not slide on soft ground: a stance foot moves back exactly as far as the body moves', () => {
  for (const [motion, speed] of [['walk', .8], ['walk', 2], ['run', 6]] as [Motion, number][]) {
    const b = wolf(); b.motion = motion; b.expend(1 / 30, speed / 30, 1.6); // settle the gait
    const g = gaitFor(motion, speed, WOLF_LEGS, b.gaitName)!; let checked = 0;
    for (let leg = 0; leg < 4; leg++) {
      const before = footTarget(g, motion, b.phase, leg); if (before.y !== 0) continue; // swing leg
      const p0 = b.phase; b.expend(1 / 240, speed / 240, 1.6); const after = footTarget(g, motion, b.phase, leg); b.phase = p0;
      if (after.y !== 0) continue; // lifted off in between
      assert.ok(Math.abs((after.z - before.z) - speed / 240) < 1e-9, `${motion}@${speed} leg ${leg} slid ${(after.z - before.z) - speed / 240}`); checked++;
    }
    assert.ok(checked > 0, `${motion}@${speed}: no stance leg checked`);
  }
});

test('render interpolation: the drawn wolf moves every display frame at a steady pace between 30 Hz sim steps', () => {
  for (const hz of [60, 144, 165]) {
    let acc = 0, x = 0, from: { x: number; z: number; yaw: number; sim: number } | undefined, sim = 0; const drawn: number[] = [];
    const v = 2, frame = 1 / hz;
    for (let f = 0; f < hz * 2; f++) {
      acc += frame; while (acc >= 1 / 30) { from = { x, z: 0, yaw: 0, sim }; x += v / 30; sim += 1 / 30; acc -= 1 / 30; }
      drawn.push(drawBetween(from, { x, z: 0, yaw: 0, sim }, acc * 30).x);
    }
    const steps = drawn.slice(hz).map((d, i) => d - drawn[hz + i - 1]);
    assert.ok(steps.every(s => s > 0), `${hz} Hz: a frame repeated`);
    assert.ok(steps.every(s => Math.abs(s - v * frame) < 1e-9), `${hz} Hz: uneven step`);
  }
  const mid = drawBetween({ x: 0, z: 0, yaw: Math.PI - .1, sim: 0 }, { x: 1, z: 0, yaw: -Math.PI + .1, sim: 1 }, .5);
  assert.ok(Math.abs(mid.x - .5) < 1e-12 && Math.abs(Math.abs(mid.yaw) - Math.PI) < 1e-9, 'yaw takes the short way round');
  assert.equal(drawBetween({ x: 0, z: 0, yaw: 0, sim: 0 }, { x: DRAW_SNAP + 1, z: 0, yaw: 0, sim: 1 }, .3).x, DRAW_SNAP + 1, 'teleports snap');
  assert.equal(drawBetween(undefined, { x: 3, z: 0, yaw: 0, sim: 1 }, .3).alpha, 1);
  const b = wolf(); b.motion = 'walk'; b.expend(1 / 30, 2 / 30); b.drawAlpha = .5;
  assert.ok(Math.abs(b.drawPhase - (b.prevPhase + b.phase) / 2) < 1e-12 && b.drawPhase > b.prevPhase, 'legs drawn between steps too');
});

test('touchdowns from the gait phase: every leg once per stride, trot pairs together, spans capped at one stride', () => {
  for (const [motion, speed] of [['walk', .8], ['walk', 2], ['run', 6]] as [Motion, number][]) {
    const g = gaitFor(motion, speed, WOLF_LEGS)!, seen: number[][] = []; let ph = .013;
    for (let k = 0; k < 600; k++) { const legs = touchdownsBetween(ph, ph + 1 / 600, g.offsets); if (legs.length) seen.push(legs); ph += 1 / 600; }
    assert.deepEqual(seen.flat().sort(), [0, 1, 2, 3], `${g.name}: each leg once`);
    if (g.name === 'trot') assert.equal(seen.length, 2, 'trot: diagonal pairs land together');
    if (g.name === 'walk') assert.equal(seen.length, 4, 'walk: four separate footfalls');
  }
  assert.deepEqual(touchdownsBetween(.2, 3.7, [0, .5, .5, 0]).sort(), [0, 1, 2, 3]);
  assert.deepEqual(touchdownsBetween(.5, .5, [0, .5, .5, 0]), []);
});

test('footsteps: rate tied to footfalls with a cooldown, varied pitch and level, never a fixed tick', () => {
  let s = 7; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const [motion, speed, perStride] of [['walk', 2, 2], ['run', 6, 2], ['walk', .8, 4]] as [Motion, number, number][]) {
    const b = wolf(); b.motion = motion; const gate = { last: -1e9 }, played: { t: number; rate: number; level: number }[] = [];
    let t = 0, prev = 0;
    for (let f = 0; f < 60 * 6; f++) { // 6 s at 60 fps, sim steps at 30 Hz like main.ts
      t += 1 / 60; if (f % 2 === 0) { prev = b.phase; b.expend(1 / 30, speed / 30, 1.4); }
      const g = gaitFor(motion, b.gaitSpeed, WOLF_LEGS, b.gaitName)!, legs = f % 2 === 0 ? touchdownsBetween(prev, b.phase, g.offsets) : [];
      if (legs.length && pawGate(gate, t)) played.push({ t, ...pawSound(legs, .5, rng) });
    }
    const hz = cadence(speed, WOLF_LEGS.hip), rate = played.length / 6;
    assert.ok(Math.abs(rate - perStride * hz) <= 1, `${motion}@${speed}: ${rate.toFixed(2)}/s vs ${perStride} x ${hz.toFixed(2)} Hz`);
    const gaps = played.slice(1).map((p, i) => p.t - played[i].t);
    assert.ok(gaps.every(g => g >= PAW.minGap - 1e-9), 'cooldown');
    assert.ok(new Set(played.map(p => p.rate.toFixed(3))).size > played.length / 2, 'pitch varies step to step');
    assert.ok(Math.max(...played.map(p => p.level)) - Math.min(...played.map(p => p.level)) > .05, 'level varies');
    assert.ok(played.every(p => p.rate > .9 && p.rate < 1.1), 'pitch stays natural');
  }
});
