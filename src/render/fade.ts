/**
 * Patch fade (Grok Bot): the game patch dithering in under the globe during the in-page transition (world/globe/inpage.ts).
 * ONE shared helper the terrain (render/pbr), water (render/water) and batched (render/batch) materials opt into.
 * Uniform only: the GLSL is always compiled in, there is no define and no new material variant, and the program cache key
 * stays exactly what it was (customProgramCacheKey is kept, or frozen to the pre-wrap value), so opting in adds no program.
 * The uniforms default to 0 = no fade (an unset uniform reads 0 too), so a material that ever shares a program unwired draws
 * normally. Dither: 4x4 ordered (Bayer) threshold on gl_FragCoord (no hash), times a radial edge at the patch disc; tested at
 * the end of the fragment shader.
 */
import * as THREE from 'three';

/** uPatchCut: 0 = patch fully drawn, 1 = fully cut (globe shows). uPatchDisc: centre x, z and radius (m); radius 0 = no disc. */
/** uPatchY: the height (m) of the plane the disc distance is measured on. Each fragment's distance is taken where the camera ray
 *  through it meets that plane, so everything on one pixel (water surface and the lake bed under it, a crown and the ground behind)
 *  gets the same keep value (inpage puts it on the water surface of the lake the disc reaches into). */
export const PATCH_FADE = { uPatchCut: { value: 0 }, uPatchDisc: { value: new THREE.Vector3(0, 0, 0) }, uPatchY: { value: 0 } };
export function setPatchFade(opacity: number, disc?: { x: number; z: number; r: number; y?: number }) {
  PATCH_FADE.uPatchY.value = disc?.y ?? 0;
  PATCH_FADE.uPatchCut.value = 1 - Math.min(1, Math.max(0, opacity));
  if (disc) PATCH_FADE.uPatchDisc.value.set(disc.x, disc.z, disc.r); else PATCH_FADE.uPatchDisc.value.set(0, 0, 0);
}
/** The far layer behind the patch (in-page band): its colour (blend toward it by x, scaled by y = the background intensity)
 *  and its resolved log depth (z = the globe's log-depth constant; a globe surface nearer than the fragment by more than
 *  occ.x m + occ.y x distance hides it); w = 1 on. Off (w = 0, also when unset) costs one uniform branch. */
export const PATCH_FAR = { uFarColor: { value: null as THREE.Texture | null }, uFarDepth: { value: null as THREE.Texture | null }, uFarMix: { value: new THREE.Vector4() }, uFarOcc: { value: new THREE.Vector2(15, .03) } };
/** Depth margin (metres, then a fraction of distance) before the coarse globe may hide a patch fragment.
 *  Below `low` the eye is in the stand: a margin of 1e6 m means the globe never wins, so the forest floor
 *  is not replaced by the far layer. Above `low` the caller's margin stays. */
export function nearGroundOcc(height: number, low: number, occ: readonly [number, number]): [number, number] {
  return height < low ? [1e6, 0] : [occ[0], occ[1]];
}
export function setPatchFar(o: { color: THREE.Texture; depth: THREE.Texture | null; mix: number; scale: number; logFC: number; occ: [number, number] } | null) {
  if (!o || !o.depth) { PATCH_FAR.uFarMix.value.w = 0; return; }
  PATCH_FAR.uFarColor.value = o.color; PATCH_FAR.uFarDepth.value = o.depth; PATCH_FAR.uFarMix.value.set(o.mix, o.scale, o.logFC, 1); PATCH_FAR.uFarOcc.value.set(o.occ[0], o.occ[1]);
}
const VERT = `#include <project_vertex>
  vPatchClip = gl_Position;
  { vec4 pw = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      pw = batchingMatrix * pw;
    #endif
    #ifdef USE_INSTANCING
      pw = instanceMatrix * pw;
    #endif
    vPatchXZ = (modelMatrix * pw).xz; vPatchY = (modelMatrix * pw).y; }`;
