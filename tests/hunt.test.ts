/** T-0013: hold aim to lock, calm stealth stays under notice, a leap curves onto the lock.
 *  Position metric is leapScore = 1 - minDist/startDist (closest approach of the two motion segments).
 *  Known match: a segment that passes through the prey scores 1. Known mismatch: heading frozen, prey off that line, scores under 0.95.
 *  Timing metric is lockTimingScore = 1 - |acquiredAt - dwell|/dwell. dwell 0.2 s is 6 steps of 1/30, so a correct stepper scores 1.
 *  Known timing mismatch: a lock on the first step scores 1 - |1/30 - 0.2|/0.2 = 0.833. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stepLock, leapAim, steerLeap, huntTouch, leapScore, lockTimingScore, bodyVelocity, HUNT_LOCK, type LockState } from '../src/core/hunt';
import { perceive, notices, modulators, type Other } from '../src/core/agent';
import { HARE_AGENT } from '../src/core/species';
import { HUNT } from '../src/core/needs/diet';
import { CONTACTS } from '../src/core/contactBus';
import { assign, conflicts, defaults } from '../src/core/bindings';
import { lockPoint, HALO } from '../src/core/senseBeacons';
import { PHYS } from '../src/core/tuning';
import { createSensesHalo } from '../src/render/sensesHalo';

const dt = 1 / 30;
const self = { x: 0, z: 0 };
const ahead = (key: string, x = 0, z = -8): Other & { key: string } => ({ key, x, z, kind: 'hare', speed: 0 });
const holdUntil = (aiming: boolean, view: number, prey: { key: string; x: number; z: number }[], steps: number, start: LockState = { hold: 0 }) => {
  let s = start;
  for (let i = 0; i < steps; i++) s = stepLock(s, aiming, view, self, prey, dt);
  return s;
};

test('lock waits out the dwell, stays on that body, and drops when aim leaves or the button is up', () => {
  const a = ahead('a'), b = ahead('b', 0.4, -8);
  assert.equal(HUNT_LOCK.dwell, 0.2);
  assert.equal(holdUntil(false, 0, [a], 30).key, undefined, 'no lock without the aim button');
  assert.equal(holdUntil(true, 0, [a], 5).key, undefined, 'not before the dwell');
  const locked = holdUntil(true, 0, [a], 6);
  assert.equal(locked.key, 'a');
  const acquiredAt = 6 * dt;
  const timing = lockTimingScore(acquiredAt);
  console.log(`T-0013 lockTimingScore ${timing.toFixed(6)} acquiredAt ${acquiredAt}`);
  assert.ok(timing >= 0.95, `timing ${timing}`);
  assert.ok(lockTimingScore(dt) < 0.95, 'a first-step lock is the known timing mismatch');
  assert.equal(stepLock(locked, true, 0, self, [a, b], dt).key, 'a', 'a second prey does not steal a held lock');
  assert.equal(stepLock(locked, true, Math.PI / 2, self, [a], dt).key, undefined, 'aim leaving the cone drops it');
  assert.deepEqual(stepLock(locked, false, 0, self, [a], dt), { hold: 0 }, 'releasing the button drops it');
  const wide = ahead('w', Math.sin(31 * Math.PI / 180) * 10, -Math.cos(31 * Math.PI / 180) * 10);
  assert.equal(holdUntil(true, 0, [wide], 30).key, undefined, 'outside the 30° half-angle');
  assert.equal(holdUntil(true, 0, [ahead('far', 0, -31)], 30).key, undefined, 'past the 30 m radius');
  assert.equal(holdUntil(true, 0, [ahead('near', 0, -29)], 6).key, 'near');
});

test('a calm hare misses super-stealth and notices a walk; cover kills sight; night and nerves move the threshold', () => {
  const wolf = (speed: number, extra: Partial<Other> = {}): Other => ({ key: 'p', kind: 'wolf', x: 0, z: 10, speed, crouched: speed < 1, ...extra });
  const downwind = { x: 0, z: 1 }; // plume blows +z, away from the hare at the origin
  const calm = { r: 100, e: 90, s: 100 };
  const creep = perceive(HARE_AGENT, self, wolf(.35), downwind, 1);
  const walk = perceive(HARE_AGENT, self, wolf(2, { crouched: false }), downwind, 1);
  const run = perceive(HARE_AGENT, self, wolf(4, { crouched: false }), downwind, 1);
  assert.equal(notices(HARE_AGENT, creep, calm.r, calm.e, calm.s), false, `creep ${creep.level}`);
  assert.equal(notices(HARE_AGENT, walk, calm.r, calm.e, calm.s), true, `walk ${walk.level}`);
  assert.equal(notices(HARE_AGENT, run, calm.r, calm.e, calm.s), true, `run ${run.level}`);
  const near = perceive(HARE_AGENT, self, { ...wolf(.35), z: 8 }, downwind, 1);
  assert.equal(notices(HARE_AGENT, near, calm.r, calm.e, calm.s), false, `8 m creep ${near.level}`);
  const covered = perceive(HARE_AGENT, self, wolf(2, { crouched: false, cover: 1 }), downwind, 1);
  assert.equal(covered.sight, 0, 'full canopy closure removes sight');
  assert.ok(covered.sound === walk.sound && covered.scent === walk.scent, 'cover does not mute sound or scent');
  const bare = perceive(HARE_AGENT, self, wolf(2, { crouched: false }), downwind, 1);
  const open = perceive(HARE_AGENT, self, wolf(2, { crouched: false, cover: 0 }), downwind, 1);
  assert.equal(open.level, bare.level, 'cover 0 leaves the old percept');
  const night = perceive(HARE_AGENT, self, wolf(2, { crouched: false }), downwind, 0);
  assert.ok(night.sight < walk.sight, 'night lowers sight');
  const nervous = modulators({ species: HARE_AGENT, relaxation: 20, energy: 90, stamina: 100 });
  const settled = modulators({ species: HARE_AGENT, relaxation: 100, energy: 90, stamina: 100 });
  assert.ok(nervous.noticeAt < settled.noticeAt, 'a nervous hare notices a weaker cue');
});

/** Closest approach of two segments (Ericson). A point on the wolf's step against a point on the prey's step. */
function segDist(a0: { x: number; z: number }, a1: { x: number; z: number }, b0: { x: number; z: number }, b1: { x: number; z: number }) {
  const d1x = a1.x - a0.x, d1z = a1.z - a0.z, d2x = b1.x - b0.x, d2z = b1.z - b0.z;
  const rx = a0.x - b0.x, rz = a0.z - b0.z;
  const a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z, f = d2x * rx + d2z * rz, EPS = 1e-12;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let s: number, t: number;
  if (a <= EPS && e <= EPS) { s = t = 0; }
  else if (a <= EPS) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1z * rz;
    if (e <= EPS) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1z * d2z, denom = a * e - b * b;
      s = denom > EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  return Math.hypot(a0.x + d1x * s - (b0.x + d2x * t), a0.z + d1z * s - (b0.z + d2z * t));
}

