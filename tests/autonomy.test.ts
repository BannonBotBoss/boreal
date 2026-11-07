import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AnimalBrain } from '../src/core/animalBehavior';
import { autonomousWolfStep, steerPlayerWolf, wolfReadout, wolfTrunkBlocked, type WolfSense } from '../src/core/autonomy';
import { BEHAVIOUR, WOLF_AGENT } from '../src/core/species';
import { blocksFrom, jumpHopM, jumpJPerKg, logAxis, plan, segmentDistance } from '../src/core/plan';
import { metabolicW, travelJ } from '../src/core/needs/engine';
import { WOLF_NEEDS } from '../src/core/needs/species';
import { BLOCK } from '../src/core/tuning';
import type { Entity } from '../src/core/world';
import type { WolfPose } from '../src/core/locomotion';

const ent = (kind: Entity['kind'], x: number, z: number, extra: Partial<Entity> = {}): Entity =>
  ({ key: `${kind}:${x}:${z}:${extra.seed ?? 1}`, kind, seed: extra.seed ?? 1, generatorVersion: 1, x, z, rotation: extra.rotation ?? 0, scale: extra.scale ?? 1, ...extra });
const flat: WolfSense = { walkable: () => true, massKg: 40, daylight: 1, wind: { x: 0, z: 0 } };

/** The pre-T-0010 rule: any low obstacle inside 1.8 m ahead and 0.65 m to the side was a jump, with no goal. */
function oldWouldJump(heading: number, x: number, z: number, low: boolean) {
  const ahead = -Math.sin(heading) * x - Math.cos(heading) * z;
  const side = Math.abs(Math.cos(heading) * x - Math.sin(heading) * z);
  return low && ahead > 0 && ahead < 1.8 && side < .65;
}
function sim(energy: number, seconds: number, objects: Entity[], sense: WolfSense = {}, stamina = 100, seed = 1) {
  const b = new AnimalBrain(seed); b.energy = energy;
  let pose: WolfPose = { x: 0, z: 0, heading: 0 };
  let jumps = 0;
  for (let i = 0; i < Math.round(seconds * 30); i++) {
    pose = autonomousWolfStep(b, pose, 1 / 30, stamina, objects, { ...flat, ...sense });
    if (b.motion === 'jump') jumps++;
  }
  return { b, pose, jumps, read: wolfReadout(b) };
}

test('segment distance and the log axis match the mesh yaw', () => {
  assert.ok(segmentDistance(0, 0, 0, -10, -2, -3, 2, -3) < 1e-9, 'crossing segments');
  assert.ok(Math.abs(segmentDistance(0, 0, 0, -10, 3, 0, 3, -10) - 3) < 1e-9, 'parallel');
  const g = new THREE.Group(); g.rotation.y = 0.4; g.updateMatrixWorld();
  const p = new THREE.Vector3(2.2, 0, 0).applyMatrix4(g.matrixWorld);
  const axis = logAxis(0.4);
  assert.ok(Math.abs(p.x - axis.x * 2.2) < 1e-5 && Math.abs(p.z - axis.z * 2.2) < 1e-5, 'yaw matches three.js');
});

test('travel joules are metabolic power times time, the Taylor 1982 split', () => {
  const v = 2.4, d = 10, mass = WOLF_NEEDS.body.massKg.v;
  assert.ok(Math.abs(travelJ(mass, v, d) - metabolicW(WOLF_NEEDS, v) * (d / v)) < 1e-6);
  assert.equal(WOLF_AGENT.diet.forage.eatSeconds, 60);
  assert.equal(WOLF_AGENT.timing.feed, 60);
  assert.ok(Math.abs(WOLF_AGENT.diet.forage.eatUnits / WOLF_AGENT.diet.forage.eatSeconds - 7.8 / 60) < 1e-12);
  assert.equal(BEHAVIOUR.wolf, WOLF_AGENT);
  assert.equal(WOLF_AGENT.levels.energy.fed, WOLF_NEEDS.behaviour.drives.energy.seekBelow.v);
  assert.equal(WOLF_AGENT.speed.approach, WOLF_NEEDS.behaviour.evasion.tiredSpeed.v);
});

