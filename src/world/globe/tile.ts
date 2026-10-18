/**
 * One globe tile (Grok Bot): a (segments+1)² grid on a quadtree node, displaced by the planet's surface, plus a skirt
 * (SimonDev ProceduralTerrain_Part10 `FixEdgeSkirt_`, MIT: edge vertices dropped toward the centre so cracks between LOD
 * levels show ground, not sky). Vertices are stored RELATIVE to the tile centre (float32 keeps centimetres inside a tile)
 * and the mesh sits at the centre in double precision; three.js composes modelView on the CPU in float64, so planet-scale
 * coordinates never reach the GPU (floating-origin idea, SimonDev part 8).
 * Built as a sliced generator for core/interest runJobs (rule 8): it yields every row.
 */
import * as THREE from 'three';
import { bounds, edgeMetres, faceDir, type QNode } from './cube';
import { surfaceColour, type Planet, type Vec3 } from './planet';

export interface TileOut { geometry: THREE.BufferGeometry; centre: Vec3; minH: number; maxH: number; /** wall time from first slice to done (spans frames) */ ms: number }
export function* tileJob(q: QNode, planet: Planet, segments: number): Generator<void, TileOut> {
  const t0 = performance.now(), n = segments + 1, R = planet.radius, { a0, b0, s } = bounds(q);
  const cd = faceDir(q.face, a0 + s / 2, b0 + s / 2), centre: Vec3 = [cd[0] * R, cd[1] * R, cd[2] * R];
  const count = n * n + 4 * n, pos = new Float32Array(count * 3), col = new Float32Array(count * 3), d: Vec3 = [0, 0, 0], rgb = [0, 0, 0];
  let minH = Infinity, maxH = -Infinity;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      faceDir(q.face, a0 + s * i / segments, b0 + s * j / segments, d);
      const surf = planet.sampleSurface(d), top = Math.max(surf.h, surf.water), r = R + top, k = (j * n + i) * 3;
      pos[k] = d[0] * r - centre[0]; pos[k + 1] = d[1] * r - centre[1]; pos[k + 2] = d[2] * r - centre[2];
      surfaceColour(surf, d, rgb); col[k] = rgb[0]; col[k + 1] = rgb[1]; col[k + 2] = rgb[2];
      minH = Math.min(minH, top); maxH = Math.max(maxH, top);
    }
    yield;
  }
  // grid triangles (CCW seen from outside: u × v = outward normal)
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) { const a = j * n + i, b = a + 1, c = a + n, e = c + 1; idx.push(a, b, e, a, e, c); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setIndex(idx); geometry.computeVertexNormals(); // normals from the grid only, so skirts do not bend edge normals
  // skirt: copy each edge vertex, pulled toward the planet centre by a fraction of the tile size [game calibration]
  const drop = edgeMetres(q.level, R) / segments * 3 + 20, nor = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const edges = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => (n - 1) * n + i),
    Array.from({ length: n }, (_, j) => j * n), Array.from({ length: n }, (_, j) => j * n + n - 1)];
  const norms = new Float32Array(count * 3); norms.set(nor.array as Float32Array);
  let v = n * n;
  edges.forEach(edge => {
    const start = v;
    for (const src of edge) {
      const k = src * 3, x = pos[k] + centre[0], y = pos[k + 1] + centre[1], z = pos[k + 2] + centre[2], l = Math.hypot(x, y, z), f = (l - drop) / l;
      pos[v * 3] = x * f - centre[0]; pos[v * 3 + 1] = y * f - centre[1]; pos[v * 3 + 2] = z * f - centre[2];
      col.copyWithin(v * 3, k, k + 3); norms.copyWithin(v * 3, k, k + 3); v++;
    }
    for (let m = 0; m < n - 1; m++) { // two triangles per edge segment; both windings so the skirt shows from either side
      const a = edge[m], b = edge[m + 1], c = start + m, dd = start + m + 1; idx.push(a, c, b, b, c, dd, a, b, c, b, dd, c);
    }
  });
  geometry.setAttribute('normal', new THREE.BufferAttribute(norms, 3)); geometry.setIndex(idx);
  geometry.computeBoundingSphere();
  return { geometry, centre, minH, maxH, ms: performance.now() - t0 };
}
