/**
 * Dive from 2 km to 2 m. On main 6af1de2e one height band rebuilt the whole
 * horizon mesh in 371–560 ms (SwiftShader then drew that upload in the same
 * frame). A frame here is one `update`. The picture is a software raster of
 * the mesh the draw would upload, from the isometric descent pose.
 *
 * Calibration: a known match is two rasters of the same settled eye (difference 0).
 * A known mismatch is a settled 1200 m frame against 300 m (about 0.06) and
 * against 28 m (about 0.11). The gate is 0.03, above the match and below
 * those mismatches. Colour channels are linear 0..1, so this is not a 0..255 count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createContinuousTerrain, type ContinuousTerrain } from '../src/render/continuousTerrain';
import { ISO_BELOW_HORIZON } from '../src/world/globe/flight';
import { horizonMetres } from '../src/world/globe/horizonSkirt';
import { viewpointPose } from '../src/world/globe/transition';
import { heightAt } from '../src/core/world';

const W = 48, H = 36;

function picture(terrain: ContinuousTerrain, eye: number) {
  const camera = new THREE.PerspectiveCamera(48, W / H, Math.max(0.2, eye * 0.01), Math.max(8000, horizonMetres(eye) * 1.2));
  const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  viewpointPose(0, 0, heightAt(0, 0), eye, 0, ISO_BELOW_HORIZON, pose);
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const color = new Float64Array(W * H * 3);
  const depth = new Float64Array(W * H);
  depth.fill(1);
  const geos: THREE.BufferGeometry[] = [];
  terrain.mesh.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    if (!geo?.getAttribute?.('position') || geo.drawRange.count === 0) return;
    geos.push(geo);
  });
  const v = new THREE.Vector3();
  const project = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (1 - (v.y * 0.5 + 0.5)) * H, z: v.z };
  };
  for (const geo of geos) {
    const pos = geo.getAttribute('position');
    const col = geo.getAttribute('color');
    const index = geo.getIndex();
    if (!pos || !index) continue;
    const tri = (ia: number, ib: number, ic: number) => {
      const a = project(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
      const b = project(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
      const c = project(pos.getX(ic), pos.getY(ic), pos.getZ(ic));
      if (a.z < -1 && b.z < -1 && c.z < -1) return;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      if (Math.abs(area) < 1e-8) return;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b.x - px) * (c.y - py) - (c.x - px) * (b.y - py)) / area;
        const w1 = ((c.x - px) * (a.y - py) - (a.x - px) * (c.y - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a.z + w1 * b.z + w2 * c.z;
        const p = y * W + x;
        if (z < -1 || z > 1 || z >= depth[p]) continue;
        depth[p] = z;
        const cr = col ? col.getX(ia) * w0 + col.getX(ib) * w1 + col.getX(ic) * w2 : 0.3;
        const cg = col ? col.getY(ia) * w0 + col.getY(ib) * w1 + col.getY(ic) * w2 : 0.4;
        const cb = col ? col.getZ(ia) * w0 + col.getZ(ib) * w1 + col.getZ(ic) * w2 : 0.2;
        color[p * 3] = cr; color[p * 3 + 1] = cg; color[p * 3 + 2] = cb;
      }
    };
    const start = geo.drawRange.start ?? 0;
    const count = geo.drawRange.count ?? index.count;
    const end = Math.min(index.count, start + (count === Infinity ? index.count : count));
    for (let i = start; i + 2 < end; i += 3) tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  }
  return color;
}

function meanDiff(a: Float64Array, b: Float64Array) {
  let n = 0, d = 0, hit = 0;
  for (let i = 0; i < a.length; i += 3) {
    const live = a[i] + a[i + 1] + a[i + 2] + b[i] + b[i + 1] + b[i + 2];
    if (live <= 0) continue;
    hit++;
    d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n++;
  }
  return { diff: n ? d / n : 0, hit };
}

test('a dive from 2000 m to 2 m stays under 500 ms and the picture changes with height', () => {
  const terrain = createContinuousTerrain();
  heightAt(0, 0);
  const gaps: { eye: number; ms: number }[] = [];
  let eye = 2000;
  while (eye >= 2) {
    const t0 = performance.now();
    terrain.update(0, 0, eye);
    gaps.push({ eye, ms: performance.now() - t0 });
    eye *= 0.84;
  }
  const max = gaps.reduce((m, g) => Math.max(m, g.ms), 0);
  assert.ok(max < 500, `frame gap ${max.toFixed(1)} ms (limit 500)`);
  const pending = () => Number(terrain.mesh.userData.pending ?? 0);
  const settle = (h: number) => {
    let guard = 0;
    let ms = 0;
    do {
      const t0 = performance.now();
      terrain.update(0, 0, h);
      ms = performance.now() - t0;
      assert.ok(ms < 500, `${h} m frame ${ms.toFixed(1)} ms`);
    } while (pending() > 0 && guard++ < 120);
    assert.equal(pending(), 0, `${h} m still streaming`);
    return picture(terrain, h);
  };
  const high = settle(1200), mid = settle(300), low = settle(28);
  const same = meanDiff(low, picture(terrain, 28));
  assert.ok(same.diff < 0.01, `same-eye calibration diff ${same.diff.toFixed(4)} (a match is 0)`);
  const far = meanDiff(high, low);
  const step = meanDiff(high, mid);
  const lowMid = meanDiff(mid, low);
  assert.ok(far.hit > 20, `raster hit ${far.hit} pixels`);
  assert.ok(far.diff > 0.03, `1200 m vs 28 m diff ${far.diff.toFixed(4)} (mismatch gate 0.03)`);
  assert.ok(step.diff > 0.03, `1200 m vs 300 m diff ${step.diff.toFixed(4)} (mismatch gate 0.03)`);
  assert.ok(lowMid.diff > 0.03, `300 m vs 28 m diff ${lowMid.diff.toFixed(4)} (mismatch gate 0.03)`);
  terrain.dispose();
});
