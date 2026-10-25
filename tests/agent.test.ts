import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CLOVER, CLOVER_WHY, CLOVER_STATE, clearingAt, cloverPatchesInTile, cloverSuitability, cloverStateJSON, loadCloverState, createCloverField, grazeTransaction, regrowTransaction, regrowthRate, daylightFraction, sunSeconds, unitsAt, groundLight, cloverSiteAt, type CloverPatch, type CloverSite } from '../src/core/fields';
import { lighting, sunPosition, hourAt, dayAt, REAL_SECONDS_PER_GAME_HOUR } from '../src/core/timeOfDay';
import { createAgent, stepAgent, modulators, updateLevels, perceive, agentReadout, writeLocomotion, agentSnapshot, restoreAgent, groupVigilance, herdBouts, alarmDelay, deerPosture, type Agent, type AgentWorld, type FoodSource, type Mate } from '../src/core/agent';
import { HARE_AGENT, BEHAVIOUR, DEER_AGENT, BROWSE } from '../src/core/species';
import { deerSoundIds } from '../src/audio/borealSound';
import { stream } from '../src/proc/rng';
import { TRANSACTIONS } from '../src/core/transactions';
import { CONTACTS } from '../src/core/contactBus';
import { climate, solar, shortwave } from '../src/core/weather';
import { untagged } from '../src/core/stateFields';
import { createSnapshotHub } from '../src/core/snapshot';
import { siteAt } from '../src/core/flora/site';
import { AnimalBrain } from '../src/core/animalBehavior';

const patch = (x = 0, z = 0, r = 1, light = 1): CloverPatch => { const max = Math.round(Math.PI * r * r * CLOVER.unitsPerM2); return { key: `clover:t:${x}:${z}`, x, z, r, light, max, units: max, at: 0, stolon: Math.PI * r * r * CLOVER.stolonGPerM2, why: CLOVER_WHY.map(w => ({ ...w })) }; };
const source = (ps: CloverPatch[]): FoodSource => ({
  at: (x, z, pad = 0) => ps.find(p => p.units > 0 && Math.hypot(p.x - x, p.z - z) < p.r + pad),
  nearest: (x, z, range, except) => ps.filter(p => p.units > 0 && p.key !== except && Math.hypot(p.x - x, p.z - z) < range).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0],
  eat: (key, units, by) => { const p = ps.find(q => q.key === key); return p ? grazeTransaction(p, units, by) : 0; },
});
const quiet: AgentWorld['wind'] = { x: 0, z: 0 };
const world = (ps: CloverPatch[], wolf?: { x: number; z: number; speed: number; crouched?: boolean }, extra: Partial<AgentWorld> = {}): AgentWorld =>
  ({ others: wolf ? [{ key: 'player', kind: 'wolf', ...wolf }] : [], wind: quiet, daylight: 1, food: { clover: source(ps) }, ...extra });
const hare = (seed: string, x = 0, z = 0, init: Parameters<typeof createAgent>[5] = {}) => createAgent(HARE_AGENT, `hare:${seed}`, x, z, stream(1, seed), init);
const run = (a: Agent, w: AgentWorld | (() => AgentWorld), seconds: number, dt = 1 / 30, each?: (a: Agent, t: number) => void) => {
  const evs = []; for (let t = 0; t < seconds; t += dt) { evs.push(...stepAgent(a, typeof w === 'function' ? w() : w, dt)); each?.(a, t); } return evs; };

