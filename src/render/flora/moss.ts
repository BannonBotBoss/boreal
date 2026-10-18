/**
 * Forest-floor ground layer (Grok Bot): feathermoss, reindeer lichen and Sphagnum cover (core/flora/mosses) drawn as a
 * terrain-shader layer, not geometry: no draw calls, no triangles. A 128² cover texture (2 m texels, toroidal, ~256 m around
 * the camera) holds the three cover shares from siteAt (stage-3 soils, wetness, light under the drawn crowns + stand
 * closure); the terrain (render/pbr addGroundLayer) and the far grass blades (render/grass) both read it through
 * `groundLayer(base, xz)`, so the grass fades into the same ground it stands on. Base colour per soil = render/math
 * groundColor (the staged terrain's Sentinel-2 albedos, STAGED_TOP tint). Patch shape inside a texel = proc/glsl's
 * integer-hash value noise vnoiseU (no fract(sin) lattice speckle under ANGLE): a point is covered where noise < cover
 * share, so the covered area matches the share. Texture refills run as sliced interest jobs (<= 2 ms slices).
 * Tiers: patch-noise octaves follow LADDER `foliage` through a uniform (5 at Ultra/High .. 2 at Minimum; no recompiles),
 * foliage 0 switches the layer off.
 */
import * as THREE from 'three';
import { GROUND_LAYERS, groundCover } from '../../core/flora/mosses';
import { prepareArea, siteAt } from '../../core/flora/site';
import { enqueue, pending, perFrame } from '../../core/interest';
import { addGroundLayer } from '../pbr';
import { groundColor } from '../math';
import { SOIL_KINDS } from '../../core/stages/soils';

