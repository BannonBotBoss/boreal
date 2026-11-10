/**
 * One globe tile (Grok Bot): a (segments+1)Â² grid on a quadtree node, displaced by the planet's surface, plus a skirt
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
 * LOD rings: a distance split draws a fine leaf against a coarse neighbour. The fine leaf's extra vertices, normals and
 * colours are a different surface, so from overhead the boundary is a bright or dark ring. Each vertex also stores the
 * point it would have on the parent grid (even vertices already lie there; odd ones sit on the parent's diagonal).
 * The vertex shader smoothsteps onto that point between this node's split distance and the parent's, so the shared
 * edge is already the coarse surface when the leaf is replaced. The near/far pick uses each vertex's world
 * position so two same-level neighbours agree on a shared edge (those edges drop their skirt, so a centre-based
 * pick that disagreed near the reach boundary would show a hairline crack). A sealed edge (neighbour drawn at
 * this level or one coarser) drops its skirt, which was a radial fin and read as a line around every cell.
 * Coastlines: each vertex carries the signed field h âˆ’ level (aH); the material contours it per pixel (globeMaterial), so
 * the land/water edge is an interpolated contour instead of a per-vertex colour switch (no stair steps).
 */
import { GLOBE_LAYERS, LAYERS_FRAG, LAYERS_PARS } from './planetLayers';
import * as THREE from 'three';
import { withLogDepth } from './logDepth';
import { bounds, edgeMetres, faceDir, type QNode } from './cube';
import { GLOBE_COLOURS, coverWeights, surfaceColour, type Planet, type Vec3 } from './planet';
import { GLSL_NOISE, GLSL_SIMPLEX } from '../../proc/glsl';
import { CLOUDS } from './atmosphere';
import { absorbedAttribute } from '../../core/planet/solarBudget';
import { HYDRO_DRAW } from './hydroLayer';
import { figureRadius } from './figure';
import { AERIAL } from './aerialExemplar';
import { TILING_BLEND_GLSL } from './tilingBlend.glsl';

/** `lake`: 255 where the reference water level is above sea level (lakes and their shores), 0 at sea level: picks the lake vs ocean water colour. */
/** `loc`: game-local x, z (gnomonic, m) and the home weight per vertex: where the shader reads the home shoreline mask (lakeMask.ts). */
export interface TileData { position: Float32Array; color: Float32Array; height: Float32Array; lake: Uint8Array; loc: Float32Array; normal: Float32Array; index: Uint16Array; centre: Vec3; cpu: number; cover: Float32Array; coarsePos: Float32Array; coarseNrm: Float32Array; coarseH: Float32Array; coarseCol: Float32Array; coarseLake: Float32Array; coarseCover: Float32Array; level: number }
/** 0 at `near` (this leaf's own split distance: full detail), 1 at `far` (the parent split: the leaf is about to
 *  disappear and must already be the parent surface). Smoothstep, the same curve the vertex shader uses. */
