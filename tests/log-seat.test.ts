import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateChunk, heightAt, type Entity } from '../src/core/world';
import { generateGeometry, logSeat } from '../src/render/geometry';
import { segmentShare, TRUNK_DENSITY } from '../src/core/settle';

/** T-0005: a fallen log lies flat against the terrain, pressed in until the earth's push equals its weight (Matthew: about a third
 *  of the trunk's width; core/settle: trunk vs earth density).
 *  Measured on the cylinder mesh itself (its local y is the log axis: +2.2 m radius .32, -2.2 m radius .43), so the test reads
 *  the old recipe too (where it fails: one level log at the centre height). The bury depth is taken perpendicular to the
 *  ground (axis height above ground / k, k = sqrt(1 + slope^2 + cross-slope^2)), as a fraction of the local diameter. */
const AXIS = [[2.2, .32], [0, .375], [-2.2, .43]] as const;
function measure(e: Entity, detail = 0) {
  const g = generateGeometry(e, detail); g.updateMatrixWorld(true);
  let cyl: THREE.Mesh | undefined; g.traverse(o => { const m = o as THREE.Mesh; if (!cyl && m.isMesh && (m.geometry as THREE.CylinderGeometry).type === 'CylinderGeometry') cyl = m; });
  const hc = heightAt(e.x, e.z), s = e.scale;
  const pts = AXIS.map(([y, r]) => { const p = new THREE.Vector3(0, y, 0).applyMatrix4(cyl!.matrixWorld); return { x: e.x + p.x, z: e.z + p.z, y: hc + p.y, r: r * s }; });
  const dx = pts[0].x - pts[2].x, dz = pts[0].z - pts[2].z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const along = (heightAt(pts[0].x, pts[0].z) - heightAt(pts[2].x, pts[2].z)) / len;
  const cross = (heightAt(e.x - uz * .5, e.z + ux * .5) - heightAt(e.x + uz * .5, e.z - ux * .5)) / 1, k = Math.sqrt(1 + along * along + cross * cross);
  const frac = pts.map(p => (p.r - (p.y - heightAt(p.x, p.z)) / k) / (2 * p.r)); // buried share of the diameter, perpendicular to the ground
  const mean = (frac[0] + frac[1] + frac[2]) / 3, err = pts.map(p => (p.y - heightAt(p.x, p.z)) / k - p.r * (1 - 2 * mean)); // metres off the log's own (seeded) bury
  const curv = heightAt(pts[1].x, pts[1].z) - (heightAt(pts[0].x, pts[0].z) + heightAt(pts[2].x, pts[2].z)) / 2; // ground bend under the log
  const pitch = Math.atan2(pts[0].y - pts[2].y, len), groundPitch = Math.atan(along);
  return { frac, mean, err, curv, pitch, groundPitch, along, cyl: cyl!.matrixWorld.clone() };
}
const logs: Entity[] = []; for (let cx = -5; cx <= 5; cx++) for (let cz = -5; cz <= 5; cz++) logs.push(...generateChunk(cx, cz).filter(e => e.kind === 'log'));

test('fallen logs: pressed in by the settled depth (about a third of the width) at both ends and the middle, within 0.05 m', () => {
  assert.ok(logs.length > 100, `${logs.length} logs`); let flat = 0; const mineral: number[] = [];
  for (const e of logs) { const m = measure(e), st = logSeat(e).settle, tag = `${e.key} ${st.soil} depth ${st.depth.toFixed(2)} bury ${m.frac.map(v => v.toFixed(2))} curv ${m.curv.toFixed(3)}`;
    if (st.soil !== 'bedrock' && st.soil !== 'peat') mineral.push(m.mean);
    for (const f of m.frac) assert.ok(f >= Math.max(0, st.depth - .2) - 1e-6 && f <= Math.min(.65, st.depth + .2) + 1e-6, `${tag}: no floating end, never out of sight`);
    if (Math.abs(m.curv) > .06) continue; flat++; // a straight log can't follow ground bent more than ~6 cm over 4.4 m (about 1 log in 10)
    assert.ok(Math.abs(m.mean - st.depth) < .02, `${tag}: settled depth`);
    for (const d of m.err) assert.ok(Math.abs(d) < .05, `${tag}: end/middle off its depth by ${m.err.map(v => v.toFixed(3))} m`); }
  assert.ok(flat > logs.length * .8, `${flat} of ${logs.length} on ground bent < 6 cm`);
  mineral.sort((a, b) => a - b); const med = mineral[mineral.length >> 1];
  assert.ok(mineral.length > 50 && med > .3 && med < .4, `median pressed-in depth on mineral soil and lake beds ${med?.toFixed(3)} of the width (${mineral.length} logs): about a third`);
});
test('fallen logs: the earth yields until it carries the trunk (displaced earth weighs what the trunk weighs)', () => {
  for (const e of logs) { const st = logSeat(e).settle; if (st.onRock) { assert.ok(segmentShare(st.depth) * st.earthDensity <= TRUNK_DENSITY + 1e-6, `${e.key} on rock`); continue; }
    assert.ok(Math.abs(segmentShare(st.depth) * st.earthDensity / st.trunkDensity - 1) < .01, `${e.key} ${st.soil}: ${segmentShare(st.depth).toFixed(3)} x ${st.earthDensity.toFixed(0)} vs ${st.trunkDensity.toFixed(0)} kg/m3`);
    assert.ok(st.trunkDensity < st.earthDensity, `${e.key}: trunk denser than earth would sink through`); }
});
test('fallen logs: tilted with the slope (axis pitch within 1 degree of the ground under its ends)', () => {
  const sloped = logs.filter(e => Math.abs(measure(e).along) > .08); assert.ok(sloped.length > 20, `${sloped.length} sloped logs`);
  for (const e of sloped) { const m = measure(e), k = Math.sqrt(1 + m.along * m.along), want = Math.atan(m.along - k * (1 - 2 * m.frac[1]) * .11 / 4.4); // a tapered log's axis dips toward its thin end by the taper above the buried share
    assert.ok(Math.abs(m.pitch - want) < Math.PI / 180, `${e.key} pitch ${(m.pitch * 180 / Math.PI).toFixed(2)} vs ground ${(m.groundPitch * 180 / Math.PI).toFixed(2)} deg`); }
});
test('fallen logs: seating is deterministic and the same at every LOD', () => {
  for (const e of logs.slice(0, 10)) { const a = measure(e, 0).cyl, b = measure({ ...e }, 0).cyl, c = measure(e, 2).cyl;
    assert.ok(a.equals(b), `${e.key} not deterministic`); for (let i = 0; i < 16; i++) assert.ok(Math.abs(a.elements[i] - c.elements[i]) < 1e-9, `${e.key} LOD 2 differs`); }
});test('fallen logs: the seat gives T-0006 its contact (point on the earth under the middle, unit ground normal)', () => {
  for (const e of logs.slice(0, 60)) { const { at, normal: n } = logSeat(e), d = .5;
    assert.deepEqual([at[0], at[2]], [e.x, e.z]); assert.ok(Math.abs(at[1] - heightAt(e.x, e.z)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-9 && n[1] > .7, `${e.key} normal ${n}`);
    const gx = (heightAt(e.x + d, e.z) - heightAt(e.x - d, e.z)) / (2 * d), gz = (heightAt(e.x, e.z + d) - heightAt(e.x, e.z - d)) / (2 * d), l = Math.hypot(gx, 1, gz);
    assert.ok(Math.acos(Math.min(1, (-gx * n[0] + n[1] - gz * n[2]) / l)) < 6 * Math.PI / 180, `${e.key} normal off the ground's`); }
});