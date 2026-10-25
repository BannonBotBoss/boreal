import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactBus } from '../src/core/contactBus';
import { WOLF_LEGS } from '../src/core/animalBehavior';
import { LEG_XZ } from '../src/core/wolfBody';
import { WOLF_SCALE } from '../src/core/wolfModes';
import { HARE_BODY } from '../src/animals/hare';
import {
  WAVE, LAMBDA, WAKE_GLSL, WATERLINE, DEER_HIP_XZ, HARE_HIP_XZ, createWake, crestAmp, dispersion, fitDisturbance,
  hipsFor, hullFroude, projectTop, ringAt, unprojectTop, wakeHalfAngle, wakeHalfAngleDeg, wakeScore, type SampleFn,
} from '../src/core/waterWake';

const wetIfPositive: SampleFn = x => x > 0 ? { ground: -1, water: 0 } : { ground: 2 };
const hips = [[0, 0], [0.1, 0.2], [-0.1, 0.2], [0.1, -0.2]] as const;
function timed(over: Record<string, unknown> = {}) {
  return {
    id: 'paw', x: 2, z: 0, heading: 0, motion: 'walk' as const, speed: 1, t: 0, mass: 1, length: 1.325,
    hips, pawArea: 0.01, sample: wetIfPositive, phase: 0, prevPhase: 0, offsets: [0.25, 0, 0.75, 0.5], duty: 0.65, stride: 1,
    ...over,
  };
}

test('dispersion at 10 cm sits in the task bands, and the capillary minimum is near 0.23 m/s', () => {
  assert.ok(WAVE.c >= 0.30 && WAVE.c <= 0.69, `phase speed ${WAVE.c}`);
  assert.ok(WAVE.cg >= 0.18 && WAVE.cg <= 0.35, `group speed ${WAVE.cg}`);
  assert.ok(Math.abs(WAVE.kelvin - Math.asin(1 / 3)) < 1e-12);
  assert.equal(WAVE.k, dispersion(LAMBDA).k);
  let minC = Infinity, minL = 0;
  for (let lam = 0.005; lam <= 0.05; lam += 0.0005) {
    const c = dispersion(lam).c;
    if (c < minC) { minC = c; minL = lam; }
  }
  assert.ok(minC > 0.20 && minC < 0.26, `minimum ${minC} m/s`);
  assert.ok(minL > 0.012 && minL < 0.025, `wavelength ${minL} m`);
});

test('a slow hull keeps the Kelvin angle; the wolf at the game walk speed stays inside 19.5 ± 2 deg', () => {
  assert.equal(wakeHalfAngle(0.48), WAVE.kelvin);
  const fr = hullFroude(2, WATERLINE.wolf);
  const deg = wakeHalfAngleDeg(fr);
  assert.ok(fr > 0.5, `walk Froude ${fr} uses the narrowed branch`);
  assert.ok(Math.abs(deg - 19.47) <= 2, `predicted half-angle ${deg.toFixed(2)} deg at Fr ${fr.toFixed(3)}`);
});

test('the ring envelope peaks on the group-speed radius and a crest moves at the phase speed', () => {
  const ring = { x: 0, z: 0, t0: 0, amp: 1 };
  const age = 20;
  let best = 0, bestE = -1;
  for (let r = 0.05; r < WAVE.cg * age * 1.6; r += 0.01) {
    const s = Math.sin(WAVE.k * (r - WAVE.c * age));
    if (Math.abs(s) < 0.5) continue;
    const e = Math.abs(ringAt(r, 0, age, ring).h / s);
    if (e > bestE) { bestE = e; best = r; }
  }
  assert.ok(Math.abs(best - WAVE.cg * age) / (WAVE.cg * age) < 0.02, `envelope radius ${best}`);
  const crest = (a: number) => {
    const r0 = WAVE.c * a + LAMBDA / 4;
    let rBest = r0, hBest = -Infinity;
    for (let r = r0 - LAMBDA; r <= r0 + LAMBDA; r += 0.002) {
      const h = ringAt(r, 0, a, ring).h;
      if (h > hBest) { hBest = h; rBest = r; }
    }
    return rBest;
  };
  const speed = (crest(4) - crest(2)) / 2;
  assert.ok(Math.abs(speed - WAVE.c) / WAVE.c < 0.02, `crest speed ${speed}`);
});

