/**
 * Step 10. The strongest urge wins. #101's cutoff ladder is not used.
 * The recorded trace is tasks/evidence/T-0099/approach-then-flee.json.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgent, stepAgent, strongestUrge, urgeScores, urgeWeights, winningUrge, type AgentWorld, type FoodSource, type UrgeName } from '../src/core/agent';
import { HARE_AGENT } from '../src/core/species';
import { habitatAt, habitatQuality } from '../src/core/habitat';
import { stream } from '../src/proc/rng';
import { CLOVER, type CloverPatch, CLOVER_WHY } from '../src/core/fields';

const patch = (x: number, z: number, r = 1): CloverPatch => {
  const max = Math.round(Math.PI * r * r * CLOVER.unitsPerM2);
  return { key: `clover:t:${x}:${z}`, x, z, r, light: 1, max, units: max, at: 0, stolon: Math.PI * r * r * CLOVER.stolonGPerM2, why: CLOVER_WHY.map(w => ({ ...w })) };
};
const source = (ps: CloverPatch[]): FoodSource => ({
  at: (x, z, pad = 0) => ps.find(p => p.units > 0 && Math.hypot(p.x - x, p.z - z) < p.r + pad),
  nearest: (x, z, range, except) => ps.filter(p => p.units > 0 && p.key !== except && Math.hypot(p.x - x, p.z - z) < range)
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0],
  eat: () => 0,
});
const hare = (seed: string, energy = 20) => createAgent(HARE_AGENT, `hare:${seed}`, 0, 0, stream(1, seed), { energy, stamina: 100, relaxation: 100, heading: 0 });
const cell = (food: number, water: number, quality: number) => ({ food, water, quality });
const weights = urgeWeights(HARE_AGENT.utility);

test('severity times the existing utility times the opportunity: no cutoff ladder', () => {
  const feed = urgeScores(weights, { hunger: 1, thirst: 0, fear: 0, fatigue: 0, food: 1, water: 0, leave: 0 });
  assert.equal(strongestUrge(feed), 'feed');
  assert.ok(feed.feed > feed.rest && feed.flee === 0);

  const drink = urgeScores(weights, { hunger: 0.1, thirst: 1, fear: 0, fatigue: 0, food: 0.2, water: 1, leave: 0 });
  assert.equal(strongestUrge(drink), 'drink');
  assert.ok(drink.drink > drink.feed && drink.drink > drink.rest);

  const scared = urgeScores(weights, { hunger: 1, thirst: 0, fear: 0.7, fatigue: 0, food: 1, water: 0, leave: 0 });
  const bold = urgeScores(weights, { hunger: 1, thirst: 0, fear: 0.2, fatigue: 0, food: 1, water: 0, leave: 0 });
  assert.equal(strongestUrge(scared), 'flee');
  assert.equal(strongestUrge(bold), 'feed', 'a weak cue does not outrank hunger');

  const tired = urgeScores(weights, { hunger: 0.2, thirst: 0, fear: 0, fatigue: 1, food: 1, water: 0, leave: 0 });
  assert.equal(strongestUrge(tired), 'rest');

  const rich = urgeScores(weights, { hunger: 0.8, thirst: 0.1, fear: 0, fatigue: 0.05, food: 1, water: 0.2, leave: 0 });
  const poor = urgeScores(weights, { hunger: 0.8, thirst: 0.1, fear: 0, fatigue: 0.05, food: 0.05, water: 0.2, leave: 1.2 });
  assert.equal(strongestUrge(rich), 'feed');
  assert.equal(strongestUrge(poor), 'move');
  assert.ok(poor.move > rich.move && poor.feed < rich.feed, 'the same hunger loses when the cell is poorer and a neighbor is better');
});

test('the step 9 score is the cell the urge reads', () => {
  const here = habitatAt(3, 4);
  assert.equal(here.quality, habitatQuality(here));
  const world: AgentWorld = {
    others: [], wind: { x: 0, z: 0 }, daylight: 1, food: {},
    urges: { habitat: here, hunger: 1, thirst: 0, fear: 0, fatigue: 0 },
  };
  const fed = winningUrge(hare('cell'), world, 0);
  assert.equal(fed.urge, 'feed');
  assert.ok(fed.scores.feed > 0);
  const left: AgentWorld = {
    ...world,
    urges: { habitat: { ...here, food: 0 }, hunger: 1, thirst: 0, fear: 0, fatigue: 0, betterQuality: here.quality + 1, toward: { x: 0, z: -8 } },
  };
  const gone = winningUrge(hare('leave'), left, 0);
  assert.equal(gone.urge, 'move');
  assert.ok(gone.scores.move > fed.scores.move);
  assert.ok(gone.scores.feed < fed.scores.feed);
});

test('the animal feeds, drinks, flees, rests, or moves', () => {
  const act = (urge: UrgeName, world: Partial<AgentWorld>, energy = 20) => {
    const a = hare(urge, energy);
    const w: AgentWorld = { others: [], wind: { x: 0, z: 0 }, daylight: 1, food: {}, ...world };
    for (let i = 0; i < 5; i++) stepAgent(a, w, 1 / 30);
    return a;
  };
  const drink = act('drink', { urges: { habitat: cell(0, 1, 1), hunger: 0, thirst: 1, fear: 0, fatigue: 0, water: { x: 0, z: -10 } } }, 95);
  assert.match(drink.goal, /^urge drink/);
  assert.ok(drink.z < -0.05, `walked toward water (z ${drink.z})`);

  const rest = act('rest', { urges: { habitat: cell(0, 0, 0), hunger: 0, thirst: 0, fear: 0, fatigue: 0 } }, 99);
  assert.match(rest.goal, /^urge rest/);
  assert.equal(rest.x, 0); assert.equal(rest.z, 0);

  const move = act('move', { urges: { habitat: cell(0, 0, 0), hunger: 0, thirst: 0, fear: 0, fatigue: 0, betterQuality: 1, toward: { x: 0, z: -8 } } }, 95);
  assert.match(move.goal, /^urge move/);
  assert.ok(move.z < -0.05, `left the poorer cell (z ${move.z})`);

  const flee = act('flee', {
    others: [{ key: 'player', kind: 'wolf', x: 0, z: -3, speed: 2 }],
    urges: { habitat: cell(1, 0, 1), hunger: 0, thirst: 0, fatigue: 0 },
  }, 95);
  assert.match(flee.goal, /^urge flee/);
  assert.ok(flee.z > 0.05, `ran back from the wolf (z ${flee.z})`);
});

test('a hungry animal approaches food and flees when a predator is sensed', () => {
  const food = patch(0, -16);
  const habitat = cell(1, 0.2, 2);
  const urges = { habitat, thirst: 0, fatigue: 0 };
  const a = hare('trace', 20);
  const wolfAt = (z: number, speed: number): AgentWorld => ({
    others: [{ key: 'player', kind: 'wolf', x: 0, z, speed }],
    wind: { x: 0, z: 0 }, daylight: 1, food: { clover: source([food]) }, urges,
  });
  const none = (): AgentWorld => ({ others: [], wind: { x: 0, z: 0 }, daylight: 1, food: { clover: source([food]) }, urges });
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const frames: { t: number; x: number; z: number; action: string; goal: string }[] = [];
  const push = (t: number) => frames.push({ t: round(t), x: round(a.x), z: round(a.z), action: a.action, goal: a.goal });
  let t = 0;
  for (let i = 0; i < 75; i++) { stepAgent(a, none(), 1 / 30); t += 1 / 30; push(t); }
  const approached = a.z;
  assert.match(a.goal, /^urge feed/, a.goal);
  assert.ok(approached < -1, `approached the food (z ${approached})`);
  for (let i = 0; i < 30; i++) { stepAgent(a, wolfAt(-80, 0), 1 / 30); t += 1 / 30; push(t); }
  assert.match(a.goal, /^urge feed/, `a distant wolf does not win (${a.goal})`);
  assert.ok(a.z < approached, 'still closing on the food');
  const beforeFlee = a.z;
  for (let i = 0; i < 30; i++) { stepAgent(a, wolfAt(a.z - 3, 2), 1 / 30); t += 1 / 30; push(t); }
  assert.match(a.goal, /^urge flee/, a.goal);
  assert.equal(a.action, 'flee');
  assert.ok(a.z > beforeFlee, `fled back from the predator (z ${a.z} from ${beforeFlee})`);

  const trace = {
    what: 'A hungry hare walks toward food. A wolf too far away does not turn it. A wolf close in front does, and the hare runs back.',
    food: { x: 0, z: -16 },
    frames,
  };
  const path = fileURLToPath(new URL('../tasks/evidence/T-0099/approach-then-flee.json', import.meta.url));
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(trace, null, 2) + '\n');
  } else {
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), trace);
  }
});

test('the cited need rates stay, and the urge code has no 90, 80, 25, or 85 cutoff', () => {
  const engine = readFileSync(new URL('../src/core/needs/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /Nagy & Peterson 1988/);
  assert.match(engine, /Taylor, Heglund & Maloiy 1982/);
  assert.match(engine, /turnoverMlPerDay\.v \/ 86400/);
  assert.match(engine, /10\.7 \* M \*\* -\.316/);
  assert.match(engine, /6\.03 \* M \*\* -\.303/);
  const agent = readFileSync(new URL('../src/core/agent.ts', import.meta.url), 'utf8');
  const slice = agent.slice(agent.indexOf('export interface UrgeHabitat'), agent.indexOf('/** Relaxed choice:'));
  assert.doesNotMatch(slice, /choose_action/);
  assert.doesNotMatch(slice, /(?<![\d.])(90|80|25|85)(?![\d.])/);
  const legs = readFileSync(new URL('../src/core/animalBehavior.ts', import.meta.url), 'utf8');
  assert.match(legs, /class AnimalBrain/);
  assert.match(legs, /decide\(origin: Point/);
  assert.doesNotMatch(legs, /choose_action/);
});
