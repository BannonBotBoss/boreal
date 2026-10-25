/** T-0013: hold aim to lock, calm stealth stays under notice, a leap curves onto the lock.
 *  Position metric is leapScore = 1 - minDist/startDist (closest approach of the two motion segments).
 *  Known match: a segment that passes through the prey scores 1. Known mismatch: heading frozen, prey off that line, scores under 0.95.
 *  Timing metric is lockTimingScore = 1 - |acquiredAt - dwell|/dwell. dwell 0.2 s is 6 steps of 1/30, so a correct stepper scores 1.
 *  Known timing mismatch: a lock on the first step scores 1 - |1/30 - 0.2|/0.2 = 0.833. */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stepLock, leapAim, steerLeap, huntTouch, leapScore, lockTimingScore, bodyVelocity, HUNT_LOCK, type LockState } from '../src/core/hunt';
import { perceive, notices, modulators, type Other } from '../src/core/agent';
import { HARE_AGENT } from '../src/core/species';
import { HUNT } from '../src/core/needs/diet';
import { CONTACTS } from '../src/core/contactBus';
import { assign, conflicts, defaults } from '../src/core/bindings';
import { HUNT_HOLD, carryError, decayScore, emptyBag, engageHold, friendLive, friendStrength, graspAngle, gutContentsKg, pinLayout, poseScore, preyOf, releaseHold, consumeHold, setSqueal } from '../src/core/huntHold';
import { TRANSACTIONS } from '../src/core/transactions';
import { dietOf } from '../src/core/needs/diet';
import { HARE_NEEDS, WOLF_NEEDS } from '../src/core/needs/species';
import { DELTAS } from '../src/core/deltas';
import { consumePrey, createAnimal, createWorld, releasePrey, takeEvents, tick } from '../src/core/sim';
import { HARE_BODY, HARE_PLAN, HARE_SKIN } from '../src/animals/hare';
import { createContext, friendCount, parseContext, rememberBond } from '../src/core/events';
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

