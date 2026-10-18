/**
 * One globe tile (Grok Bot): a (segments+1)² grid on a quadtree node, displaced by the planet's surface, plus a skirt
 * (SimonDev ProceduralTerrain_Part10 `FixEdgeSkirt_`, MIT: edge vertices dropped toward the centre so cracks between LOD
 * levels show ground, not sky). Vertices are RELATIVE to the tile centre (float32 keeps centimetres inside a tile) and the
 * mesh sits at the centre in double precision; three.js composes modelView on the CPU in float64 (floating origin).
 * `buildTile` is pure (no three.js, no DOM) so it runs in the tile worker (tileWorker.ts) or, as a fallback, sliced on the
 * main thread through core/interest runJobs. It yields once per sample row.
 * Seams: normals come from central differences over ONE extra ring of samples beyond the tile edge, so two tiles that
 * share an edge at the same level compute identical edge normals (no lighting seam).
 * Coarse/fine edges (stitching, as in geomipmapping): where the drawn neighbour across an edge is one level coarser, the
 * tile swaps to a shared index buffer that collapses its odd edge vertices onto their even neighbours (stitchIndex), so
 * that edge runs straight through the coarse tile's own vertices: no crack, no T-junction, and the skirt stays hidden.
 * Vertex data never changes (only the index buffer), so the exactness tests still hold. Deeper steps fall back to the skirt.
 * Coastlines: each vertex carries the signed field h − level (aH); the material contours it per pixel (globeMaterial), so
 * the land/water edge is an interpolated contour instead of a per-vertex colour switch (no stair steps).
 */
import * as THREE from 'three';
import { withLogDepth } from './logDepth';
import { bounds, edgeMetres, faceDir, type QNode } from './cube';
import { GLOBE_COLOURS, surfaceColour, type Planet, type Vec3 } from './planet';

