import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateChunk, heightAt, type Entity } from '../src/core/world';
import { generateGeometry } from '../src/render/geometry';

/** T-0005: a fallen log lies on the terrain and is partly buried (Matthew: 20-35 % of its thickness, seeded).
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
  const err = pts.map((p, i) => (p.y - heightAt(p.x, p.z)) / k - p.r * (1 - 2 * frac[1]) - 0 * i); // vs the middle's bury, metres
  const pitch = Math.atan2(pts[0].y - pts[2].y, len), groundPitch = Math.atan(along);
  return { frac, err, pitch, groundPitch, along, cyl: cyl!.matrixWorld.clone() };
}
const logs: Entity[] = []; for (let cx = -5; cx <= 5; cx++) for (let cz = -5; cz <= 5; cz++) logs.push(...generateChunk(cx, cz).filter(e => e.kind === 'log'));

test('fallen logs: partly buried (20-35 % of the thickness) at both ends and the middle, within 0.05 m', () => {
  assert.ok(logs.length > 100, `${logs.length} logs`);
  for (const e of logs) { const m = measure(e);
    for (const f of m.frac) assert.ok(f > .2 - .05 / .64 && f < .35 + .05 / .64, `${e.key} bury ${m.frac.map(v => v.toFixed(2))}`);
    assert.ok(m.frac[1] >= .2 - 1e-9 && m.frac[1] <= .35 + 1e-9, `${e.key} middle bury ${m.frac[1].toFixed(3)}`);
    for (const d of m.err) assert.ok(Math.abs(d) < .05, `${e.key} end/middle off the seeded bury by ${m.err.map(v => v.toFixed(3))} m`); }
});
test('fallen logs: tilted with the slope (axis pitch within 1 degree of the ground under its ends)', () => {
  const sloped = logs.filter(e => Math.abs(measure(e).along) > .08); assert.ok(sloped.length > 20, `${sloped.length} sloped logs`);
  for (const e of sloped) { const m = measure(e), k = Math.sqrt(1 + m.along * m.along), want = Math.atan(m.along - k * (1 - 2 * m.frac[1]) * .11 / 4.4); // a tapered log's axis dips toward its thin end by the taper above the buried share
    assert.ok(Math.abs(m.pitch - want) < Math.PI / 180, `${e.key} pitch ${(m.pitch * 180 / Math.PI).toFixed(2)} vs ground ${(m.groundPitch * 180 / Math.PI).toFixed(2)} deg`); }
});
test('fallen logs: seating is deterministic and the same at every LOD', () => {
  for (const e of logs.slice(0, 10)) { const a = measure(e, 0).cyl, b = measure({ ...e }, 0).cyl, c = measure(e, 2).cyl;
    assert.ok(a.equals(b), `${e.key} not deterministic`); for (let i = 0; i < 16; i++) assert.ok(Math.abs(a.elements[i] - c.elements[i]) < 1e-9, `${e.key} LOD 2 differs`); }
});