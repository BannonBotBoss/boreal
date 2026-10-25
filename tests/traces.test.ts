import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAgent, modulators, stepAgent, type AgentWorld } from '../src/core/agent';
import { DELTA_KINDS, DELTAS, record } from '../src/core/deltas';
import { GROUND } from '../src/core/ground';
import { consumeHold, emptyBag, engageHold, gutContentsKg, preyOf } from '../src/core/huntHold';
import { scentLevel } from '../src/core/senses';
import { addFood, createAnimal, createWorld, tick } from '../src/core/sim';
import { DEER_AGENT, HARE_AGENT, WOLF_AGENT } from '../src/core/species';
import {
  DEER_TRACE_RANGE_M, MARK_SPACING_M, WOLF_SCENT_RANGE_M, addFeces, awayScore, carcassRefKg,
  deltaSources, resetTraceGut, traceHits, tryMark,
} from '../src/core/traces';

const quiet = { x: 0, z: 0 };
const saved: typeof DELTAS.log = [];
const isolate = () => { saved.splice(0, saved.length, ...DELTAS.log); DELTAS.log.length = 0; resetTraceGut(); };
const restore = () => { DELTAS.log.length = 0; DELTAS.log.push(...saved); resetTraceGut(); };

/**
 * The production plume, copied here so the score is not a function compared with itself.
 * EPA ISC local gaussian (sigma 4 m) plus a downwind plume. Same arithmetic as core/senses scentLevel.
 */
function plume(nose: { x: number; z: number }, source: { x: number; z: number; potency: number; range: number }, wind: { x: number; z: number }) {
  const dx = nose.x - source.x, dz = nose.z - source.z, distance = Math.hypot(dx, dz);
  if (distance >= source.range || source.potency <= 0) return 0;
  const speed = Math.hypot(wind.x, wind.z);
  const local = Math.exp(-distance * distance / (2 * 4 * 4));
  let arm = 0;
  if (speed > .05) {
    const down = (dx * wind.x + dz * wind.z) / speed;
    const cross = (dx * wind.z - dz * wind.x) / speed;
    if (down > 0) {
      const width = 2 + down * .22;
      arm = Math.exp(-.5 * (cross / width) ** 2) / (1 + down / 14) * Math.min(1, speed);
    }
  }
  return Math.min(1, source.potency * Math.max(local, arm) * (1 - distance / source.range));
}
const gate = (got: number, want: number) => 1 - Math.min(1, Math.abs(got - want) / Math.max(Math.abs(want), 1e-9));

test('awayScore is 1 straight away, 0 straight toward, 0.5 perpendicular', () => {
  assert.equal(awayScore({ x: 1, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 0 }), 1);
  assert.equal(awayScore({ x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }), 0);
  assert.equal(awayScore({ x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 0 }), 0.5);
});

test('decay rows and the delta cap are the ones already on main', () => {
  assert.equal(DELTA_KINDS.scent.tau, 10);
  assert.equal(DELTA_KINDS.carcass.tau, 8);
  assert.equal(DELTA_KINDS.droppings.tau, 60);
  assert.equal(DELTAS.cap, 1500);
  assert.equal(MARK_SPACING_M, 450);
  assert.equal(WOLF_SCENT_RANGE_M, 2400);
  assert.equal(DEER_TRACE_RANGE_M, 2);
});

test('pellet and gut formulas match the cited rates, and a carcass odor is one hare gut', () => {
  const hare = HARE_AGENT.traces.droppings!, deer = DEER_AGENT.traces.droppings!;
  assert.ok(Math.abs(hare.groupG - 167 * (1 - 0.36) / 576) < 1e-12);
  assert.ok(Math.abs(hare.fecesGPerUnit - 0.015 * (1 - 0.36)) < 1e-12);
  assert.ok(Math.abs(hare.unitsPerWetKg! - 0.17 / 0.015 * 1000) < 1e-9);
  assert.ok(Math.abs(deer.groupG - 70 * 0.022 * (1 - 0.55) * 1000 / 34.4) < 1e-9);
  assert.ok(Math.abs(deer.fecesGPerUnit - 0.35 * (1 - 0.55)) < 1e-12);
  assert.ok(Math.abs(carcassRefKg() - gutContentsKg(1.5)) < 1e-12);
  assert.equal(WOLF_AGENT.traces.response.carcass, 1);
  assert.equal(DEER_AGENT.traces.response.scent, -1);
  assert.equal(DEER_AGENT.traces.response.droppings, 0);
  assert.equal(HARE_AGENT.senses.scent.range, 2);
  assert.equal(WOLF_AGENT.senses.scent.range, 2400);
});