export function morphWeight(dist: number, near: number, far: number): number {
  const span = far - near;
  if (!(span > 0)) return 0;
  const u = Math.max(0, Math.min(1, (dist - near) / span));
  return u * u * (3 - 2 * u);
}
/** Angular distance (radians) from the camera to a planet-centric point. Matches `globeMorph`. */
export function morphAngle(point: Vec3, cam: Vec3): number {
  const camL = Math.hypot(cam[0], cam[1], cam[2]), cL = Math.hypot(point[0], point[1], point[2]);
  if (!(camL > 1)) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (point[0] * cam[0] + point[1] * cam[1] + point[2] * cam[2]) / Math.max(cL * camL, 1e-6))));
}
/** Near/far split pick in `globeMorph`: the boosted split inside the reach band, otherwise the capped split. */
export function morphSplit(ang: number, ext: number, radius: number, reach: number, boosted: number, capped: number): number {
  return Math.max(0, ang - ext) * radius < reach ? boosted : capped;
}
export function* buildTile(q: QNode, planet: Planet, segments: number): Generator<void, TileData> {
  let cpu = 0, t = performance.now();
  const n = segments + 1, g = 2, m = n + g * 2, R = planet.radius, { a0, b0, s } = bounds(q), den = segments * 2 ** q.level;
  const cd = faceDir(q.face, a0 + s / 2, b0 + s / 2), Rc = figureRadius(cd), centre: Vec3 = [cd[0] * Rc, cd[1] * Rc, cd[2] * Rc];
  const count = n * n + 4 * n, position = new Float32Array(count * 3), color = new Float32Array(count * 3), height = new Float32Array(count), lake = new Uint8Array(count), loc = new Float32Array(count * 3), normal = new Float32Array(count * 3);
  const coarsePos = new Float32Array(count * 3), coarseNrm = new Float32Array(count * 3), coarseH = new Float32Array(count), coarseCol = new Float32Array(count * 3), coarseLake = new Float32Array(count);
  const cover = new Float32Array(count * 4), coarseCover = new Float32Array(count * 4);
  const P = new Float64Array(m * m * 3), d: Vec3 = [0, 0, 0], rgb = [0, 0, 0], fp = 1.6 * R / den; // fp: ~vertex spacing (m), the soil colour's filter footprint
  for (let jj = 0; jj < m; jj++) { // sample rows âˆ’1 â€¦ n (the outer ring only feeds normals)
    for (let ii = 0; ii < m; ii++) {
      const i = ii - g, j = jj - g, inside = i >= 0 && j >= 0 && i < n && j < n;
      // exact dyadic lattice: a = -1 + 2g / (segmentsÂ·2^L) with integer g, so a point shared by neighbours, parents and
      // children gets the SAME double (division is correctly rounded): shared vertices are bit-identical, never 1-ulp apart
      const a = -1 + 2 * (q.i * segments + i) / den, b = -1 + 2 * (q.j * segments + j) / den;
      faceDir(q.face, a, b, d);
      const surf = planet.sampleSurface(d, fp), r = figureRadius(d) + Math.max(surf.h, surf.water), k = (jj * m + ii) * 3;
      P[k] = d[0] * r - centre[0]; P[k + 1] = d[1] * r - centre[1]; P[k + 2] = d[2] * r - centre[2];
      if (inside) {
        const v = j * n + i; height[v] = surf.h - surf.level; lake[v] = surf.level > .5 ? 255 : 0;
        const hc = d[0] * planet.home[0] + d[1] * planet.home[1] + d[2] * planet.home[2]; // game-local x, z (gnomonic, as planet.sampleSurface)
        if (hc > 0) { loc[v * 3] = R * (d[0] * planet.east[0] + d[1] * planet.east[1] + d[2] * planet.east[2]) / hc; loc[v * 3 + 1] = -R * (d[0] * planet.north[0] + d[1] * planet.north[1] + d[2] * planet.north[2]) / hc; loc[v * 3 + 2] = surf.home; }
        surf.kind = ''; if (surf.h < surf.level) surf.h = surf.level; // the land colour this vertex would have at the shore
        surfaceColour(surf, d, rgb); color.set(rgb, v * 3);
        const cw = coverWeights(surf, d); cover[v * 4] = cw[0]; cover[v * 4 + 1] = cw[1]; cover[v * 4 + 2] = cw[2]; cover[v * 4 + 3] = cw[3];
      }
    }
    cpu += performance.now() - t; yield; t = performance.now();
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = ((j + g) * m + i + g) * 3, v = (j * n + i) * 3, e = c + 3, w = c - 3, nn = c + m * 3, ss = c - m * 3;
    position[v] = P[c]; position[v + 1] = P[c + 1]; position[v + 2] = P[c + 2];
    const ax = P[e] - P[w], ay = P[e + 1] - P[w + 1], az = P[e + 2] - P[w + 2], bx = P[nn] - P[ss], by = P[nn + 1] - P[ss + 1], bz = P[nn + 2] - P[ss + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1; // a Ã— b, outward (u Ã— v = n)
    normal[v] = nx / l; normal[v + 1] = ny / l; normal[v + 2] = nz / l;
  }
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) { const a = j * n + i, b = a + 1, c = a + n, e = c + 1; idx.push(a, b, e, a, e, c); }
  // skirt: copy each edge vertex, pulled toward the planet centre by a fraction of the tile size [game calibration]
  const drop = edgeMetres(q.level, R) / segments * 3 + 20;
  const edges = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => (n - 1) * n + i),
    Array.from({ length: n }, (_, j) => j * n), Array.from({ length: n }, (_, j) => j * n + n - 1)];
  const skirtSrc = new Int16Array(count).fill(-1);
  let v = n * n;
  for (const edge of edges) {
    const start = v;
    for (const src of edge) {
      const k = src * 3, x = position[k] + centre[0], y = position[k + 1] + centre[1], z = position[k + 2] + centre[2], l = Math.hypot(x, y, z), f = (l - drop) / l;
      position[v * 3] = x * f - centre[0]; position[v * 3 + 1] = y * f - centre[1]; position[v * 3 + 2] = z * f - centre[2];
      color.copyWithin(v * 3, k, k + 3); normal.copyWithin(v * 3, k, k + 3); height[v] = height[src]; lake[v] = lake[src]; loc.copyWithin(v * 3, k, k + 3); cover.copyWithin(v * 4, src * 4, src * 4 + 4); skirtSrc[v] = src; v++;
    }
    for (let e = 0; e < n - 1; e++) { const a = edge[e], b = edge[e + 1], c = start + e, dd = start + e + 1; idx.push(a, c, b, b, c, dd, a, b, c, b, dd, c); } // both windings
  }
  // Parent surface. Even vertices already are the parent lattice (segments is even on every LOD row). Odd ones
  // lie on the parent's diagonal, which is the edge shared by both of its triangles. The parent normal samples
  // two fine steps out, the same points the parent tile's own normal uses.
  const samp = (i: number, j: number) => (j + g) * m + (i + g);
  const nrmAt = (i: number, j: number, step: number) => {
    const e = samp(i + step, j) * 3, w = samp(i - step, j) * 3, nn = samp(i, j + step) * 3, ss = samp(i, j - step) * 3;
    const ax = P[e] - P[w], ay = P[e + 1] - P[w + 1], az = P[e + 2] - P[w + 2], bx = P[nn] - P[ss], by = P[nn + 1] - P[ss + 1], bz = P[nn + 2] - P[ss + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };
  const evenN = new Float32Array(n * n * 3);
  if (segments % 2 === 0) {
    for (let j = 0; j < n; j += 2) for (let i = 0; i < n; i += 2) { const vn = nrmAt(i, j, 2), o = (j * n + i) * 3; evenN[o] = vn[0]; evenN[o + 1] = vn[1]; evenN[o + 2] = vn[2]; }
  }
  const copy3 = (dst: Float32Array, to: number, srcA: Float32Array, from: number) => { dst[to] = srcA[from]; dst[to + 1] = srcA[from + 1]; dst[to + 2] = srcA[from + 2]; };
  const avg3 = (dst: Float32Array, to: number, srcA: Float32Array, a: number, b: number) => { dst[to] = (srcA[a] + srcA[b]) / 2; dst[to + 1] = (srcA[a + 1] + srcA[b + 1]) / 2; dst[to + 2] = (srcA[a + 2] + srcA[b + 2]) / 2; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = j * n + i, k = v * 3, ie = (i & 1) === 0, je = (j & 1) === 0;
    if (segments % 2 || (ie && je)) {
      copy3(coarsePos, k, position, k); copy3(coarseCol, k, color, k); coarseH[v] = height[v]; coarseLake[v] = lake[v] / 255;
      coarseCover.set(cover.subarray(v * 4, v * 4 + 4), v * 4);
      if (segments % 2) copy3(coarseNrm, k, normal, k); else copy3(coarseNrm, k, evenN, k);
      continue;
    }
    // Edge midpoint: the two even neighbours. Quad centre: the parent's diagonal, (i-1,j-1) to (i+1,j+1).
    let pa: number, pb: number;
    if (!ie && je) { pa = j * n + (i - 1); pb = j * n + (i + 1); }
    else if (ie && !je) { pa = (j - 1) * n + i; pb = (j + 1) * n + i; }
    else { pa = (j - 1) * n + (i - 1); pb = (j + 1) * n + (i + 1); }
    avg3(coarsePos, k, position, pa * 3, pb * 3); avg3(coarseCol, k, color, pa * 3, pb * 3);
    coarseH[v] = (height[pa] + height[pb]) / 2; coarseLake[v] = (lake[pa] + lake[pb]) / 510;
    for (let c = 0; c < 4; c++) coarseCover[v * 4 + c] = (cover[pa * 4 + c] + cover[pb * 4 + c]) / 2;
    const nx = evenN[pa * 3] + evenN[pb * 3], ny = evenN[pa * 3 + 1] + evenN[pb * 3 + 1], nz = evenN[pa * 3 + 2] + evenN[pb * 3 + 2], l = Math.hypot(nx, ny, nz) || 1;
    coarseNrm[k] = nx / l; coarseNrm[k + 1] = ny / l; coarseNrm[k + 2] = nz / l;
  }
  for (let s = n * n; s < count; s++) {
    const src = skirtSrc[s]; copy3(coarsePos, s * 3, coarsePos, src * 3); copy3(coarseNrm, s * 3, coarseNrm, src * 3); copy3(coarseCol, s * 3, coarseCol, src * 3);
    coarseH[s] = coarseH[src]; coarseLake[s] = coarseLake[src]; coarseCover.set(coarseCover.subarray(src * 4, src * 4 + 4), s * 4);
  }
  cpu += performance.now() - t;
  return { position, color, height, lake, loc, normal, index: Uint16Array.from(idx), centre, cpu, cover, coarsePos, coarseNrm, coarseH, coarseCol, coarseLake, coarseCover, level: q.level };
}
/** Edge bits for stitchIndex: the neighbour across that edge is coarser. Row j = 0, row j = n-1, column i = 0, column i = n-1. */
export const EDGE = { south: 1, north: 2, west: 4, east: 8 } as const;
const STITCH = new Map<string, THREE.BufferAttribute>();
/** Shared index buffer for a tile of `segments` with the given coarser-neighbour edge bits (built once per combination):
 *  the grid and skirt triangles of buildTile with each odd vertex on a flagged edge (and its skirt copy) collapsed
 *  onto its lower even neighbour. Collapsed triangles are degenerate and rasterize nothing. `skirt` is the edge-bit
 *  mask of fins to keep; a sealed edge (same level, or one level coarser) passes 0 for that bit so the radial fin,
 *  which reads as a line around the cell, is not drawn. Default 15 keeps every fin (buildTile's own index). */