describe('T-0014 hold', { concurrency: 1 }, () => {
test('pin, bite and hold are rows; one squeal; consume and release follow', () => {
  assert.equal(HARE_SKIN.neck[0].ry, HUNT_HOLD.neckRy);
  assert.equal(HARE_BODY.shoulderZ, HUNT_HOLD.shoulderZ);
  assert.equal(HARE_PLAN.track.fore, HUNT_HOLD.scapulaX);
  assert.equal(TRANSACTIONS.get('wolf', 'hare'), undefined, 'the pair without a verb is not the old single row');
  assert.equal(TRANSACTIONS.get('wolf', 'hare', 'pin')?.name, 'pin');
  assert.equal(TRANSACTIONS.get('wolf', 'hare', 'bite')?.name, 'bite');
  assert.equal(TRANSACTIONS.get('wolf', 'hare', 'hold')?.name, 'hold');
  assert.equal(TRANSACTIONS.get('wolf', 'hare', 'consume')?.name, 'consume');
  assert.equal(TRANSACTIONS.get('wolf', 'hare', 'release')?.name, 'release');
  const prey = preyOf(14, 0, -0.4);
  const wolfKey = 'wolf:t14', preyKey = prey.key;
  const bag = emptyBag();
  let squeals = 0;
  setSqueal(() => { squeals++; });
  const saved = DELTAS.log.slice();
  DELTAS.log.length = 0;
  try {
    engageHold(wolfKey, preyKey, prey, 0, bag);
    assert.equal(bag.phase, 'held');
    assert.equal(bag.squeals, 1);
    assert.equal(squeals, 1, 'the bite row plays one squeal');
    assert.equal(CONTACTS.touching(wolfKey, preyKey).length, 1);
    engageHold(wolfKey, preyKey, prey, 0.1, bag);
    assert.equal(bag.squeals, 1, 'holding again does not squeal');
    assert.equal(squeals, 1);
    const tissue = prey.massKg - gutContentsKg(prey.massKg);
    const expectMeal = dietOf(WOLF_NEEDS).meal(WOLF_NEEDS, 'hare', tissue);
    consumeHold(bag, prey, 1);
    assert.ok(bag.energy > 30 && bag.energy < 80, `energy ${bag.energy}`);
    assert.ok(Math.abs(bag.energy - expectMeal.energy) < 1e-9);
    assert.ok(Math.abs(bag.remainsKg - gutContentsKg(prey.massKg)) < 1e-9);
    assert.equal(DELTAS.log.length, 1);
    assert.equal(DELTAS.log[0].kind, 'carcass');
    assert.ok(Math.abs(DELTAS.log[0].m - bag.remainsKg) < 1e-9);
    assert.equal(CONTACTS.touching(wolfKey, preyKey).length, 0, 'eating ends the contact');
    const again = emptyBag();
    engageHold(wolfKey, preyKey, prey, 2, again);
    assert.equal(squeals, 2, 'a new catch squeals once more');
    releaseHold(again, prey, 2);
    assert.equal(again.bond?.tau, 180);
    assert.equal(again.bond?.key, preyKey);
    assert.equal(friendLive(again.bond!.at, again.bond!.at + 180), true);
    assert.equal(friendLive(again.bond!.at, again.bond!.at + 180.01), false);
    assert.equal(CONTACTS.touching(wolfKey, preyKey).length, 0);
    const ctx = rememberBond(createContext(), preyKey, { at: 2, tau: 180, species: 'hare' });
    assert.equal(friendCount(ctx), 1);
    assert.equal(friendCount(ctx, 2), 1);
    assert.equal(friendCount(ctx, 2 + 180), 1);
    assert.equal(friendCount(ctx, 2 + 181), 0);
    const loaded = parseContext(JSON.stringify(ctx));
    assert.equal(loaded.bonds?.[preyKey].tau, 180);
    const old = createContext(); delete (old as { bonds?: unknown }).bonds;
    assert.deepEqual(parseContext(JSON.stringify(old)).bonds, {});
    assert.throws(() => parseContext(JSON.stringify({ ...createContext(), bonds: { bad: { at: 0, tau: 0, species: 'hare' } } })));
  } finally {
    setSqueal(undefined);
    CONTACTS.end(wolfKey, preyKey);
    DELTAS.log.length = 0; DELTAS.log.push(...saved);
  }
});

test('a handling capture pins and a friend does not flee; an NPC still removes the prey', () => {
  const saved = DELTAS.log.slice();
  DELTAS.log.length = 0;
  const keys: [string, string][] = [];
  try {
    const w = createWorld({ handling: true, step: 1 / 30, seed: 4 });
    const wolf = createAnimal(w, 'wolf', { x: 0, z: 0, heading: 0 }, { controlled: true });
    wolf.pouncing = true; wolf.speed = 0;
    const hare = createAnimal(w, 'hare', { x: 0, z: -0.4, heading: 0 });
    keys.push([`wolf:${wolf.id}`, `hare:${hare.id}`]);
    tick(w, 1 / 30);
    const first = takeEvents(w).filter(e => e.type === 'pinned');
    assert.equal(first.length, 1);
    assert.equal(hare.alive, true);
    assert.equal(hare.heldBy, wolf.id);
    assert.equal(w.hold.squeals, 1);
    tick(w, 1 / 30);
    assert.equal(takeEvents(w).filter(e => e.type === 'pinned').length, 0);
    assert.equal(w.hold.squeals, 1);
    const bond = releasePrey(w, hare, wolf.id);
    assert.equal(bond?.species, 'hare');
    assert.equal(hare.heldBy, undefined);
    assert.equal(hare.friendOf, wolf.id);
    wolf.pouncing = false; wolf.speed = 4; wolf.crouched = false; wolf.x = 0; wolf.z = 0;
    hare.x = 0; hare.z = -3;
    for (let i = 0; i < 20; i++) tick(w, 0.05);
    assert.equal(takeEvents(w).filter(e => e.type === 'bolt').length, 0, 'a live friend does not bolt');
    assert.notEqual(hare.state, 'flee');
    hare.friendAt = w.time - HUNT_HOLD.friendTau - 1;
    hare.x = 0; hare.z = -3; wolf.x = 0; wolf.z = 0; wolf.speed = 4; wolf.crouched = false; wolf.pouncing = false;
    tick(w, 0.05);
    const after = takeEvents(w);
    assert.ok(after.some(e => e.type === 'bolt') || hare.state === 'flee', 'the memory resets and flight returns');
    const npc = createWorld({ handling: true, step: 0.05, seed: 5 });
    const hunter = createAnimal(npc, 'wolf', { x: 0, z: 0 });
    hunter.pouncing = true;
    const prey = createAnimal(npc, 'hare', { x: 0, z: -0.3 });
    tick(npc, 0.05);
    assert.equal(prey.alive, false, 'an NPC capture still removes the prey');
    assert.ok(takeEvents(npc).some(e => e.type === 'caught'));
    const meal = createWorld({ handling: true, step: 1 / 30, seed: 6 });
    const eater = createAnimal(meal, 'wolf', { x: 0, z: 0, heading: 0 }, { controlled: true });
    eater.pouncing = true;
    const food = createAnimal(meal, 'hare', { x: 0, z: -0.4 });
    keys.push([`wolf:${eater.id}`, `hare:${food.id}`]);
    tick(meal, 1 / 30); takeEvents(meal);
    const eaten = consumePrey(meal, food, eater.id);
    assert.ok(eaten.energy > 30 && eaten.energy < 80, `sim energy ${eaten.energy}`);
    assert.equal(food.alive, false);
    assert.ok(eaten.remainsKg > 0.1 && eaten.remainsKg < 0.2, `gut ${eaten.remainsKg}`);
  } finally {
    for (const [a, b] of keys) CONTACTS.end(a, b);
    DELTAS.log.length = 0; DELTAS.log.push(...saved);
  }
});
});