const N = 128, TEXEL = 2, SLICE_MS = 2, SHIFT = 8; // texels, m, ms, texels moved before a refill [game calibration]
export const MOSS_FX = { off: typeof location !== 'undefined' && new URLSearchParams(location.search).get('moss') === '0' }; // ?moss=0: bench A/B
export const MOSS_INFO = { refills: 0, texels: 0, sliceMaxMs: 0, octaves: 5, mean: [0, 0, 0] };
(globalThis as { borealMoss?: unknown }).borealMoss = { info: MOSS_INFO, fx: MOSS_FX }; // dev/bench handle
/** Patch-noise octaves at a LADDER foliage factor (Ultra/High 1 -> 5, Medium .8 -> 4, Low .6 -> 3, Very low .4 -> 3, Minimum .25 -> 2). */
export const mossOctaves = (foliage: number) => foliage <= 0 ? 0 : Math.max(2, Math.min(5, Math.round(1 + 4 * foliage)));
const data = new Uint8Array(N * N * 4);
const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
Object.assign(tex, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
const v3 = (c: [number, number, number]) => `vec3(${c.map(x => x.toFixed(3)).join(', ')})`;
/** Ground colour per soil class exactly as the terrain paints it (render/math groundColor, mean top tint), indexed by SOIL_KINDS. */
const SOIL_GROUND = SOIL_KINDS.map(k => { const c = groundColor(k); return new THREE.Vector3(c.r, c.g, c.b); });
export const MOSS_UNIFORMS = { uGroundSoil: { value: SOIL_GROUND }, uMoss: { value: tex as THREE.Texture }, uMossWin: { value: new THREE.Vector4(0, 0, .001, TEXEL) },
  uMossMean: { value: new THREE.Vector3() }, uMossOn: { value: 1 }, uMossOct: { value: 5 } };
const [F, L, S] = GROUND_LAYERS.map(l => l.albedo);
/** GLSL (needs proc/glsl GLSL_NOISE first): base albedo -> albedo with the ground layer at world xz. */
export const MOSS_GLSL = `uniform sampler2D uMoss; uniform vec4 uMossWin; uniform vec3 uMossMean; uniform float uMossOn, uMossOct; uniform vec3 uGroundSoil[${SOIL_KINDS.length}];
/** Terrain ground colour of the soil at xz (texel alpha = soil index, read at the texel centre); till outside the window. */
vec3 soilGround(vec2 xz) {
  float a = textureLod(uMoss, (floor(xz / uMossWin.w) + 0.5) / ${N}.0, 0.0).a; // explicit LOD: no derivatives in divergent code (ANGLE/D3D X3595)
  return length(xz - uMossWin.xy) > uMossWin.z ? uGroundSoil[${SOIL_KINDS.indexOf('till')}] : uGroundSoil[int(a * ${SOIL_KINDS.length - 1}.0 + 0.5)];
}
float mossFbm(vec2 p, float s, float oct) { float v = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 5; i++) { if (float(i) >= oct) break; v += a * vnoiseU(p, s); t += a; p = p * 2.03 + 17.1; a *= 0.5; } return v * (0.96875 / t); } // proc/glsl fbm on vnoiseU, same range
/** Covered where the patch noise is below the share (soft edge e); a zero share stays bare even where the noise is 0. */
float mossCover(float w, float n, float e) { return smoothstep(n - e, n + e, w) * smoothstep(0.0, e, w); }
vec3 groundLayer(vec3 base, vec2 xz) {
  if (uMossOn < 0.5) return base; // bench toggle (MOSS_FX.off) / foliage 0 skips the layer
  vec3 w = textureLod(uMoss, xz / (uMossWin.w * ${N}.0), 0.0).rgb;
  w = mix(w, uMossMean, smoothstep(uMossWin.z * 0.75, uMossWin.z, length(xz - uMossWin.xy))); // beyond the window: its mean
  if (max(w.r, max(w.g, w.b)) < 0.004) return base; // no cover here (water, bare ground): skip the noise
  // ONE patch field for all three: moss and Sphagnum where it is low, lichen where it is high (they rarely share a texel).
  // Octaves: the tier's (uMossOct), minus one per doubling of distance beyond 16 m (finer ones are sub-pixel there).
  float d = length(xz - cameraPosition.xz), oct = clamp(uMossOct - floor(log2(max(d, 1.0) / 16.0)), 1.0, uMossOct);
  // fbm is near-normal (mean .5, sd ~.13): smoothstep(.3, .7) ~ its CDF, so a share s covers ~s of the ground (raw fbm: s > .6 covered everything)
  float n = smoothstep(0.3, 0.7, mossFbm(xz * 0.35, 17.3, oct)), f = d < 40.0 ? vnoiseU(xz * 2.3, 4.1) : 0.5;
  // lichen: near the camera the 2.3/m detail noise breaks the mats into 0.3-2 m pieces with rock between (Cladonia mats on granite)
  float fm = mossCover(w.r, n, 0.05), li = mossCover(w.g, 1.0 - mix(n, f, 0.45 * (1.0 - smoothstep(30.0, 40.0, d))), 0.035), sp = mossCover(w.b, n, 0.05);
  base = mix(base, mix(${v3(F[0])}, ${v3(F[1])}, f) * (0.8 + 0.4 * f), fm);
  base = mix(base, mix(${v3(S[0])}, ${v3(S[1])}, smoothstep(0.45, 0.6, f)), sp);
  return mix(base, mix(${v3(L[0])}, ${v3(L[1])}, f) * (0.85 + 0.3 * f), li);
}
`;
addGroundLayer({ name: 'moss', uniforms: MOSS_UNIFORMS, head: MOSS_GLSL, body: 'diffuseColor.rgb = groundLayer(diffuseColor.rgb, vXZ);' });

const mod = (a: number) => ((a % N) + N) % N;
/** Refill the texels of window (wx, wz) (min-corner texel coords) not covered by the loaded window (lx, lz); sliced. */
function* refill(wx: number, wz: number, lx: number | undefined, lz: number | undefined): Generator<unknown, number[]> {
  const sum = [0, 0, 0]; let t = performance.now(), n = 0;
  for (let j = 0; j < N; j++) {
    const cz = wz + j, rowOld = lz !== undefined && cz >= lz && cz < lz + N;
    if (!rowOld || wx !== lx) yield* prepareArea(wx * TEXEL, cz * TEXEL, (wx + N) * TEXEL, (cz + 1) * TEXEL); // drawn crowns of this row (sliced)
    for (let i = 0; i < N; i++) { const cx = wx + i, o = (mod(cz) * N + mod(cx)) * 4;
      if (!(rowOld && lx !== undefined && cx >= lx && cx < lx + N)) { const s = siteAt((cx + .5) * TEXEL, (cz + .5) * TEXEL), c = groundCover(s);
        for (let k = 0; k < 3; k++) data[o + k] = Math.round(c[k] * 255);
        data[o + 3] = Math.round(SOIL_KINDS.indexOf(s.water ? 'water' : s.soil ?? 'till') * 255 / (SOIL_KINDS.length - 1)); n++; }
      for (let k = 0; k < 3; k++) sum[k] += data[o + k];
      if (performance.now() - t > SLICE_MS) { yield; t = performance.now(); } }
  }
  MOSS_INFO.texels += n; return sum.map(s => s / (N * N * 255));
}

/** Keeps the cover window centred on the camera (call per frame with LADDER foliage; cheap unless a refill is due). */
export function createMoss() {
  let lx: number | undefined, lz: number | undefined;
  return function update(camera: THREE.Camera, foliage = 1) {
    const oct = mossOctaves(foliage); MOSS_INFO.octaves = oct;
    MOSS_UNIFORMS.uMossOn.value = MOSS_FX.off || oct === 0 ? 0 : 1; MOSS_UNIFORMS.uMossOct.value = oct;
    const wx = Math.floor(camera.position.x / TEXEL) - N / 2, wz = Math.floor(camera.position.z / TEXEL) - N / 2;
    if (pending('moss:refill') || (lx !== undefined && Math.abs(wx - lx) < SHIFT && Math.abs(wz - lz!) < SHIFT)) return;
    const timed = (function* () { const g = refill(wx, wz, lx, lz); for (;;) { const t0 = performance.now(), r = g.next(); MOSS_INFO.sliceMaxMs = Math.max(MOSS_INFO.sliceMaxMs, performance.now() - t0); if (r.done) return r.value; yield; } })();
    enqueue('moss:refill', 30, perFrame('moss', SLICE_MS, timed), (mean: number[]) => { // texture + window switch together (one 64 KB upload)
      lx = wx; lz = wz; tex.needsUpdate = true; MOSS_UNIFORMS.uMossWin.value.set((wx + N / 2) * TEXEL, (wz + N / 2) * TEXEL, (N / 2 - 2) * TEXEL, TEXEL);
      MOSS_UNIFORMS.uMossMean.value.set(mean[0], mean[1], mean[2]); MOSS_INFO.mean = mean; MOSS_INFO.refills++; });
  };
}