export function stitchIndex(segments: number, flags: number, skirt = 15) {
  const key = segments + '/' + flags + '/' + skirt; let a = STITCH.get(key); if (a) return a;
  const n = segments + 1, at = (i: number, j: number) => {
    if (j === 0 && flags & 1 && i & 1) i--; else if (j === n - 1 && flags & 2 && i & 1) i--;
    if (i === 0 && flags & 4 && j & 1) j--; else if (i === n - 1 && flags & 8 && j & 1) j--;
    return j * n + i;
  };
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) { const p = at(i, j), b = at(i + 1, j), c = at(i, j + 1), e = at(i + 1, j + 1); idx.push(p, b, e, p, e, c); }
  const edges: [number, (k: number) => [number, number]][] = [[1, k => [k, 0]], [2, k => [k, n - 1]], [4, k => [0, k]], [8, k => [n - 1, k]]];
  edges.forEach(([bit, ij], ei) => {
    if ((skirt & bit) === 0) return;
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
  g.setAttribute('color', new THREE.BufferAttribute(t.color, 3)); g.setAttribute('aH', new THREE.BufferAttribute(t.height, 1)); g.setAttribute('aLake', new THREE.BufferAttribute(t.lake, 1, true)); g.setAttribute('aLoc', new THREE.BufferAttribute(t.loc, 3));
  g.setAttribute('aCoarse', new THREE.BufferAttribute(t.coarsePos, 3)); g.setAttribute('aCoarseN', new THREE.BufferAttribute(t.coarseNrm, 3)); g.setAttribute('aCoarseC', new THREE.BufferAttribute(t.coarseCol, 3));
  g.setAttribute('aCoarseH', new THREE.BufferAttribute(t.coarseH, 1)); g.setAttribute('aCoarseL', new THREE.BufferAttribute(t.coarseLake, 1));
  g.setAttribute('aCover', new THREE.BufferAttribute(t.cover, 4)); g.setAttribute('aCoarseK', new THREE.BufferAttribute(t.coarseCover, 4));
  const level = new Float32Array(t.position.length / 3); level.fill(t.level); g.setAttribute('aLevel', new THREE.BufferAttribute(level, 1));
  const seg = Math.round(Math.sqrt(4 + t.position.length / 3)) - 3; // count = nÂ² + 4n
  g.setIndex(stitchIndex(seg, 0)); g.userData.stitch = -1; // stitch() fills the real edge mask; 0 would mean "already sealed" and skip it
  g.computeBoundingSphere(); return g;
}
/** The globe material: vertex-colour land, per-pixel land/water contour of aH (antialiased with fwidth), water shaded
 *  shallow â†’ deep by depth and smoother than land. Colours come from planet GLOBE_COLOURS (one table). */
/** `debugSegments` (?seams=1): skirts drawn red and tile borders yellow, unlit, over everything else (seam hunting); the
 *  vertex id tells skirt from surface (buildTile layout: nÂ² grid, then 4 edges of n skirt copies). */
/** Lake colours, one uniform pair shared by every globe material (the in-page band eases them toward the game's water near
 *  the ground, inpage.ts; values only, the program is the same). */
/** Sun glint on water, physical: Fresnel reflectance at normal incidence F0 = ((n-1)/(n+1))², n = 1.33 -> 0.020 (three's default
 *  dielectric 0.04 doubled the glint and the milky haze over the whole ocean); roughness from the Cox & Munk (1954, JOSA 44:838)
 *  mean-square wave slope σ² = 0.003 + 0.00512 W (W wind at 12.5 m, m/s). GGX α ≈ rms slope σ (Walter et al. 2007), three's
 *  roughness r = sqrt(α) -> r = σ²^¼. W = 7 m/s: global-mean ocean surface wind ~7 m/s (Wentz et al. 2007, Science 317:233; SSM/I) [verify]. */
export const GLINT = { n: 1.33, windMs: 7 };
export const fresnelF0 = (n = GLINT.n) => ((n - 1) / (n + 1)) ** 2;
export const coxMunkSigma2 = (w = GLINT.windMs) => 0.003 + 0.00512 * w;
export const glintRoughness = (w = GLINT.windMs) => coxMunkSigma2(w) ** 0.25;
/** Matthew 2026-11-06: ocean sun glint on this MeshStandardMaterial. Lakes stay on GLINT / Cox-Munk.
 *  The chop and these values are applied only when uOceanGlint is 1 (tier octaves ≥ CLOUDS.shadowMinOct:
 *  off at Very low and Minimum). roughness 0.15–0.2, metalness 0.1–0.2. */
export const OCEAN_GLINT = { roughness: 0.18, metalness: 0.15 };
export const GLOBE_LAKE = { shallow: { value: new THREE.Color().setRGB(...GLOBE_COLOURS.lakeShallow) }, deep: { value: new THREE.Color().setRGB(...GLOBE_COLOURS.lakeDeep) }, rough: { value: glintRoughness() } }; // rough: water roughness (inpage eases it to the game water's .32 in the band)
/** High-frequency ground detail in the tile shader (the CPU makes the macro shape, the GPU adds what is finer than a vertex):
 *  three octaves of seeded value noise on proc/glsl's hash2u, 3D in planet space (a function of position only, so it is
 *  continuous across tiles and cube faces, with no projection stretch on slopes), as albedo variation + a derivative bump. Precision:
 *  the shader sees camera-relative positions; the camera's planet position enters as a per-octave lattice offset taken
 *  mod 4096 cells in doubles here. Uniforms only: x = tier scale (GLOBE_LOD.detail) x smoothstep(fadeFrom, fadeFull, alt),
 *  0 skips the work. lambda: octave cell sizes (m); amp: bump heights (m); albedo: +- brightness. [game calibration] */
/** proc/glsl's noise, namespaced (gd_): other patches of this material (atmosphere, the game's photoreal chain) may or may
 *  not bring their own unguarded copy, and GLSL allows one body per name. Same code, same values. */
const DETAIL_NOISE = GLSL_NOISE.replace(/\b(hash2s|vnoise|hash2u|vnoiseU|fbm)\b/g, 'gd_$1');
/** Simplex for the ocean chop only. Renamed so it does not collide with anything the atmosphere patch injects. */
const SIMPLEX_NOISE = GLSL_SIMPLEX.replace(/\b(mod289v3|mod289v4|permute4|taylorInvSqrt4|snoise)\b/g, 'gd_$1');
/** r20: finer and much weaker than r19 (40/12/4 m, albedo .6, bumps 3 m read as blotches): crown-scale grain, not patches. */
export const DETAIL = { lambda: [24, 8, 3], amp: [1.2, .6, .25], albedo: .22, weight: [.3, .4, .3], fadeFrom: 5000, fadeFull: 2500 };
export const GLOBE_DETAIL = { uDetail: { value: new THREE.Vector4(0, DETAIL.albedo, 1, 0) }, uLiveMosaic: { value: 0 }, uDetO0: { value: new THREE.Vector3() }, uDetO1: { value: new THREE.Vector3() }, uDetO2: { value: new THREE.Vector3() },
  uDetL: { value: new THREE.Vector3(...DETAIL.lambda.map(l => 1 / l)) }, uDetAmp: { value: new THREE.Vector3(...DETAIL.amp) } };
/** globeView, each render: the detail strength and the camera's lattice offsets (double precision in, float32 out). */
export function setGlobeDetail(cam: Vec3, alt: number, tierScale: number, seed: number) {
  const u = GLOBE_DETAIL, t = Math.min(1, Math.max(0, (DETAIL.fadeFrom - alt) / (DETAIL.fadeFrom - DETAIL.fadeFull)));
  u.uDetail.value.set(tierScale * t * t * (3 - 2 * t), DETAIL.albedo, 1, seed % 65536);
  // Below 20 km a coarse tile can still fill the drone frame. The mosaic then uses a
  // wavelength of at least a few pixels, so the fill breaks before the quadtree arrives.
  u.uLiveMosaic.value = alt < 20000 ? 1 : 0;
  const m = (v: number, l: number) => (((v / l) % 4096) + 4096) % 4096;
  [u.uDetO0, u.uDetO1, u.uDetO2].forEach((o, k) => { const l = DETAIL.lambda[k]; o.value.set(m(cam[0], l), m(cam[1], l), m(cam[2], l)); });
}
/** One program, one upload per frame (globeView sets these before the draw). x radius (m), y capped split, z full
 *  split, w near boost. Reach is metres. Cam is the real camera, because the draw itself runs from the origin. */
export const GLOBE_MORPH = { uMorph: { value: new THREE.Vector4(0, 1, 1, 0) }, uMorphReach: { value: 0 }, uMorphCam: { value: new THREE.Vector3() } };
export function setGlobeMorph(radius: number, split: number, full: number, boost: number, reach: number, cam: Vec3) {
  GLOBE_MORPH.uMorph.value.set(radius, split, full, boost);
  GLOBE_MORPH.uMorphReach.value = reach;
  GLOBE_MORPH.uMorphCam.value.set(cam[0], cam[1], cam[2]);
}
/** morphWeight, in the vertex shader. The near test is lod.ts nearNode: extent is 0.8 edge / radius, the parent
 *  uses twice that because its edge is twice as long. The angle is measured at the vertex's world position so
 *  two same-level neighbours share one near/far pick on a shared edge. Level 0 has no parent, so it stays at full detail. */
const MORPH_GLSL = /* glsl */`
attribute vec3 aCoarse, aCoarseN, aCoarseC;
attribute float aCoarseH, aCoarseL, aLevel;
uniform vec4 uMorph;
uniform float uMorphReach;
uniform vec3 uMorphCam;
float gMorph;
float globeMorph() {
  if (aLevel < 0.5 || uMorph.x <= 0.0) return 0.0;
  vec3 vertCam = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 vertW = vertCam + uMorphCam;
  float camL = length(uMorphCam), cL = length(vertW);
  float ang = camL > 1.0 ? acos(clamp(dot(vertW, uMorphCam) / max(cL * camL, 1e-6), -1.0, 1.0)) : 0.0;
  float edge = uMorph.x * 1.57079632679 / exp2(aLevel);
  float ext = edge / uMorph.x * 0.8;
  float boosted = uMorph.z * (1.0 + uMorph.w);
  float split = max(0.0, ang - ext) * uMorph.x < uMorphReach ? boosted : uMorph.y;
  float parentSplit = max(0.0, ang - ext * 2.0) * uMorph.x < uMorphReach ? boosted : uMorph.y;
  float dist = length(vertCam);
  float farD = parentSplit * edge * 2.0, nearD = split * edge, span = farD - nearD;
  if (span <= 0.0) return dist >= farD ? 1.0 : 0.0;
  float t = clamp((dist - nearD) / span, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}`;
/** Home shoreline mask (lakeMask.ts): one R8 signed-field texture over the home region, shared by every globe material.
 *  uShore: x = 1 / region size, y = half a texel (texel i sits on x = i * size / n), w = n, z = 1 once the mask is loaded (until
 *  then, and outside the home region, the per-vertex field aH contours as before). Uniform values only, same program. */
const SHORE_EMPTY = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat); SHORE_EMPTY.needsUpdate = true;
export const GLOBE_SHORE = { uShoreTex: { value: SHORE_EMPTY as THREE.Texture }, uShore: { value: new THREE.Vector4(1, 0, 0, 0) }, key: '' };
/** Land tint (1 = unchanged): inpage.ts eases it toward the game patch's colour over the end of the descent. Uniform only. */
export const GLOBE_LAND = { uLandTint: { value: new THREE.Color(1, 1, 1) } };
/** Cinematic Earth. x magma, y sea fill from the basins, z plants across the land, w unused. 0 is the present globe. */
export const GLOBE_ERA = { uEra: { value: new THREE.Vector4(0, 0, 0, 0) }, uCrack: { value: 1 } };
/** Atmosphere grade for the same beats. warm 1 is an orange haze, steam raises the cloud deck. hold 0 leaves the sky alone. */
export const GLOBE_SKY = { warm: 0, steam: 0, clear: 0, hold: 0 };
/** Shore band widths (m of the field): wet ground above the waterline, shallows below it. [game calibration] */
export const SHORE = { wet: .6, shallow: 1.5, wetDark: .2, shallowMix: .4 };
export function setLakeMask(key: string, data: Uint8Array, n: number, size: number) {
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.LinearFilter, THREE.LinearFilter);
  t.generateMipmaps = false; // no mips: an averaged signed field is not a coarser shoreline (at grazing angles it read as all water)
  t.needsUpdate = true; const old = GLOBE_SHORE.uShoreTex.value; if (old !== SHORE_EMPTY) old.dispose();
  GLOBE_SHORE.uShoreTex.value = t; GLOBE_SHORE.uShore.value.set(1 / size, .5 / n, 1, n); GLOBE_SHORE.key = key;
}
/** T-0057: the solar-budget layer is on for a quality row whose cloud-octave count is above 0, and off at Minimum
 *  (CLOUDS.octaves ends at 0). Same rows the cloud shell already uses. No second ladder. */