test('with nothing sensed the wolf rests, including on a field of logs the old rule would jump', () => {
  const log = ent('log', 0, -1);
  assert.equal(oldWouldJump(0, log.x, log.z, true), true, 'calibration: the old predicate jumps this log');
  const logs = [log];
  for (let i = 0; i < 12; i++) logs.push(ent('log', (i % 4) * 3 - 4.5, -2 - Math.floor(i / 4) * 3, { rotation: i * .3, seed: i + 2 }));
  const quiet = sim(95, 4, logs);
  assert.equal(quiet.jumps, 0, 'known match: jump count 0 when nothing is sensed');
  assert.ok(Math.hypot(quiet.pose.x, quiet.pose.z) < .05, `moved ${quiet.pose.x},${quiet.pose.z}`);
  assert.equal(quiet.b.problem, 'recover');
  assert.match(quiet.read?.goal ?? '', /rest/);
  assert.match(quiet.read?.because ?? '', /nothing-sensed|energy/);
  const tired = sim(95, 2, [], {}, 10);
  assert.equal(tired.jumps, 0);
  assert.equal(tired.b.motion, 'idle');
  const empty = sim(0, 1, []);
  assert.equal(empty.b.problem, 'recover');
  assert.equal(empty.pose.x, 0); assert.equal(empty.pose.z, 0);
});

test('a hungry wolf travels to forage; the position matches the lope', () => {
  const food = ent('forage', 0, -20);
  const seconds = 4;
  const got = sim(40, seconds, [food], {}, 100, 3);
  const expectZ = -WOLF_AGENT.speed.approach * (seconds - 1 / 30);
  const score = 1 - Math.abs(got.pose.z - expectZ) / Math.abs(expectZ);
  assert.ok(score >= .95, `position score ${score.toFixed(3)} z ${got.pose.z.toFixed(2)} vs ${expectZ.toFixed(2)}`);
  assert.equal(got.jumps, 0);
  assert.match(got.read?.goal ?? '', /forage/);
  assert.ok(got.pose.z < -8);
});

test('a long log on the way is jumped only when the jump is cheaper; a short one is walked around', () => {
  const mass = 40, speed = WOLF_AGENT.speed.approach;
  const from = { x: 0, z: 0, heading: 0 };
  // Scale 1 keeps the mesh radius (0.63 m). A fatter log (scale 3) is wider than one hop at the lope, so plan() walks around it.
  const long = blocksFrom([ent('log', 0, -2.2)])[0];
  const farGoal = { x: 0, z: -6 };
  const jumpRoute = plan(from, farGoal, [long], mass, speed, () => true);
  assert.ok(jumpRoute.jumpJPerKg < jumpRoute.detourJPerKg, `jump ${jumpRoute.jumpJPerKg} detour ${jumpRoute.detourJPerKg}`);
  assert.equal(jumpRoute.motion, 'direct', 'the hop is cheaper, but the body is not in the takeoff window yet');
  assert.ok(jumpHopM(speed) > long.r * 2 + 0.15, 'one lope hop clears this log');
  const fat = blocksFrom([ent('log', 0, -2.2, { scale: 3 })])[0];
  assert.equal(plan(from, farGoal, [fat], mass, speed, () => true).motion, 'detour', 'a log wider than the hop is walked around');
  const jumped = sim(40, 3, [ent('log', 0, -2.2), ent('forage', 0, -6)], {}, 100, 4);
  assert.ok(jumped.jumps > 0, 'known match: the cheaper jump happens once the log is inside the takeoff window');
  assert.ok(Math.abs(jumped.pose.x) < 1, `jumped sideways ${jumped.pose.x}`);
  assert.ok(jumped.pose.z < -2.2 - long.r, `landed at z ${jumped.pose.z}, still short of the far bark`);
  assert.match(jumped.read?.because ?? jumped.b.problem, /jump|avoid|J\/kg|forage|rest/);

  const short = blocksFrom([ent('log', 0, -5, { scale: 1 })])[0];
  const around = plan(from, { x: 0, z: -40 }, [short], mass, speed, () => true);
  assert.ok(around.detourJPerKg < around.jumpJPerKg, `detour ${around.detourJPerKg} jump ${around.jumpJPerKg}`);
  assert.equal(around.motion, 'detour');
  // Food sits inside the approach utility (distance / 40). The plan() check above uses a farther goal so the extra metres stay small.
  const walked = sim(40, 3, [ent('log', 0, -5), ent('forage', 0, -20)], {}, 100, 5);
  assert.equal(walked.jumps, 0, 'known mismatch for the old rule, which would jump this log with no comparison');
  assert.ok(Math.abs(walked.pose.x) > .5, `did not step aside (${walked.pose.x})`);
  assert.match(walked.read?.because ?? '', /detour/);
});

test('a trunk on the path is walked around, never jumped', () => {
  const got = sim(40, 3, [ent('spruce', 0, -3), ent('forage', 0, -15)], {}, 100, 6);
  assert.equal(got.jumps, 0);
  assert.ok(Math.abs(got.pose.x) > .3, `x ${got.pose.x}`);
});