test('pin and carry scores are calibrated; the jaw stays inside the gape; eat and release do not collide', () => {
  const pin = pinLayout(0);
  const carryMatch = poseScore(carryError({ x: 0, z: 0, heading: 0 }, true));
  const carryMiss = poseScore(carryError({ x: 0, z: 0, heading: 0 }, false));
  const tau = HUNT_HOLD.friendTau;
  const expected = Math.exp(-0.5);
  const decayMatch = decayScore(friendStrength(0, tau / 2), expected);
  const decayMiss = decayScore(1 - 0.5, expected);
  const jaw = graspAngle();
  console.log(`T-0014 pinScore ${pin.pinScore.toFixed(6)} dist ${pin.pawToScapula.toFixed(4)} reach ${pin.reach.toFixed(4)} stand ${pin.standScore.toFixed(6)} err ${pin.standError.toFixed(4)}`);
  console.log(`T-0014 carryScore ${carryMatch.toFixed(6)} ground ${carryMiss.toFixed(6)} groundErr ${carryError({ x: 0, z: 0, heading: 0 }, false).toFixed(4)} decay ${decayMatch.toFixed(6)} linear ${decayMiss.toFixed(6)}`);
  console.log(`T-0014 grasp ${(jaw.rad * 180 / Math.PI).toFixed(2)} deg gape ${(jaw.gape * 180 / Math.PI).toFixed(2)} deg jaw ${jaw.jawLen.toFixed(3)} m`);
  assert.ok(pin.pinScore >= 0.95, `pin ${pin.pinScore}`);
  assert.ok(pin.standScore < 0.95, `standing paws are the known mismatch (${pin.standScore})`);
  assert.ok(carryMatch >= 0.95, `carry ${carryMatch}`);
  assert.ok(carryMiss < 0.95, `a hare left on the ground is the known mismatch (${carryMiss})`);
  assert.ok(decayMatch >= 0.95, `exp decay ${decayMatch}`);
  assert.ok(decayMiss < 0.95, `linear fade is the known mismatch (${decayMiss})`);
  assert.ok(jaw.rad < jaw.gape, `grasp ${jaw.rad} gape ${jaw.gape}`);
  assert.deepEqual(defaults().eatPrey, { keys: ['k:x'], pad: [] });
  assert.deepEqual(defaults().releasePrey, { keys: ['k:b'], pad: [] });
  assert.deepEqual(conflicts(defaults()), []);
});