test('a travelling wolf marks once per 450 m of its own trail, and standing still does not', () => {
  isolate();
  try {
    assert.equal(tryMark('deer:1', 0, 0, 1), false);
    assert.equal(tryMark('wolf:1', 0, 0, 0), false);
    assert.equal(tryMark('wolf:1', 0, 0, 1), true);
    assert.equal(DELTAS.log.filter(d => d.kind === 'scent' && d.meta === 'wolf:1').length, 1);
    assert.equal(DELTAS.log[0].m, 1);
    assert.equal(tryMark('wolf:1', 10, 0, 10), false);
    assert.equal(tryMark('wolf:2', 10, 0, 1), true);
    assert.equal(tryMark('wolf:1', MARK_SPACING_M, 0, 1), true);
    assert.equal(DELTAS.log.filter(d => d.kind === 'scent' && d.meta === 'wolf:1').length, 2);
  } finally { restore(); }
});

test('one pellet or one deer group is one dropping, and a shortfall stays in the gut', () => {
  isolate();
  try {
    const hare = HARE_AGENT.traces.droppings!;
    const units = hare.groupG / hare.fecesGPerUnit;
    assert.equal(addFeces(HARE_AGENT, 'hare:1', 3, 4, units / 2), 0);
    assert.equal(DELTAS.log.length, 0);
    assert.equal(addFeces(HARE_AGENT, 'hare:1', 3, 4, units / 2), 1);
    assert.equal(DELTAS.log.length, 1);
    assert.equal(DELTAS.log[0].kind, 'droppings');
    assert.ok(Math.abs(DELTAS.log[0].m - hare.groupG / 1000) < 1e-12);
    assert.equal(DELTAS.log[0].x, 3);
    const deer = DEER_AGENT.traces.droppings!;
    assert.equal(addFeces(DEER_AGENT, 'deer:1', 1, 2, deer.groupG / deer.fecesGPerUnit), 1);
    assert.equal(addFeces(WOLF_AGENT, 'wolf:1', 0, 0, 100), 0);
  } finally { restore(); }
});

test('the plume score matches the copied formula and disagrees with the upwind nose', () => {
  const source = { x: 0, z: 0, potency: 1, range: WOLF_SCENT_RANGE_M };
  const wind = { x: 1, z: 0 };
  const downNose = { x: 30, z: 0 }, upNose = { x: -30, z: 0 };
  const down = scentLevel(downNose, { key: 't', kind: 'scent', ...source }, wind);
  const match = gate(down, plume(downNose, source, wind));
  const mismatch = gate(down, plume(upNose, source, wind));
  assert.equal(match, 1);
  assert.ok(mismatch < 0.2, `upwind formula scored ${mismatch}`);
});

test('a wolf smells a mark at 30 m downwind and a deer does not, and the hit is scentLevel', () => {
  isolate();
  try {
    record({ kind: 'scent', x: 0, z: 0, t: GROUND.years, m: 1, meta: 'wolf:1' });
    const wind = { x: 1, z: 0 };
    const wolf = traceHits(WOLF_AGENT, { x: 30, z: 0 }, wind, 0);
    assert.ok(wolf.length >= 1 && wolf[0].level > 0);
    assert.equal(traceHits(DEER_AGENT, { x: 30, z: 0 }, wind, 0).length, 0);
    const deer = traceHits(DEER_AGENT, { x: 1, z: 0 }, quiet, 0);
    assert.equal(deer.length, 1);
    assert.equal(deer[0].weight, -1);
    const src = deltaSources(1, 0, DEER_AGENT.senses.scent.range)[0];
    assert.equal(deer[0].level, scentLevel({ x: 1, z: 0 }, src, quiet));
    const calm = createAgent(DEER_AGENT, 'deer:calm', 1, 0, () => 0, { relaxation: 100, energy: 90, stamina: 100 });
    const m = modulators(calm, 0);
    assert.ok(deer[0].level >= m.noticeAt && deer[0].level < m.fleeAt, `level ${deer[0].level} notice ${m.noticeAt} flee ${m.fleeAt}`);
  } finally { restore(); }
});

