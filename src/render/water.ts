/**
 * ONE shared water material (Grok Bot) for the base water plane, lakes/ponds and rivers. Was one MeshStandardMaterial per chunk.
 * Flow: the two-phase flow-map technique (Vlachos 2010, "Water Flow in Portal 2", SIGGRAPH; as used by three.js
 * examples/jsm/objects/Water2.js, MIT, r180), tailored: the flow vector is a per-vertex attribute from stage 2c (core/stages/rivers)
 * instead of a flow-map texture, and the normals come from the shared procedural noise (proc/glsl fbm gradient) instead of baked
 * normal-map textures, so nothing is an asset. Foam = noise thresholded by speed (aFlow.z, m/s). Lakes have zero flow and only
 * get the slow ripple drift.
 * Optics (T-0023): calm water is a mirror split by Fresnel, not a coloured surface. The open-water level y = LEVEL.waterSurface
 * is mirrored with three.js examples/jsm/objects/Reflector.js (MIT, r180, reused as is: we only call its mirror-camera pass and
 * sample its target), so the far shore and the sky appear upside down in it; the split is Schlick F = 0.02 + 0.98 (1 - cos)^5
 * (Water2.js, n = 1.333). What leaves the water body is humic-brown, about 1 % or less (R/G/B 1.1/0.7/0.2 %; Kutser, Paavel &
 * Kauer, EGU2015-13460: negligible across the visible in very brown boreal lakes), and over shallow ground the bottom shows
 * through by depth absorption (HUMIC below). Lakes at other levels and the tiers without IBL reflect the horizon colour (fog)
 * by the same Fresnel instead of the mirror; uniforms only, so no new program.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';
import { shaderClock } from './shaderClock';
import { WORLD_SEED } from '../core/world';
import { fadeOptIn } from './fade';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { LEVEL } from '../core/tuning';

const SEED = ((WORLD_SEED * 7) % 997) * .37, uTime = { value: 0 };
/** Humic boreal water, per channel at the R/G/B centres 610/550/465 nm. Absorption a = pure water (Pope & Fry 1997, Appl. Opt.
 *  36:8710) + CDOM a440·e^(-S(λ-440)) (Bricaud, Morel & Prieur 1981); diffuse attenuation K = a / μd (μd ≈ 0.8); deep-water
 *  reflectance R∞ ≈ 0.33 bb / a (Morel & Prieur 1977); over a bottom of albedo Ab at depth H the shallow-water model
 *  R = R∞ (1 - e^(-2KH)) + Ab e^(-2KH) (Maritorena, Morel & Gentili 1994, Limnol. Oceanogr. 39:1689). So the colour is generated
 *  by absorption over depth, not picked. [verify] a440, S, bb, Ab against a regional survey (T-0023 table). */
export const HUMIC = { a440: 5, slope: .016, bb: .02, muD: .8, bottom: [.16, .13, .09], nm: [610, 550, 465], pureWater: [.264, .0565, .0102] };
export const humicK = () => HUMIC.nm.map((nm, i) => (HUMIC.pureWater[i] + HUMIC.a440 * Math.exp(-HUMIC.slope * (nm - 440))) / HUMIC.muD);
export const humicDeepR = () => humicK().map(k => .33 * HUMIC.bb / (k * HUMIC.muD));
/** Irradiance reflectance just below the surface over a bottom `depth` m down (Maritorena 1994), per channel R, G, B. */
export const shallowReflectance = (depth: number) => { const r = humicDeepR(); return humicK().map((k, i) => { const t = Math.exp(-2 * k * Math.max(0, depth)); return r[i] * (1 - t) + HUMIC.bottom[i] * t; }); };
const HUMIC_BODY = new THREE.Color().setRGB(...humicDeepR() as [number, number, number], THREE.LinearSRGBColorSpace);
const MIRROR = { uMirror: { value: null as THREE.Texture | null }, uMirrorMatrix: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 },
  uMirrorY: { value: LEVEL.waterSurface }, uWaterSky: { value: new THREE.Color(0x8fa6b8) },
  uWaterK: { value: new THREE.Vector3(...humicK()) }, uBottom: { value: new THREE.Vector3(...HUMIC.bottom) } };