export function solarLayerOn(tier: number) {
  const i = Math.max(0, Math.min(CLOUDS.octaves.length - 1, tier | 0));
  return CLOUDS.octaves[i] > 0;
}
/** The gate: the absorbed attribute is present exactly when the tier draws the layer. A fixed "always off" or a
 *  missing attribute at Ultra fails. `hasAbsorbed` is geometry.getAttribute('aAbsorbed') != null. */
export function solarLayerGate(hasAbsorbed: boolean, tier: number) { return hasAbsorbed === solarLayerOn(tier); }
/** Shared uniforms (one program). uSolarLayer is 0 at Minimum, so the fragment keeps the terrain colour. */
export const SOLAR_DRAW = { uSolarLayer: { value: 0 }, uQScale: { value: 900 } };
export function setSolarLayer(on: boolean) { SOLAR_DRAW.uSolarLayer.value = on ? 1 : 0; }
/** Write Q_absorbed onto the tile, or remove it when the tier drops the layer. Returns whether the layer is on.
 *  Cloud defaults to each vertex's T-0059 cover (null); pass a number to override. */
export function applySolarAttribute(g: THREE.BufferGeometry, centre: Vec3, day: number, hour: number, tier: number, cloud: number | null = null) {
  if (!solarLayerOn(tier)) { if (g.getAttribute('aAbsorbed')) g.deleteAttribute('aAbsorbed'); return false; }
  const pos = g.getAttribute('position').array, col = g.getAttribute('color').array, h = g.getAttribute('aH').array;
  const arr = absorbedAttribute(pos, col, h, centre, day, hour, cloud);
  const prev = g.getAttribute('aAbsorbed') as THREE.BufferAttribute | undefined;
  if (prev && prev.array.length === arr.length) { (prev.array as Float32Array).set(arr); prev.needsUpdate = true; }
  else g.setAttribute('aAbsorbed', new THREE.BufferAttribute(arr, 1));
  return true;
}
/** A vertex lake with the home mask off is one dark polygon once the camera is low enough to see the
 *  triangle. Below `below` that lake is hidden and the land colour stays. The home shoreline mask
 *  still draws the real shore. Oceans (lake 0) stay, and so do the far-field lakes at 10 km and in orbit.
 *  One uniform for every tile: three uploads a MeshStandardMaterial's uniforms once per material per frame.
 *  [game calibration] */
