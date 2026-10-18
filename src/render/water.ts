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

const SEED = ((WORLD_SEED * 7) % 997) * .37, uTime = { value: 0 };
let water: THREE.MeshStandardMaterial | undefined;
export function waterMaterial() {
  if (water) return water;
  water = new THREE.MeshStandardMaterial({ color: 0x578d91, roughness: .32, metalness: .1 }); water.userData.shared = true;
  water.onBeforeCompile = shader => {
    shader.uniforms.uWaterTime = uTime;
    shader.vertexShader = 'attribute vec3 aFlow; varying vec3 vFlow; varying vec2 vWXZ;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFlow = aFlow; vWXZ = (modelMatrix * vec4(position, 1.)).xz;');
    shader.fragmentShader = `uniform float uWaterTime; varying vec3 vFlow; varying vec2 vWXZ;\n${GLSL_NOISE}
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
        normal = normalize(normal - (viewMatrix * vec4(wg.x, 0., wg.y, 0.)).xyz * (0.6 + 0.6 * length(fl)));`);
  };
  water.customProgramCacheKey = () => 'boreal-water-flow';
  fadeOptIn(water); // render/fade: in-page transition patch fade (uniform only, same cache key)
  return water;
}
/** Per frame: the shared shader clock drives the flow phases. */
export function updateWaterUniforms() { uTime.value = shaderClock.time; }
