/**
 * Surface bands (T-0004): one shared look for solid, untextured batched objects. Darker and lighter bands cross the
 * surface from a deterministic world-position pattern (proc/glsl GLSL_NOISE only: vnoiseU and fbm; no new hash, no time).
 * ONE function, applySurfaceBands(material), called from render/batch for every batched material. The edit is one chunk
 * injected by onBeforeCompile just before `#include <alphamap_fragment>`, after all colour work, including tree bark.
 * Patched materials get one fixed program key (their previous key + '|bands'), so objects share programs.
 * Selection: opaque (not transparent, no alphaTest/alphaToCoverage), no colour or alpha map, not a sprite/line/points/shader
 * material, and not opted out (userData.noBands). A mixed material (render/trees: bark + leaf cards) sets userData.bandsMask
 * to a GLSL float (1 = band, 0 = keep). Terrain and animals are not batched here; logs and rocks that ship their own
 * pattern set userData.noBands (T-0005, T-0026).
 * Off with ?bands=0. ?bands=<amp> with 0 < amp <= 0.5 sets the half-range. Matthew owns the shipped on/off. The spec says
 * this preview branch is ON. Default amp 0.15 multiplies diffuse by 0.85-1.15.
 * That half-range is a coefficient of variation of about 10.6% for a pure sine (0.15/sqrt(2)). Juola, Hovi & Rautiainen
 * 2022, Ecol. Evol. 12:e8718 (doi:10.1002/ece3.8718) report 8-32% VIS-NIR CV between trees of one non-birch species, and
 * 34-46% for birch (white bark, black spots). Their figure is between trees, not along one trunk. Birch spots and fissures
 * stay in the species bark shaders.
 * Full-cycle spacing of sin(bt*pi) is 2/(BAND_FREQ*|dot(dir, BAND_AXIS)|) metres: 0.357 m vertical, 0.500 m along +X,
 * 0.556 m along +Z. Juola et al. imaged 11.1 cm of bark (plate and lenticel scale). Bondy gneiss (Blein, NRCAN
 * ae83ea04-31c8-4cb2-984a-d9f42c2aeb53): mafic/felsic layers millimetres to centimetres, felsic veins centimetres to
 * decimetres. This sine is decimetre-scale, coarser than bark plates. The vnoiseU term (about 0.11/m) warps phase by up
 * to about one cycle. fBm (about 1.3/m) is the fine grain.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';

/** Oblique world axis so upright trunks and lying logs both cross the bands. */
export const BAND_AXIS = [1, 1.4, .9] as const;
/** Multiplier on dot(world, BAND_AXIS) before the sine. */
export const BAND_FREQ = 4;
/** Plan default: diffuse × (1 ± this) = 0.85-1.15. */
export const BANDS_AMP_DEFAULT = .15;
/** Full-cycle spacing (m) of the sine along a unit direction. */
export function bandCycleM(dir: readonly [number, number, number]) {
  const d = Math.abs(dir[0] * BAND_AXIS[0] + dir[1] * BAND_AXIS[1] + dir[2] * BAND_AXIS[2]);
  return 2 / (BAND_FREQ * d);
}
/** ?bands=0 off; ?bands=<amp> in (0, 0.5] sets the half-range. Null search is the default (on, 0.15). */
export function bandsFromSearch(search: string | null): { on: boolean; amp: number } {
  if (search == null) return { on: true, amp: BANDS_AMP_DEFAULT };
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('bands');
  return { on: q !== '0', amp: q && +q > 0 && +q <= .5 ? +q : BANDS_AMP_DEFAULT };
}
const boot = bandsFromSearch(typeof location === 'undefined' ? null : location.search);
const ON = boot.on;
export const BANDS_AMP = boot.amp;
const defaultKey = THREE.Material.prototype.customProgramCacheKey;
const done = new WeakSet<THREE.Material>();

/** The selection rule (exported for tests). */
export function wantsBands(m: THREE.Material) {
  const s = m as THREE.MeshStandardMaterial & { isMeshBasicMaterial?: boolean; isShaderMaterial?: boolean; isSpriteMaterial?: boolean; isLineBasicMaterial?: boolean; isPointsMaterial?: boolean };
  if (m.userData.noBands || m.transparent || m.alphaTest > 0 || m.alphaToCoverage || s.map || s.alphaMap) return false;
  if (s.isShaderMaterial || s.isSpriteMaterial || s.isLineBasicMaterial || s.isPointsMaterial) return false;
  return !!(s.isMeshStandardMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial || (m as THREE.MeshPhongMaterial).isMeshPhongMaterial);
}

const VERT = `#include <worldpos_vertex>
  { vec4 bw = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      bw = batchingMatrix * bw;
    #endif
    #ifdef USE_INSTANCING
      bw = instanceMatrix * bw;
    #endif
    vBandW = (modelMatrix * bw).xyz; }`;
const FRAG = (mask: string) => `{ float bt = dot(vBandW, vec3(${BAND_AXIS.map(n => n.toFixed(1)).join(', ')})) * ${BAND_FREQ.toFixed(1)} + 2.2 * vnoiseU(vBandW.xz * .11 + vBandW.y * .05, 5.3);
    float bn = sin(bt * 3.14159) * (.6 + .4 * vnoiseU(vec2(bt * .5, dot(vBandW.xz, vec2(.07, -.05))), 2.9)), bg = fbm(vBandW.xz * 1.3 + vBandW.y * .9, 8.1);
    float bk = 1. + ${BANDS_AMP.toFixed(3)} * clamp(bn * .85 + (bg - .5) * .9, -1., 1.);
    diffuseColor.rgb *= mix(1., bk, ${mask}); }
  #include <alphamap_fragment>`;

export function applySurfaceBands(m: THREE.Material) {
  if (!ON || done.has(m) || !wantsBands(m)) return m;
  done.add(m);
  const prev = m.onBeforeCompile, own = m.customProgramCacheKey, mask = String(m.userData.bandsMask ?? '1.');
  const base = own === defaultKey ? prev.toString() : undefined; // default-key materials are keyed by their hook's source: freeze it
  m.customProgramCacheKey = function () { return (base ?? own.call(this)) + '|bands'; };
  m.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    if (shader.fragmentShader.includes('vBandW')) return;
    shader.vertexShader = 'varying vec3 vBandW;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', VERT);
    shader.fragmentShader = `varying vec3 vBandW;\n${shader.fragmentShader.includes('float vnoiseU(') ? '' : GLSL_NOISE}\n` + shader.fragmentShader.replace('#include <alphamap_fragment>', FRAG(mask));
  };
  m.needsUpdate = true;
  return m;
}