function runLeap(prey: { key: string; x: number; z: number; heading?: number; speed?: number }, steer: boolean) {
  const speed = 8;
  let x = 0, z = 0, heading = 0, jumpTime = 0;
  let state: LockState = { hold: 0 };
  for (let i = 0; i < 6; i++) state = stepLock(state, true, 0, self, [prey], dt);
  const startDist = Math.hypot(prey.x, prey.z);
  let minD = startDist, px = prey.x, pz = prey.z, heldAtClosest = state.key === prey.key;
  const { vx, vz } = bodyVelocity(prey);
  while (jumpTime < PHYS.jumpSeconds - 1e-9) {
    jumpTime += dt;
    const body = { ...prey, x: px, z: pz };
    state = stepLock(state, true, heading, { x, z }, [body], dt);
    if (steer && state.key === prey.key) {
      const aim = leapAim({ x, z }, body, speed, Math.max(0, PHYS.jumpSeconds - jumpTime));
      heading = steerLeap(heading, { x, z }, aim, speed, dt);
    }
    const nx = x - Math.sin(heading) * speed * dt, nz = z - Math.cos(heading) * speed * dt;
    const npx = px + vx * dt, npz = pz + vz * dt;
    const d = segDist({ x, z }, { x: nx, z: nz }, { x: px, z: pz }, { x: npx, z: npz });
    if (d <= minD) { minD = d; heldAtClosest = state.key === prey.key; }
    x = nx; z = nz; px = npx; pz = npz;
  }
  return { minD, startDist, score: leapScore(minD, startDist), heldAtClosest };
}