// Nature check (notes/grok.md "Clover and hare numbers"): every rate below is a sourced figure, not a tuning.
const DAY = 86400, HARE_G_PER_DAY = 167, CROP_SECONDS_PER_DAY = 8.7 * 3600 * .26; // Seeley Lake captive hares; Belovsky 1984
const near = (v: number, want: number, tol: number, what: string) => assert.ok(Math.abs(v / want - 1) < tol, `${what}: ${v} vs ${want}`);
test('clover units are real biomass: 10 000 units/m^2 = 150 g DM/m^2 of leaf; hare crops 20.5 mg DM/s; 100 energy = a day of food', () => {
  const p = patch(); const d = HARE_AGENT.diet.clover, E = HARE_AGENT.levels.energy;
  near(p.max * CLOVER.mgPerUnit / 1000 / (Math.PI * p.r * p.r), 150, .01, 'g DM/m^2 of a full patch');
  near(d.eatUnits / d.eatSeconds * CLOVER.mgPerUnit, HARE_G_PER_DAY * 1000 / CROP_SECONDS_PER_DAY, .01, 'mg DM/s while cropping');
  near(E.max * d.unitsPerEnergy * CLOVER.mgPerUnit / 1000, HARE_G_PER_DAY, .01, 'g DM in 100 energy');
  near(E.drain * DAY, E.max, 1e-9, 'energy spent per real day');
  let eaten = 0; for (let i = 0; i < 90; i++) eaten += grazeTransaction(p, d.eatUnits / d.eatSeconds / 30, 'hare:1');
  near(eaten, 4.1, 1e-6, 'units in one 3 s bout'); assert.equal(p.why.at(-1)?.step, 'grazed');
  const small = patch(); small.units = 5; assert.equal(grazeTransaction(small, 100, 'hare:1'), 5); assert.equal(small.units, 0); assert.equal(grazeTransaction(small, 100, 'hare:1'), 0);
});
test('clover regrowth: 6 g DM/m^2 per summer day from the stolons, ~25 days bare -> full; none at night, in the cold or without stolon', () => {
  const p = patch(); p.units = 0; // one full day (day 227, 20 C) with the game's own daylight curve, 60 s steps
  for (let t = 0; t < DAY; t += 60) regrowTransaction(p, 60, lighting(sunPosition(t / 3600, 227).elevation).day, 20, 227);
  near(p.units / (Math.PI * p.r * p.r) * CLOVER.mgPerUnit / 1000, CLOVER.growth.gPerM2Day, .02, 'g/m^2 grown in a day');
  const days = p.max / p.units; assert.ok(days >= 21 && days <= 28, `recovery ${days.toFixed(1)} d (nature 21-28 d)`);
  assert.ok(daylightFraction(227) > .5 && daylightFraction(227) < .7, 'mid-August at 49.5 N: ~14-15 h of light');
  assert.equal(regrowthRate(p, 0, 20), 0, 'night'); assert.equal(regrowthRate(p, 1, 4), 0, 'below 5 C (frost, winter)');
  near(regrowthRate(p, 1, 12.5), regrowthRate(p, 1, 20) / 2, 1e-9, 'half rate at 12.5 C'); near(regrowthRate(p, 1, 30), regrowthRate(p, 1, 20), 1e-9, 'plateau');
  near(regrowthRate(patch(0, 0, 1, .5), 1, 20), regrowthRate(p, 1, 20) / 2, 1e-9, 'half site light, half growth');
  const g = patch(); const stolon = g.stolon; grazeTransaction(g, 1e9, 'hare:1');
  assert.equal(g.units, 0, 'grazed out'); assert.equal(g.stolon, stolon, 'grazing never takes the stolons / growing points');
  assert.ok(regrowthRate(g, 1, 20) > 0, 'a grazed-out patch regrows from its residual'); regrowTransaction(g, 1, 1); assert.equal(g.why.at(-1)?.step, 'regrew');
  const dead = patch(); dead.units = 0; dead.stolon = 0; assert.equal(regrowthRate(dead, 1, 20), 0, 'no stolon, no regrowth');
});
test('depletion emerges: a cropping hare outeats a patch ~60x faster than it regrows; one hare grazes a 1 m patch out in ~2.8 days', () => {
  const p = patch(0, 0, 1); const crop = HARE_AGENT.diet.clover.eatUnits / HARE_AGENT.diet.clover.eatSeconds, peak = regrowthRate(p, 1, 20);
  assert.ok(crop / peak > 40, `crop ${crop.toFixed(3)}/s vs peak regrowth ${peak.toFixed(4)}/s`);
  const perDayGrow = CLOVER.growth.gPerM2Day * 1000 / CLOVER.mgPerUnit * Math.PI, perDayEat = crop * CROP_SECONDS_PER_DAY;
  const days = p.max / (perDayEat - perDayGrow); assert.ok(days > 2.5 && days < 3.5, `grazed out in ${days.toFixed(2)} days`);
});
test('clover: grows only where sunlight reaches the ground (open, dry, gentle); none in shade or water', () => {
  const open = { water: false, light: 1, wet: .4, rock: 0, slopeDeg: 5 };
  assert.ok(cloverSuitability(open) > .9); assert.equal(cloverSuitability({ ...open, light: .3 }), 0);
  assert.equal(cloverSuitability({ ...open, water: true }), 0); assert.equal(cloverSuitability({ ...open, slopeDeg: 30 }), 0);
  const sunny = cloverPatchesInTile(3, 4, () => open), shade = cloverPatchesInTile(3, 4, () => ({ ...open, light: .35 }));
  assert.ok(sunny.length >= 5, `sunny ${sunny.length}`); assert.equal(shade.length, 0);
  assert.deepEqual(cloverPatchesInTile(3, 4, () => open).map(p => p.key), sunny.map(p => p.key)); // seeded
});
test('clearings: a low-frequency mask leaves sunlit gaps over ~5-35 % of the forest', () => {
  let n = 0, inGap = 0; for (let x = -2000; x < 2000; x += 17) for (let z = -2000; z < 2000; z += 17) { n++; if (clearingAt(x, z) > .5) inGap++; }
  const share = inGap / n; assert.ok(share > .05 && share < .35, `clearing share ${share.toFixed(3)}`);
  assert.ok(Math.abs(clearingAt(10, 10) - clearingAt(11, 10)) < .1); // smooth, not speckle
});
test('levels: energy -100 per real day at rest, x8 in flight; stamina empties in 8 s of flight and refills in 8 s of rest', () => {
  const none = { level: 0, sight: 0, sound: 0, scent: 0, moving: false, distance: Infinity };
  const a = hare('lv', 0, 0, { energy: 50 }); a.action = 'rest'; for (let i = 0; i < 864; i++) updateLevels(a, 1, none); assert.ok(Math.abs(a.energy - 49) < 1e-9, `${a.energy}`);
  a.action = 'flee'; for (let i = 0; i < 80; i++) updateLevels(a, .1, none); assert.ok(Math.abs(a.energy - (49 - 64 / 864)) < 1e-9); assert.ok(a.stamina < 1e-9);
  a.action = 'rest'; for (let i = 0; i < 40; i++) updateLevels(a, .1, none); assert.ok(Math.abs(a.stamina - 50) < 1e-6); for (let i = 0; i < 40; i++) updateLevels(a, .1, none); assert.equal(a.stamina, 100);
  const g = hare('lv2', 0, 0, { energy: 50 }); g.action = 'feed'; updateLevels(g, 3, none, 4.1, 111); assert.ok(Math.abs(g.energy - (50 + 4.1 / 111 - 3 / 864)) < 1e-9);
});
test('timings emerge from relaxation and hunger: calm + fed = Matthew\'s 3 s graze / 1 s head-up / 3 s sprint / 1 s pause', () => {
  const calm = modulators({ species: HARE_AGENT, relaxation: 100, energy: 90, stamina: 100 }, .5);
  assert.deepEqual([calm.feedBout, calm.scan, calm.alert, calm.flee, calm.pause].map(v => +v.toFixed(6)), [3, 1, 1, 3, 1]);
  const nervous = modulators({ species: HARE_AGENT, relaxation: 20, energy: 90, stamina: 100 }, .5);
  assert.ok(nervous.feedBout < calm.feedBout * .6, 'nervous: short bouts'); assert.ok(nervous.scan > calm.scan * 1.8, 'nervous: long scans');
  assert.ok(nervous.scanChance > calm.scanChance * 5, 'nervous: frequent scans'); assert.ok(nervous.noticeAt < calm.noticeAt, 'nervous: notices weaker cues');
  const hungry = modulators({ species: HARE_AGENT, relaxation: 100, energy: 20, stamina: 100 }, .5);
  assert.ok(hungry.feedBout > calm.feedBout * 1.6, 'hungry: long bouts'); assert.ok(hungry.noticeAt > calm.noticeAt && hungry.fleeAt > calm.fleeAt, 'hungry: tolerates more risk');
  assert.ok(modulators({ species: HARE_AGENT, relaxation: 100, energy: 90, stamina: 100 }, .9).alert < calm.alert, 'strong cue: shorter alert');
  assert.ok(modulators({ species: HARE_AGENT, relaxation: 100, energy: 90, stamina: 10 }, .5).flee < calm.flee, 'low stamina: shorter flight');
});
test('emergent bouts (simulated): calm hare grazes ~3 s bouts with rare scans; nervous one short bouts, many long scans', () => {
  const bouts = (relax: number, energy: number) => {
    const p = patch(0, 0, 1.4); const a = hare(`b${relax}:${energy}`, 0, 0, { relaxation: relax, energy }); const w = world([p]);
    const saved = HARE_AGENT.levels.relaxation.recover;
    HARE_AGENT.levels.relaxation.recover = 0; // hold the mood fixed for the measurement
    const feed: number[] = [], scan: number[] = []; let last = a.action, start = 0, t = 0;
    try { run(a, w, 120, 1 / 30, (b) => { t += 1 / 30; if (b.action !== last) { (last === 'feed' ? feed : last === 'scan' ? scan : []).push(t - start); last = b.action; start = t; } }); }
    finally { HARE_AGENT.levels.relaxation.recover = saved; }
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
    return { feed: mean(feed), scans: scan.length / Math.max(1, feed.length), scan: mean(scan) };
  };
  const calm = bouts(100, 90), nervous = bouts(15, 90), hungry = bouts(100, 5);
  assert.ok(Math.abs(calm.feed - 3) < .35, `calm bout ${calm.feed}`); assert.ok(calm.scans < .3, `calm scans/bout ${calm.scans}`);
  assert.ok(nervous.feed < 2, `nervous bout ${nervous.feed}`); assert.ok(nervous.scans > .6 && nervous.scan > 1.8, `nervous ${JSON.stringify(nervous)}`);
  assert.ok(hungry.feed > 4.5, `hungry bout ${hungry.feed}`);
});
test('graze: head-down on contact (CONTACTS feed edge), slow steps stay inside the patch, eats the patch down', () => {
  const p = patch(0, 0, 1.2); const a = hare('g', .2, .1, { energy: 60 }); const w = world([p]);
  const evs = run(a, w, 60); assert.ok(evs.some(e => e.type === 'eat-start' && e.other === p.key), 'feed contact edge on the CONTACTS bus');
  assert.ok(Math.hypot(a.x, a.z) < p.r + .1, 'stays on its patch'); const ate = p.max - p.units; assert.ok(ate > 30 && ate <= 60 * 4.1 / 3 + 1e-6, `ate ${ate} (at most 20.5 mg/s of cropping)`); assert.ok(a.energy > 60, `energy ${a.energy}`);
});
test('no purposeless motion: a full hare with nothing sensed stays put; a hungry one only moves toward sensed clover or sunlit ground', () => {
  const a = hare('still', 5, 5, { energy: 99 }); run(a, world([]), 60); assert.ok(Math.hypot(a.x - 5, a.z - 5) < 1e-9, 'full + nothing to do: rests in place');
  const far = patch(12, 0, 1); const b = hare('trot', 0, 0, { energy: 40 }); let minD = Infinity;
  run(b, world([far]), 30, 1 / 30, h => { minD = Math.min(minD, Math.hypot(h.x - far.x, h.z - far.z)); });
  assert.ok(minD < far.r, `reached the sensed clover (min ${minD.toFixed(2)})`);
  const c = hare('seek', 0, 0, { energy: 40 }); const sun = (x: number) => x > 0 ? 1 : 0; // sunlight to the east only
  run(c, world([], undefined, { habitat: (x) => sun(x) }), 10); assert.ok(c.x > 1, `sought sunlight east (x ${c.x.toFixed(2)})`);
});
test('wolf: crossing the awareness radius -> head up; moving during the alert -> flight directly away; pause; relax when the wolf is gone', () => {
  const p = patch(0, 0, 1.4); const a = hare('flee', 0, 0, { energy: 90 }); let wolf = { x: 0, z: 40, speed: 2 }; const actions: string[] = [];
  run(a, () => world([p], wolf), 4, 1 / 30, h => { if (actions.at(-1) !== h.action) actions.push(h.action); }); // wolf far: grazing
  assert.ok(!actions.includes('alert'), actions.join());
  wolf = { x: 0, z: 14, speed: 2 }; let alertAt = -1, fleeAt = -1, t = 0;
  run(a, () => world([p], wolf), 1.5, 1 / 30, h => { t += 1 / 30; if (h.action === 'alert' && alertAt < 0) alertAt = t; if (h.action === 'flee' && fleeAt < 0) fleeAt = t; });
  assert.ok(alertAt >= 0 && fleeAt > alertAt + .25, `alert ${alertAt} flee ${fleeAt}`);
  const z0 = a.z; run(a, () => world([p], wolf), 1); assert.ok(a.z < z0 - 5, 'sprints away from the wolf (north, -z)');
  let paused = false, after = ''; wolf = { x: 0, z: 400, speed: 0 }; // wolf gone
  run(a, () => world([p], wolf), 8, 1 / 30, h => { if (h.action === 'pause') paused = true; else if (paused && !after) after = h.action; });
  assert.ok(paused && !['flee', 'alert'].includes(after), `after pause: ${after}`);
});
test('stealth: a wolf creeping below slow-stealth speed is not "moving"; a still crouched wolf at 10 m (downwind) is not noticed', () => {
  const s1 = perceive(HARE_AGENT, { x: 0, z: 0 }, { key: 'p', kind: 'wolf', x: 0, z: 10, speed: .35, crouched: true }, { x: 0, z: 1 }, 1);
  const s2 = perceive(HARE_AGENT, { x: 0, z: 0 }, { key: 'p', kind: 'wolf', x: 0, z: 10, speed: 2 }, { x: 0, z: 1 }, 1);
  assert.equal(s1.moving, false); assert.ok(s2.moving);
  const m = modulators({ species: HARE_AGENT, relaxation: 100, energy: 90, stamina: 100 }); assert.ok(s1.level < m.noticeAt && s2.level > m.noticeAt, `${s1.level} ${s2.level}`);
  const night = perceive(HARE_AGENT, { x: 0, z: 0 }, { key: 'p', kind: 'wolf', x: 0, z: 10, speed: 2 }, { x: 0, z: 1 }, 0); assert.ok(night.sight < s2.sight, 'dimmer sight at night');
});
test('stamina 0: the hare cannot enter flight (freezes instead)', () => {
  const a = hare('tired', 0, 0, { stamina: 0, energy: 90 }); a.action = 'alert'; a.timer = 1; a.elapsed = 1; // mid-alert, out of stamina, wolf moving close
  const evs = stepAgent(a, world([], { x: 0, z: 3, speed: 3 }), 1 / 30);
  assert.ok(!evs.some(e => e.type === 'bolt')); assert.equal(a.action, 'hide');
});
test('relaxation habituates: a steady faint cue holds it part-way down; a strong one drives it low; quiet lets it recover', () => {
  const faint = { level: .2, sight: 0, sound: 0, scent: .2, moving: false, distance: 6 }, none = { ...faint, level: 0, scent: 0 }, strong = { ...faint, level: .55 };
  const a = hare('hab'); a.action = 'alert'; for (let i = 0; i < 600; i++) updateLevels(a, .1, faint);
  assert.ok(Math.abs(a.relaxation - 100 * (1 - .2 / HARE_AGENT.levels.relaxation.panic)) < 1e-6, `settles at ${a.relaxation}`);
  for (let i = 0; i < 100; i++) updateLevels(a, .1, strong); assert.ok(a.relaxation < 10);
  a.action = 'rest'; for (let i = 0; i < 100; i++) updateLevels(a, .1, none); assert.ok(Math.abs(a.relaxation - (100 * (1 - .55 / .6) + 30)) < 1e-6, `recovers 3/s: ${a.relaxation}`);
});
test('alert holds ~1 s (freeze, then flee) unless the wolf is inside the 3.7 m flight distance; flight accelerates at 10 m/s^2', () => {
  // Emmel 2024 (snowshoe hare FID mean 3.7 m; freeze then flee); hold and acceleration are flagged estimates (species.ts)
  const p = patch(0, 0, 1.4), far = hare('hold', 0, 0, { energy: 90 }); let alertAt = -1, fleeAt = -1, t = 0;
  run(far, () => world([p], { x: 0, z: 12, speed: 2 }), 2, 1 / 60, h => { t += 1 / 60; if (h.action === 'alert' && alertAt < 0) alertAt = t; if (h.action === 'flee' && fleeAt < 0) fleeAt = t; });
  assert.ok(alertAt >= 0 && fleeAt - alertAt >= HARE_AGENT.timing.react - 1e-6 && fleeAt - alertAt < HARE_AGENT.timing.react + .1, `alert ${alertAt} flee ${fleeAt}`);
  const close = hare('fid', 0, 0, { energy: 90 }); const speeds: number[] = []; let first = -1; t = 0;
  run(close, () => world([p], { x: 0, z: 3, speed: 0 }), 1.2, 1 / 60, h => { t += 1 / 60; if (h.action === 'flee' && first < 0) first = t; if (h.action === 'flee') speeds.push(h.speed); });
  assert.ok(first >= 0 && first < .1, `inside the flight distance: bolts at once (${first})`);
  const A = HARE_AGENT.speed.accel!; speeds.forEach((v, i) => assert.ok(v <= A * (i + 1) / 60 + 1e-9, `speed ${v} at frame ${i}`));
  assert.ok(Math.max(...speeds) >= HARE_AGENT.speed.flee - 1e-9 && speeds.findIndex(v => v >= HARE_AGENT.speed.flee - 1e-9) / 60 > .8, 'top speed after ~0.85 s (about 3 bounds)');
});

