import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, type Kind } from '../src/core/catalog';
import { NEEDS_SPECIES } from '../src/core/needs/species';
import { siteAt } from '../src/core/flora/site';
import { standAt } from '../src/core/stand';
import { riverCenter } from '../src/core/world';
import {
  DOING, WHY_DEFAULTS, WHY_MAX, agentWhy, anchor, doingFromAgent, doingFromProblem, gapLight, inspectWhy,
  isWhy, onFlow, placementCause, stepText, whyOf, withDoing,
} from '../src/core/why';

/** The metric is exact equality of the cause id with an independent standAt/siteAt/onFlow reading.
 *  A known match scores equal. An off-by-one age is a known mismatch and must not pass. */
function find(want: 'flow' | 'sunlit-gap' | 'stand'): { x: number; z: number } {
  if (want === 'flow') { const x = riverCenter(0), z = 0; if (onFlow(x, z) && placementCause(x, z).cause === 'flow') return { x, z }; }
  for (let z = -400; z <= 800; z += 40) for (let x = -400; x <= 800; x += 40) {
    if (placementCause(x, z).cause === want) return { x, z };
  }
  throw new Error(`no ${want} point in the scan`);
}

test('placement: every catalog kind names a cause, and the age matches standAt (off-by-one fails)', () => {
  const stand = find('stand'), gap = find('sunlit-gap'), flow = find('flow');
  for (const [at, cause] of [[stand, 'stand'], [gap, 'sunlit-gap'], [flow, 'flow']] as const) {
    const p = placementCause(at.x, at.z);
    const age = Math.round(standAt(at.x, at.z, siteAt(at.x, at.z).wet).age);
    assert.equal(p.cause, cause);
    assert.equal(p.age, age, 'known match: the chain age is standAt');
    assert.notEqual(p.age, age + 1, 'known mismatch: one year off');
    assert.ok(Math.abs(p.light - siteAt(at.x, at.z).light) < 1e-9);
  }
  const grew = (at: { x: number; z: number }) => whyOf({ kind: 'spruce', ...at }).find(s => s.step === 'grew')!;
  assert.equal(grew(stand).by, `stand:${placementCause(stand.x, stand.z).age}`);
  assert.equal(grew(gap).by, `sunlit-gap:${placementCause(gap.x, gap.z).age}`);
  assert.equal(grew(flow).by, 'flow');
  assert.match(stepText(grew(stand)), new RegExp(`grew in a stand ${placementCause(stand.x, stand.z).age} years since fire`));
  assert.match(stepText(grew(gap)), /grew in a sunlit gap \(stand \d+ years since fire\)/);
  assert.equal(stepText(grew(flow)), 'grew in the channel');
  assert.ok(siteAt(gap.x, gap.z).light >= gapLight());
  assert.ok(siteAt(stand.x, stand.z).light < gapLight());
  for (const kind of ['spruce', 'plant', 'forage', 'log'] as Kind[]) {
    const w = whyOf({ kind, ...stand });
    assert.equal(w.length, WHY_DEFAULTS[kind].length, 'placement sets by, it does not add a step');
    assert.ok(isWhy(w));
    assert.ok(w.some(s => s.step === 'grew' && s.by === `stand:${placementCause(stand.x, stand.z).age}`));
  }
  const rock = whyOf({ kind: 'rock', ...flow });
  assert.equal(rock.find(s => s.step === 'embedded')!.by, 'flow');
  assert.equal(stepText(rock[rock.length - 1]), 'embedded in the channel');
  assert.deepEqual(whyOf({ kind: 'rock', ...stand }), WHY_DEFAULTS.rock, 'a rock off the channel keeps the embedded default');
  for (const kind of ['deer', 'person'] as Kind[]) {
    const w = whyOf({ kind, ...stand });
    assert.equal(w.find(s => s.step === 'born')!.by, 'birth');
    assert.equal(stepText(w.find(s => s.step === 'wandered')!), 'wandered here');
    const wet = whyOf({ kind, ...flow });
    assert.equal(wet.find(s => s.step === 'wandered')!.by, 'flow');
    assert.equal(stepText(wet.find(s => s.step === 'wandered')!), 'wandered into the flow');
  }
  for (const kind of Object.keys(catalog) as Kind[]) assert.ok(isWhy(whyOf({ kind, x: stand.x, z: stand.z })));
});

