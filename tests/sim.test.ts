/** T-0036: headless animal sim (core/sim), senses, diets, group awareness, vigilance, capture tuning. No renderer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NEEDS_SPECIES, HARE_NEEDS, WOLF_NEEDS } from '../src/core/needs/species';
import { sourcedEntries } from '../src/core/needs/template';
import { createAnimal, createWorld, addFood, tick, takeEvents, nearbyAnimals, nearbyFood, type SimAnimal } from '../src/core/sim';
import { perceive, inView } from '../src/core/needs/senses';
import { dietOf, DIETS, gameSpeed } from '../src/core/needs/diet';
import { vigilance, linkHops, sharedDetections, scatterBend } from '../src/core/needs/social';
import { simulateHunt, STYLES } from './huntSim';

test('every species template defines needs, senses, stamina, a diet and social values, all sourced and finite', () => {
  for (const [id, sp] of Object.entries(NEEDS_SPECIES)) {
    assert.ok(sp.needs && sp.senses && sp.stamina && sp.diet && sp.social, id);
    assert.ok(DIETS[sp.diet.kind] && Object.keys(sp.diet.foods).length > 0, `${id} diet`);
    for (const [path, s] of sourcedEntries(sp)) {
      const vals = Array.isArray(s.v) ? s.v : [s.v];
      assert.ok(vals.every(v => typeof v !== 'number' || Number.isFinite(v)), `${id}.${path}`); assert.ok(s.src.length > 3, `${id}.${path} source`);
    }
    assert.ok(sp.senses.sight.fovDeg.v > 0 && sp.senses.hearing.rangeM.v > 0 && sp.senses.smell.potency.v > 0, id);
  }
});
test('stamina: wolf sprint >= 10 s and run >= 30 s; the hare burst is faster but shorter', () => {
  assert.ok(WOLF_NEEDS.stamina.sprintSeconds.v >= 10 && WOLF_NEEDS.stamina.runSeconds.v >= 30);
  assert.ok(HARE_NEEDS.stamina.sprintSeconds.v < WOLF_NEEDS.stamina.sprintSeconds.v);
  assert.ok(HARE_NEEDS.behaviour.evasion.burstSpeed.v / HARE_NEEDS.body.massKg.v > WOLF_NEEDS.behaviour.evasion.burstSpeed.v / WOLF_NEEDS.body.massKg.v);
  assert.ok(Math.abs(gameSpeed(WOLF_NEEDS.behaviour.evasion.burstSpeed.v) - 10.5) < 1e-9); // = the player wolf's game sprint
});
test('senses: the hare sees behind (360 deg), the wolf does not (250 deg); stealth hides a slow, crouched body', () => {
  const o = { x: 0, z: 0, heading: 0 }, behind = { x: 0, z: 10 }; // forward is -Z
  assert.ok(inView(HARE_NEEDS, o, behind)); assert.ok(!inView(WOLF_NEEDS, o, behind));
  const env = { daylight: 1, wind: { x: 0, z: 0 } };
  const walk = perceive(HARE_NEEDS, o, { x: 0, z: -12, speed: 2 }, env).level, stalk = perceive(HARE_NEEDS, o, { x: 0, z: -12, speed: .35, crouched: true }, env).level;
  assert.ok(walk > .25 && stalk < .1, `${walk} ${stalk}`);
});
test('diets share one interface: a wolf eating a hare and a hare grazing clover both refill Energy and hydration', () => {
  for (const [sp, food] of [[WOLF_NEEDS, 'hare'], [HARE_NEEDS, 'clover']] as const) {
    const r = dietOf(sp).eat(sp, { water: 50, rest: 50 }, 50, food);
    assert.ok(r.energy > 50 && r.state.water > 50, `${sp.id} ${food}`);
  }
  // a whole hare is ~half a wolf day; a hare's day of clover (167 g DM, HARE_AGENT) is ~a full day
  const hareMeal = dietOf(WOLF_NEEDS).meal(WOLF_NEEDS, 'hare'); assert.ok(hareMeal.energy > 30 && hareMeal.energy < 80, String(hareMeal.energy));
  const day = dietOf(HARE_NEEDS).meal(HARE_NEEDS, 'clover', .167 / .17).energy * HARE_NEEDS.needs.energy.fullSeconds.v / 86400; assert.ok(day > 80 && day < 120, String(day)); // % of one day's FMR
});
test('group awareness: a wolf seen by hare A alerts linked hare B; outside link distance there is no relay', () => {
  const L = HARE_NEEDS.social.linkM.v;
  for (const [gap, expect] of [[L * .7, true], [L * 1.4, false]] as const) {
    const w = createWorld({ step: .05 }); const A = createAnimal(w, 'hare', { x: 0, z: 0, heading: 0 }), B = createAnimal(w, 'hare', { x: gap, z: 0, heading: 0 });
    const wolf = createAnimal(w, 'wolf', { x: -14, z: 0 }, { controlled: true }); Object.assign(wolf, { speed: 2 });
    assert.ok(perceive(HARE_NEEDS, B, { x: wolf.x, z: wolf.z, speed: 2 }, { daylight: 1, wind: { x: 0, z: 0 } }).level < .25, 'B cannot sense the wolf itself');
    tick(w, 1);
    assert.ok(A.knowsAt !== undefined); assert.equal(B.knowsAt !== undefined, expect, `gap ${gap}`);
    if (expect) assert.ok(B.relayed || B.state === 'freeze');
  }
  // the pure helper agrees (chains count: A-B-C)
  const hops = linkHops(HARE_NEEDS, [{ x: 0, z: 0 }, { x: L * .9, z: 0 }, { x: L * 1.8, z: 0 }]); assert.equal(hops[0][2], 2);
  const known = sharedDetections(HARE_NEEDS, [{ x: 0, z: 0 }, { x: L * .9, z: 0 }, { x: L * 3, z: 0 }], [0, undefined, undefined], 1);
  assert.ok(known[0] === 0 && known[1] !== undefined && known[2] === undefined);
});
test('vigilance: a hare with a linked neighbour grazes a larger share of its time and detects a stalking wolf no later', () => {
  assert.ok(vigilance(HARE_NEEDS, 1).grazeShare > vigilance(HARE_NEEDS, 0).grazeShare);
  assert.ok(vigilance(HARE_NEEDS, 1).corporate > vigilance(HARE_NEEDS, 0).corporate);
  const run = (mate: boolean) => {
    const w = createWorld({ step: .05, seed: 3 }); const h = createAnimal(w, 'hare', { x: 0, z: 0 });
    if (mate) createAnimal(w, 'hare', { x: -10, z: 0 }); // the mate sits toward the wolf's line
    const wolf = createAnimal(w, 'wolf', { x: -40, z: 0 }, { controlled: true });
    let graze = 0, total = 0, detected = Infinity;
    for (let t = 0; t < 120; t += .05) {
      if (t > 60) { wolf.x += .8 * .05; Object.assign(wolf, { speed: .8, crouched: true }); } // stalk in after 60 s of grazing
      tick(w, .05); if (t <= 60) { total++; if (h.state === 'graze') graze++; }
      if (h.knowsAt !== undefined && detected === Infinity) detected = t;
    }
    return { share: graze / total, detected };
  };
  const lone = run(false), pair = run(true);
  assert.ok(pair.share >= lone.share, `${pair.share} ${lone.share}`);
  assert.ok(pair.detected <= lone.detected, `${pair.detected} ${lone.detected}`);
});
test('scatter: linked hares bend their flight away from each other (confusion effect)', () => {
  const mates = [{ x: -1, z: 0 }, { x: 1, z: 0 }], threat = { x: 0, z: 10 };
  const b0 = scatterBend(HARE_NEEDS, mates, 0, threat), b1 = scatterBend(HARE_NEEDS, mates, 1, threat);
  assert.ok(b0 !== 0 && Math.sign(b0) === -Math.sign(b1));
  const dir = (m: { x: number; z: number }, bend: number) => { const h = Math.atan2(m.x - threat.x, m.z - threat.z) + Math.PI + bend; return -Math.sin(h); }; // x of the flight
  assert.ok(dir(mates[0], b0) < 0 && dir(mates[1], b1) > 0, 'each flees outward');
});
test('headless: 200 hares + 5 wolves tick for 10 simulated minutes with no renderer', () => {
  const w = createWorld({ seed: 11, step: .1 }); let r = 1;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 200; i++) createAnimal(w, 'hare', { x: rnd() * 400 - 200, z: rnd() * 400 - 200 });
  for (let i = 0; i < 60; i++) addFood(w, 'clover', rnd() * 400 - 200, rnd() * 400 - 200, .5);
  const wolves: SimAnimal[] = []; for (let i = 0; i < 5; i++) wolves.push(createAnimal(w, 'wolf', { x: rnd() * 400 - 200, z: rnd() * 400 - 200 }, { energy: 25 })); // hungry: they hunt
  const t0 = Date.now(); const events: string[] = [];
  for (let s = 0; s < 600; s++) { tick(w, 1); events.push(...takeEvents(w).map(e => e.type)); }
  const ms = Date.now() - t0;
  assert.ok(Math.abs(w.time - 600) < 1e-6);
  for (const a of w.animals) assert.ok([a.x, a.z, a.energy, a.needs.water, a.needs.rest, a.stamina].every(Number.isFinite), `animal ${a.id}`);
  assert.ok(events.includes('bolt'), 'hares bolted from wolves');
  assert.ok(nearbyAnimals(w, 0, 0, 1e4, 'hare').length > 150 && nearbyFood(w, 0, 0, 1e4).length > 0);
  assert.ok(ms < 60000, `${ms} ms`);
  console.log(`# 205 animals x 600 s at .1 s steps: ${ms} ms; events`, Object.fromEntries([...new Set(events)].map(k => [k, events.filter(e => e === k).length])));
});
test('core/sim and core/needs import no Three.js (transitively)', () => {
  const seen = new Set<string>(), bad: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return; seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) {
      const spec = m[1]; if (spec === 'three' || spec.startsWith('three/')) { bad.push(file); continue; }
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(file), spec.replace(/\.js$/, '')); const next = [base + '.ts', base + '/index.ts'].find(existsSync); if (next) visit(next);
    }
  };
  visit(resolve('src/core/sim/index.ts'));
  assert.deepEqual(bad, []); assert.ok(seen.size > 5);
});
test('capture tuning: a catch is achievable with skill but not trivial (field: lynx 29 %, coyote 37 % of chases)', () => {
  for (const s of ['skilled', 'naive'] as const) {
    const r = simulateHunt(STYLES[s], 30, 0, 0, 6000);
    assert.ok(r.tries >= 10, `${s} tries ${r.tries}`); assert.ok(r.rate > .1 && r.rate < .75, `${s} ${r.rate}`);
  }
});