const sunny = (): CloverSite => ({ water: false, light: 1, wet: 0, rock: 0, slopeDeg: 0 });
const GAME_DAY = 24 * REAL_SECONDS_PER_GAME_HOUR;
function field() { let t = 1000; const f = createCloverField(sunny, undefined, 7, () => t); f.ensure(8, 8, 4, 9); return { f, set: (v: number) => { t = v; }, get t() { return t; } }; }

test('lazy regrowth (closed form over sun tables) matches stepping the regrow transaction on the game clock', () => {
  const { f } = field(); const p = [...f.list()][0]; assert.ok(p, 'a sunny tile has patches');
  const w0 = 1000, w1 = w0 + 3 * GAME_DAY; // three game days
  const stepped = { ...p, units: 0 }; const dt = 15;
  for (let w = w0; w < w1; w += dt) { const h = hourAt(w + dt / 2), d = dayAt(w + dt / 2);
    regrowTransaction(stepped, dt, lighting(sunPosition(h, d).elevation).day, climate(d, h).tC, d); }
  const lazy = unitsAt({ ...p, units: 0, at: w0 }, w1);
  assert.ok(lazy > 0, 'grows'); assert.ok(Math.abs(lazy - stepped.units) / stepped.units < .03, `lazy ${lazy.toFixed(1)} vs stepped ${stepped.units.toFixed(1)}`);
  const mid = w0 + 1.37 * GAME_DAY, a = unitsAt({ ...p, units: 0, at: w0 }, mid), b = unitsAt({ ...p, units: a, at: mid }, w1);
  assert.ok(Math.abs(a + 0 - a) < 1e-9 && Math.abs(b - lazy) < 1e-6, 'settling half way changes nothing (additive)');
  assert.equal(sunSeconds(w0, w0), 0); assert.ok(sunSeconds(w0, w0 + GAME_DAY) > 0);
  const far = unitsAt({ ...p, units: 0, at: w0 }, w0 + 1e7); assert.equal(far, p.max, 'a long absence refills exactly to max (capped loop)');
});