const FRAG = `
  if (uPatchCut > 0.0 || uPatchDisc.z > 0.0) {
    float keep = 1.0 - uPatchCut;
    if (uPatchDisc.z > 0.0) { float dy = cameraPosition.y - vPatchY, t = (cameraPosition.y - uPatchY) / max(dy, 1e-3); // ray -> plane uPatchY
      vec2 pxz = dy > 1.0 && t > 0.0 && t < 4.0 ? cameraPosition.xz + (vPatchXZ - cameraPosition.xz) * t : vPatchXZ;
      keep *= 1.0 - smoothstep(0.75, 1.0, length(pxz - uPatchDisc.xy) / uPatchDisc.z); }
    int bx = int(gl_FragCoord.x) & 3, by = int(gl_FragCoord.y) & 3, bxy = bx ^ by;
    int bayer = ((bxy & 1) << 3) | ((by & 1) << 2) | (((bxy >> 1) & 1) << 1) | ((by >> 1) & 1);
    if ((float(bayer) + 0.5) / 16.0 >= keep) discard;
  }
  if (uFarMix.w > 0.5) { // in-page band: globe terrain in front hides the patch; the patch blends toward the globe behind it
    vec2 fuv = vPatchClip.xy / vPatchClip.w * 0.5 + 0.5; float fd = textureLod(uFarDepth, fuv, 0.0).r;
    if (fd < 1.0 && vPatchClip.w > exp2(fd * 2.0 / uFarMix.z) - 1.0 + uFarOcc.x + uFarOcc.y * vPatchClip.w) discard;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, textureLod(uFarColor, fuv, 0.0).rgb * uFarMix.y, fd < 1.0 ? uFarMix.x : 0.0); // only toward globe terrain: over sky (cleared far depth) a tree top kept its own colour, not the pale horizon
  }
  #include <dithering_fragment>`; // at the end: no gradient instruction follows the discard (an early discard made ANGLE/D3D's fxc warn X3595 on the shadow loops)
/** The source edit (exported for tests). */
export function addPatchFade(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }) {
  if (shader.fragmentShader.includes('uPatchCut')) return;
  Object.assign(shader.uniforms, PATCH_FADE, PATCH_FAR);
  shader.vertexShader = 'varying vec2 vPatchXZ; varying float vPatchY; varying vec4 vPatchClip;\n' + shader.vertexShader.replace('#include <project_vertex>', VERT);
  shader.fragmentShader = 'uniform float uPatchCut, uPatchY; uniform vec3 uPatchDisc; varying vec2 vPatchXZ; varying float vPatchY; varying vec4 vPatchClip;\nuniform sampler2D uFarColor, uFarDepth; uniform vec4 uFarMix; uniform vec2 uFarOcc;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', FRAG);
}
const wired = new WeakSet<THREE.Material>();
const defaultKey = THREE.Material.prototype.customProgramCacheKey;
/** Opt a material in (idempotent). Call before its first compile. Only materials with their OWN customProgramCacheKey (terrain,
 *  water, trees) are wrapped: their key does not depend on the onBeforeCompile source, so the key stays exactly the same.
 *  Default-key materials (props, rocks) are skipped: three keys them by onBeforeCompile.toString() and render/photoreal's
 *  CSM chain + precompile rely on that. `userData.patchFade` is set when the edit actually compiles; world/globe/inpage.ts
 *  hides undithered chunk meshes until the patch is fully faded in.
 *  `defaultKeyToo` (render/batch: world props such as blueberry bushes, rocks): default-key materials are wrapped as well and
 *  get a fixed key, their hook's source at wiring time + '|patchFade'. An unwired material with the same parameters keeps the
 *  plain key, so the two never share whichever program compiled first (a prop would then not dither). The key is a constant
 *  string, not per material: one extra program per prop hook (normally one), and photoreal's precompile clones take it as
 *  their key (custom-key path, like trees and terrain); CSM/PCSS still vary the program through their defines. */
export function fadeOptIn(m: THREE.Material, defaultKeyToo = false) {
  if (wired.has(m) || (m.customProgramCacheKey === defaultKey && !defaultKeyToo)) return m;
  wired.add(m);
  const prev = m.onBeforeCompile;
  if (m.customProgramCacheKey === defaultKey) { const key = prev.toString() + '|patchFade'; m.customProgramCacheKey = () => key; }
  m.onBeforeCompile = function (shader, renderer) { prev.call(this, shader, renderer); addPatchFade(shader); m.userData.patchFade = true; };
  return m;
}
