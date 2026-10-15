import test from 'node:test';
import assert from 'node:assert/strict';
import { gravity, body, step, kinetic, jumpArc, collide, accelLimit, approach } from '../src/proc/physics.ts';
import { generateChunk } from '../src/core/world.ts';
import { entityMass } from '../src/render/mass.ts';
import { withTrace, type Trace } from '../src/proc/trace.ts';

test('g from G, Earth mass and radius', () => {
  assert.ok(Math.abs(gravity() - 9.82) < .01, String(gravity())); assert.ok(gravity(10000) < gravity());
});
test('integrator: free fall conserves energy within 1%, impact = ½mv²', () => {
  const b = body(40, 0, 10); let e = 0; while (!e) e = step(b, 1 / 1000, {}, 0);
  const expect = 40 * gravity() * 10; assert.ok(Math.abs(e - expect) / expect < .01, `${e} vs ${expect}`);
  assert.equal(kinetic(2, 3), 9);
  const j = jumpArc(40); assert.ok(Math.abs(j.seconds - .85) < .02); assert.ok(Math.abs(j.energy - kinetic(40, j.launch)) / j.energy < .02);
});
test('momentum and inertia', () => {
  const [a, b] = collide(80, 3, 40, 0, 1); assert.ok(Math.abs(80 * 3 - (80 * a + 40 * b)) < 1e-9); assert.ok(b > a);
  assert.ok(accelLimit(250, 40) < accelLimit(40, 40)); assert.ok(Math.abs(accelLimit(40, 40) - 30) < 1e-9);
  assert.equal(approach(0, 10, 30, 1 / 30), 1);
});
test('mass derivation is deterministic, positive and traced', () => {
  const es = [...generateChunk(0, 0), ...generateChunk(1, -1)].filter(e => e.kind !== 'deer');
  const a = es.map(entityMass), b = es.map(entityMass); assert.deepEqual(a, b); assert.ok(a.every(m => m > 0 && Number.isFinite(m)));
  const tree = es.find(e => e.kind === 'spruce')!, rock = es.find(e => e.kind === 'rock')!;
  assert.ok(entityMass(tree) > 50 && entityMass(tree) < 5000, String(entityMass(tree))); assert.ok(entityMass(rock) < 300);
  const t: Trace = { factors: [] }; withTrace(t, () => entityMass(tree));
  for (const n of ['body plan', 'volume (m³)', 'mass (kg)', 'weight (N)', 'g']) assert.ok(t.factors.some(x => x.name === n), n);
});
import * as THREE from 'three';
import { rigMass } from '../src/render/mass.ts';
import { COMPOSITIONS, density } from '../src/core/materials.ts';

test('compositions: every mix sums to 1 and references known materials', () => {
  for (const [plan, regions] of Object.entries(COMPOSITIONS)) for (const [r, mix] of Object.entries(regions)) {
    const sum = Object.values(mix).reduce((a, b) => a + b, 0); assert.ok(Math.abs(sum - 1) < 1e-9, `${plan}.${r} = ${sum}`);
    assert.ok(Number.isFinite(density(mix)) && density(mix) > 0, `${plan}.${r}`);
  }
});
test('scale law: x2 linear size -> x8 mass; regions traced', () => {
  const rig = () => { const root = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(.5, 1, 1.4, 6, 6, 6)); m.position.y = .5; root.add(m); return root; };
  const a = rig(), b = rig(); b.scale.setScalar(2);
  const ma = rigMass(a, 'canid'), mb = rigMass(b, 'canid'); assert.ok(Math.abs(mb / ma - 8) < 1e-6, `${mb / ma}`);
  const t: Trace = { factors: [] }; withTrace(t, () => rigMass(a, 'canid'));
  assert.ok(t.factors.filter(x => x.group === 'mass').length >= 3); assert.ok(t.factors.some(x => x.name === 'mass (kg)'));
  const e = generateChunk(0, 0).find(x => x.kind === 'rock')!; assert.ok(Math.abs(entityMass({ ...e, scale: 2 }) - entityMass(e)) < 1e-9); // rocks: size from recipe
  const tr = generateChunk(0, 0).find(x => x.kind === 'spruce')!; assert.ok(Math.abs(entityMass({ ...tr, scale: tr.scale * 2 }) / entityMass(tr) - 8) < 1e-6);
});