/** `lake`: 255 where the reference water level is above sea level (lakes and their shores), 0 at sea level: picks the lake vs ocean water colour. */
export interface TileData { position: Float32Array; color: Float32Array; height: Float32Array; lake: Uint8Array; normal: Float32Array; index: Uint16Array; centre: Vec3; cpu: number }
export function* buildTile(q: QNode, planet: Planet, segments: number): Generator<void, TileData> {
  let cpu = 0, t = performance.now();
  const n = segments + 1, m = n + 2, R = planet.radius, { a0, b0, s } = bounds(q), den = segments * 2 ** q.level;
  const cd = faceDir(q.face, a0 + s / 2, b0 + s / 2), centre: Vec3 = [cd[0] * R, cd[1] * R, cd[2] * R];
  const count = n * n + 4 * n, position = new Float32Array(count * 3), color = new Float32Array(count * 3), height = new Float32Array(count), lake = new Uint8Array(count), normal = new Float32Array(count * 3);
  const P = new Float64Array(m * m * 3), d: Vec3 = [0, 0, 0], rgb = [0, 0, 0];
  for (let jj = 0; jj < m; jj++) { // sample rows −1 … n (the outer ring only feeds normals)
    for (let ii = 0; ii < m; ii++) {
      const i = ii - 1, j = jj - 1, inside = i >= 0 && j >= 0 && i < n && j < n;
      // exact dyadic lattice: a = -1 + 2g / (segments·2^L) with integer g, so a point shared by neighbours, parents and
      // children gets the SAME double (division is correctly rounded): shared vertices are bit-identical, never 1-ulp apart
      const a = -1 + 2 * (q.i * segments + i) / den, b = -1 + 2 * (q.j * segments + j) / den;
      faceDir(q.face, a, b, d);
      const surf = planet.sampleSurface(d), r = R + Math.max(surf.h, surf.water), k = (jj * m + ii) * 3;
      P[k] = d[0] * r - centre[0]; P[k + 1] = d[1] * r - centre[1]; P[k + 2] = d[2] * r - centre[2];
      if (inside) {
        const v = j * n + i; height[v] = surf.h - surf.level; lake[v] = surf.level > .5 ? 255 : 0;
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
      color.copyWithin(v * 3, k, k + 3); normal.copyWithin(v * 3, k, k + 3); height[v] = height[src]; lake[v] = lake[src]; v++;
    }
    for (let e = 0; e < n - 1; e++) { const a = edge[e], b = edge[e + 1], c = start + e, dd = start + e + 1; idx.push(a, c, b, b, c, dd, a, b, c, b, dd, c); } // both windings
  }
  cpu += performance.now() - t;
  return { position, color, height, lake, normal, index: Uint16Array.from(idx), centre, cpu };
}
/** Edge bits for stitchIndex: the neighbour across that edge is coarser. Row j = 0, row j = n-1, column i = 0, column i = n-1. */
export const EDGE = { south: 1, north: 2, west: 4, east: 8 } as const;
const STITCH = new Map<string, THREE.BufferAttribute>();
/** Shared index buffer for a tile of `segments` with the given coarser-neighbour edge bits (16 per segment count, built
 *  once): the grid and skirt triangles of buildTile with each odd vertex on a flagged edge (and its skirt copy) collapsed
 *  onto its lower even neighbour. Collapsed triangles are degenerate and rasterize nothing. */
export function stitchIndex(segments: number, flags: number) {
  const key = segments + '/' + flags; let a = STITCH.get(key); if (a) return a;
  const n = segments + 1, at = (i: number, j: number) => {
    if (j === 0 && flags & 1 && i & 1) i--; else if (j === n - 1 && flags & 2 && i & 1) i--;
    if (i === 0 && flags & 4 && j & 1) j--; else if (i === n - 1 && flags & 8 && j & 1) j--;
    return j * n + i;
  };
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) { const p = at(i, j), b = at(i + 1, j), c = at(i, j + 1), e = at(i + 1, j + 1); idx.push(p, b, e, p, e, c); }
  const edges: [number, (k: number) => [number, number]][] = [[1, k => [k, 0]], [2, k => [k, n - 1]], [4, k => [0, k]], [8, k => [n - 1, k]]];
  edges.forEach(([bit, ij], ei) => {
    const start = n * n + ei * n, sk = (k: number) => start + (flags & bit && k & 1 ? k - 1 : k);
    for (let k = 0; k < n - 1; k++) { const p = at(...ij(k)), b = at(...ij(k + 1)), c = sk(k), d = sk(k + 1); idx.push(p, c, b, b, c, d, p, b, c, b, d, c); }
  });
  a = new THREE.BufferAttribute(Uint16Array.from(idx), 1); STITCH.set(key, a); return a;
}
/** Free a tile's geometry without deleting a shared stitch index buffer from the GPU. */
export function releaseTileGeometry(g: THREE.BufferGeometry) { g.setIndex(null); g.dispose(); }
/** Main-thread side: wrap tile arrays (from a worker or the fallback job) in a BufferGeometry. */
export function tileGeometry(t: TileData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(t.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(t.color, 3)); g.setAttribute('aH', new THREE.BufferAttribute(t.height, 1)); g.setAttribute('aLake', new THREE.BufferAttribute(t.lake, 1, true));
  const seg = Math.round(Math.sqrt(4 + t.position.length / 3)) - 3; // count = n² + 4n
  g.setIndex(stitchIndex(seg, 0)); g.userData.stitch = 0; // shared index buffers (same triangles as t.index), never per tile
  g.computeBoundingSphere(); return g;
}
/** The globe material: vertex-colour land, per-pixel land/water contour of aH (antialiased with fwidth), water shaded
 *  shallow → deep by depth and smoother than land. Colours come from planet GLOBE_COLOURS (one table). */
/** `debugSegments` (?seams=1): skirts drawn red and tile borders yellow, unlit, over everything else (seam hunting); the
 *  vertex id tells skirt from surface (buildTile layout: n² grid, then 4 edges of n skirt copies). */
