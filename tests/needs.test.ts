import test from 'node:test';
import assert from 'node:assert/strict';
import { NEEDS_SPECIES, WOLF_NEEDS, HARE_NEEDS } from '../src/core/needs/species';
import { TEMPLATE_SPECIES } from '../src/core/needs/species/_template';
import { sourcedEntries } from '../src/core/needs/template';
import { SYSTEM_PROPERTIES } from '../src/config/systemProperties';
import { activityFactor, agentLevels, createNeeds, eatWater, levelsOf, needRates, parseNeeds, percentPerMl, stepNeeds, staminaRates } from '../src/core/needs/engine';
import { activityAt, chooseGoal, sunTimes } from '../src/core/needs/behaviour';
import { createThoughtClock, thoughtLook, thoughtTick, STAGGER, THOUGHT_RULES } from '../src/core/needs/thoughts';
import { MAMMALS } from '../src/core/species';
import { untagged } from '../src/core/stateFields';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b} +-${tol}`);
const GAME_PER_REAL = 12; // core/timeOfDay: 300 real s per game hour
const run = (sp = WOLF_NEEDS, speed = 0, gameSeconds = 3600, init = createNeeds(), energy = 100, tC = 10, drinking = false) => {
  let st = init, e = energy; for (let t = 0; t < gameSeconds; t += 10) ({ state: st, energy: e } = stepNeeds(sp, st, { dtGame: 10, speed, tC, energy: e, drinking })); return { st, e };
};

test('every number in every species template has a source; the copy-me template is complete but unfilled', () => {
  for (const sp of Object.values(NEEDS_SPECIES)) for (const [path, s] of sourcedEntries(sp)) {
    assert.ok(s.src && s.src.length > 8 && !/TODO/.test(s.src), `${sp.id}.${path} unsourced`);
    if (typeof s.v === 'number') assert.ok(Number.isFinite(s.v), `${sp.id}.${path}`);
  }
  assert.deepEqual(sourcedEntries(TEMPLATE_SPECIES).map(e => e[0]).sort(), sourcedEntries(WOLF_NEEDS).map(e => e[0]).filter(p => !p.startsWith('needs.water.foodWaterMlPerKg.')).sort());
  for (const sp of Object.values(NEEDS_SPECIES)) assert.equal(MAMMALS.find(r => r[0] === sp.name)?.[3], sp.body.massKg.v, `${sp.id} mass = core/species row`);
});
test('sourced derivations: Nagy & Peterson 1988 water flux, Nagy et al. 1999 FMR, Taylor et al. 1982 cost of transport', () => {
  near(WOLF_NEEDS.needs.water.turnoverMlPerDay.v, .326 * 40000 ** .818, 2, 'wolf water flux');
  near(WOLF_NEEDS.body.fmrKjPerDay.v, 4.21 * 40000 ** .772, 5, 'wolf FMR');
  near(HARE_NEEDS.needs.water.turnoverMlPerDay.v, .326 * 1500 ** .818, 1, 'hare water flux');
  near(HARE_NEEDS.body.fmrKjPerDay.v / 4.21 / 1500 ** .772, .93, .02, 'hare measured / predicted');
  near(activityFactor(WOLF_NEEDS, 0), .45, .01); near(activityFactor(WOLF_NEEDS, 2), 1.99, .01); near(activityFactor(WOLF_NEEDS, 4), 3.52, .01); near(activityFactor(WOLF_NEEDS, 7), 5.82, .01);
  near(WOLF_NEEDS.needs.water.turnoverMlPerDay.v / 40, 47.4, .2, 'mL/kg/day in the 40-60 dog range');
});
test('same engine, both species: water drains with activity and heat, 0 % = the critical deficit', () => {
  for (const sp of [WOLF_NEEDS, HARE_NEEDS]) {
    const still = run(sp, 0).st.water, walk = run(sp, sp.body.speeds.walk.v).st.water, sprint = run(sp, sp.body.speeds.sprint.v).st.water;
    assert.ok(100 > still && still > walk && walk > sprint, `${sp.id} ${still} ${walk} ${sprint}`);
    assert.ok(run(sp, 0, 3600, createNeeds(), 100, 30).st.water < still, `${sp.id} heat`);
    // at the daily-average activity (factor 1) one day loses exactly the daily turnover
    const perDay = -needRates(sp, 0).water / activityFactor(sp, 0) * 86400;
    near(perDay, sp.needs.water.turnoverMlPerDay.v * percentPerMl(sp), 1e-6, sp.id);
  }
  // wolf: at the daily-average rate 100 -> 30 % takes 0.7 x 12 % x 40 kg / 1895 mL/d = 1.77 game days
  const days = .7 * .12 * 40000 / 1895; near(days, 1.773, .01);
  // walking (factor 1.99) 100 -> 30 % in ~21 game hours = ~1.8 real hours of walking
  const walkHours = .7 * .12 * 40000 / (1895 / 24 * activityFactor(WOLF_NEEDS, 2)); near(walkHours, 21.4, .3);
  near(walkHours * 3600 / GAME_PER_REAL / 3600, 1.78, .03);
});
test('drinking at water restores hydration at the lapping rate; eating prey adds its body water', () => {
  const drunk = run(WOLF_NEEDS, 0, 60, createNeeds({ water: 30 }), 100, 10, true).st.water;
  near(drunk - 30, 60 * 7.5 * percentPerMl(WOLF_NEEDS) - 60 * -needRates(WOLF_NEEDS, 0).water, .01);
  const fill = .7 * .12 * 40000 / 7.5 / GAME_PER_REAL; near(fill, 37.3, .2); // real seconds from 30 % to full
  assert.equal(run(WOLF_NEEDS, 3, 60, createNeeds({ water: 30 }), 100, 10, true).st.water < 30, true, 'no drinking while moving');
  near(eatWater(WOLF_NEEDS, createNeeds({ water: 50 }), 'hare', 1.5).water - 50, 1.5 * 650 * percentPerMl(WOLF_NEEDS), 1e-9);
  near(eatWater(HARE_NEEDS, createNeeds({ water: 50 }), 'clover', .01).water - 50, 8.3 * percentPerMl(HARE_NEEDS), 1e-9);
  assert.equal(eatWater(WOLF_NEEDS, createNeeds({ water: 99 }), 'hare', 1.5).water, 100);
});
test('energy (the existing stat) drains 100 per day at the FMR rate; rest drains with activity and refills while still', () => {
  for (const sp of [WOLF_NEEDS, HARE_NEEDS]) {
    near(100 - run(sp, 0, 86400).e, 100 * activityFactor(sp, 0), .5, sp.id);
    const tired = run(sp, sp.body.speeds.walk.v, sp.needs.rest.activeHoursToEmpty.v * 3600).st.rest; near(tired, 0, .5, `${sp.id} empties`);
    near(run(sp, 0, sp.needs.rest.restHoursToFull.v * 3600, createNeeds({ rest: 0 })).st.rest, 100, .5, `${sp.id} refills`);
  }
  assert.deepEqual(agentLevels(HARE_NEEDS), { energy: { drain: 100 / 86400 }, stamina: { max: 100, drainSeconds: 8, recoverSeconds: 8 } }); // = HARE_AGENT (T-0009)
  near(staminaRates(WOLF_NEEDS).sprint * 10, 83.3, .1); assert.ok(100 / staminaRates(WOLF_NEEDS).sprint >= 10 && 100 / staminaRates(WOLF_NEEDS).run >= 30);
});
test('thresholds and timing: below 30 % every 10 s, fading to 0 within 1.5-2 s; at 10 % a pulsing alert every 3 s', () => {
  const c = createThoughtClock(); const born: number[] = [];
  for (let i = 0; i <= 600; i++) { const t = i * .05; for (const th of thoughtTick(c, { water: 25, energy: 80, rest: 80 }, t)) { born.push(t); assert.equal(th.style, 'low'); assert.equal(th.need, 'water'); } }
  assert.deepEqual(born.map(t => Math.round(t * 100) / 100), [0, 10, 20, 30]);
  assert.equal(thoughtTick(createThoughtClock(), { water: 30, energy: 80, rest: 80 }, 0).length, 0, '30 % is not below 30 %');
  const th = { need: 'water' as const, style: 'low' as const, born: 0, lane: 0 };
  assert.ok(thoughtLook(th, .5)!.alpha < .6 && thoughtLook(th, .5)!.alpha > 0, 'semi-transparent');
  assert.ok(thoughtLook(th, 1.7)!.alpha < .01); assert.equal(thoughtLook(th, THOUGHT_RULES.fade), undefined);
  assert.ok(THOUGHT_RULES.fade >= 1.5 && THOUGHT_RULES.fade <= 2 && THOUGHT_RULES.alertFade >= 1.5 && THOUGHT_RULES.alertFade <= 2);
  assert.ok(thoughtLook(th, 1)!.rise > thoughtLook(th, .2)!.rise, 'floats up');
  const a = createThoughtClock(), alerts: number[] = [];
  for (let i = 0; i <= 180; i++) { const t = i * .05; for (const x of thoughtTick(a, { water: 8, energy: 80, rest: 80 }, t)) { alerts.push(Math.round(t * 100) / 100); assert.equal(x.style, 'alert'); } }
  assert.deepEqual(alerts, [0, 3, 6, 9]);
  const al = { ...th, style: 'alert' as const }, scales = [.05, .1, .15, .2].map(t => thoughtLook(al, t)!.scale);
  assert.ok(Math.max(...scales) - Math.min(...scales) > .2, 'pulses');
  // low -> critical switches style at once
  const s = createThoughtClock(); thoughtTick(s, { water: 20, energy: 80, rest: 80 }, 0); assert.equal(thoughtTick(s, { water: 9, energy: 80, rest: 80 }, .1)[0]?.style, 'alert');
  assert.equal(thoughtTick(s, { water: 60, energy: 80, rest: 80 }, 50).length, 0, 'recovered: no thoughts');
});
test('thought figures live in the system properties file (Matthew: one place for gameplay figures)', () => {
  assert.equal(THOUGHT_RULES, SYSTEM_PROPERTIES.needsThoughts);
  assert.deepEqual([THOUGHT_RULES.low, THOUGHT_RULES.critical, THOUGHT_RULES.lowEvery, THOUGHT_RULES.criticalEvery], [30, 10, 10, 3]);
  assert.ok(THOUGHT_RULES.lowOpacity < 1 && THOUGHT_RULES.alertOpacity < 1, 'semi-transparent');
});
test('several low needs are staggered in time and stacked in lanes, most urgent first', () => {
  const c = createThoughtClock(), seen: { t: number; need: string; lane: number }[] = [];
  for (let i = 0; i <= 240; i++) { const t = i * .05; for (const th of thoughtTick(c, { water: 25, energy: 15, rest: 28 }, t)) seen.push({ t: Math.round(t * 100) / 100, need: th.need, lane: th.lane }); }
  assert.deepEqual(seen.slice(0, 3), [{ t: 0, need: 'energy', lane: 0 }, { t: STAGGER, need: 'water', lane: 1 }, { t: 2 * STAGGER, need: 'rest', lane: 2 }]);
  assert.ok(thoughtLook({ need: 'rest', style: 'low', born: 0, lane: 2 }, .5)!.rise > thoughtLook({ need: 'energy', style: 'low', born: 0, lane: 0 }, .5)!.rise);
});
test('behaviour model from the template: needs drive goals, activity pattern, flight, gait by urgency (both species)', () => {
  const sun = sunTimes(227); assert.ok(sun.sunrise > 4 && sun.sunrise < 6.5 && sun.sunset > 18 && sun.sunset < 20.5, JSON.stringify(sun));
  const ctx = { hour: 12, ...sun }, full = levelsOf(createNeeds(), 100);
  assert.equal(chooseGoal(WOLF_NEEDS, { ...full, water: 70 }, ctx).goal, 'drink');
  assert.equal(chooseGoal(WOLF_NEEDS, { ...full, water: 70 }, ctx).gait, 'walk');
  assert.equal(chooseGoal(WOLF_NEEDS, { ...full, water: 8 }, ctx).gait, 'sprint');
  assert.equal(chooseGoal(WOLF_NEEDS, { ...full, energy: 40 }, ctx).goal, 'hunt');
  assert.equal(chooseGoal(HARE_NEEDS, { ...full, energy: 40 }, ctx).goal, 'forage');
  assert.equal(chooseGoal(WOLF_NEEDS, { ...full, rest: 20, water: 80 }, ctx).goal, 'bed-down', 'lowest relative level wins');
  assert.equal(chooseGoal(HARE_NEEDS, full, { ...ctx, threat: { kind: 'wolf', distance: 3 } }).goal, 'flee');
  assert.equal(chooseGoal(HARE_NEEDS, full, { ...ctx, threat: { kind: 'wolf', distance: 8 } }).goal, 'alert');
  assert.equal(chooseGoal(WOLF_NEEDS, full, { ...ctx, threat: { kind: 'wolf', distance: 1 } }).goal, 'explore', 'a wolf does not fear wolves; noon: crepuscular trough but rested');
  assert.equal(chooseGoal(WOLF_NEEDS, { ...full, rest: 80 }, ctx).goal, 'rest', 'midday trough and not fully rested');
  assert.equal(activityAt(WOLF_NEEDS, { ...sun, hour: sun.sunrise }), 1); assert.equal(activityAt(WOLF_NEEDS, ctx), .35);
  assert.equal(activityAt(HARE_NEEDS, { ...sun, hour: 1 }), 1); assert.equal(activityAt(HARE_NEEDS, ctx), .2);
});
test('needs save round-trips and are tagged snapshot', () => {
  assert.deepEqual(parseNeeds(JSON.stringify({ water: 42.5, rest: 7, energy: 3 })), { water: 42.5, rest: 7 });
  assert.deepEqual(parseNeeds('garbage'), createNeeds()); assert.deepEqual(parseNeeds(JSON.stringify({ water: 400 })), { water: 100, rest: 100 });
  assert.deepEqual(untagged('needs', createNeeds()), []);
});
import { nearestWater, waterAhead, waterAt } from '../src/core/needs/water';
test('drinking needs visible water within muzzle reach (0.6-1.8 m ahead), not shore mud', () => {
  const w = nearestWater(0, 0); assert.ok(w && waterAt(w.x, w.z));
  const d = Math.hypot(w!.x, w!.z), ux = w!.x / d, uz = w!.z / d, h = Math.atan2(-ux, -uz);
  let x = w!.x - ux * 1.2, z = w!.z - uz * 1.2; // back off until dry, then stand 1 m from the edge
  while (waterAt(x, z)) { x -= ux * .5; z -= uz * .5; }
  assert.ok(waterAhead(x - ux * .0, z - uz * .0, h) || waterAhead(x + ux * .5, z + uz * .5, h));
  assert.equal(waterAhead(x - ux * 6, z - uz * 6, h), false, '6 m back: out of reach');
  assert.equal(waterAhead(x, z, h + Math.PI), false, 'facing away');
});
