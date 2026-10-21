/**
 * ONE shared water material (Grok Bot) for the base water plane, lakes/ponds and rivers. Was one MeshStandardMaterial per chunk.
 * Flow: the two-phase flow-map technique (Vlachos 2010, "Water Flow in Portal 2", SIGGRAPH; as used by three.js
 * examples/jsm/objects/Water2.js, MIT, r180), tailored: the flow vector is a per-vertex attribute from stage 2c (core/stages/rivers)
 * instead of a flow-map texture, and the normals come from the shared procedural noise (proc/glsl fbm gradient) instead of baked
 * normal-map textures, so nothing is an asset. Foam = noise thresholded by speed (aFlow.z, m/s). Lakes have zero flow and only
 * get the slow ripple drift.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';
import { shaderClock } from './shaderClock';
import { WORLD_SEED } from '../core/world';
import { fadeOptIn } from './fade';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { LEVEL } from '../core/tuning';

const SEED = ((WORLD_SEED * 7) % 997) * .37, uTime = { value: 0 };
/** Body albedo (linear): CDOM absorbs blue first, so what little leaves the water is brown; < 1 % in every channel (see top). */
const HUMIC_BODY = new THREE.Color().setRGB(.010, .006, .002, THREE.LinearSRGBColorSpace);
const MIRROR = { uMirror: { value: null as THREE.Texture | null }, uMirrorMatrix: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 },
  uMirrorY: { value: LEVEL.waterSurface }, uWaterSky: { value: new THREE.Color(0x8fa6b8) } };
/** Schlick's Fresnel for water (n = 1.333, F0 = 0.02), as in the shader: share of light reflected at a view angle with cosine c. */
export const waterFresnel = (c: number) => .02 + .98 * Math.pow(1 - Math.min(1, Math.max(0, c)), 5);
let water: THREE.MeshStandardMaterial | undefined;
export function waterMaterial() {
  if (water) return water;
  water = new THREE.MeshStandardMaterial({ color: HUMIC_BODY, roughness: .32, metalness: 0 }); water.userData.shared = true; // roughness: Cox & Munk 1954 slopes at light wind (T-0023 table)
  water.onBeforeCompile = shader => {
    shader.uniforms.uWaterTime = uTime; Object.assign(shader.uniforms, MIRROR);
    shader.vertexShader = 'attribute vec3 aFlow; varying vec3 vFlow; varying vec2 vWXZ; varying float vWY;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFlow = aFlow; vec4 wWP = modelMatrix * vec4(position, 1.); vWXZ = wWP.xz; vWY = wWP.y;');
    shader.fragmentShader = `uniform float uWaterTime; varying vec3 vFlow; varying vec2 vWXZ; varying float vWY;
      uniform sampler2D uMirror; uniform mat4 uMirrorMatrix; uniform float uMirrorOn, uMirrorY; uniform vec3 uWaterSky;\n${GLSL_NOISE}
      vec2 wgrad(vec2 p) { float e = 0.07, s = ${SEED.toFixed(3)}; return vec2(fbm(p + vec2(e, 0.), s) - fbm(p - vec2(e, 0.), s), fbm(p + vec2(0., e), s) - fbm(p - vec2(0., e), s)); }
      // Vlachos 2010 / Water2.js: two phases half a cycle apart, crossfaded so the stretch of each phase is hidden
      float wPhase(float k) { return fract(uWaterTime * 0.25 + k); }\n` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 fl = vFlow.xy, drift = vec2(0.03, 0.02) * uWaterTime; float p0 = wPhase(0.0), p1 = wPhase(0.5), wgt = abs(0.5 - p0) * 2.0;
        vec2 q = vWXZ * 0.35 + drift;
        vec2 wg = mix(wgrad(q - fl * p0 * 4.0 * 0.35), wgrad(q - fl * p1 * 4.0 * 0.35 + 0.37), wgt);
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