export const COARSE_LAKE = { below: 8000 };
export const LAKE_FADE = { uHide: { value: 0 } };
export function coarseLake(alt: number, homeMask: number, lake: number) {
  const hide = alt < COARSE_LAKE.below ? 1 : 0;
  return hide * Math.max(0, Math.min(1, lake)) * (1 - Math.max(0, Math.min(1, homeMask)));
}
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
    sh.uniforms.uShallow = { value: new THREE.Color().setRGB(...C.shallow) }; sh.uniforms.uDeep = { value: new THREE.Color().setRGB(...C.deep) }; sh.uniforms.uDeepSun = { value: new THREE.Color().setRGB(...C.deepSun) };
    sh.uniforms.uOceanRough = { value: OCEAN_GLINT.roughness }; sh.uniforms.uOceanMetal = { value: OCEAN_GLINT.metalness };
    sh.uniforms.uLakeShallow = GLOBE_LAKE.shallow; sh.uniforms.uLakeDeep = GLOBE_LAKE.deep; sh.uniforms.uLakeRough = GLOBE_LAKE.rough; Object.assign(sh.uniforms, GLOBE_DETAIL, GLOBE_LAYERS, GLOBE_MORPH, AERIAL); sh.uniforms.uLandTint = GLOBE_LAND.uLandTint; sh.uniforms.uEra = GLOBE_ERA.uEra; sh.uniforms.uCrack = GLOBE_ERA.uCrack; sh.uniforms.uShoreTex = GLOBE_SHORE.uShoreTex; sh.uniforms.uShore = GLOBE_SHORE.uShore; sh.uniforms.uHideLake = LAKE_FADE.uHide; sh.uniforms.uSolarLayer = SOLAR_DRAW.uSolarLayer; sh.uniforms.uQScale = SOLAR_DRAW.uQScale; sh.uniforms.uHydroTex = HYDRO_DRAW.uHydroTex; sh.uniforms.uHydroLayer = HYDRO_DRAW.uHydroLayer;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH, aLake;\nattribute float aAbsorbed;\nattribute vec3 aLoc;\nattribute vec4 aCover, aCoarseK;\nvarying float vH, vLake;\nvarying float vAbsorbed;\nvarying vec3 vDetW, vLoc, vAerial;\nvarying vec4 vCover;\n' + MORPH_GLSL)
      .replace('#include <color_vertex>', `#include <color_vertex>\ngMorph = globeMorph();`)
      .replace('#include <morphcolor_vertex>', `#include <morphcolor_vertex>\nvColor.rgb = mix(vColor.rgb, aCoarseC, gMorph);`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, aCoarseN, gMorph));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = mix(transformed, aCoarse, gMorph);
vH = mix(aH, aCoarseH, gMorph); vLake = mix(aLake, aCoarseL, gMorph); vAbsorbed = aAbsorbed; vLoc = aLoc; vDetW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vAerial = vDetW - uMorphCam; vCover = mix(aCover, aCoarseK, gMorph);
#ifdef DEBUG_SEAMS
{ float n = uSeg + 1.0, id = float(gl_VertexID); vSkirt = id >= n * n ? 1.0 : 0.0;
  if (id < n * n) vTileUV = vec2(mod(id, n), floor(id / n)) / uSeg;
  else { float e = floor((id - n * n) / n), k = mod(id - n * n, n) / uSeg; vTileUV = e < 0.5 ? vec2(k, 0.0) : e < 1.5 ? vec2(k, 1.0) : e < 2.5 ? vec2(0.0, k) : vec2(1.0, k); } }
