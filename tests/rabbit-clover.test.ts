import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOVER, CLOVER_WHY, clearingAt, cloverPatchesInTile, cloverSuitability, grazeTransaction, regrowTransaction, type CloverPatch } from '../src/core/clover';
import { createAgent, stepAgent, modulators, updateLevels, perceive, type Agent, type AgentWorld, type FoodSource } from '../src/core/agent/pipeline';
import { HARE_AGENT } from '../src/core/agent/species';
import { stream } from '../src/proc/rng';

const patch = (x = 0, z = 0, r = 1, light = 1): CloverPatch => { const max = Math.round(Math.PI * r * r * CLOVER.unitsPerM2); return { key: `clover:t:${x}:${z}`, x, z, r, light, max, units: max, why: CLOVER_WHY.map(w => ({ ...w })) }; };
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

test('clover: grazing eats 100 units per 3 s and never below 0; 100 units = +1 energy (hare diet)', () => {
  const p = patch(); const d = HARE_AGENT.diet.clover;
  let eaten = 0; for (let i = 0; i < 90; i++) eaten += grazeTransaction(p, d.eatUnits / d.eatSeconds / 30, 'hare:1');
  assert.ok(Math.abs(eaten - 100) < 1e-6, `eaten ${eaten}`); assert.ok(Math.abs(eaten / d.unitsPerEnergy - 1) < 1e-9);
  assert.equal(p.why.at(-1)?.step, 'grazed');
  const small = patch(); small.units = 5; assert.equal(grazeTransaction(small, 100, 'hare:1'), 5); assert.equal(small.units, 0); assert.equal(grazeTransaction(small, 100, 'hare:1'), 0);
  assert.equal(Math.round(patch(0, 0, 1).max), Math.round(Math.PI * 1e4)); // ~10 000 units per m²
});
test('clover: regrowth is a sunlight transaction, 0 -> full in 15 min of full sun, none at night, slower in partial light', () => {
  const p = patch(); p.units = 0; for (let t = 0; t < 900; t++) regrowTransaction(p, 1, 1); assert.ok(Math.abs(p.units - p.max) < 1e-6);
  assert.equal(p.why.at(-1)?.step, 'grew'); // never grazed: no regrew step
  const n = patch(); n.units = 0; for (let t = 0; t < 900; t++) regrowTransaction(n, 1, 0); assert.equal(n.units, 0);
  const h = patch(0, 0, 1, .5); h.units = 0; for (let t = 0; t < 900; t++) regrowTransaction(h, 1, 1); assert.ok(Math.abs(h.units / h.max - .5) < 1e-6);
  const g = patch(); grazeTransaction(g, 1000, 'hare:1'); regrowTransaction(g, 1, 1); assert.equal(g.why.at(-1)?.step, 'regrew');
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
test('levels: energy -1/8 per s at rest, x8 (-1/s) in flight; stamina empties in 8 s of flight and refills in 8 s of rest', () => {
  const none = { level: 0, sight: 0, sound: 0, scent: 0, moving: false, distance: Infinity };
  const a = hare('lv', 0, 0, { energy: 50 }); a.action = 'rest'; for (let i = 0; i < 80; i++) updateLevels(a, .1, none); assert.ok(Math.abs(a.energy - 49) < 1e-9, `${a.energy}`);
  a.action = 'flee'; for (let i = 0; i < 80; i++) updateLevels(a, .1, none); assert.ok(Math.abs(a.energy - 41) < 1e-9); assert.ok(a.stamina < 1e-9);
  a.action = 'rest'; for (let i = 0; i < 40; i++) updateLevels(a, .1, none); assert.ok(Math.abs(a.stamina - 50) < 1e-6); for (let i = 0; i < 40; i++) updateLevels(a, .1, none); assert.equal(a.stamina, 100);
  const g = hare('lv2', 0, 0, { energy: 50 }); g.action = 'feed'; updateLevels(g, 3, none, 100, 100); assert.ok(Math.abs(g.energy - (50 + 1 - 3 / 8)) < 1e-9);
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
    HARE_AGENT.levels.relaxation.recover = 0; // hold the mood fixed for the measurement
    const feed: number[] = [], scan: number[] = []; let last = a.action, start = 0, t = 0;
    run(a, w, 120, 1 / 30, (b) => { t += 1 / 30; if (b.action !== last) { (last === 'feed' ? feed : last === 'scan' ? scan : []).push(t - start); last = b.action; start = t; } });
    HARE_AGENT.levels.relaxation.recover = 3;
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
  assert.ok(Math.hypot(a.x, a.z) < p.r + .1, 'stays on its patch'); assert.ok(p.units < p.max - 1200, `ate ${p.max - p.units}`); assert.ok(a.energy > 60, `energy ${a.energy}`);
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