test('graze and regrow are transaction rows; graze needs the feed contact; the grazed delta is saved and re-applied', () => {
  CLOVER_STATE.clear(); const F = field(); const p = [...F.f.list()][0];
  assert.equal(TRANSACTIONS.get('clover', 'sun')?.name, 'regrow');
  assert.equal(F.f.eat(p.key, 50, 'hare:91'), 0, 'no contact, no graze'); assert.equal(TRANSACTIONS.get('hare', 'clover')?.name, 'graze');
  CONTACTS.begin({ a: 'hare:91', b: p.key, at: [0, 0, 0], normal: [0, 1, 0], kind: 'feed', source: 'agent:feed' });
  assert.equal(F.f.eat(p.key, 50, 'hare:91'), 50); CONTACTS.end('hare:91', p.key);
  assert.equal(F.f.eat(p.key, 50, 'hare:91'), 0, 'contact ended');
  const d = CLOVER_STATE.get(p.key)!; assert.equal(d.units, p.max - 50); assert.equal(d.at, 1000);
  const json = cloverStateJSON(); loadCloverState(null); assert.equal(CLOVER_STATE.size, 0); loadCloverState(json);
  const G = field(); const q = G.f.get(p.key)!; assert.equal(q.units, p.max - 50, 'a rebuilt tile keeps the graze');
  G.set(1000 + 2 * GAME_DAY); assert.ok(G.f.unitsOf(q) > p.max - 50, 'and regrows from it lazily');
  CLOVER_STATE.clear(); G.f.reload(); assert.equal(G.f.get(p.key)!.units, p.max, 'rewind to before the graze: full again');
  assert.ok(CLOVER.unitsPerM2 > 0);
});

