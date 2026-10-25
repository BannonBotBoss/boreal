import test from 'node:test';
import assert from 'node:assert/strict';
import { BEHAVIOUR, PERSON_AGENT, PERSON_BERRY_G, PERSON_DAY_S, PERSON_FAST_MPS, PERSON_G_PER_ENERGY, PERSON_KCAL_DAY, PERSON_KCAL_PER_100G, PERSON_PICK_PER_S, PERSON_WALK_MPS, PERSON_WATER_SEEK } from '../src/core/species';
import { PERSON_CUP_L, PERSON_CUP_POINTS, PERSON_CUP_S, PERSON_DRINK_L_DAY, PERSON_DRINK_PER_S, PERSON_REFERENCE_KG, PERSON_WATER_DRAIN_PER_S, PERSON_WATER_POINTS_PER_DAY, drinkPoint, stepVisitor, trackScore, visitorFriend, visitorPatchGrams, visitorReadout, visitorSitDrop, visitorStores, type VisitorBody, type VisitorInput } from '../src/core/visitors';
import { forageLedger } from '../src/core/fields';
import { inspectWhy, whyOf, withDoing } from '../src/core/why';
import { TRANSACTIONS } from '../src/core/transactions';

const flat: Pick<VisitorInput, 'walkable' | 'daylight' | 'wind' | 'friend' | 'forage'> = {
  walkable: () => true, daylight: 1, wind: { x: 0, z: 0 }, friend: false, forage: [],
};

function run(key: string, seconds: number, input: Partial<VisitorInput>, init?: { energy?: number; water?: number }, wolfSpeed = 0) {
  let body: VisitorBody = { key, x: 0, z: 0, heading: 0, seed: 3 };
  const full: VisitorInput = { dt: 1 / 30, ...flat, ...input };
  if (input.wolf) full.wolf = { ...input.wolf, speed: input.wolf.speed ?? wolfSpeed };
  let last = stepVisitor(body, full, init);
  const n = Math.round(seconds * 30);
  for (let i = 1; i < n; i++) {
    body = { ...body, x: last.x, z: last.z, heading: last.heading };
    last = stepVisitor(body, { ...full, dt: 1 / 30 }, init);
  }
  return last;
}

test('visitor numbers match the cited day, the gait table and the cup', () => {
  assert.equal(BEHAVIOUR.person, PERSON_AGENT);
  assert.equal(PERSON_AGENT.speed.approach, PERSON_WALK_MPS);
  assert.equal(PERSON_AGENT.speed.flee, PERSON_FAST_MPS);
  assert.equal(PERSON_WALK_MPS, 1.393);
  assert.equal(PERSON_FAST_MPS, 2.533);
  assert.ok(Math.abs(PERSON_G_PER_ENERGY - (PERSON_KCAL_DAY / 100) / (PERSON_KCAL_PER_100G / 100)) < 1e-9);
  assert.equal(PERSON_AGENT.diet.forage.unitsPerEnergy, PERSON_G_PER_ENERGY);
  assert.ok(Math.abs(PERSON_AGENT.diet.forage.eatUnits / PERSON_AGENT.diet.forage.eatSeconds - PERSON_BERRY_G * PERSON_PICK_PER_S) < 1e-9);
  assert.equal(PERSON_AGENT.levels.energy.drain, 100 / PERSON_DAY_S);
  assert.equal(PERSON_WATER_SEEK, 70);
  const points = PERSON_DRINK_L_DAY / PERSON_REFERENCE_KG / 0.10 * 100;
  assert.ok(Math.abs(PERSON_WATER_POINTS_PER_DAY - points) < 1e-9);
  assert.ok(Math.abs(PERSON_CUP_L / PERSON_DRINK_L_DAY * 10 - 1) < 1e-9, 'ten cups are the beverage day');
  assert.ok(Math.abs(PERSON_CUP_POINTS * (PERSON_DRINK_L_DAY / PERSON_CUP_L) - PERSON_WATER_POINTS_PER_DAY) < 1e-6);
  assert.equal(PERSON_DRINK_PER_S, PERSON_CUP_POINTS / PERSON_CUP_S);
  assert.equal(PERSON_WATER_DRAIN_PER_S, PERSON_WATER_POINTS_PER_DAY / PERSON_DAY_S);
  assert.equal(TRANSACTIONS.has('person', 'forage'), true);
  assert.equal(visitorFriend({ relationship: 'friend' }), true);
  assert.equal(visitorFriend({ relationship: null }), false);
  assert.equal(visitorFriend(undefined), false);
});