test('a calm deer walks away from a fresh mark and does not walk away from its own dropping', () => {
  isolate();
  try {
    record({ kind: 'scent', x: 0, z: 0, t: GROUND.years, m: 1, meta: 'wolf:1' });
    const deer = createAgent(DEER_AGENT, 'deer:1', 1, 0, () => 0, { relaxation: 100, energy: 90, stamina: 100, heading: 0 });
    deer.action = 'rest'; deer.timer = 30;
    const world: AgentWorld = { others: [], wind: quiet, daylight: 1, food: {} };
    for (let i = 0; i < 20; i++) stepAgent(deer, world, 0.1);
    const score = awayScore({ x: 1, z: 0 }, deer, { x: 0, z: 0 });
    assert.ok(deer.x > 1.4, `x ${deer.x}`);
    assert.ok(Math.abs(deer.z) < 1e-6, `z ${deer.z}`);
    assert.ok(score >= 0.95, `away ${score}`);
    assert.notEqual(deer.action, 'flee');
    DELTAS.log.length = 0;
    record({ kind: 'droppings', x: 0, z: 0, t: GROUND.years, m: 0.02, meta: 'deer:2' });
    const still = createAgent(DEER_AGENT, 'deer:2', 1, 0, () => 0, { relaxation: 100, energy: 90, stamina: 100, heading: 0 });
    still.action = 'rest'; still.timer = 30;
    for (let i = 0; i < 10; i++) stepAgent(still, world, 0.1);
    assert.equal(still.x, 1);
    assert.equal(still.z, 0);
  } finally { restore(); }
});

test('a wolf downwind of a carcass walks toward it', () => {
  isolate();
  try {
    record({ kind: 'carcass', x: 0, z: 0, t: GROUND.years, m: carcassRefKg(), meta: 'hare:1' });
    const wolf = createAgent(WOLF_AGENT, 'wolf:1', 8, 0, () => 0.5, { relaxation: 100, energy: 70, stamina: 100, heading: 0 });
    wolf.action = 'rest'; wolf.timer = 0;
    const world: AgentWorld = { others: [], wind: { x: 1, z: 0 }, daylight: 1, food: {} };
    const x0 = wolf.x;
    for (let i = 0; i < 40; i++) stepAgent(wolf, world, 0.1);
    const toward = 1 - awayScore({ x: x0, z: 0 }, wolf, { x: 0, z: 0 });
    assert.ok(wolf.x < x0 - 1, `x ${wolf.x}`);
    assert.ok(toward >= 0.95, `toward ${toward}`);
    // Inside 1.2 m the pipeline holds on the lure instead of keeping the approach goal.
    assert.ok(wolf.goal.includes('carcass'), wolf.goal);
  } finally { restore(); }
});

test('consume still writes the gut as a carcass', () => {
  isolate();
  try {
    const prey = preyOf(19, 2, 3);
    const bag = emptyBag();
    engageHold('wolf:t19', prey.key, prey, 0, bag);
    consumeHold(bag, prey, 1);
    const row = DELTAS.log.find(d => d.kind === 'carcass');
    assert.ok(row);
    assert.ok(Math.abs(row!.m - gutContentsKg(prey.massKg)) < 1e-9);
    assert.equal(row!.x, 2);
    assert.equal(row!.z, 3);
  } finally { restore(); }
});

test('a sim hare deposits the pellet the gut was holding and walks away from a mark', () => {
  isolate();
  try {
    const w = createWorld({ step: 0.05, seed: 1, wind: () => quiet });
    const h = createAnimal(w, 'hare', { x: 0, z: 0, heading: 0 }, { energy: 50 });
    addFood(w, 'clover', 0, 0, 1);
    const spec = HARE_AGENT.traces.droppings!;
    const oneBite = h.sp.diet.foods.clover.biteKg.v * spec.unitsPerWetKg!;
    addFeces(HARE_AGENT, `hare:${h.id}`, 0, 0, spec.groupG / spec.fecesGPerUnit - oneBite);
    h.bite = h.sp.diet.foods.clover.eatSeconds.v - 0.01;
    h.timer = 10; h.state = 'graze';
    tick(w, 0.05);
    const drops = DELTAS.log.filter(d => d.kind === 'droppings');
    assert.equal(drops.length, 1);
    assert.ok(Math.abs(drops[0].m - spec.groupG / 1000) < 1e-9);

    DELTAS.log.length = 0;
    record({ kind: 'scent', x: 0, z: 0, t: GROUND.years, m: 1, meta: 'wolf:9' });
    const w2 = createWorld({ step: 0.05, seed: 2, wind: () => quiet });
    const h2 = createAnimal(w2, 'hare', { x: 1, z: 0, heading: 0 }, { energy: 50 });
    h2.timer = 10; h2.state = 'graze';
    tick(w2, 1);
    const score = awayScore({ x: 1, z: 0 }, h2, { x: 0, z: 0 });
    assert.ok(h2.x > 1.4, `x ${h2.x}`);
    assert.ok(score >= 0.95, `away ${score}`);
  } finally { restore(); }
});

test('the player mark is the travel act and the 1 s deer dropping interval is gone', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.equal(main.includes('deerDroppingsKg'), false);
  assert.ok(main.includes("tryMark('wolf:player'"));
  assert.ok(main.includes("kind: 'footprint'"));
});
