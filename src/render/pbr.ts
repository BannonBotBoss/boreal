/**
 * Procedural PBR surfaces (Grok Bot). Shared materials whose albedo/roughness/normal detail come from the shared shader
 * noise (proc/glsl GLSL_NOISE) and whose wet/snow response comes from the ground state (core/ground via per-vertex
 * attributes written by render/math terrainJob). Extends three's MeshStandardMaterial (three.js r180, MIT) with
 * onBeforeCompile instead of a new shading model.
 *  - Wet darkening: albedo × (1 − 0.4·wet), roughness 0.95 → 0.35 (Lekner & Dorf 1988, Appl. Opt. 27:1278: wet soils
 *    darken because water's index reduces internal scattering; observed reflectance drop ~30–50 %) [verify factor].
 *  - Snow: albedo 0.8, roughness 0.6 (fresh snow 0.80–0.95, Oke 1987, Boundary Layer Climates, Table 1.1).
 *  - Needle translucency: fast subsurface approximation (Barré-Brisebois & Bouchard 2011, "Approximating Translucency for
 *    a Fast, Cheap and Convincing Subsurface Scattering Look", GDC) with needle transmittance ≈ 0.1 in the visible
 *    (Jacquemoud & Baret 1990 PROSPECT; conifer needle T_vis 0.05–0.15) [verify].
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';
import { WORLD_SEED } from '../core/world';
import { fadeOptIn } from './fade';

/** Scene illuminance (lux) and the adaptation gain derived from it (core/light). The gain is applied to
 * the sun/moon light intensities (render/sky) rather than to tone mapping, so the hand-tuned sky/cloud shaders keep their look. */
export const LIGHTING = { lux: 1e5, gain: 1, moonAge: 0, Esun: 0, Emoon: 0 };
/** Shared light uniforms (updated once per frame by render/photoreal from the NOAA sun). */
export const SUN_UNIFORMS = { uSunView: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) } };
const SEED = (WORLD_SEED % 997) * .37;

let terrain: THREE.MeshStandardMaterial | undefined;
/** Extra terrain albedo layers (e.g. render/flora/moss: forest-floor mosses and lichens), applied before the noise, wet and
 * snow response. `head` is fragment GLSL after GLSL_NOISE (world xz is `vXZ`), `body` edits `diffuseColor`. No draw calls. */
export interface GroundLayerHook { name: string; uniforms: Record<string, THREE.IUniform>; head: string; body: string }
const groundLayers: GroundLayerHook[] = [];
export function addGroundLayer(l: GroundLayerHook) { groundLayers.push(l); if (terrain) terrain.needsUpdate = true; }
/** ONE terrain material for every chunk (was one per chunk). */
export function terrainMaterial() {
  if (terrain) return terrain;
  terrain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }); terrain.userData.shared = true;
  terrain.onBeforeCompile = shader => {
    addCloudShadow(shader as unknown as Parameters<typeof addCloudShadow>[0]);
    for (const l of groundLayers) Object.assign(shader.uniforms, l.uniforms);
    shader.vertexShader = 'attribute float aWet; attribute float aSnow; varying float vWet; varying float vSnow; varying vec2 vXZ;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWet = aWet; vSnow = aSnow; vXZ = (modelMatrix * vec4(position, 1.)).xz;');
    shader.fragmentShader = `varying float vWet; varying float vSnow; varying vec2 vXZ;\n${GLSL_NOISE}\n${groundLayers.map(l => l.head).join('\n')}\n` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${groundLayers.map(l => l.body).join('\n')}
        float n1 = fbm(vXZ * 1.7, ${SEED.toFixed(3)}), n2 = vnoise(vXZ * 9.0, ${SEED.toFixed(3)});
        diffuseColor.rgb *= (0.85 + 0.3 * n1) * (1.0 - 0.4 * vWet);
        float snow = smoothstep(0.2, 0.8, vSnow + (n2 - 0.5) * 0.4);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8), snow);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.95, 0.35, vWet) * (0.9 + 0.2 * n2), 0.6, snow);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float e = 0.05, s = ${SEED.toFixed(3)}; vec2 p = vXZ * 3.0;
          float gx = fbm(p + vec2(e, 0.), s) - fbm(p - vec2(e, 0.), s), gz = fbm(p + vec2(0., e), s) - fbm(p - vec2(0., e), s);
          normal = normalize(normal - (viewMatrix * vec4(gx, 0., gz, 0.)).xyz * (1.0 - snow) * 1.5); }`);
  };
  terrain.customProgramCacheKey = () => ['boreal-terrain-pbr', ...groundLayers.map(l => l.name)].join(':');
  fadeOptIn(terrain); // render/fade: in-page transition patch fade (uniform only, same cache key)
  return terrain;
}
/** Adds needle/leaf translucency to a foliage material's shader source (called from its onBeforeCompile). */
export function addTranslucency(shader: { uniforms: Record<string, THREE.IUniform>; fragmentShader: string }) {
  Object.assign(shader.uniforms, SUN_UNIFORMS);
  shader.fragmentShader = 'uniform vec3 uSunView; uniform vec3 uSunCol;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
    { vec3 V = normalize(vViewPosition), H = normalize(uSunView + normal * 0.3);
      float t = pow(clamp(dot(V, -H), 0., 1.), 4.0) * 0.1 * 6.0; // T ≈ 0.1, scale 6 (B-B&B 2011 'power/scale' knobs)
      #ifdef TRANSLUCENCY_MASK
      t *= TRANSLUCENCY_MASK;
      #endif
      outgoingLight += diffuseColor.rgb * uSunCol * t; }
    #include <opaque_fragment>`);
}