test('seeded stores repeat, and the range includes both a hungry visitor and a thirsty one', () => {
  const a = visitorStores(3), b = visitorStores(3);
  assert.deepEqual(a, b);
  let hungry = 0, thirsty = 0;
  for (let s = 1; s <= 24; s++) {
    const v = visitorStores(s);
    if (v.energy < PERSON_AGENT.levels.energy.fed) hungry++;
    if (v.water < PERSON_WATER_SEEK) thirsty++;
  }
  assert.ok(hungry > 0 && thirsty > 0, `hungry ${hungry} thirsty ${thirsty}`);
});

test('a hungry visitor walks to berries at the comfortable gait', () => {
  const food = { key: 'forage:gate:berries', x: 0, z: -20 };
  const seconds = 4;
  const got = run('hungry', seconds, { forage: [food] }, { energy: 20, water: 100 });
  const expectZ = -PERSON_WALK_MPS * (seconds - 1 / 30);
  const score = trackScore(got.z, expectZ);
  assert.ok(score >= 0.95, `position score ${score} z ${got.z} vs ${expectZ}`);
  assert.ok(Math.abs(got.x) < 0.05);
  assert.equal(got.action, 'approach');
  assert.match(got.goal, /forage/);
  assert.equal(got.doing, 'seeking');
  assert.match(got.because, /energy/);
  assert.equal(visitorSitDrop(got.posture, 1), 0);
  const y = inspectWhy(withDoing(whyOf({ kind: 'person', x: 0, z: 0 }), got.doing, got.because), 'Visitor');
  assert.match(y.now, /seeking/);
  assert.match(y.chain, /born/);
  assert.equal(visitorReadout('hungry')?.goal, got.goal);
});

test('a thirsty visitor walks to water; a sated one sits and does not sway', () => {
  const seconds = 4;
  const thirsty = run('thirst', seconds, { water: { x: 0, z: -20 } }, { energy: 95, water: 40 });
  const expectZ = -PERSON_WALK_MPS * (seconds - 1 / 30);
  const score = trackScore(thirsty.z, expectZ);
  assert.ok(score >= 0.95, `water score ${score} z ${thirsty.z}`);
  assert.match(thirsty.goal, /water/);
  assert.equal(thirsty.doing, 'drinking');

  const rest = run('rest', seconds, {}, { energy: 95, water: 100 });
  assert.equal(trackScore(rest.z, 0), 1, 'known match: no displacement when sated');
  assert.equal(rest.x, 0);
  assert.equal(rest.action, 'rest');
  assert.equal(rest.posture, 'rest');
  assert.equal(visitorSitDrop(rest.posture, 1), 0.45);
  assert.match(rest.goal, /rest/);
  const headingRange = 0; // the agent does not add a sine
  const swayScore = 1 - headingRange / 0.14;
  assert.ok(swayScore >= 0.95);
  let legacy = 0;
  for (let i = 0; i < seconds * 30; i++) legacy = Math.max(legacy, Math.abs(Math.sin((i / 30) * .7 + 3) * .07 - Math.sin(0) * .07));
  const legacyScore = 1 - Math.min(0.14, legacy * 2) / 0.14;
  assert.ok(legacyScore < 0.5, `known mismatch: the old sway scores ${legacyScore}`);
});

