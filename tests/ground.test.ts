import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUND, POOLS, addDeposit, chain, chainStep, column, footing, rates, sinkage, tickGround } from '../src/core/ground';

const x0 = [.3, .2, 1.5, 2, 5], input = [.12, 0, .15, 0, 0];
test('closed-form decay chain equals the stepped simulation', () => {
  for (const t of [1, 10, 80]) {
    const a = chain(x0, input, t), b = chainStep(x0, input, t, .001).x;
    a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 2e-3 * Math.max(1, v), `t=${t} pool ${POOLS[i].id}: ${v} vs ${b[i]}`));
  }
});
test('mass is conserved apart from respiration', () => {
  const t = 50, { x, resp } = chainStep(x0, input, t, .001), sum = (v: number[]) => v.reduce((s, y) => s + y, 0);
  const before = sum(x0) + sum(input) * t, after = sum(x) + resp;
  assert.ok(Math.abs(before - after) < 1e-6 * before, `${before} vs ${after}`);
  assert.ok(sum(chain(x0, [0, 0, 0, 0, 0], t)) < sum(x0), 'closed form loses mass only by respiration');
});
test('catch-up is deterministic and independent of tick count', () => {
  GROUND.years = 0; GROUND.deposits = [];
  const once = column(13, -27, 40);
  GROUND.years = 0; for (let i = 0; i < 1000; i++) tickGround(40 * 365.25 * 86400 / 1000);
  const stepped = column(13.4, -27.2), again = column(13, -27, 40);
  assert.deepEqual(stepped.pools.map(v => +v.toFixed(9)), once.pools.map(v => +v.toFixed(9)));
  assert.deepEqual(again, once);
  addDeposit({ x: 13, z: -27, year: 10, pool: 0, kg: 4, what: 'carcass test' });
  assert.ok(column(13, -27, 40).pools[2] > once.pools[2], 'deposit flows down the chain');
  GROUND.deposits = []; GROUND.years = 0;
});
test('sinkage is monotonic in pressure; heavier animals sink deeper and pay more', () => {
  let x = 0; while (column(x, 30, 0).layers[0].id === 'water') x += 7; const col = column(x, 30, 0); let last = -1;
  for (let p = 1; p < 200; p += 3) { const z = sinkage(col, p, .1); assert.ok(z >= last); last = z; }
  const light = footing(col, 40, 'canid', 9.8), heavy = footing(col, 80, 'canid', 9.8);
  assert.ok(heavy.sink > light.sink && heavy.cost >= light.cost && heavy.absorb < light.absorb);
});
test('warmer soil decays faster (Q10)', () => assert.ok(rates(15)[0] > rates(2.5)[0]));