test('the leap reaches a stationary offset and a moving prey; a frozen heading misses', () => {
  const through = segDist({ x: 0, z: 0 }, { x: 0, z: -4 }, { x: 0, z: -2 }, { x: 0, z: -2 });
  assert.ok(through < 1e-6, 'known match: the segment passes through the prey');
  assert.ok(leapScore(through, 4) >= 0.95);
  const still = { key: 'hare:1', x: 2, z: -4 };
  const steered = runLeap(still, true);
  const frozen = runLeap(still, false);
  const moving = runLeap({ key: 'hare:2', x: 1.6, z: -6, heading: -Math.PI / 2, speed: 1.4 }, true);
  console.log(`T-0013 leapScore steered ${steered.score.toFixed(6)} min ${steered.minD.toFixed(4)} frozen ${frozen.score.toFixed(6)} moving ${moving.score.toFixed(6)} min ${moving.minD.toFixed(4)}`);
  assert.ok(steered.score >= 0.95, `steered ${steered.score} dist ${steered.minD}`);
  assert.ok(frozen.score < 0.95, `frozen heading is the known mismatch (${frozen.score})`);
  assert.equal(steered.heldAtClosest, true, 'the lock is still on at the closest approach');
  assert.ok(moving.score >= 0.95, `moving ${moving.score} dist ${moving.minD}`);
  assert.equal(moving.heldAtClosest, true);
});

test('a hunt contact begins only inside the pounce reach, and only on the rising edge', () => {
  assert.equal(huntTouch('player', 'hare:1', self, { x: 0, z: -(HUNT.catchPounce + .05) }), undefined);
  const c = huntTouch('player', 'hare:1', self, { x: 0, z: -(HUNT.catchPounce - .05) });
  assert.equal(c?.kind, 'hunt'); assert.equal(c?.source, 'hunt:leap');
  try {
    assert.equal(CONTACTS.begin(c!), true);
    assert.equal(CONTACTS.begin(c!), false, 'already touching');
    assert.equal(CONTACTS.touching('player', 'hare:1').length, 1);
  } finally { CONTACTS.end('player', 'hare:1'); }
  assert.equal(CONTACTS.touching('player', 'hare:1').length, 0);
});

test('the lock binding defaults to Q / RB and can be rebound without a conflict', () => {
  assert.deepEqual(defaults().lock, { keys: ['k:q'], pad: ['rb'] });
  const next = assign(defaults(), 'lock', ['k:z']);
  assert.deepEqual(next.lock.keys, ['k:z']);
  assert.deepEqual(conflicts(defaults()), []);
});

test('the lock pip sits on the forward bearing and stays up when the cue ring hides', () => {
  const p = lockPoint({ x: 0, z: -5 }, self, 0);
  assert.ok(Math.abs(p.bearing) < 1e-9, `bearing ${p.bearing}`);
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.z + HALO.radius) < 1e-9, `ring point ${p.x},${p.z}`);
  const scene = new THREE.Scene(), halo = createSensesHalo(scene), wolf = new THREE.Object3D();
  wolf.position.set(0, 1, 0);
  const root = () => scene.getObjectByName('senses-halo')!;
  const pip = () => root().children.find(c => (c as THREE.Mesh).geometry instanceof THREE.CircleGeometry)!;
  halo.update(wolf, 0, 0, [], [], true, { x: p.x, z: p.z });
  assert.equal(root().visible, true); assert.equal(pip().visible, true);
  assert.equal(root().children[0].visible, false, 'focus-hide drops the ring, not the pip');
  halo.update(wolf, 0, 0, [], [], true, null);
  assert.equal(root().visible, false, 'no lock and a hidden ring: nothing drawn');
  halo.update(wolf, 0, 0, [], [], false, { x: 0, z: -HALO.radius });
  for (let i = 1; i <= 12; i++) { wolf.position.set(i * .5, 1, 0); halo.update(wolf, i * .05, 0, [], [], false, { x: 0, z: -HALO.radius }); }
  assert.equal(root().visible, true, 'a fast leap fades the ring and keeps the pip');
  assert.equal(pip().visible, true);
  assert.equal(root().children[0].visible, false);
});
