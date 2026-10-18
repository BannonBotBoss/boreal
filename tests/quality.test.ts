import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNOR, KNOBS, LADDER, MANUAL, applied, governFrame, resetGovernor, tierForGpu } from '../src/core/quality';

const feed = (ms: number, seconds: number) => { let changed = 0; for (let t = 0; t < seconds * 1000; t += 16.7) changed += governFrame(ms, undefined, 16.7); return changed; };
const fresh = (tier = 1) => { Object.assign(GOVERNOR, { auto: true, targetFps: 60, tier, capTier: 0 }); resetGovernor(); for (const k of KNOBS) delete MANUAL[k]; };

test('ladder is ordered best → cheapest and bounded', () => {
  assert.ok(LADDER.length >= 3);
  for (let i = 1; i < LADDER.length; i++) for (const k of KNOBS) assert.ok(LADDER[i][k] <= LADDER[i - 1][k], `${k} not non-increasing at ${LADDER[i].name}`);
  for (const t of LADDER) { assert.ok(t.resScale >= .5 && t.resScale <= 2); assert.ok(t.shadows >= 0 && t.shadows <= 3); assert.ok(t.lod <= 1 && t.trees <= 1 && t.foliage <= 1); assert.ok(t.near <= t.mid); }
  fresh(); assert.equal(applied(-5).name, LADDER[0].name); assert.equal(applied(99).name, LADDER.at(-1)!.name);
});
test('steps down after sustained overload (drei-style 10 × 250 ms windows), not on a short spike', () => {
  fresh(); assert.equal(feed(40, 1), 0, 'a 1 s spike does not trigger');
  fresh(); feed(1000 / 70, 2); feed(40, 3); assert.equal(GOVERNOR.tier, 2, 'stepped down one tier');
});
test('hysteresis: no change inside the margin; steps up only with clear headroom', () => {
  fresh(2); feed(1000 / 70, 10); assert.equal(GOVERNOR.tier, 2, 'between 60 and 81 fps work: hold');
  fresh(2); feed(5, 3); assert.equal(GOVERNOR.tier, 1, 'stepped up');
});
test('flip-flops lock on the cheaper tier; manual caps bound the ladder', () => {
  fresh(2); GOVERNOR.flipflops = 2;
  for (let i = 0; i < 6 && !GOVERNOR.locked; i++) { feed(40, 14); feed(5, 44); } // each leg outlasts the 10 s cooldown / 30 s up-hold
  assert.ok(GOVERNOR.locked); const at = GOVERNOR.tier; feed(5, 5); assert.equal(GOVERNOR.tier, at, 'locked'); GOVERNOR.flipflops = 6;
  fresh(3); GOVERNOR.capTier = 2; feed(5, 10); assert.equal(GOVERNOR.tier, 2, 'climbs only to the cap');
  fresh(0); MANUAL.shadows = 1; MANUAL.resScale = .8; const a = applied(); assert.equal(a.shadows, 1); assert.equal(a.resScale, .8);
  GOVERNOR.auto = false; GOVERNOR.tier = 3; feed(40, 10); assert.equal(GOVERNOR.tier, 3, 'manual mode never moves');
  fresh();
});
test('time hysteresis: 10 s cooldown, 30 s up-hold after a drop, world knobs wait 20 s for a tier that holds; median ignores stalls', () => {
  fresh(1); feed(40, 3); assert.equal(GOVERNOR.tier, 2, 'stepped down');
  let a = applied(); assert.equal(a.resScale, LADDER[2].resScale, 'cheap knobs move at once'); assert.equal(a.lod, LADDER[1].lod); assert.equal(a.near, LADDER[1].near); assert.equal(a.shadows, LADDER[1].shadows);
  feed(40, 6); assert.equal(GOVERNOR.tier, 2, 'cooldown: no second step');
  feed(5, 16); assert.equal(GOVERNOR.tier, 2, 'up-hold: no bounce back'); a = applied(); assert.equal(a.lod, LADDER[2].lod, 'tier held 20 s: world follows');
  feed(5, 10); assert.equal(GOVERNOR.tier, 1, 'steps up after the hold'); assert.equal(applied().lod, LADDER[2].lod, 'world waits again');
  fresh(1); for (let t = 0; t < 10000; t += 16.7) governFrame(t % 1000 < 20 ? 400 : 14, undefined, 16.7); assert.equal(GOVERNOR.tier, 1, 'a 400 ms stall each second: median holds');
  fresh(1); GOVERNOR.auto = false; GOVERNOR.tier = 3; assert.equal(applied().lod, LADDER[3].lod, 'manual: world knobs follow at once'); fresh();
});
test('GPU detection picks the starting tier; XR caps apply on top', () => {
  assert.equal(tierForGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 0);
  assert.equal(tierForGpu('ANGLE (Intel, Intel(R) Graphics (0x00007D55) Direct3D11)'), 2);
  assert.equal(tierForGpu('Adreno (TM) 740'), 3);
  fresh(0); GOVERNOR.xr = true; const a = applied(); assert.equal(a.shadows, 1); assert.equal(a.ssao, 0); assert.ok(a.resScale <= 1); GOVERNOR.xr = false;
});
import { airMass, exposureFor, moonAge, moonLux, rayleighTau, sunColour, LUX } from '../src/core/light';
test('natural light: Rayleigh depth, reddening at low sun, moon phase and exposure', () => {
  assert.ok(Math.abs(rayleighTau(.55) - .0973) < .003, `τR(550 nm) ${rayleighTau(.55)}`); // Bucholtz 1995: 0.0973 at 550 nm
  assert.ok(Math.abs(airMass(1) - 1) < .01 && airMass(Math.cos(80 * Math.PI / 180)) > 5.5);
  const noon = sunColour(1), low = sunColour(Math.cos(87 * Math.PI / 180));
  assert.ok(Math.abs(noon.b - 1) < 1e-9 && low.b < .5 * low.r, 'sunset is red');
  assert.ok(moonAge(6, 2000) > 29 && moonAge(7, 2000) < 1, 'new moon on 2000-01-06 18:14 UT');
  assert.ok(Math.abs(moonLux(SYN / 2, 1) - LUX.fullMoon) < 1e-9 && moonLux(1, 1) < .001 * LUX.fullMoon * 100);
  assert.equal(exposureFor(LUX.ref), 1); assert.ok(exposureFor(.27) > 1e4);
});
const SYN = 29.530589;
import { random, sample } from '../src/proc/rng';
import { TREE_SPECIES, chapmanRichards, standTable } from '../src/core/treeSpecies';
test('bounded distributions: within bounds, mean and SD match (normal + lognormal); every species table is sane', () => {
  const r = random(7), d = { mean: 25, sd: 6, min: 8, max: 50 }, xs = Array.from({ length: 20000 }, () => sample(r, d));
  const m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  assert.ok(xs.every(x => x >= 8 && x <= 50)); assert.ok(Math.abs(m - 25) < .2, `mean ${m}`); assert.ok(Math.abs(sd - 6) < .2, `sd ${sd}`); // truncation at ±2.8σ barely moves them
  const ln = { mean: 20, sd: .1, min: 10, max: 30, kind: 'lognormal' as const }, ys = Array.from({ length: 20000 }, () => sample(r, ln)).map(Math.log);
  const lm = ys.reduce((a, b) => a + b, 0) / ys.length; assert.ok(Math.abs(Math.exp(lm) - 20) < .2, 'lognormal median');
  for (const sp of TREE_SPECIES) {
    for (const [k, v] of Object.entries(sp.attr)) if ('min' in v) assert.ok(v.min <= v.mean && v.mean <= v.max && v.sd > 0, `${sp.id}.${k}`);
    const H = chapmanRichards(sp.attr.dbh.mean, sp.attr.hd); assert.ok(H >= sp.height[0] * .7 && H <= sp.height[1] * 1.2, `${sp.id} H(mean DBH) = ${H}`);
  }
  const dry = standTable(0), wet = standTable(1), share = (t: readonly (readonly [string, number])[], id: string) => { const i = t.findIndex(x => x[0] === id); return t[i][1] - (i ? t[i - 1][1] : 0); };
  assert.ok(share(dry, 'jack-pine') > share(wet, 'jack-pine') && share(wet, 'black-spruce') > share(dry, 'black-spruce'));
  assert.ok(share(standTable(.45), 'trembling-aspen') > .15, 'aspen common on mesic sites');
});