/** Schlick's Fresnel for water (n = 1.333, F0 = 0.02), as in the shader: share of light reflected at a view angle with cosine c. */
export const waterFresnel = (c: number) => .02 + .98 * Math.pow(1 - Math.min(1, Math.max(0, c)), 5);
let water: THREE.MeshStandardMaterial | undefined;
export function waterMaterial() {
  if (water) return water;
  water = new THREE.MeshStandardMaterial({ color: HUMIC_BODY, roughness: .32, metalness: 0 }); water.userData.shared = true; // roughness: Cox & Munk 1954 slopes at light wind (T-0023 table)
  water.onBeforeCompile = shader => {
    shader.uniforms.uWaterTime = uTime; Object.assign(shader.uniforms, MIRROR);
    shader.vertexShader = 'attribute vec3 aFlow; attribute float aDepth; varying vec3 vFlow; varying vec2 vWXZ; varying float vWY, vDepth;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFlow = aFlow; vec4 wWP = modelMatrix * vec4(position, 1.); vWXZ = wWP.xz; vWY = wWP.y; vDepth = aDepth;');
    shader.fragmentShader = `uniform float uWaterTime; varying vec3 vFlow; varying vec2 vWXZ; varying float vWY, vDepth;
      uniform sampler2D uMirror; uniform mat4 uMirrorMatrix; uniform float uMirrorOn, uMirrorY; uniform vec3 uWaterSky, uWaterK, uBottom;\n${GLSL_NOISE}
      vec2 wgrad(vec2 p) { float e = 0.07, s = ${SEED.toFixed(3)}; return vec2(fbm(p + vec2(e, 0.), s) - fbm(p - vec2(e, 0.), s), fbm(p + vec2(0., e), s) - fbm(p - vec2(0., e), s)); }
      // Vlachos 2010 / Water2.js: two phases half a cycle apart, crossfaded so the stretch of each phase is hidden
      float wPhase(float k) { return fract(uWaterTime * 0.25 + k); }\n` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 fl = vFlow.xy, drift = vec2(0.03, 0.02) * uWaterTime; float p0 = wPhase(0.0), p1 = wPhase(0.5), wgt = abs(0.5 - p0) * 2.0;
        vec2 q = vWXZ * 0.35 + drift;
        vec2 wg = mix(wgrad(q - fl * p0 * 4.0 * 0.35), wgrad(q - fl * p1 * 4.0 * 0.35 + 0.37), wgt);
        vec3 wT2 = exp(-2.0 * uWaterK * (abs(vWY - uMirrorY) < .05 ? max(vDepth, 0.0) : 1e3)); // open-water sheet only (aDepth); lakes/rivers: deep
        diffuseColor.rgb = diffuseColor.rgb * (1.0 - wT2) + uBottom * wT2; // Maritorena 1994 shallow-water reflectance
        float foam = smoothstep(0.55, 0.85, fbm(vWXZ * 1.3 - fl * uWaterTime * 1.3, ${SEED.toFixed(3)}) + vFlow.z * 0.25 - 0.35) * smoothstep(0.4, 1.2, vFlow.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.9, 0.9), foam);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.7, foam);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal - (viewMatrix * vec4(wg.x, 0., wg.y, 0.)).xyz * (0.6 + 0.6 * length(fl)));`)
      .replace('#include <opaque_fragment>', `float wF = 0.02 + 0.98 * pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 5.); // Schlick, F0 = 0.02
        vec4 mc = uMirrorMatrix * vec4(vWXZ.x, vWY, vWXZ.y, 1.);
        vec3 wSky = uMirrorOn > .5 && abs(vWY - uMirrorY) < .05 ? texture2D(uMirror, mc.xy / mc.w + wg * .04).rgb : uWaterSky;
        outgoingLight = mix(totalDiffuse, wSky, wF) + reflectedLight.directSpecular + totalEmissiveRadiance; // the IBL specular is replaced by the mirror
        #include <opaque_fragment>`);
  };
  water.customProgramCacheKey = () => 'boreal-water-flow';
  fadeOptIn(water); // render/fade: in-page transition patch fade (uniform only, same cache key)
  return water;
}
/** T-0023: a chunk's open-water sheet = its terrain grid lifted to the water level, with the depth to the bottom per vertex
 *  (aDepth, for the shallow-water colour). Null where the whole chunk is dry (nothing to draw there; was one quad per chunk). */
export function openWaterGeometry(terrain: THREE.BufferGeometry, level = LEVEL.waterSurface): THREE.BufferGeometry | null {
  const p = terrain.getAttribute('position'), n = p.count, pos = new Float32Array(n * 3), depth = new Float32Array(n), up = new Float32Array(n * 3);
  let wet = false;
  for (let i = 0; i < n; i++) { const h = p.getY(i); if (h < level) wet = true; depth[i] = level - h; pos[i * 3] = p.getX(i); pos[i * 3 + 1] = level; pos[i * 3 + 2] = p.getZ(i); up[i * 3 + 1] = 1; }
  if (!wet) return null;
  const g = new THREE.BufferGeometry(); if (terrain.index) g.setIndex(terrain.index.clone());
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(up, 3)); g.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  g.computeBoundingSphere(); return g;
}
/** T-0023: one mirror pass per frame for the open-water level (Reflector's virtual camera, oblique near plane at the water),
 *  at `scale` of the drawing buffer, only while `on` (the tiers with IBL) and the camera is above the water. The water itself is
 *  hidden during the pass (its own target would be read and written). Off: the water reflects the fog/horizon colour. */
export function createWaterMirror(renderer: THREE.WebGLRenderer, scale = .5) {
  const mirror = new Reflector(new THREE.PlaneGeometry(1, 1), { textureWidth: 1, textureHeight: 1, multisample: 0, clipBias: .003 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = LEVEL.waterSurface; mirror.updateMatrixWorld();
  const rt = mirror.getRenderTarget(), size = new THREE.Vector2(), toLocal = mirror.matrixWorld.clone().invert();
  const tm = (mirror.material as THREE.ShaderMaterial).uniforms.textureMatrix.value as THREE.Matrix4;
  MIRROR.uMirror.value = rt.texture;
  return {
    update(scene: THREE.Scene, camera: THREE.PerspectiveCamera, on: boolean) {
      if (scene.fog) MIRROR.uWaterSky.value.copy(scene.fog.color);
      camera.updateMatrixWorld();
      MIRROR.uMirrorOn.value = on && camera.position.y > LEVEL.waterSurface ? 1 : 0; if (!MIRROR.uMirrorOn.value) return;
      renderer.getDrawingBufferSize(size); const w = Math.max(1, Math.round(size.x * scale)), h = Math.max(1, Math.round(size.y * scale));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      const m = waterMaterial(); m.visible = false;
      mirror.onBeforeRender(renderer, scene, camera, mirror.geometry, mirror.material as THREE.Material, null as unknown as THREE.Group);
      m.visible = true; MIRROR.uMirrorMatrix.value.multiplyMatrices(tm, toLocal);
    },
    dispose() { mirror.dispose(); },
  };
}
/** Per frame: the shared shader clock drives the flow phases. */
export function updateWaterUniforms() { uTime.value = shaderClock.time; }