test('thirst sends the wolf toward water when the needs level is under the line', () => {
  const got = sim(90, 3, [], { water: { x: 0, z: -15 }, waterLevel: 40 }, 100, 7);
  assert.ok(got.pose.z < -2, `z ${got.pose.z}`);
  assert.match(got.read?.goal ?? '', /water/);
  assert.equal(got.jumps, 0);
});

test('the same seed walks the same path, and a player command ignores a log', () => {
  const food = [ent('forage', 2, -12)];
  const a = sim(40, 2, food, {}, 100, 9), b = sim(40, 2, food, {}, 100, 9);
  assert.equal(a.pose.x, b.pose.x); assert.equal(a.pose.z, b.pose.z); assert.equal(a.read?.goal, b.read?.goal);
  const brain = new AnimalBrain(1); brain.energy = 100; brain.heading = 1;
  const origin = { x: 0, y: 0, z: 0 };
  brain.sense(origin, [{ key: 'log', x: 0, y: 0, z: -1, kind: 'obstacle', low: true }]);
  brain.decide(origin, 1 / 30, { motion: 'walk', heading: .4, speed: 1.2 });
  assert.equal(brain.motion, 'walk'); assert.equal(brain.problem, 'player');
  assert.equal(brain.heading, .4); assert.equal(brain.speed, 1.2);
  assert.ok(jumpJPerKg() > 0);
});

test('steered player wolf refuses a step whose probe is inside BLOCK.wolf.trunk (0.7 m) of a tree or person and moves on open ground (T-0055)', () => {
  assert.equal(BLOCK.wolf.trunk, 0.7);
  // Known match from T-0055 calibration: tree at (0, -1) from origin heading 0 keeps x = 0, z = 0
  const tree0 = ent('spruce', 0, -1);
  const blocked0 = steerPlayerWolf({ x: 0, z: 0, heading: 0 }, 2, 1 / 30, [tree0]);
  assert.equal(blocked0.x, 0);
  assert.equal(blocked0.z, 0);
  assert.equal(wolfTrunkBlocked(0, -0.5, [tree0]), true);
  // Person inside 0.7 m also blocks
  const person0 = ent('person', 0, -1);
  const blockedP = steerPlayerWolf({ x: 0, z: 0, heading: 0 }, 2, 1 / 30, [person0]);
  assert.equal(blockedP.x, 0);
  assert.equal(blockedP.z, 0);
  // Replay of placed jack pine 3:4:10 at (141.900, 196.983) from at=(141.900, 198.183) heading 0 at speed 2 m/s
  const pine = ent('spruce', 141.900, 196.983, { key: '3:4:10', scale: 1.284 });
  let pose: WolfPose = { x: 141.900, z: 198.183, heading: 0 };
  let minDist = Infinity;
  for (let i = 0; i < 90; i++) {
    pose = steerPlayerWolf(pose, 2, 1 / 30, [pine]);
    const d = Math.hypot(pose.x - pine.x, pose.z - pine.z);
    if (d < minDist) minDist = d;
  }
  assert.ok(minDist >= BLOCK.wolf.trunk, `expected min distance >= 0.7 m from jack pine 3:4:10, got ${minDist}`);
  // Open walk with no tree or person inside 0.7 m moves normally
  let openPose: WolfPose = { x: 141.900, z: 198.183, heading: 0 };
  for (let i = 0; i < 30; i++) openPose = steerPlayerWolf(openPose, 2, 1 / 30, []);
  assert.ok(Math.abs(openPose.z - (198.183 - 2)) < 1e-6, `expected open walk to advance 2 m in 1 s, got z=${openPose.z}`);
  // Slow nonzero creep (0.005 m/s) at the 0.7 m boundary is still checked
  const creep = steerPlayerWolf({ x: 0, z: 0, heading: 0 }, 0.005, 1 / 30, [ent('spruce', 0, -0.7001)]);
  assert.equal(creep.z, 0);
  // Oblique sprint (10.5 m/s, dt = 1/30) past a tree at (0.68, -0.17) is caught by the swept segment check
  const oblique = steerPlayerWolf({ x: 0, z: 0, heading: 0 }, 10.5, 1 / 30, [ent('spruce', 0.68, -0.17)]);
  assert.equal(oblique.z, 0);
  // Backing out from an existing overlap (d0 = 0.5 < 0.7) is permitted when moving outward
  const backOut = steerPlayerWolf({ x: 0, z: 0, heading: 0 }, -2, 1 / 30, [ent('spruce', 0, -0.5)]);
  assert.ok(backOut.z > 0, `expected backing out to increase z, got ${backOut.z}`);
});
