/** #162 item 2 / #192: wolf levels of detail on the Meshy body, and the realism numbers (tools/wolf-lod-bench.ts). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detailShares } from '../src/render/animalLadder';
import { spawnWolf, blendWeight, clusterIndex, lowTemplate, pickLevel, reboundTemplate, speckBob, terrainFeet, type WolfLevel } from '../src/render/gaitLod';
import * as THREE from 'three';
import { GAITS, MAES, footfalls, levelCost, loadWolf, stanceSlip, switchPop } from '../tools/wolf-lod-bench';

test('levels follow the ladder with hysteresis: no flicker around 32 m or 94 m', () => {
  for (const mid of [32, 94, 132]) {
    let level: WolfLevel | undefined, flips = 0;
    for (let n = 0; n < 400; n++) { const next = pickLevel(level, detailShares(mid + Math.sin(n * 0.3))); if (level && next !== level) flips++; level = next; }
    assert.ok(flips <= 1, `${mid} m: ${flips} flips`);
  }
  assert.equal(pickLevel(undefined, detailShares(5)), 'near');
  assert.equal(pickLevel(undefined, detailShares(60)), 'mid');
  assert.equal(pickLevel(undefined, detailShares(200)), 'far');
});

test('blend and bob are pure and bounded', () => {
  assert.equal(blendWeight(0), 1); assert.equal(blendWeight(0.2), 0); assert.ok(blendWeight(0.1) > 0.4 && blendWeight(0.1) < 0.6);
  assert.equal(speckBob(0.3, false), 0); assert.ok(speckBob(0.25, true) <= 0.02 + 1e-9);
});

test('vertex clustering merges a cell and drops degenerate triangles', () => {
  const pos = [0, 0, 0, 0.001, 0, 0, 1, 0, 0, 0, 1, 0];
  const c = clusterIndex(pos, [0, 1, 2, 1, 2, 3, 0, 1, 3], 0.01);
  assert.equal(c.index.length, 3); // 0-1 merge: tri 0 and tri 2 degenerate, tri 1 survives as (0,2,3)
  assert.equal(c.keep.length, 3);
});

test('wolf: low mesh, leg weights, slip, drift, footfalls, terrain, cost and switch pop', async () => {
  const meshy = await loadWolf();
  const full = reboundTemplate(meshy);
  const t0 = performance.now(); const low = lowTemplate(full); const ms = performance.now() - t0;
  assert.ok(low.tris > 3000 && low.tris < 5500, `low tris ${low.tris}`);
  assert.ok(ms < 500, `low build ${ms} ms`);
  for (const f of footfalls()) {
    const band = MAES[f.gait as keyof typeof MAES];
    assert.ok(band, f.gait);
    assert.ok(f.duty >= band.duty[0] && f.duty <= band.duty[1], `${f.label} duty ${f.duty}`);
    assert.ok(f.fl >= band.fl[0] && f.fl <= band.fl[1], `${f.label} fore lag ${f.fl}`);
    assert.ok(f.hl >= band.hl[0] && f.hl <= band.hl[1], `${f.label} hind lag ${f.hl}`);
  }
  for (const g of GAITS) {
    const before = stanceSlip(meshy, g.motion, g.speed), r = stanceSlip(full, g.motion, g.speed), l = stanceSlip(low, g.motion, g.speed);
    assert.ok(Math.max(...r.slipMm) < 5, `${g.label} bone slip ${r.slipMm}`);
    assert.ok(Math.max(...r.meshSlipMm) < 10, `${g.label} sole slip ${r.meshSlipMm}`);
    assert.ok(Math.max(...l.meshSlipMm) < 10, `${g.label} low sole slip ${l.meshSlipMm}`);
    assert.ok(Math.max(...r.driftMm) < 10, `${g.label} mesh-bone drift ${r.driftMm}`);
    assert.ok(Math.max(...before.meshSlipMm) > 50, 'the Meshy proximity weights slid (if this fails, the rebind may be unneeded)');
  }
  // hinge-only limbs: no twist channel moves, so a candy-wrapper (twist) collapse cannot happen
  const s = spawnWolf(full);
  for (const g of GAITS) for (let k = 0; k < 8; k++) { s.pose(g.motion, k / 8, g.speed); s.root.traverse(o => { if (/^(upper|lower|foot|paw)/.test(o.name)) { assert.equal(o.rotation.y, 0); assert.equal(o.rotation.z, 0); } }); }
  // terrain feet: exact where the leg reaches (1:10 slope)
  const ground = (_x: number, z: number) => -0.1 * z, p = new THREE.Vector3();
  s.pose('walk', 0.3, 1.2); s.root.updateMatrixWorld(true);
  const before = [0, 1, 2, 3].map(i => { s.root.getObjectByName('paw' + i)!.getWorldPosition(p); return p.clone(); });
  terrainFeet(s.root, ground, 0);
  for (let i = 0; i < 4; i++) { s.root.getObjectByName('paw' + i)!.getWorldPosition(p); assert.ok(Math.abs(p.y - before[i].y - ground(before[i].x, before[i].z)) < 0.003, `paw ${i}`); }
  const cost = levelCost(full, low, (_x, z) => 0.05 * Math.sin(z * 2));
  for (const g of GAITS) { const c = cost[g.label]; assert.ok(c.midUs < c.nearUs && c.farUs < c.midUs, JSON.stringify(c)); }
  const blend = switchPop(full, low, 0.2);
  assert.equal(blend.switches, 4);
  assert.ok(blend.pop.pawMm <= blend.base.pawMm + 5, `switch pop ${blend.pop.pawMm} mm vs mid steps ${blend.base.pawMm} mm`);
  const hard = switchPop(full, low, 0);
  const mn = blend.byKind['mid>near'].pawMm, mnHard = hard.byKind['mid>near'].pawMm;
  assert.ok(mn < 0.5 * mnHard && mn < blend.base.pawMm, `mid to near pop ${mn} mm blended, ${mnHard} mm hard, mid steps ${blend.base.pawMm} mm`);
  const fine = switchPop(full, low, 0.2, 60);
  assert.ok(fine.pop.pawMm < 15, `switch pop at a 60 Hz mid ${fine.pop.pawMm} mm`);
});