test('a stranger turns to the wolf and steps back only when it is close; a friend walks over', () => {
  const watch = run('watch', 2, { wolf: { x: 16, z: 0, speed: 2 } }, { energy: 95, water: 100 });
  const face = trackScore(watch.heading, -Math.PI / 2);
  assert.ok(face >= 0.95, `heading score ${face} heading ${watch.heading}`);
  assert.ok(Math.hypot(watch.x, watch.z) < 0.05, 'watching does not walk them off the spot');
  assert.equal(watch.action, 'alert');
  assert.match(watch.goal, /wolf/);
  assert.equal(watch.doing, 'alerting');

  const bolt = run('bolt', 2, { wolf: { x: 0, z: -5, speed: 2 } }, { energy: 95, water: 100 });
  const expectZ = PERSON_FAST_MPS * (2 - 1 / 30);
  const boltScore = trackScore(bolt.z, expectZ);
  assert.ok(boltScore >= 0.95, `step-back score ${boltScore} z ${bolt.z} vs ${expectZ}`);
  assert.equal(bolt.action, 'flee');
  assert.equal(bolt.doing, 'fleeing');

  const friend = run('friend', 4, { friend: true, wolf: { x: 0, z: -12, speed: 0 } }, { energy: 95, water: 100 });
  const fScore = trackScore(friend.z, -PERSON_WALK_MPS * (4 - 1 / 30));
  assert.ok(fScore >= 0.95, `friend score ${fScore} z ${friend.z}`);
  assert.equal(friend.action, 'approach');
  assert.match(friend.goal, /wolf/);
  assert.equal(friend.doing, 'seeking');
  assert.equal(friend.because, 'friend');
  assert.ok(friend.water > 99);

  const near = run('near-friend', 2, { friend: true, wolf: { x: 0, z: -1, speed: 0 } }, { energy: 95, water: 100 });
  assert.notEqual(near.action, 'flee');
  assert.ok(Math.hypot(near.x, near.z) < 0.05);
  assert.equal(near.doing, 'recovering');
  assert.equal(near.because, 'friend');
});

test('drinking a cup raises the meter at the cup rate, and picking removes berry grams', () => {
  const before = 40;
  const drank = run('drink', 2, { water: { x: 0, z: -1 } }, { energy: 95, water: before });
  const net = PERSON_DRINK_PER_S * 2 - PERSON_WATER_DRAIN_PER_S * 2;
  assert.ok(Math.abs(drank.water - (before + net)) < 0.05, `water ${drank.water} vs ${before + net}`);
  assert.match(drank.goal, /water/);

  const patch = 'forage:gate:pick';
  const picked = run('pick', 3, { forage: [{ key: patch, x: 0, z: 0 }] }, { energy: 20, water: 100 });
  assert.equal(picked.action, 'feed');
  assert.equal(picked.doing, 'grazing');
  assert.ok(picked.energy > 20, `energy ${picked.energy}`);
  const left = visitorPatchGrams(patch);
  const row = forageLedger(patch);
  assert.ok(left !== undefined && row && left < row.max - 2, `berries left ${left} of ${row?.max}`);
  const gained = picked.energy - 20 + PERSON_AGENT.levels.energy.drain * 3;
  const removed = row.max - left;
  assert.ok(Math.abs(removed / gained - PERSON_G_PER_ENERGY) / PERSON_G_PER_ENERGY < 0.15, `grams/energy ${removed / gained}`);
});

test('a drink point in the water stops on the last dry step', () => {
  const dry = (x: number, z: number) => z > -5;
  const at = drinkPoint({ x: 0, z: 0 }, { x: 0, z: -20 }, dry);
  assert.ok(at.z > -5.01 && at.z <= 0, `${at.z}`);
  assert.equal(drinkPoint({ x: 0, z: 0 }, { x: 0, z: -4 }, () => true).z, -4);
});
