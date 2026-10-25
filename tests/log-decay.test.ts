import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_SIZE, generateChunk, type Entity } from '../src/core/world';
import { siteAt } from '../src/core/flora/site';
import { standAt } from '../src/core/stand';
import { CELL, column, GROUND, POOLS, rates } from '../src/core/ground';
import { TRANSACTIONS } from '../src/core/transactions';
import { WHY_DEFAULTS, nowText, stepText, whyOf } from '../src/core/why';
import {
  LOG_CLASS5_YR, LOG_HALF_LIFE_YR, LOG_INSECT_SHARE, LOG_INSECT_YEARS, LOG_K_POOR, LOG_K_REF, LOG_K_WELL,
  arenaOf, budget, cellsUnder, fallFraction, integrateFloor, logDryMass, type LogSite,
} from '../src/core/logDecay';

/** 1 − |got − want| / want. A known match on the published figure scores 1. A known wrong figure scores under 0.95. */
const timing = (got: number, want: number) => 1 - Math.abs(got - want) / want;
const shade: LogSite = { wet: 0.6, light: 0, age: 0 };
const dry: LogSite = { wet: 0, light: 1, age: 0 };
const bog: LogSite = { wet: 1, light: 0, age: 0 };
const sun: LogSite = { wet: 0.6, light: 1, age: 0 };
function bisect(site: LogSite, pred: (age: number) => boolean) {
  let lo = 0, hi = 400;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (pred(mid)) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
function euler(m0: number, age: number, kEarly: number, kLate: number, kFloor: number, pass: number, dt: number) {
  let W = m0, D = 0, respB = 0, respF = 0, below = 0;
  const n = Math.max(1, Math.round(age / dt)), h = age / n;
  for (let i = 0; i < n; i++) {
    const aw = (i + 0.5) * h < LOG_INSECT_YEARS ? kEarly : kLate, loss = aw * W * h, dloss = kFloor * D * h;
    respB += (1 - pass) * loss; respF += (1 - pass) * dloss; below += pass * dloss;
    W -= loss; D += pass * loss - dloss;
  }
  return { W, D, respB, respF, below };
}

test('registry rows: water, oxygen, sun and insects are site factors', () => {
  assert.equal(TRANSACTIONS.has('log', 'water', 'wet'), true);
  assert.equal(TRANSACTIONS.has('log', 'oxygen', 'air'), true);
  assert.equal(TRANSACTIONS.has('log', 'sun', 'sun'), true);
  assert.equal(TRANSACTIONS.has('log', 'insects', 'feed'), true);
  const mesic = arenaOf({ ...shade, age: 10 });
  assert.equal(mesic.moisture, 1, 'mesic shade is at or above the 43.1% breakpoint');
  assert.equal(mesic.oxygen, 1);
  assert.equal(mesic.insects, LOG_INSECT_SHARE);
  assert.ok(Math.abs(mesic.k - LOG_K_REF) < 1e-12);
  const ridge = arenaOf({ ...dry, age: 10 });
  assert.ok(ridge.moisture < 1 && ridge.insects === 0);
  assert.ok(Math.abs(arenaOf({ ...bog, age: 10 }).oxygen - LOG_K_POOR / LOG_K_WELL) < 1e-12);
  assert.ok(arenaOf({ ...shade, age: 10 }).mc > arenaOf({ ...sun, age: 10 }).mc, 'the same wetness is drier in the sun');
});

test('timing: reference half-life is 19 years and class 5 is 100, and the wrong clocks fail', () => {
  const t50 = bisect(shade, age => arenaOf({ ...shade, age }).remain <= 0.5);
  const t5 = bisect(shade, age => arenaOf({ ...shade, age }).klass >= 5);
  const half = timing(t50, LOG_HALF_LIFE_YR), klass = timing(t5, LOG_CLASS5_YR);
  assert.ok(half >= 0.95 && klass >= 0.95, `match half ${half} class ${klass} (t50 ${t50}, t5 ${t5})`);
  assert.ok(Math.abs(t50 - LOG_HALF_LIFE_YR) < 1e-6);
  assert.ok(Math.abs(t5 - LOG_CLASS5_YR) < 1e-4);
  const wrongClass = timing(LOG_HALF_LIFE_YR, LOG_CLASS5_YR);
  const harmon = timing(Math.log(2) / 0.03, LOG_HALF_LIFE_YR);
  assert.ok(wrongClass < 0.7, `known mismatch: half-life is not class 5 (${wrongClass})`);
  assert.ok(harmon < 0.95, `known mismatch: the stand's 0.03 /yr is not the 19-year half-life (${harmon})`);
  assert.equal(arenaOf({ ...shade, age: 0 }).klass, 1);
});

test('position: wet shade has less wood left than a dry ridge, a bog, or the same wetness in full sun', () => {
  const ages = [20, 40, 60, 80];
  let n = 0, ok = 0, bad = 0;
  for (const age of ages) {
    const a = arenaOf({ ...shade, age }).remain;
    const checks = [arenaOf({ ...dry, age }).remain, arenaOf({ ...bog, age }).remain, arenaOf({ ...sun, age }).remain];
    for (const b of checks) { n++; if (a < b) ok++; if (a > b) bad++; }
  }
  const match = ok / n, mismatch = bad / n;
  assert.ok(match >= 0.95, `position ${match}`);
  assert.equal(mismatch, 0, 'known mismatch: the reversed order scores 0');
  assert.ok(arenaOf({ ...shade, age: 60 }).klass > arenaOf({ ...dry, age: 60 }).klass);
});

test('mass is conserved apart from respiration, and the closed form matches a fine step', () => {
  const kFloor = rates()[2], pass = POOLS[2].toNext, m0 = logDryMass(1);
  for (const site of [shade, dry, bog, sun]) for (const age of [1, 3, 19, 50, 100]) {
    const b = budget(m0, { ...site, age }, kFloor, pass);
    const sum = b.W + b.respB + b.D + b.respF + b.below;
    assert.ok(Math.abs(sum - m0) / m0 < 1e-9, `conserve ${site.wet} ${age}: ${sum} vs ${m0}`);
    assert.ok(Math.abs(b.W / m0 - b.remain) < 1e-12);
    const e = euler(m0, age, b.kEarly, b.kLate, kFloor, pass, 0.01);
    for (const [name, got, ref] of [['W', b.W, e.W], ['D', b.D, e.D], ['respB', b.respB, e.respB]] as const) {
      assert.ok(Math.abs(got - ref) / m0 < 2e-3, `${name} ${site.wet} age ${age}: ${got} vs ${ref}`);
    }
  }
  const idle = integrateFloor(m0, 0, LOG_K_REF, LOG_K_REF, kFloor, pass);
  assert.equal(idle.W, m0); assert.equal(idle.D, 0);
});

test('the column under a log keeps that floor wood, and the why chain names the rates', () => {
  const saved = GROUND.years; GROUND.years = 0; GROUND.deposits = [];
  let log: Entity | undefined, col: ReturnType<typeof column> | undefined;
  for (let cz = -4; cz <= 4 && !col; cz++) for (let cx = -4; cx <= 4 && !col; cx++) for (const e of generateChunk(cx, cz)) {
    if (e.kind !== 'log') continue;
    const at = column(e.x, e.z, 0);
    if (at.wood.kg > 0) { log = e; col = at; break; }
  }
  assert.ok(log && col && col.wood.kg > 0);
  assert.ok(col.wood.logs >= 1 && col.wood.kg > 0);
  const layer = col.layers.find(l => l.id === 'wood');
  assert.ok(layer && Math.abs(layer.kg - col.wood.kg) < 1e-9);
  assert.equal(layer.bulk, 108);
  const gx = Math.floor(log.x / CELL), gz = Math.floor(log.z / CELL), key = `${gx}:${gz}`;
  const cx = Math.floor((gx * CELL + CELL / 2) / CHUNK_SIZE), cz = Math.floor((gz * CELL + CELL / 2) / CHUNK_SIZE);
  let expect = 0;
  const kFloor = rates()[2], pass = POOLS[2].toNext;
  for (let a = cx - 1; a <= cx + 1; a++) for (let b = cz - 1; b <= cz + 1; b++) for (const e of generateChunk(a, b)) if (e.kind === 'log') {
    const cells = cellsUnder(e.x, e.z, e.rotation, e.scale, CELL);
    if (!cells.includes(key)) continue;
    const site = siteAt(e.x, e.z, true, false);
    const age = fallFraction(e.seed) * standAt(e.x, e.z, site.wet).age;
    expect += budget(logDryMass(e.scale) / cells.length, { wet: site.wet, light: site.light, age }, kFloor, pass).D / (CELL * CELL);
  }
  assert.ok(Math.abs(col.wood.kg - expect) / expect < 1e-9, `${col.wood.kg} vs ${expect}`);
  const again = column(log.x, log.z, 0);
  assert.equal(again.wood.kg, col.wood.kg);
  const w = whyOf(log);
  assert.equal(w.length, WHY_DEFAULTS.log.length);
  assert.match(stepText(w.find(s => s.step === 'decaying')!), /^decay class [1-5]$/);
  assert.match(stepText(w.find(s => s.step === 'rotting')!), /^rotting at \d\.\d+ \/yr$/);
  assert.match(stepText(w.find(s => s.step === 'wetted')!), /moisture \d\.\d+ g\/g/);
  assert.match(stepText(w.find(s => s.step === 'sunned')!), /light \d\.\d+/);
  assert.match(stepText(w.find(s => s.step === 'oxidized')!), /oxygen \d\.\d+ of the well-drained rate/);
  assert.match(stepText(w.find(s => s.step === 'insected')!), /insects|insects absent/);
  assert.equal(nowText(w), 'resting on the ground, becoming forest floor (one more trunk cycle)');
  GROUND.years = saved; GROUND.deposits = [];
});