test('every agent and clover patch field is tagged in STATE_FIELDS', () => {
  const a = createAgent(HARE_AGENT, 'hare:1', 0, 0, stream(1, 't')); a.target = { x: 0, z: 0 }; a.food = 'clover:x'; a.contact = 'clover:x';
  assert.deepEqual(untagged('agent', a), []);
  const F = field(); assert.deepEqual(untagged('cloverPatch', [...F.f.list()][0]), []);
});

test('ground light is site shade times shortwave, and night shortwave is zero', () => {
  assert.ok(solar(227, 0).cosZ <= 0, 'hour 0 on day 227 is below the horizon at the site');
  assert.equal(groundLight(0, 0, 227, 0), 0);
  const sw = shortwave(Math.max(0, solar(227, 12).cosZ), 0);
  assert.ok(sw > 0, 'noon shortwave');
  assert.ok(Math.abs(groundLight(0, 0, 227, 12) - siteAt(0, 0).light * sw) < 1e-6);
  const s = siteAt(4, -6), c = cloverSiteAt(4, -6);
  assert.equal(c.water, s.water); assert.equal(c.light, s.light); assert.equal(c.wet, s.wet);
  assert.equal(c.rock, s.rock); assert.equal(c.slopeDeg, s.slopeDeg);
});