export function globeMaterial(debugSegments = 0) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 }), C = GLOBE_COLOURS;
  const uSeg = { value: debugSegments }; m.userData.uSeg = uSeg;
  m.onBeforeCompile = sh => {
    withLogDepth(sh); // per-material log depth (logDepth.ts): no renderer flag, so it also works on the game's renderer
    // centroid sampling for the varyings the atmosphere patch and the log depth use: with MSAA a fragment that only
    // covers a sample is shaded at the pixel centre, OUTSIDE its triangle; for a near edge-on skirt sliver at a tile
    // border that extrapolates vViewPosition / vFragDepth by kilometres -> wrong depth and a black (NaN/0) sample in the
    // atmosphere maths (the dotted line along the a = 0.5 tile border from orbit; -25 % = one of 4 samples)
    const centroid = (src: string, pars: string) => src.replace('varying vec3 vViewPosition;', 'centroid varying vec3 vViewPosition;')
      .replace(`#include <${pars}>`, `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n${pars.endsWith('fragment') ? 'uniform float logDepthBufFC;\n' : ''}centroid varying float vFragDepth;\ncentroid varying float vIsPerspective;\n#endif`);
    sh.vertexShader = centroid(sh.vertexShader, 'logdepthbuf_pars_vertex'); sh.fragmentShader = centroid(sh.fragmentShader, 'logdepthbuf_pars_fragment');
    sh.uniforms.uSeg = uSeg; if (debugSegments) { sh.vertexShader = '#define DEBUG_SEAMS\n' + sh.vertexShader; sh.fragmentShader = '#define DEBUG_SEAMS\n' + sh.fragmentShader; }
    sh.uniforms.uShallow = { value: new THREE.Color().setRGB(...C.shallow) }; sh.uniforms.uDeep = { value: new THREE.Color().setRGB(...C.deep) };
    sh.uniforms.uLakeShallow = { value: new THREE.Color().setRGB(...C.lakeShallow) }; sh.uniforms.uLakeDeep = { value: new THREE.Color().setRGB(...C.lakeDeep) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH, aLake;\nvarying float vH, vLake;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vH = aH; vLake = aLake;
#ifdef DEBUG_SEAMS
{ float n = uSeg + 1.0, id = float(gl_VertexID); vSkirt = id >= n * n ? 1.0 : 0.0;
  if (id < n * n) vTileUV = vec2(mod(id, n), floor(id / n)) / uSeg;
  else { float e = floor((id - n * n) / n), k = mod(id - n * n, n) / uSeg; vTileUV = e < 0.5 ? vec2(k, 0.0) : e < 1.5 ? vec2(k, 1.0) : e < 2.5 ? vec2(0.0, k) : vec2(1.0, k); } }
#endif`);
    sh.vertexShader = sh.vertexShader.replace('varying float vH, vLake;', 'varying float vH, vLake;\n#ifdef DEBUG_SEAMS\nuniform float uSeg; centroid varying float vSkirt; varying vec2 vTileUV;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uShallow, uDeep, uLakeShallow, uLakeDeep;\nvarying float vH, vLake;\nfloat landMask;\n#ifdef DEBUG_SEAMS\ncentroid varying float vSkirt; varying vec2 vTileUV;\n#endif')
      .replace('#include <color_fragment>', `#include <color_fragment>
  { float fw = max(fwidth(vH), 1e-3); landMask = smoothstep(-fw, fw, vH);
    float dw = smoothstep(0.0, 150.0, -vH); vec3 water = mix(mix(uShallow, uDeep, dw), mix(uLakeShallow, uLakeDeep, dw), vLake); diffuseColor.rgb = mix(water, diffuseColor.rgb, landMask); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.55, roughnessFactor, landMask); // water: a soft sun glint [game calibration]')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
#ifdef DEBUG_SEAMS
  { vec2 b = min(vTileUV, 1.0 - vTileUV); float d = min(b.x, b.y), w = fwidth(d) * 1.5;
    if (vSkirt > 0.0) gl_FragColor.rgb = vec3(1.0, 0.0, 0.0); else if (d < w) gl_FragColor.rgb = vec3(1.0, 0.9, 0.0); }
#endif`);
  };
  return m;
}
