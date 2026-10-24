// T-0070 stage 6: the Earth bake made of relaxed SPH parcels (formation.rs) and its view (parcels.ts).
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { STRIDE, toGlobe, parcelReadout, REAL, invF, type ParcelBake } from '../src/world/globe/parcels';
import { ACTION, actionsIn } from '../src/core/bindings';
const buf = new Float32Array(readFileSync(new URL('../public/bake/earth-parcels.bin', import.meta.url)).buffer.slice(0));
const meta: ParcelBake = JSON.parse(readFileSync(new URL('../public/bake/earth-parcels.json', import.meta.url), 'utf8'));
test('bake: count, centre of mass at the origin, no parcel outside 1.3 R, core, mantle and crust present', () => {
  const n = buf.length / STRIDE; assert.equal(n, meta.n); let c = [0, 0, 0], rmax = 0; const L = new Set<number>();
  for (let i = 0; i < n; i++) { const b = i * STRIDE; for (let k = 0; k < 3; k++) c[k] += buf[b + k] / n; rmax = Math.max(rmax, Math.hypot(buf[b], buf[b + 1], buf[b + 2])); L.add(buf[b + 3]); }
  assert.ok(Math.hypot(...c) < 50, `com ${c}`); assert.ok(rmax < 1.3 * REAL.rMean, `rmax ${rmax}`); for (const l of [0, 1, 2, 3]) assert.ok(L.has(l), `layer ${l}`); // the ocean (1.4e21 kg) is ~11 parcels of 1.2e20 kg: below the 48-fold stratified draw, so not yet resolved
});
test('measured vs real Earth: mass 0.2 %, radius 2 %, 1/f 25 %, g 4 %, pole g > equator g', () => {
  assert.ok(Math.abs(meta.mass / REAL.mass - 1) < .002 && Math.abs(meta.r_vol / REAL.rMean - 1) < .02);
  assert.ok(Math.abs(invF(meta) / REAL.invF - 1) < .25 && meta.c! < meta.a!);
  assert.ok(Math.abs(meta.g_eq / REAL.gEq - 1) < .04 && Math.abs(meta.g_pole / REAL.gPole - 1) < .04 && meta.g_pole > meta.g_eq);
  assert.match(parcelReadout(meta), /J2 .* 1\/f .*real 298\.257/s);
});
test('frames: sim spin +z maps to globe +y, right-handed', () => {
  const [x, y, z] = toGlobe(0, 0, 1); assert.deepEqual([x, y, z], [0, 1, -0]); const ex = toGlobe(1, 0, 0), ey = toGlobe(0, 1, 0), ez = toGlobe(0, 0, 1);
  const cr = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]]; assert.deepEqual(cr.map(v => v + 0), ez.map(v => v + 0));
});
test('gamepad: the parcels toggle has a pad button no other axis action uses', () => {
  const a = ACTION.axisParcels; assert.ok(a && a.context === 'axis'); const pad = JSON.stringify(a).match(/"x"/); assert.ok(pad, 'pad x');
  const others = actionsIn('axis').filter(b => b.id !== 'axisParcels').map(b => JSON.stringify(b)); assert.ok(!others.some(o => /\["x"\]/.test(o)));
});