const deer = (seed: string, x = 0, z = 0, init: Parameters<typeof createAgent>[5] = {}) => createAgent(DEER_AGENT, `deer:${seed}`, x, z, stream(3, seed), init);
const deerWorld = (wolf?: { x: number; z: number; speed: number }, mates: Mate[] = []): AgentWorld =>
  ({ others: wolf ? [{ key: 'player', kind: 'wolf', x: wolf.x, z: wolf.z, speed: wolf.speed }] : [], wind: quiet, daylight: 1, food: { browse: BROWSE }, mates });
const mateOf = (a: Agent, snort = false): Mate => ({ key: a.key, x: a.x, z: a.z, heading: a.heading, action: a.action, speed: a.speed, alarmed: a.action === 'flee' || a.action === 'alert' || a.action === 'pause', snort });

test('deer vigilance share follows the feeding-time slope and stops at group size 4', () => {
  const lone = groupVigilance(DEER_AGENT, 0), one = groupVigilance(DEER_AGENT, 1), four = groupVigilance(DEER_AGENT, 3), more = groupVigilance(DEER_AGENT, 6);
  assert.equal(lone.share, DEER_AGENT.social!.loneVigilance);
  assert.ok(Math.abs(lone.share - one.share - DEER_AGENT.social!.vigilancePerMate) < 1e-12, 'one mate drops vigilance by the measured slope');
  assert.ok(Math.abs(lone.share - four.share - 3 * .07) < 1e-12, `group of 4 is 0.21 lower (${four.share})`);
  assert.equal(more.share, four.share, 'past group size 4 the female slope is flat');
  const calm = { species: DEER_AGENT, relaxation: 100, energy: 90 };
  const b0 = herdBouts(calm, 0), b3 = herdBouts(calm, 3);
  assert.ok(b0.feed < b3.feed, 'alone, the head-down bout is shorter');
  assert.ok(Math.abs(b0.scan / (b0.scan + b0.feed) - b0.share) < 1e-9, 'time share scanning equals the vigilance share');
  assert.ok(Math.abs(b3.feed - 17) < 1e-9, `group of 4 grazes 17 s (${b3.feed})`);
});
test('deer alarm delay is sound travel plus attention, and a heard cue is faster when it is stronger', () => {
  const cue = .5;
  const far = alarmDelay(90, cue, true, DEER_AGENT), nearD = alarmDelay(40, cue, true, DEER_AGENT);
  assert.ok(Math.abs(far - nearD - 50 / 343) < 1e-9, `${far - nearD} vs ${50 / 343}`);
  assert.equal(alarmDelay(90, cue, false, DEER_AGENT), alarmDelay(40, cue, false, DEER_AGENT));
  assert.ok(alarmDelay(10, 1, false, DEER_AGENT) < alarmDelay(10, .25, false, DEER_AGENT));
});
test('deer: a wolf inside 30 m bolts the same step; a mate 50 m off bolts after the attention delay, not in the same step', () => {
  const A = deer('bolt', 20, 0, { heading: 0, energy: 70, relaxation: 100 });
  const B = deer('mate', 70, 0, { heading: 0, energy: 70, relaxation: 100 });
  const wolf = { x: 0, z: 0, speed: 4 };
  const dt = .05;
  let prevA = mateOf(A), prevB = mateOf(B), t = 0, alertAt = -1, fleeAt = -1, snort = false;
  for (let i = 0; i < 40; i++) {
    const evA = stepAgent(A, deerWorld(wolf, [prevB]), dt);
    const evB = stepAgent(B, deerWorld(wolf, [prevA]), dt);
    t += dt;
    if (i === 0) { assert.equal(A.action, 'flee', 'flight distance: bolts the step it notices'); assert.equal(B.action === 'flee', false, 'the mate has not been seen fleeing yet'); }
    if (evA.some(e => e.type === 'snort')) snort = true;
    if (B.action === 'alert' && alertAt < 0) alertAt = t;
    if (B.action === 'flee' && fleeAt < 0) fleeAt = t;
    prevA = mateOf(A, evA.some(e => e.type === 'snort')); prevB = mateOf(B, evB.some(e => e.type === 'snort'));
  }
  assert.ok(snort, 'the bolt snorts');
  assert.ok(alertAt > 0 && fleeAt > alertAt, `alert ${alertAt} flee ${fleeAt}`);
  assert.ok(fleeAt - alertAt > .5 && fleeAt - alertAt < .85, `delay ${fleeAt - alertAt} (attention over the fleeing-mate sight cue)`);
  CONTACTS.end(A.key, 'browse:ground'); CONTACTS.end(B.key, 'browse:ground');
});
test('deer calm-down is relaxation, not a timer', () => {
  const saved = DEER_AGENT.levels.relaxation.recover;
  const w = deerWorld();
  const a = deer('calm', 0, 0, { heading: 0, energy: 60, relaxation: 40 });
  a.action = 'alert'; a.elapsed = 0; a.timer = 0;
  try {
    let feeding = false;
    for (let t = 0; t < 3; t += .1) stepAgent(a, w, .1);
    assert.equal(a.action, 'alert', `still alert while relaxation is ${a.relaxation}`);
    assert.ok(a.relaxation < DEER_AGENT.social!.calmAt);
    for (let t = 3; t < 8; t += .1) { stepAgent(a, w, .1); if ((a.action as string) === 'feed') feeding = true; }
    assert.ok(feeding, `back to grazing once relaxation recovers (now ${a.action}, relaxation ${a.relaxation})`);
    a.action = 'alert'; a.relaxation = 40; a.elapsed = 0; a.timer = 0; a.energy = 60;
    DEER_AGENT.levels.relaxation.recover = 0;
    for (let t = 0; t < 10; t += .1) stepAgent(a, w, .1);
    assert.equal(a.action, 'alert', 'with no recovery it never returns to grazing');
  } finally { DEER_AGENT.levels.relaxation.recover = saved; CONTACTS.end(a.key, 'browse:ground'); }
});
test('deer graze at 7.8 g fresh/min, chew once per bite, and do not roll dice', () => {
  const a = deer('chew', 0, 0, { heading: .4, energy: 60, relaxation: 100 });
  a.action = 'feed'; a.food = 'browse:ground'; a.timer = 40; a.bitten = 0;
  const w = deerWorld(undefined, [{ key: 'deer:calm-mate', x: 5, z: 0, heading: 0, action: 'feed', speed: 0, alarmed: false, snort: false }]);
  const dt = .05; const chews: number[] = []; let t = 0;
  try {
    while (t < 20) { const ev = stepAgent(a, w, dt); t += dt; if (ev.some(e => e.type === 'chew')) chews.push(t); }
    const bite = 60 / 7.1;
    assert.ok(chews[0] > bite - dt && chews[0] < bite + 2 * dt, `first chew ${chews[0]} vs ${bite}`);
    assert.ok(Math.abs(chews[1] - chews[0] - bite) < 2 * dt, `interval ${chews[1] - chews[0]}`);
    assert.equal(chews.filter(c => c < bite - dt).length, 0);
  } finally { CONTACTS.end(a.key, 'browse:ground'); }
  const g = deer('rate', 0, 0, { heading: .4, energy: 60, relaxation: 100 });
  g.action = 'feed'; g.food = 'browse:ground'; g.timer = 30;
  const e0b = g.energy;
  try { for (let i = 0; i < 200; i++) stepAgent(g, w, .05); }
  finally { CONTACTS.end(g.key, 'browse:ground'); }
  const diet = DEER_AGENT.diet.browse, expect = (diet.eatUnits / diet.eatSeconds) / diet.unitsPerEnergy * 10 - DEER_AGENT.levels.energy.drain * 10;
  assert.ok(Math.abs(g.energy - e0b - expect) < 1e-6, `energy ${g.energy - e0b} vs ${expect}`);
  const dice = createAgent(DEER_AGENT, 'deer:nodice', 0, 0, () => { throw new Error('dice'); }, { heading: 1, energy: 70, relaxation: 100, stamina: 100 });
  const brain = new AnimalBrain(1);
  assert.doesNotThrow(() => { for (let i = 0; i < 200; i++) { stepAgent(dice, w, .1); writeLocomotion(brain, dice); assert.notEqual(brain.motion, 'jump'); } });
  CONTACTS.end(dice.key, 'browse:ground');
  const full = deer('full', 0, 0, { heading: 0, energy: 99, relaxation: 100 });
  for (let i = 0; i < 50; i++) stepAgent(full, deerWorld(), .1);
  assert.notEqual(full.action, 'feed', 'a full deer does not keep grazing');
  const p = deer('same', 0, 0, { heading: .3, energy: 70 }), q = createAgent(DEER_AGENT, 'deer:same-b', 0, 0, stream(9, 'other'), { heading: .3, energy: 70 });
  const seq = (ag: Agent) => { const s: string[] = []; for (let i = 0; i < 80; i++) { stepAgent(ag, deerWorld(), .1); s.push(ag.action + ag.heading.toFixed(5)); } return s; };
  assert.deepEqual(seq(p), seq(q), 'two streams, same levels: the same actions');
  CONTACTS.end(p.key, 'browse:ground'); CONTACTS.end(q.key, 'browse:ground'); CONTACTS.end(full.key, 'browse:ground');
});
test('deer sounds follow the snort, the hoof phase and the chew, not a timer', () => {
  const idle = { problem: 'feed', motion: 'idle', phase: 0 };
  assert.deepEqual(deerSoundIds(idle, { key: 'd', motion: 'idle', problem: 'feed', phase: 0, snort: true }), ['deer-snort']);
  assert.deepEqual(deerSoundIds({ problem: 'explore', motion: 'idle', phase: 0 }, { key: 'd', motion: 'run', problem: 'escape', phase: 0, snort: false }), []);
  assert.deepEqual(deerSoundIds({ problem: 'explore', motion: 'idle', phase: 0 }, { key: 'd', motion: 'run', problem: 'escape', phase: 0 }), ['deer-snort']);
  assert.deepEqual(deerSoundIds({ problem: 'escape', motion: 'run', phase: .2 }, { key: 'd', motion: 'run', problem: 'escape', phase: 1.1, snort: false }), ['deer-hooves']);
  assert.deepEqual(deerSoundIds({ problem: 'feed', motion: 'walk', phase: .2 }, { key: 'd', motion: 'walk', problem: 'feed', phase: 1.1 }), ['paw-walk']);
  assert.deepEqual(deerSoundIds(idle, { key: 'd', motion: 'idle', problem: 'feed', phase: 0, chew: true }), ['chew']);
  assert.deepEqual(deerSoundIds({ problem: 'explore', motion: 'jump', phase: 0 }, { key: 'd', motion: 'idle', problem: 'explore', phase: 0 }), ['land']);
  assert.equal(deerPosture('feed'), 'graze'); assert.equal(deerPosture('flee'), 'flee'); assert.equal(deerPosture('alert'), 'alert');
});
test('the deer timer layer is gone', () => {
  assert.equal(existsSync(new URL('../src/core/deerHerd.ts', import.meta.url)), false);
  const scene = readFileSync(new URL('../src/render/buildScene.ts', import.meta.url), 'utf8');
  assert.equal(scene.includes('shapeDeer'), false);
  assert.equal(scene.includes('brain.decide'), false);
  assert.equal(TRANSACTIONS.get('deer', 'browse')?.name, 'graze');
  assert.equal(BEHAVIOUR.deer, DEER_AGENT);
});

