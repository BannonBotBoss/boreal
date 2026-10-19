/**
 * Surface bands (Grok Bot, T-0004): one global look for solid, untextured objects (logs, rock, bark, props): darker and
 * lighter bands across the surface from a deterministic world-position pattern (proc/glsl noise, no time), multiplying the
 * diffuse colour by about 0.85-1.15. ONE function, applySurfaceBands(material), called from render/batch for every batched
 * material; the edit is one chunk injected by onBeforeCompile after all colour work. Patched materials get a fixed program
 * key (their previous key + '|bands'), so they share programs and no object gets its own.
 * Selection: opaque (not transparent, no alphaTest/alphaToCoverage), no colour map, not a sprite/line/points/shader material,
 * and not opted out (userData.noBands). A material that mixes surfaces (render/trees: bark + leaf cards in one material) sets
 * userData.bandsMask to a GLSL float expression (1 = band, 0 = keep).
 * Off with ?bands=0 (preview branch: on by default).
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';

const ON = typeof location === 'undefined' || new URLSearchParams(location.search).get('bands') !== '0';
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
/** Bands along an oblique world axis (so upright trunks and lying logs both cross them), domain-warped by low-frequency
 *  noise, plus a little fBm grain. Range ~0.85-1.15. */
const FRAG = (mask: string) => `{ float bt = dot(vBandW, vec3(.55, 1.25, .4)) * 1.6 + 2.2 * vnoiseU(vBandW.xz * .11 + vBandW.y * .05, 5.3);
    float bn = vnoiseU(vec2(bt, dot(vBandW.xz, vec2(.07, -.05))), 2.9), bg = fbm(vBandW.xz * 1.3 + vBandW.y * .9, 8.1);
    float bk = clamp(.85 + .3 * (bn * .8 + bg * .4 - .1), .85, 1.15);
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