/** Cloud shadows: the weather grid's cloud water path as a texture, projected from the cloud base (~1 km) along the sun.
 * Direct light only is attenuated, by the same Kasten & Czeplak (1980) factor the weather uses: 1 − 0.75 C^3.4. */
export const CLOUD = { uCloudTex: { value: new THREE.DataTexture(new Uint8Array(64), 8, 8, THREE.RedFormat) as THREE.DataTexture },
  uCloudBox: { value: new THREE.Vector4(0, 0, 384, 0) } /* originX, originZ, size, on */, uSunWorld: { value: new THREE.Vector3(0, 1, 0) } };
CLOUD.uCloudTex.value.magFilter = CLOUD.uCloudTex.value.minFilter = THREE.LinearFilter;
export function setCloudField(cover: Float32Array | number[], n: number, originX: number, originZ: number, size: number, on: boolean) {
  let tex = CLOUD.uCloudTex.value;
  if (tex.image.width !== n) { tex.dispose(); tex = CLOUD.uCloudTex.value = new THREE.DataTexture(new Uint8Array(n * n), n, n, THREE.RedFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; }
  const d = tex.image.data as Uint8Array; for (let i = 0; i < n * n; i++) d[i] = Math.round(Math.min(1, cover[i]) * 255);
  tex.needsUpdate = true; CLOUD.uCloudBox.value.set(originX - size / 2, originZ - size / 2, size, on ? 1 : 0);
}
export function addCloudShadow(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }) {
  Object.assign(shader.uniforms, CLOUD);
  shader.vertexShader = 'varying vec3 vCloudW;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vCloudW = (modelMatrix * vec4(transformed, 1.)).xyz;');
  shader.fragmentShader = 'uniform sampler2D uCloudTex; uniform vec4 uCloudBox; uniform vec3 uSunWorld; varying vec3 vCloudW;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
    if (uCloudBox.w > 0.5 && uSunWorld.y > 0.02) {
      vec2 p = vCloudW.xz + uSunWorld.xz / uSunWorld.y * (1000.0 - vCloudW.y);
      float c = texture2D(uCloudTex, (p - uCloudBox.xy) / uCloudBox.z).r, k = 1.0 - 0.75 * pow(c, 3.4);
      reflectedLight.directDiffuse *= k; reflectedLight.directSpecular *= k; }`);
}