test('readout, locomotion plan, behaviour row, and snapshot rewind', () => {
  assert.equal(BEHAVIOUR.hare, HARE_AGENT);
  assert.equal(readFileSync(new URL('../src/animals/hare.ts', import.meta.url), 'utf8').includes('freezeSeconds'), false);
  const a = hare('read', 1, 2, { energy: 70, stamina: 100, relaxation: 100 });
  a.goal = 'grazing clover:t'; a.action = 'feed'; a.speed = 0;
  assert.equal(agentReadout(a), 'hare:read energy 70 stamina 100 relaxation 100 goal grazing clover:t');
  const brain = new AnimalBrain(1);
  writeLocomotion(brain, a);
  assert.equal(brain.motion, 'idle'); assert.equal(brain.problem, 'feed'); assert.equal(brain.heading, a.heading);
  a.action = 'flee'; a.speed = 8.5; a.heading = 1.2;
  writeLocomotion(brain, a);
  assert.equal(brain.motion, 'run'); assert.equal(brain.problem, 'escape'); assert.equal(brain.speed, 8.5); assert.equal(brain.heading, 1.2);
  CLOVER_STATE.clear();
  const hub = createSnapshotHub();
  hub.register('hare', { capture: () => agentSnapshot(a), restore: (s) => restoreAgent(a, s) });
  hub.register('clover', { capture: () => cloverStateJSON(), restore: (json) => loadCloverState(json) });
  const shot = hub.capture(1);
  a.energy = 1; a.x = 9; CLOVER_STATE.set('clover:t:0:0', { units: 3, at: 1, stolon: 1, by: 'hare:read' });
  hub.restore(shot);
  assert.equal(a.energy, 70); assert.equal(a.x, 1); assert.equal(a.action, 'flee');
  assert.equal(CLOVER_STATE.size, 0);
});
