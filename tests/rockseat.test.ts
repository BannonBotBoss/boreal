import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateChunk, heightAt } from '../src/core/world';
import { rockDiameter } from '../src/core/rocks';
import { rockGeometry } from '../src/render/rocks';

/** The pre-change seatRock (2 heightAt per vertex), kept as the reference. */
function seatRef(group: THREE.Object3D, e: { x: number; z: number; rollX?: number; rollZ?: number; seed: number; scale: number }) {
  const mesh = group.children[0] as THREE.Mesh; mesh.rotation.set(e.rollX ?? 0, 0, e.rollZ ?? 0); mesh.position.y = 0; mesh.updateMatrix();
  const p = mesh.geometry.attributes.position, v = new THREE.Vector3(); let lift = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrix); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    lift = Math.max(lift, heightAt(e.x + v.x, e.z + v.z) - heightAt(e.x, e.z) - v.y); }
  return rockDiameter(e as never) > .22 ? -(minY + maxY) / 2 : lift;
}
test('seatRock (deduplicated heightAt) seats every rock exactly as before', () => {
  let n = 0;
  for (const [cx, cz] of [[0, 0], [1, -1], [-2, 3]]) for (const e of generateChunk(cx, cz)) { if (e.kind !== 'rock') continue;
    for (const d of [0, 1]) { const g = rockGeometry({ ...e, rollX: .3 * d, rollZ: -.2 * d }, d); const y = g.children[0].position.y;
      assert.equal(y, seatRef(g, { ...e, rollX: .3 * d, rollZ: -.2 * d })); n++; } }
  assert.ok(n > 100);
});