test('one wet touchdown emits one ring; a dry body emits none; the buffer keeps eight', () => {
  const bus = createContactBus(), wake = createWake(bus);
  wake.noteTimed(timed({ prevPhase: 0.9, phase: 1.1, t: 1 }));
  assert.equal(wake.debug().rings.length, 1);
  const dry = createWake(createContactBus());
  dry.noteTimed(timed({ x: -4, prevPhase: 0.9, phase: 1.1, t: 1 }));
  assert.equal(dry.debug().rings.length, 0);
  const many = createWake(createContactBus());
  for (let i = 0; i < 10; i++) many.noteTimed(timed({ prevPhase: i, phase: i + 1, t: i, offsets: [0, 0, 0, 0] }));
  const kept = many.debug().rings;
  assert.equal(kept.length, 8);
  assert.ok(kept.every(r => r.t0 >= 8), `oldest kept t0 ${kept[0].t0}`);
});

test('water contact begins on a wet sole, holds through the stride delay, and ends after it', () => {
  const bus = createContactBus(), wake = createWake(bus);
  const id = 'paw';
  const on = () => bus.touching(`wake:${id}`, 'water').length;
  wake.noteTimed(timed({ t: 0, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 1);
  wake.noteTimed(timed({ t: 0.5, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 1);
  wake.noteTimed(timed({ t: 1, x: -4, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 1);
  wake.noteTimed(timed({ t: 1.9, x: -4, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 1);
  wake.noteTimed(timed({ t: 2.05, x: -4, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 0);
  wake.noteTimed(timed({ t: 3, phase: 0.2, prevPhase: 0.2 }));
  wake.noteTimed(timed({ t: 3.2, x: -4, phase: 0.2, prevPhase: 0.2 }));
  wake.noteTimed(timed({ t: 3.5, phase: 0.2, prevPhase: 0.2 }));
  wake.noteTimed(timed({ t: 4.0, x: -4, phase: 0.2, prevPhase: 0.2 }));
  wake.noteTimed(timed({ t: 4.3, x: -4, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 1, 're-wetting cancels the old deadline');
  wake.noteTimed(timed({ t: 5.05, x: -4, phase: 0.2, prevPhase: 0.2 }));
  assert.equal(on(), 0);
});

test('the wake ridge is the predicted half-angle, and a stopped wake falls to 1/e after one body-length of group travel', () => {
  const wake = createWake(createContactBus());
  const length = 1.325, speed = 2;
  wake.noteTimed(timed({ t: 5, x: 0, z: 0, speed, length, phase: 0.2, prevPhase: 0.2 }));
  const fr = hullFroude(speed, length), ang = wakeHalfAngle(fr);
  const lamW = Math.max(0.4, 2 * Math.PI * speed * speed / WAVE.g);
  const behind = lamW / 4;
  let best = 0, bestH = -1;
  for (let deg = 0; deg <= 40; deg += 0.25) {
    const a = deg * Math.PI / 180;
    const h = Math.abs(wake.field(Math.tan(a) * behind, behind, 5));
    if (h > bestH) { bestH = h; best = deg; }
  }
  assert.ok(Math.abs(best - ang * 180 / Math.PI) < 0.5, `ridge ${best} deg, predicted ${(ang * 180 / Math.PI).toFixed(2)}`);
  const lateral = Math.tan(ang) * behind;
  const moving = wake.field(lateral, behind, 5);
  const stoppedAt = 5 + length / WAVE.cg;
  wake.noteTimed(timed({ t: 5, x: 0, z: 0, speed: 0, motion: 'idle', length, phase: 0.2, prevPhase: 0.2 }));
  const faded = wake.field(lateral, behind, stoppedAt);
  assert.ok(Math.abs(moving) > 1e-6, 'the moving crest is measurable');
  assert.ok(Math.abs(faded / moving - Math.exp(-1)) < 1e-6, `fade ratio ${faded / moving}`);
});

test('a small paw raises a crest below the steepness cap, and a heavier paw raises a taller one', () => {
  const light = crestAmp(0.002, 4, 0.05, 0.01);
  const heavy = crestAmp(0.008, 4, 0.05, 0.01);
  assert.equal(crestAmp(1, 4, 0, 0.01), 0);
  assert.ok(light > 0 && light < WAVE.cap);
  assert.ok(heavy > light && heavy < WAVE.cap);
  assert.equal(crestAmp(80, 4, 2, 0.01), WAVE.cap);
});

test('snapshot restore puts the rings and the water contact back', () => {
  const bus = createContactBus(), wake = createWake(bus);
  wake.noteTimed(timed({ t: 1, prevPhase: 0.9, phase: 1.1 }));
  const shot = wake.capture();
  wake.reset();
  assert.equal(wake.debug().rings.length, 0);
  assert.equal(bus.touching('wake:paw', 'water').length, 0);
  wake.restore(shot);
  assert.equal(wake.debug().rings.length, shot.rings.length);
  assert.equal(bus.touching('wake:paw', 'water').length, 1);
});

test('top-down projection round-trips, and the fitter scores a known match above 95% and a known mismatch below 0.7', () => {
  const cam = { x: 3, z: -2, heading: 0.7, h: 6, fovDeg: 40, y: -0.25 };
  const p = { x: 3.4, z: -1.2 };
  const s = projectTop(p, cam, 800, 600);
  const back = unprojectTop(s.x, s.y, cam, 800, 600);
  assert.ok(Math.hypot(back.x - p.x, back.z - p.z) < 1e-6);
  const origin = { x: 10, z: -4 }, heading = 0.4, radius = 0.4;
  const fr = hullFroude(2, WATERLINE.wolf), angleDeg = wakeHalfAngleDeg(fr);
  const place = (behind: number, lateral: number) => {
    const fx = -Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
    return { x: origin.x - behind * fx + lateral * rx, z: origin.z - behind * fz + lateral * rz };
  };
  const ring: { x: number; z: number }[] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    ring.push({ x: origin.x + Math.cos(a) * radius, z: origin.z + Math.sin(a) * radius });
  }
  const arms: { x: number; z: number }[] = [];
  for (let behind = 1.5; behind <= 4; behind += 0.15) {
    const lat = Math.tan(angleDeg * Math.PI / 180) * behind;
    arms.push(place(behind, lat), place(behind, -lat));
  }
  const fit = fitDisturbance([...ring, ...arms], origin, heading);
  const score = wakeScore(fit, { radius, angleDeg });
  assert.ok(score.score >= 0.95, `known match ${score.score} (angle ${fit.angleDeg}, radius ${fit.radius})`);
  const badR = radius * 2, badA = 40;
  const wrong = [...ring.map(p => ({ x: origin.x + (p.x - origin.x) * 2, z: origin.z + (p.z - origin.z) * 2 }))];
  for (let behind = 1.5; behind <= 4; behind += 0.15) {
    const lat = Math.tan(badA * Math.PI / 180) * behind;
    wrong.push(place(behind, lat), place(behind, -lat));
  }
  const bad = wakeScore(fitDisturbance(wrong, origin, heading), { radius, angleDeg });
  assert.ok(bad.score < 0.7, `known mismatch ${bad.score}`);
});

test('the shader bakes the group speed and one ring uniform block', () => {
  assert.ok(WAKE_GLSL.includes(WAVE.cg.toFixed(6)), WAKE_GLSL.slice(0, 280));
  assert.match(WAKE_GLSL, /uRings\[8\]/);
  assert.match(WAKE_GLSL, /uWakeA\[8\]/);
  assert.match(WAKE_GLSL, /uWakeB\[8\]/);
});

test('wolf, deer and hare waterlines are the published length or the rig span', () => {
  const wolf = hipsFor('wolf', WOLF_SCALE, WOLF_SCALE);
  assert.equal(wolf[0][0], LEG_XZ[0][0] * WOLF_SCALE);
  assert.equal(wolf[0][1], LEG_XZ[0][1] * WOLF_SCALE);
  assert.equal(WATERLINE.deer, DEER_HIP_XZ[1][1] - DEER_HIP_XZ[0][1]);
  assert.equal(HARE_HIP_XZ[0][1], HARE_BODY.shoulderZ);
  assert.equal(HARE_HIP_XZ[1][1], HARE_BODY.hipZ);
  assert.equal(WATERLINE.hare, (0.361 + 0.479) / 2);
});

test('sampling the field stays inside the CPU budget', () => {
  const wake = createWake(createContactBus());
  for (let i = 0; i < 8; i++) wake.noteTimed(timed({ prevPhase: i, phase: i + 1, t: i, x: 2, speed: 2, offsets: [0, 0, 0, 0] }));
  const t0 = performance.now();
  let h = 0;
  for (let i = 0; i < 2000; i++) h += wake.field(i * 0.01, i * 0.013, 4);
  const ms = performance.now() - t0;
  assert.ok(Number.isFinite(h));
  assert.ok(ms < 100, `${ms.toFixed(2)} ms for 2000 samples`);
});

test('the player gait path raises a ring from a wolf footfall in water', () => {
  const wake = createWake(createContactBus());
  wake.noteGait({
    id: 'player', x: 3, z: 1, heading: 0.2, motion: 'walk', speed: 1.2, t: 2, mass: 30, length: WATERLINE.wolf,
    hips: hipsFor('wolf', WOLF_SCALE, WOLF_SCALE), pawArea: 0.01, sample: wetIfPositive, phase: 1, prevPhase: 0,
    legs: WOLF_LEGS,
  });
  assert.ok(wake.debug().rings.length >= 1);
  assert.equal(wake.debug().wakes.length, 1);
});
