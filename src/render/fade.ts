/**
 * Patch fade (Grok Bot): the game patch dithering in under the globe during the in-page transition (world/globe/inpage.ts).
 * ONE shared helper the terrain (render/pbr), water (render/water) and batched (render/batch) materials opt into.
 * Uniform only: the GLSL is always compiled in, there is no define and no new material variant, and the program cache key
 * stays exactly what it was (customProgramCacheKey is kept, or frozen to the pre-wrap value), so opting in adds no program.
 * The uniforms default to 0 = no fade (an unset uniform reads 0 too), so a material that ever shares a program unwired draws
 * normally. Dither: 4x4 ordered (Bayer) threshold on gl_FragCoord (no hash), times a radial edge at the patch disc.
 */
import * as THREE from 'three';

/** uPatchCut: 0 = patch fully drawn, 1 = fully cut (globe shows). uPatchDisc: centre x, z and radius (m); radius 0 = no disc. */
export const PATCH_FADE = { uPatchCut: { value: 0 }, uPatchDisc: { value: new THREE.Vector3(0, 0, 0) } };
export function setPatchFade(opacity: number, disc?: { x: number; z: number; r: number }) {
  PATCH_FADE.uPatchCut.value = 1 - Math.min(1, Math.max(0, opacity));
  if (disc) PATCH_FADE.uPatchDisc.value.set(disc.x, disc.z, disc.r); else PATCH_FADE.uPatchDisc.value.set(0, 0, 0);
}
const VERT = `#include <project_vertex>
  { vec4 pw = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      pw = batchingMatrix * pw;
    #endif
    #ifdef USE_INSTANCING
      pw = instanceMatrix * pw;
    #endif
    vPatchXZ = (modelMatrix * pw).xz; }`;
const FRAG = `#include <clipping_planes_fragment>
  if (uPatchCut > 0.0 || uPatchDisc.z > 0.0) {
    float keep = 1.0 - uPatchCut;
    if (uPatchDisc.z > 0.0) keep *= 1.0 - smoothstep(0.75, 1.0, length(vPatchXZ - uPatchDisc.xy) / uPatchDisc.z);
    int bx = int(gl_FragCoord.x) & 3, by = int(gl_FragCoord.y) & 3, bxy = bx ^ by;
    int bayer = ((bxy & 1) << 3) | ((by & 1) << 2) | (((bxy >> 1) & 1) << 1) | ((by >> 1) & 1);
    if ((float(bayer) + 0.5) / 16.0 >= keep) discard;
  }`;
/** The source edit (exported for tests). */
export function addPatchFade(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }) {
  if (shader.fragmentShader.includes('uPatchCut')) return;
  Object.assign(shader.uniforms, PATCH_FADE);
  shader.vertexShader = 'varying vec2 vPatchXZ;\n' + shader.vertexShader.replace('#include <project_vertex>', VERT);
  shader.fragmentShader = 'uniform float uPatchCut; uniform vec3 uPatchDisc; varying vec2 vPatchXZ;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', FRAG);
}
const wired = new WeakSet<THREE.Material>();
const defaultKey = THREE.Material.prototype.customProgramCacheKey;
/** Opt a material in (idempotent). Call before its first compile. Only materials with their OWN customProgramCacheKey (terrain,
 *  water, trees) are wrapped: their key does not depend on the onBeforeCompile source, so the key stays exactly the same.
 *  Default-key materials (props, rocks) are skipped: three keys them by onBeforeCompile.toString() and render/photoreal's
 *  CSM chain + precompile rely on that. `userData.patchFade` is set when the edit actually compiles; world/globe/inpage.ts
 *  hides undithered chunk meshes until the patch is fully faded in. */
export function fadeOptIn(m: THREE.Material) {
  if (wired.has(m) || m.customProgramCacheKey === defaultKey) return m;
  wired.add(m);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) { prev.call(this, shader, renderer); addPatchFade(shader); m.userData.patchFade = true; };
  return m;
}
