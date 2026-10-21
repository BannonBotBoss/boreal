/**
 * Clover ground cover (Grok Bot, rabbit-clover): ONE InstancedMesh for every clover patch (core/clover), so the whole field is
 * one draw call. Each instance is a procedural clump of trifoliate leaves (three obovate leaflets on a petiole, a white
 * flower head in some). A patch shows clumps in proportion to its units left, so it visibly thins as it is grazed and
 * fills in as it regrows. Rebuilt at most 4x a second, only when a shown count or the patch set changed.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash, random } from '../proc/rng';
import { heightAt } from '../core/world';
import type { CloverField, CloverPatch } from '../core/clover';

export const CLOVER_DRAW = { clumpsPerM2: 70, cap: 14000, leaves: 5, spread: .07, leaflet: .02, petiole: [.05, .09] as [number, number], flowerShare: .12, rebuildSeconds: .25 };

function clumpGeometry(seed: number) {
  const r = random(seed), parts: THREE.BufferGeometry[] = [], green = new THREE.Color(), tmp = new THREE.Color();
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  for (let k = 0; k < CLOVER_DRAW.leaves; k++) {
    const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * CLOVER_DRAW.spread, h = CLOVER_DRAW.petiole[0] + r() * (CLOVER_DRAW.petiole[1] - CLOVER_DRAW.petiole[0]);
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, tilt = (r() - .5) * .5, yaw = r() * Math.PI * 2;
    green.setHSL(.27 + r() * .04, .32 + r() * .12, .16 + r() * .06); // white clover leaf green, sampled darker: ACES lifts it
    const stem = new THREE.CylinderGeometry(.0012, .0016, h, 3, 1, true); stem.translate(x * .5, h / 2, z * .5); parts.push(paint(stem.toNonIndexed(), tmp.copy(green).multiplyScalar(.8)));
    for (let l = 0; l < 3; l++) { // obovate leaflet: a circle stretched along its midrib, notched look from the tip cut
      const leaf = new THREE.CircleGeometry(CLOVER_DRAW.leaflet, 7); leaf.scale(1, 1.25, 1); leaf.translate(0, CLOVER_DRAW.leaflet * 1.15, 0);
      leaf.rotateX(-Math.PI / 2 + .25); leaf.rotateY(yaw + l * Math.PI * 2 / 3); leaf.rotateZ(tilt); leaf.translate(x, h, z);
      parts.push(paint(leaf.toNonIndexed(), l === 0 ? tmp.copy(green).offsetHSL(0, 0, .03) : green));
    }
    if (r() < CLOVER_DRAW.flowerShare) { const f = new THREE.CircleGeometry(.011, 8); f.rotateX(-Math.PI / 2); f.translate(x + .01, h + .025, z); parts.push(paint(f.toNonIndexed(), new THREE.Color(.93, .92, .86))); }
  }
  for (const p of parts) p.deleteAttribute('uv');
  const g = mergeGeometries(parts)!; for (const p of parts) p.dispose(); g.computeVertexNormals(); return g;
}

export function createCloverRenderer(scene: THREE.Scene, field: CloverField) {
  const geo = clumpGeometry(hash('clover-clump-v1'));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, CLOVER_DRAW.cap); mesh.count = 0; mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false; mesh.name = 'clover';
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CLOVER_DRAW.cap * 3), 3);
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let lastRevision = -1, lastSig = '', wait = 0;
  const shown = (pt: CloverPatch) => Math.round(Math.PI * pt.r * pt.r * CLOVER_DRAW.clumpsPerM2 * Math.max(0, pt.units) / pt.max);
  function rebuild() {
    let n = 0;
    for (const pt of field.list()) {
      const total = Math.round(Math.PI * pt.r * pt.r * CLOVER_DRAW.clumpsPerM2), show = shown(pt), r = random(hash(pt.key));
      for (let i = 0; i < total && n < CLOVER_DRAW.cap; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * pt.r, yaw = r() * Math.PI * 2, sc = .8 + r() * .5, keep = r(), tint = r(); // fixed draws per clump: thinning never moves the rest
        if (i >= show) continue;
        const x = pt.x + Math.cos(a) * d, z = pt.z + Math.sin(a) * d; p.set(x, heightAt(x, z) - .005, z); q.setFromAxisAngle(up, yaw); s.setScalar(sc * (1 - .25 * (d / pt.r) ** 2)); // edges a little smaller
        m.compose(p, q, s); mesh.setMatrixAt(n, m); c.setRGB(.85 + tint * .25, .9 + tint * .15, .85 + keep * .2); mesh.setColorAt(n, c); n++;
      }
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return {
    update(dt: number) {
      wait -= dt; if (wait > 0) return; wait = CLOVER_DRAW.rebuildSeconds;
      let sig = ''; for (const pt of field.list()) sig += shown(pt) + ',';
      if (field.revision === lastRevision && sig === lastSig) return; lastRevision = field.revision; lastSig = sig; rebuild();
    },
    get count() { return mesh.count; },
    mesh,
  };
}
