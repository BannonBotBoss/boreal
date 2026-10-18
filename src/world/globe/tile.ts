/**
 * One globe tile (Grok Bot): a (segments+1)² grid on a quadtree node, displaced by the planet's surface, plus a skirt
 * (SimonDev ProceduralTerrain_Part10 `FixEdgeSkirt_`, MIT: edge vertices dropped toward the centre so cracks between LOD
 * levels show ground, not sky). Vertices are RELATIVE to the tile centre (float32 keeps centimetres inside a tile) and the
 * mesh sits at the centre in double precision; three.js composes modelView on the CPU in float64 (floating origin).
 * `buildTile` is pure (no three.js, no DOM) so it runs in the tile worker (tileWorker.ts) or, as a fallback, sliced on the
 * main thread through core/interest runJobs. It yields once per sample row.
 * Seams: normals come from central differences over ONE extra ring of samples beyond the tile edge, so two tiles that
 * share an edge at the same level compute identical edge normals (no lighting seam).
 * Coastlines: each vertex carries the signed field h − level (aH); the material contours it per pixel (globeMaterial), so
 * the land/water edge is an interpolated contour instead of a per-vertex colour switch (no stair steps).
 */
import * as THREE from 'three';
import { bounds, edgeMetres, faceDir, type QNode } from './cube';
import { GLOBE_COLOURS, surfaceColour, type Planet, type Vec3 } from './planet';

export interface TileData { position: Float32Array; color: Float32Array; height: Float32Array; normal: Float32Array; index: Uint16Array; centre: Vec3; cpu: number }
export function* buildTile(q: QNode, planet: Planet, segments: number): Generator<void, TileData> {
  let cpu = 0, t = performance.now();
  const n = segments + 1, m = n + 2, R = planet.radius, { a0, b0, s } = bounds(q), step = s / segments;
  const cd = faceDir(q.face, a0 + s / 2, b0 + s / 2), centre: Vec3 = [cd[0] * R, cd[1] * R, cd[2] * R];
  const count = n * n + 4 * n, position = new Float32Array(count * 3), color = new Float32Array(count * 3), height = new Float32Array(count), normal = new Float32Array(count * 3);
  const P = new Float64Array(m * m * 3), d: Vec3 = [0, 0, 0], rgb = [0, 0, 0];
  for (let jj = 0; jj < m; jj++) { // sample rows −1 … n (the outer ring only feeds normals)
    for (let ii = 0; ii < m; ii++) {
      const i = ii - 1, j = jj - 1, inside = i >= 0 && j >= 0 && i < n && j < n;
      faceDir(q.face, a0 + step * i, b0 + step * j, d);
      const surf = planet.sampleSurface(d), r = R + Math.max(surf.h, surf.water), k = (jj * m + ii) * 3;
      P[k] = d[0] * r - centre[0]; P[k + 1] = d[1] * r - centre[1]; P[k + 2] = d[2] * r - centre[2];
      if (inside) {
        const v = j * n + i; height[v] = surf.h - surf.level;
        surf.kind = ''; if (surf.h < surf.level) surf.h = surf.level; // the land colour this vertex would have at the shore
        surfaceColour(surf, d, rgb); color.set(rgb, v * 3);
      }
    }
    cpu += performance.now() - t; yield; t = performance.now();
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = ((j + 1) * m + i + 1) * 3, v = (j * n + i) * 3, e = c + 3, w = c - 3, nn = c + m * 3, ss = c - m * 3;
    position[v] = P[c]; position[v + 1] = P[c + 1]; position[v + 2] = P[c + 2];
    const ax = P[e] - P[w], ay = P[e + 1] - P[w + 1], az = P[e + 2] - P[w + 2], bx = P[nn] - P[ss], by = P[nn + 1] - P[ss + 1], bz = P[nn + 2] - P[ss + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1; // a × b, outward (u × v = n)
    normal[v] = nx / l; normal[v + 1] = ny / l; normal[v + 2] = nz / l;
  }
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) { const a = j * n + i, b = a + 1, c = a + n, e = c + 1; idx.push(a, b, e, a, e, c); }
  // skirt: copy each edge vertex, pulled toward the planet centre by a fraction of the tile size [game calibration]
  const drop = edgeMetres(q.level, R) / segments * 3 + 20;
  const edges = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => (n - 1) * n + i),
    Array.from({ length: n }, (_, j) => j * n), Array.from({ length: n }, (_, j) => j * n + n - 1)];
  let v = n * n;
  for (const edge of edges) {
    const start = v;
    for (const src of edge) {
      const k = src * 3, x = position[k] + centre[0], y = position[k + 1] + centre[1], z = position[k + 2] + centre[2], l = Math.hypot(x, y, z), f = (l - drop) / l;
      position[v * 3] = x * f - centre[0]; position[v * 3 + 1] = y * f - centre[1]; position[v * 3 + 2] = z * f - centre[2];
      color.copyWithin(v * 3, k, k + 3); normal.copyWithin(v * 3, k, k + 3); height[v] = height[src]; v++;
    }
    for (let e = 0; e < n - 1; e++) { const a = edge[e], b = edge[e + 1], c = start + e, dd = start + e + 1; idx.push(a, c, b, b, c, dd, a, b, c, b, dd, c); } // both windings
  }
  cpu += performance.now() - t;
  return { position, color, height, normal, index: Uint16Array.from(idx), centre, cpu };
}
/** Main-thread side: wrap tile arrays (from a worker or the fallback job) in a BufferGeometry. */
export function tileGeometry(t: TileData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(t.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(t.color, 3)); g.setAttribute('aH', new THREE.BufferAttribute(t.height, 1));
  g.setIndex(new THREE.BufferAttribute(t.index, 1)); g.computeBoundingSphere(); return g;
}
/** The globe material: vertex-colour land, per-pixel land/water contour of aH (antialiased with fwidth), water shaded
 *  shallow → deep by depth and smoother than land. Colours come from planet GLOBE_COLOURS (one table). */
export function globeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 }), C = GLOBE_COLOURS;
  m.onBeforeCompile = sh => {
    sh.uniforms.uShallow = { value: new THREE.Color().setRGB(...C.shallow) }; sh.uniforms.uDeep = { value: new THREE.Color().setRGB(...C.deep) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH;\nvarying float vH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uShallow, uDeep;\nvarying float vH;\nfloat landMask;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  { float fw = max(fwidth(vH), 1e-3); landMask = smoothstep(-fw, fw, vH);
    vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 2000.0, -vH)); diffuseColor.rgb = mix(water, diffuseColor.rgb, landMask); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.55, roughnessFactor, landMask); // water: a soft sun glint [game calibration]');
  };
  return m;
}