test('placement: a stored chain wins, and a kind with no position keeps the default words', () => {
  const mine = [{ step: 'weathered' as const }, { step: 'moved' as const, by: 'player' }];
  assert.deepEqual(whyOf({ kind: 'spruce', x: 12, z: 34 }, { why: mine }), mine);
  assert.equal(stepText(whyOf({ kind: 'spruce' }).at(-1)!), 'grew and leafed out');
  const derived = whyOf({ kind: 'log', x: 80, z: 80 }); derived.push({ step: 'grew' });
  assert.equal(whyOf({ kind: 'log', x: 80, z: 80 }).length, WHY_DEFAULTS.log.length);
});

test('agents: every needs species has a birth cause, and the doing step is live and not stored', () => {
  for (const id of Object.keys(NEEDS_SPECIES)) {
    const w = agentWhy(id);
    assert.equal(w.find(s => s.step === 'born')!.by, 'birth');
    assert.ok(isWhy(w));
    w.push({ step: 'grew' });
    assert.equal(agentWhy(id).length, 2, 'agentWhy returns a copy');
  }
  assert.equal(stepText(agentWhy('hare').at(-1)!), 'wandered into the near ring');
  assert.equal(stepText(agentWhy('wolf').at(-1)!), 'here with the player');
  assert.throws(() => agentWhy('moose'), /no why/);
  const base = whyOf({ kind: 'deer', x: 80, z: 80 });
  const live = withDoing(base, 'grazing', 'energy 41%');
  assert.equal(base.length, 2, 'withDoing does not mutate');
  assert.ok(!base.some(s => (DOING as readonly string[]).includes(s.step)));
  assert.equal(live.at(-1)!.step, 'grazing');
  assert.equal(anchor(live)!.step, 'wandered', 'a doing step is ongoing, so the anchor stays the placement');
  assert.ok(isWhy(live));
  assert.equal(withDoing(live, 'fleeing', 'wolf').at(-1)!.step, 'fleeing');
  assert.equal(withDoing(live, 'fleeing', 'wolf').filter(s => (DOING as readonly string[]).includes(s.step)).length, 1);
  const log = withDoing(whyOf({ kind: 'log' }), 'grazing', 'energy 10%');
  assert.ok(log.length <= WHY_MAX);
  assert.equal(anchor(log)!.step, 'resting');
  const panel = inspectWhy(live, 'Woodland deer');
  assert.equal(panel.now, 'Woodland deer - wandered here, grazing (energy 41%)');
  assert.match(panel.chain, /born → wandered here → grazing \(energy 41%\)/);
});

test('doing: the cause is the level or the absence of one, for the brain and the sim', () => {
  assert.deepEqual(doingFromProblem('feed', 41.2, 'forage'), { goal: 'grazing', because: 'energy 41%' });
  assert.deepEqual(doingFromProblem('escape', 80, 'wolf'), { goal: 'fleeing', because: 'wolf' });
  assert.deepEqual(doingFromProblem('explore', 100), { goal: 'exploring', because: 'nothing sensed' });
  assert.deepEqual(doingFromProblem('player', 100), { goal: 'steered', because: 'player' });
  assert.deepEqual(doingFromProblem('recover', 9.4), { goal: 'recovering', because: 'energy 9%' });
  assert.deepEqual(doingFromProblem('avoid', 50), { goal: 'seeking', because: 'obstacle' });
  const hare = { species: 'hare', energy: 40, needs: { water: 70, rest: 90 }, level: 0.5 };
  assert.deepEqual(doingFromAgent({ ...hare, state: 'graze' }), { goal: 'grazing', because: 'energy 40%' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'graze', energy: 90 }), { goal: 'grazing', because: 'bout, energy 90%' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'freeze' }), { goal: 'alerting', because: 'perceived 0.50' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'flee' }), { goal: 'fleeing', because: 'perceived 0.50' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'drink' }), { goal: 'drinking', because: 'water 70%' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'rest' }), { goal: 'recovering', because: 'rest 90%' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'move' }), { goal: 'exploring', because: 'nothing sensed' });
  assert.deepEqual(doingFromAgent({ ...hare, state: 'chase' }), { goal: 'seeking', because: 'hunt' });
  const wolfBelow = NEEDS_SPECIES.wolf.behaviour.drives.energy.seekBelow.v;
  assert.equal(doingFromAgent({ species: 'wolf', state: 'eat', energy: wolfBelow - 1, needs: { water: 100, rest: 100 }, level: 0 }).because, `energy ${Math.round(wolfBelow - 1)}%`);
});