#endif`);
    sh.vertexShader = sh.vertexShader.replace('varying float vH, vLake;', 'varying float vH, vLake;\n#ifdef DEBUG_SEAMS\nuniform float uSeg; centroid varying float vSkirt; varying vec2 vTileUV;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LAYERS_PARS + 'uniform vec3 uShallow, uDeep, uDeepSun, uLakeShallow, uLakeDeep; uniform float uLakeRough, uOceanRough, uOceanMetal;\nvarying float vH, vLake;\nvarying float vAbsorbed;\nuniform float uSolarLayer, uQScale;\nfloat landMask;\nfloat presentW = 1.0;\nfloat oceanGlint = 0.0;\nuniform vec4 uDetail; // x strength (tier x altitude fade), y albedo amplitude, z bump scale, w seed\nuniform float uLiveMosaic;\nuniform vec3 uDetO0, uDetO1, uDetO2, uDetL, uDetAmp;\nvarying vec3 vDetW, vLoc, vAerial;\nvarying vec4 vCover;\nuniform float uHideLake;\nuniform sampler2D uExCanopy, uExFen, uExShore, uExWater, uExLut;\nuniform float uExOn, uExMetres, uExGain;\nfloat aerialBand = 0.0;\n' + TILING_BLEND_GLSL + '\nuniform sampler2D uShoreTex;\nuniform vec4 uShore;\nuniform vec3 uLandTint;\nuniform vec4 uEra;\nuniform float uCrack;\nfloat eraCrack = 0.0;\nfloat eraMagma = 0.0;\nfloat detH = 0.0;\n' + DETAIL_NOISE + '\n' + SIMPLEX_NOISE + '\n// hash2u value noise with a 4096-cell periodic lattice: the camera offsets are mod 4096 cells (doubles on the CPU), so the\n// pattern stays continuous when the offset wraps and stays float32-exact near the camera\nfloat detC(vec3 c, float s) { return gd_hash2u(vec2(c.x + c.z * 4096.0, c.y), s); } // 3D cell id < 2^24: exact\nfloat detN(vec3 p, float s) { vec3 i = floor(p), f = p - i, u = f * f * (3.0 - 2.0 * f), a = mod(i, 4096.0), b = mod(i + 1.0, 4096.0);\n  return mix(mix(mix(detC(a, s), detC(vec3(b.x, a.yz), s), u.x), mix(detC(vec3(a.x, b.y, a.z), s), detC(vec3(b.xy, a.z), s), u.x), u.y),\n    mix(mix(detC(vec3(a.xy, b.z), s), detC(vec3(b.x, a.y, b.z), s), u.x), mix(detC(vec3(a.x, b.yz), s), detC(b, s), u.x), u.y), u.z); }\n#ifdef DEBUG_SEAMS\ncentroid varying float vSkirt; varying vec2 vTileUV;\n#endif')
      .replace('#include <color_fragment>', `#include <color_fragment>
  { // land/water: the home shoreline mask per pixel where it is loaded (lakeMask.ts), else the per-vertex field
    vec2 suv = vLoc.xy * uShore.x + uShore.y; float sfp = length(fwidth(suv)) * uShore.w; // pixel footprint in texels
    float hm = step(0.5, vLoc.z) * uShore.z * (1.0 - smoothstep(5.0, 9.0, sfp)), sf = (texture2D(uShoreTex, suv).r * 255.0 - 128.0) / 16.0; // keep the mask while a pixel is finer than ~45 m; coarser than that the averaged field read as all water, and hiding the vertex lake then left flat land
    float F = mix(vH, sf, hm);
    // A coarse quad draws a lake as a straight polygon. A few metres of world-space
    // wander, only while the hi-res shore mask is off and a pixel is metres not kilometres,
    // bends that edge. The amplitude stays under a real lake's depth so open water does not dry.
    float pxS = max(length(fwidth(vDetW.xz)), 1e-3);
    // Aerial band from the camera distance, not from fwidth. On these tiles fwidth(vDetW)
    // does not track metres per pixel (the 2000 m frame stayed on the vertex albedo, luma
    // ~32, after the stand table moved). length(vViewPosition) is the eye distance in metres.
    // 400 m and 2000 m are in. The forest floor (~40 m) and the full disk are out.
    float eye = length(vViewPosition);
    float aerial = smoothstep(120.0, 350.0, eye) * (1.0 - smoothstep(20000.0, 60000.0, eye));
    float shoreBand = (1.0 - hm) * smoothstep(0.35, 1.1, pxS) * (1.0 - smoothstep(40.0, 90.0, pxS));
    F += (detN(vDetW / 48.0, uDetail.w + 19.0) - 0.5) * max(3.0, pxS * 2.2) * shoreBand * (1.0 - aerial);
    // Aerial shore: bend the height contour by a few tens of metres so a coarse quad is not a straight cut.
    // Only next to the existing contour, so this does not open a new lake in the forest.
    float shoreGate = 1.0 - smoothstep(8.0, 60.0, abs(F));
    F += ((detN(vDetW / 240.0, uDetail.w + 19.0) - 0.5) * 70.0 + (detN(vDetW / 75.0, uDetail.w + 23.0) - 0.5) * 22.0) * aerial * shoreGate;
    float fw = max(fwidth(F), 1e-3); landMask = smoothstep(-fw, fw, F);
    // Below 8 km a vertex lake used to be forced to land, so the 400 m and 2000 m frames had no water.
    // Keep it water in the aerial band. Underfoot the hide stays, and the game water draws the shore.
    // Underfoot, a vertex lake with the mask off used to be forced to land (a black polygon).
    // From the air that hide erased the lakes. Draw the vertex lake as water instead.
    landMask = mix(landMask, 1.0, vLake * (1.0 - hm) * uHideLake * (1.0 - aerial));
    float band = hm * (1.0 - smoothstep(0.1, 0.4, fw)); // shore bands only while they are wider than a pixel
    float eraSum = uEra.x + uEra.y + uEra.z + uEra.w;
    presentW = eraSum < 0.001 ? 1.0 : (1.0 - (1.0 - clamp(uEra.w, 0.0, 1.0)) * (1.0 - clamp(uEra.w, 0.0, 1.0))); // film beats stay as authored; the present globe (and a non-film load) takes the new ocean
    float dw = smoothstep(0.0, 150.0, -vH);
    float face = smoothstep(0.05, 0.82, max(dot(normalize(vNormal), uSun), 0.0)); // darker away from a face-on sun; #030b1e -> #051330
    vec3 deepCol = mix(uDeep, uDeepSun, face);
    vec3 water = mix(mix(uShallow, deepCol, dw), mix(uLakeShallow, uLakeDeep, dw), vLake);
    // Globe lakes are ~0.01 albedo and read as black polygons from a few kilometres up.
    // A tannin lake in Sentinel-2 cloudless is dark blue, not a flat charcoal facet.
    water = mix(water, vec3(0.018, 0.036, 0.046), shoreBand * (1.0 - landMask) * (1.0 - aerial));
    water = mix(water, diffuseColor.rgb * 0.5, band * ${SHORE.shallowMix.toFixed(3)} * (1.0 - smoothstep(0.0, ${SHORE.shallow.toFixed(3)}, -F))); // shallows: the bed shows through
    diffuseColor.rgb *= 1.0 - band * ${SHORE.wetDark.toFixed(3)} * (1.0 - smoothstep(0.0, ${SHORE.wet.toFixed(3)}, F)); // wet ground at the waterline
    diffuseColor.rgb = mix(water, diffuseColor.rgb, landMask);
    // 400–2000 m: real aerial exemplars. Weights are the vertex cover plus stands,
    // age and disturbance at 100–800 m, and the height field (wet hollows, the shore).
    // The shoreline is landMask from F. No punched pond and no flat navy disc.
    aerialBand = aerial;
    if (aerial > 0.02 && uExOn > 0.5) {
      float eyeDist = length(vViewPosition);
      // At 2000 m a 1.6 m crown is a repeating grain. A lower mip blurs it toward the
      // Sentinel pixel without stretching the tiling cells into big squares.
      float coarse = smoothstep(650.0, 1600.0, eyeDist);
      float lod = coarse * 2.6;
      vec2 uv = vAerial.xz / max(uExMetres, 1.0);
      vec3 canopy = tbSample(uExCanopy, uExLut, 0.0, uv, lod);
      vec3 fenC = tbSample(uExFen, uExLut, 1.0, uv, lod);
      vec3 shoreC = tbSample(uExShore, uExLut, 2.0, uv, lod);
      vec3 waterC = tbSample(uExWater, uExLut, 3.0, uv, lod);
      float stand = detN(vDetW / 760.0, uDetail.w + 41.0) * 0.72 + detN(vDetW / 280.0, uDetail.w + 42.0) * 0.28;
      float age = detN(vDetW / 480.0, uDetail.w + 53.0);
      float burnN = detN(vDetW / 880.0, uDetail.w + 67.0);
      float above = max(F, 0.0);
      // Fen is a wet patch, not every metre of ground that happens to sit near a lake.
      float fenN = smoothstep(0.70, 0.88, 1.0 - stand);
      float fen = max(vCover.y, fenN * (1.0 - smoothstep(3.0, 18.0, above)));
      fen = clamp(fen, 0.0, 1.0);
      float decid = smoothstep(0.60, 0.78, stand) * (1.0 - fen);
      float rock = smoothstep(0.76, 0.90, age) * (1.0 - fen);
      rock = max(rock, smoothstep(0.55, 0.82, vCover.z) * smoothstep(22.0, 55.0, above));
      float burn = smoothstep(0.87, 0.96, burnN);
      rock = clamp(max(rock, burn), 0.0, 1.0);
      float sum = decid + fen + rock;
      if (sum > 1.0) { decid /= sum; fen /= sum; rock /= sum; sum = 1.0; }
      float conifer = 1.0 - sum;
      // Far grade pulls the lawn-green canopy toward the darker olive of the Sentinel tile.
      // Near grade keeps the crowns that read at 400 m.
      vec3 coniferC = mix(canopy, canopy * vec3(0.34, 0.28, 0.24), coarse);
      vec3 decidC = mix(canopy * vec3(1.05, 0.96, 0.62), canopy * vec3(0.90, 0.74, 0.32), coarse);
      vec3 fenCol = fenC * vec3(0.70, 0.55, 0.34);
      vec3 rockCol = shoreC * vec3(0.72, 0.66, 0.58);
      vec3 burnCol = rockCol * 0.22 + vec3(0.025, 0.018, 0.012);
      rockCol = mix(rockCol, burnCol, burn);
      vec3 landEx = coniferC * conifer + decidC * decid + fenCol * fen + rockCol * rock;
      float shoreH = landMask * (1.0 - smoothstep(0.0, 7.0, above));
      landEx = mix(landEx, mix(rockCol, fenCol, 0.35), clamp(shoreH, 0.0, 1.0));
      vec3 waterCol = waterC * vec3(0.28, 0.36, 0.55);
      vec3 photo = mix(waterCol, landEx, landMask) * uExGain;
      diffuseColor.rgb = mix(diffuseColor.rgb, photo, aerial * (1.0 - clamp(vCover.w, 0.0, 1.0)));
    }
    }${LAYERS_FRAG}
  if (uDetail.x > 0.001) { // ground detail (DETAIL): octaves fade out where a cell is under ~2 pixels (no shimmer)
    float a = 0.0;
    vec3 q0 = uDetO0 + vDetW * uDetL.x, q1 = uDetO1 + vDetW * uDetL.y, q2 = uDetO2 + vDetW * uDetL.z;
    float k0 = 1.0 - smoothstep(0.25, 0.6, length(fwidth(q0))), k1 = 1.0 - smoothstep(0.25, 0.6, length(fwidth(q1))), k2 = 1.0 - smoothstep(0.25, 0.6, length(fwidth(q2)));
    float n0 = detN(q0, uDetail.w) - 0.5, n1 = detN(q1, uDetail.w + 1.0) - 0.5, n2 = detN(q2, uDetail.w + 2.0) - 0.5;
    detH = (k0 * n0 * uDetAmp.x + k1 * n1 * uDetAmp.y + k2 * n2 * uDetAmp.z) * uDetail.x * uDetail.z * landMask;
    a = k0 * n0 * ${DETAIL.weight[0].toFixed(3)} + k1 * n1 * ${DETAIL.weight[1].toFixed(3)} + k2 * n2 * ${DETAIL.weight[2].toFixed(3)};
    diffuseColor.rgb *= 1.0 + 2.0 * a * uDetail.x * uDetail.y * landMask * (1.0 - aerialBand);
  }
  if (uOceanGlint > 0.5) { // macro wave chop on the ocean only (stegu simplex). Fades when a cell is under ~2 px. Lakes and the film's early beats stay flat.
    float ocean = (1.0 - landMask) * (1.0 - clamp(vLake, 0.0, 1.0)) * presentW;
    vec3 pw = vDetW;
    float k1 = 1.0 - smoothstep(0.22, 0.55, length(fwidth(pw * 4.0e-5)));
    float k2 = 1.0 - smoothstep(0.22, 0.55, length(fwidth(pw * 2.2e-4)));
    float k3 = 1.0 - smoothstep(0.22, 0.55, length(fwidth(pw * 1.6e-3)));
    detH += ocean * (k1 * gd_snoise(pw * 4.0e-5) * 160.0 + k2 * gd_snoise(pw * 2.2e-4 + 9.1) * 28.0 + k3 * gd_snoise(pw * 1.6e-3 + 3.7) * 3.5); }
  diffuseColor.rgb *= mix(vec3(1.0), uLandTint, landMask); // in-page band: land matched to the game patch near the handover (GLOBE_LAND)
  if (uSolarLayer > 0.5) { // T-0057: Q_absorbed on this vertex. Night (0) cools and dims; a sunlit cell stays warm. Off when the uniform is 0.
    float qn = clamp(vAbsorbed / max(uQScale, 1.0), 0.0, 1.0);
    diffuseColor.rgb *= mix(vec3(0.22, 0.26, 0.40), vec3(1.12, 1.04, 0.92), qn); }
  if (uEra.x + uEra.y + uEra.z + uEra.w > 0.001) {
    vec3 present = diffuseColor.rgb;
    vec3 nrm = normalize(vDetW);
    float plateN = detN(nrm * 22.0, 11.0);
    float plate = smoothstep(0.04, 0.2, plateN);
    float a = detN(nrm * 28.0, 3.0);
    float b = detN(nrm * 28.0 + vec3(2.4, 7.1, 1.3), 6.0);
    eraCrack = pow(clamp(1.0 - abs(a - b) * 42.0, 0.0, 1.0), 3.2);
    eraMagma = uEra.x;
    vec3 magma = vec3(1.85, 0.42, 0.07);
    vec3 crust = mix(vec3(0.03, 0.01, 0.008), vec3(0.30, 0.25, 0.20), clamp(1.0 - uEra.x, 0.0, 1.0));
    vec3 skin = mix(crust, mix(magma, crust, plate), clamp(uCrack, 0.0, 1.0));
    float crackShow = clamp(uCrack, 0.0, 1.0);
    skin = mix(skin, magma, eraCrack * crackShow);
    diffuseColor.rgb = skin;
    float flooded = (1.0 - landMask) * smoothstep(0.08, 0.72, uEra.y) * (1.0 - uEra.x);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.008, 0.028, 0.09), flooded);
    float elev = smoothstep(0.0, 2200.0, max(vH, 0.0));
    float shore = 1.0 - smoothstep(0.0, 1.0, elev);
    float need = mix(0.78, 0.05, shore);
    float plants = landMask * smoothstep(need, need + 0.14, uEra.z);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.38, 0.08), plants);
    float presentMix = clamp(uEra.w, 0.0, 1.0); presentMix = 1.0 - (1.0 - presentMix) * (1.0 - presentMix);
    diffuseColor.rgb = mix(diffuseColor.rgb, present, presentMix);
  }
  // Stand mosaic. Sentinel-2 MSI is a 10 m pixel (Drusch et al. 2012). These three waves
  // (40 / 160 / 640 m) are the stand and wetland patches a true-colour mosaic shows.
  // Outside the detail gate, and after the era mix: Minimum sets uDetail.x to 0, and the
  // plant-era colour is one green. Either one left the 400 m boreal as a single fill.
  // standMosaicActive ignores the detail strength. A full disk (uLiveMosaic 0 and a
  // sub-pixel cell) is unchanged. A coarse drone tile widens the wave until it is a few pixels.
  {
    float px = max(length(fwidth(vDetW.xz)), 1e-3);
    float w0 = 40.0, w1 = 160.0, w2 = 640.0;
    float wave = uLiveMosaic > 0.5 ? max(w0, px * 6.0) : w0;
    float seen = 1.0 - smoothstep(0.25, 0.7, length(fwidth(vDetW.xz / wave)));
    if (seen > 0.001 && landMask > 0.5) {
      float s0 = detN(vDetW / wave, uDetail.w + 7.0);
      float s1 = detN(vDetW / (wave * (w1 / w0)), uDetail.w + 8.0);
      float s2 = detN(vDetW / (wave * (w2 / w0)), uDetail.w + 9.0);
      float stand = s0 * 0.5 + s1 * 0.3 + s2 * 0.2;
      float dark = 1.0 - smoothstep(0.07, 0.16, max(diffuseColor.r, diffuseColor.g));
      // Olive fen and a greener leaf. The old 2.4 red / 0.45 green turned August boreal red.
      vec3 fen = vec3(diffuseColor.r * 1.2, diffuseColor.g * 0.88, diffuseColor.b * 0.65);
      vec3 leaf = vec3(diffuseColor.r * 0.95, diffuseColor.g * 1.28, diffuseColor.b * 0.75);
      vec3 mosaic = stand < 0.5 ? mix(fen, diffuseColor.rgb, stand * 2.0) : mix(diffuseColor.rgb, leaf, (stand - 0.5) * 2.0);
      // The aerial stand above already painted this band. Do not paint it again.
      float aerialM = smoothstep(120.0, 350.0, length(vViewPosition)) * (1.0 - smoothstep(20000.0, 60000.0, length(vViewPosition)));
      diffuseColor.rgb = mix(diffuseColor.rgb, mosaic, seen * mix(0.55, 1.0, dark) * (1.0 - aerialM));
      // No 12 m crown grid here. At 400 m that grid was a wallpaper of identical dots
      // (tasks/evidence/T-0185/after-globe-400.png and the first T-0187 recapture).
      // The 40 / 160 / 640 m stands are the canopy.
    }
  }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uDetail.x > 0.001 || uOceanGlint > 0.5) { // derivative bump (Mikkelsen 2010). detH carries land detail and, on the ocean, the simplex chop.
    vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(detH), dhy = dFdy(detH);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
    normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }
  vec3 viewDirection = normalize(vViewPosition);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
  float oceanF = (1.0 - landMask) * (1.0 - clamp(vLake, 0.0, 1.0)) * presentW;
  vec3 reflectionColor = mix(vec3(0.02, 0.035, 0.07), vec3(0.62, 0.76, 0.94), clamp(atmSkyF(dot(normal, uSun)), 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, reflectionColor, fresnel), oceanF);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
oceanGlint = (1.0 - landMask) * (1.0 - clamp(vLake, 0.0, 1.0)) * uOceanGlint * presentW;
roughnessFactor = mix(roughnessFactor, uOceanRough, oceanGlint); // Matthew 2026-11-06: 0.15-0.2 on the ocean
roughnessFactor = mix(roughnessFactor, uLakeRough, (1.0 - landMask) * (1.0 - oceanGlint)); // lakes, and the ocean when the tier drops the glint: Cox-Munk`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uOceanMetal, oceanGlint); // ocean 0.1-0.2; land and lakes stay at the material metalness')
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
        'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        'float dotNL = smoothstep(-0.08, 0.25, dot( geometryNormal, directLight.direction )); // T-0169: soft Lambert penumbra'))
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.specularColor = mix(material.specularColor, vec3(' + fresnelF0().toFixed(4) + '), (1.0 - landMask) * (1.0 - oceanGlint)); // lakes keep dielectric F0; the ocean keeps the metalness mix (Matthew 2026-11-06)\ntotalEmissiveRadiance += vec3(1.9, 0.46, 0.08) * eraCrack * clamp(uCrack, 0.0, 1.0);')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
#ifdef DEBUG_SEAMS
  { vec2 b = min(vTileUV, 1.0 - vTileUV); float d = min(b.x, b.y), w = fwidth(d) * 1.5;
    if (vSkirt > 0.0) gl_FragColor.rgb = vec3(1.0, 0.0, 0.0); else if (d < w) gl_FragColor.rgb = vec3(1.0, 0.9, 0.0); }
#endif`);
  };
  return m;
}
