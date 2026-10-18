/**
 * Photo post-processing (Grok Bot): ONE data-driven parameter table drives the UI, presets, persistence and passes.
 * When every effect is at its neutral value the composer is bypassed, so normal play costs nothing extra.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EXPOSURE } from '../core/light';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GLSL_HASH } from '../proc/glsl';

export interface Param { key: string; label: string; group: string; min: number; max: number; step: number; value: number }
/** value = neutral default. Order = panel order. */
export const PHOTO_PARAMS: Param[] = [
  { key: 'ev', label: 'Exposure (EV)', group: 'Exposure', min: -3, max: 3, step: .1, value: 0 },
  { key: 'toneMap', label: 'Tone map (0 ACES, 1 AgX, 2 Neutral, 3 Reinhard, 4 Linear)', group: 'Exposure', min: 0, max: 4, step: 1, value: 0 },
  { key: 'focalLength', label: 'Focal length (mm)', group: 'Lens', min: 12, max: 200, step: 1, value: 0 }, // 0 = keep game FOV
  { key: 'roll', label: 'Roll (°)', group: 'Lens', min: -45, max: 45, step: 1, value: 0 },
  { key: 'dof', label: 'Depth of field', group: 'Focus', min: 0, max: 1, step: 1, value: 0 },
  { key: 'autofocus', label: 'Autofocus (centre)', group: 'Focus', min: 0, max: 1, step: 1, value: 1 },
  { key: 'focus', label: 'Focus distance (m)', group: 'Focus', min: .3, max: 200, step: .1, value: 8 },
  { key: 'fstop', label: 'Aperture (f/)', group: 'Focus', min: 1.2, max: 22, step: .1, value: 2.8 },
  { key: 'temperature', label: 'Temperature', group: 'Colour', min: -1, max: 1, step: .01, value: 0 },
  { key: 'tint', label: 'Tint', group: 'Colour', min: -1, max: 1, step: .01, value: 0 },
  { key: 'contrast', label: 'Contrast', group: 'Colour', min: -1, max: 1, step: .01, value: 0 },
  { key: 'saturation', label: 'Saturation', group: 'Colour', min: -1, max: 1, step: .01, value: 0 },
  { key: 'vibrance', label: 'Vibrance', group: 'Colour', min: -1, max: 1, step: .01, value: 0 },
  { key: 'sepia', label: 'Sepia', group: 'Colour', min: 0, max: 1, step: .01, value: 0 },
  { key: 'fade', label: 'Faded blacks', group: 'Colour', min: 0, max: 1, step: .01, value: 0 },
  { key: 'vignette', label: 'Vignette', group: 'Film', min: 0, max: 1, step: .01, value: 0 },
  { key: 'grain', label: 'Grain', group: 'Film', min: 0, max: 1, step: .01, value: 0 },
  { key: 'chroma', label: 'Chromatic aberration', group: 'Film', min: 0, max: 1, step: .01, value: 0 },
  { key: 'bloom', label: 'Bloom', group: 'Film', min: 0, max: 2, step: .01, value: 0 },
  { key: 'grid', label: 'Rule-of-thirds grid', group: 'Guides', min: 0, max: 1, step: 1, value: 0 },
];
export type PhotoSettings = Record<string, number>;
export const defaultSettings = (): PhotoSettings => Object.fromEntries(PHOTO_PARAMS.map(p => [p.key, p.value]));
/** Filter presets are just partial settings over the same parameters (applied on top of the defaults). */
export const PRESETS: Record<string, PhotoSettings> = {
  'None': {},
  'B&W': { saturation: -1, contrast: .2, grain: .25 },
  'Sepia': { saturation: -1, sepia: 1, vignette: .4, grain: .2 },
  'Warm': { temperature: .45, tint: .05, vibrance: .2 },
  'Cool': { temperature: -.45, tint: -.05, saturation: -.1 },
  'Faded film': { fade: .5, contrast: -.25, saturation: -.25, grain: .35, vignette: .3, temperature: .1 },
  'High contrast': { contrast: .6, vibrance: .3, vignette: .25 },
};
const TONE_MAPS = [THREE.ACESFilmicToneMapping, THREE.AgXToneMapping, THREE.NeutralToneMapping, THREE.ReinhardToneMapping, THREE.LinearToneMapping];

const GRADE = {
  uniforms: Object.fromEntries(['tDiffuse', 'temperature', 'tint', 'contrast', 'saturation', 'vibrance', 'sepia', 'fade', 'vignette', 'grain', 'chroma', 'seed']
    .map(k => [k, { value: k === 'tDiffuse' ? null : 0 }])),
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `${GLSL_HASH}
uniform sampler2D tDiffuse; varying vec2 vUv;
uniform float temperature, tint, contrast, saturation, vibrance, sepia, fade, vignette, grain, chroma, seed;
void main(){
  vec2 d = vUv - .5; vec2 off = d * chroma * .012;
  vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
  c *= vec3(1. + temperature * .2, 1. + tint * .12, 1. - temperature * .2);
  c = (c - .5) * (1. + contrast) + .5;
  float l = dot(c, vec3(.2126, .7152, .0722));
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(vec3(l), c, 1. + saturation + vibrance * (1. - sat));
  c = mix(c, vec3(l) * vec3(1.07, .88, .66) + vec3(.06, .03, 0.), sepia);
  c = c * (1. - fade * .25) + fade * .12;
  c *= 1. - vignette * smoothstep(.25, .75, length(d * vec2(1.25, 1.)));
  c += (hash2s(vUv * 917., seed) - .5) * grain * .16;
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`,
};
/** Sun-driven screen-space lighting, ONE pass reading the scene depth:
 *  - contact shadows: per pixel, march ≤ 16 steps toward the sun in view space and test the depth buffer (the short-range
 *    ray-march of Bend Studio's screen-space shadows, Aldridge 2023, Apache-2.0 bend_sss; same idea as UE/HDRP contact shadows);
 *  - god rays: radial blur of the sky mask (depth = far) toward the sun's screen position (Mitchell 2007, GPU Gems 3 ch. 13;
 *    as three examples/jsm/shaders/GodRaysShader.js, MIT, but using the depth buffer instead of an extra occlusion pre-pass). */
const SUNFX = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() },
    uSunView: { value: new THREE.Vector3() }, uSunUv: { value: new THREE.Vector2() }, uSunCol: { value: new THREE.Color() }, uContact: { value: 0 }, uRays: { value: 0 }, uRayGain: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `${GLSL_HASH}
uniform sampler2D tDiffuse, tDepth; uniform mat4 uProjInv, uProj; uniform vec3 uSunView, uSunCol; uniform vec2 uSunUv; uniform float uContact, uRays, uRayGain; varying vec2 vUv;
vec3 viewPos(vec2 uv) { vec4 p = uProjInv * vec4(vec3(uv, texture2D(tDepth, uv).x) * 2. - 1., 1.); return p.xyz / p.w; }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb; float d0 = texture2D(tDepth, vUv).x;
  if (uContact > 0. && d0 < .9999 && uSunView.z > -1.) { // contact shadow: 16 steps over 0.6 m toward the sun
    vec3 p = viewPos(vUv); float occ = 0., j = hash2s(vUv * 731., 0.);
    for (int i = 1; i <= 16; i++) { vec3 q = p + uSunView * (.6 * (float(i) - j) / 16.); vec4 s = uProj * vec4(q, 1.); vec2 uv = s.xy / s.w * .5 + .5;
      if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) break;
      float dz = viewPos(uv).z - q.z; if (dz > .02 && dz < .5) { occ = 1. - float(i) / 17.; break; } }
    c *= 1. - .45 * occ * smoothstep(80., 30., -p.z); }
  if (uRays > 0.) { // god rays: march toward the sun, accumulating unoccluded sky with exponential decay
    vec2 stp = (vUv - uSunUv) / uRays; vec2 uv = vUv - stp * hash2s(vUv * 113., 1.); float decay = 1., acc = 0.;
    for (int i = 0; i < 48; i++) { if (float(i) >= uRays) break; uv -= stp; acc += step(.9999, texture2D(tDepth, clamp(uv, 0., 1.)).x) * decay; decay *= .96; }
    c += uSunCol * acc / uRays * uRayGain * smoothstep(1.2, 0., length(vUv - uSunUv)); }
  gl_FragColor = vec4(c, 1.);
}`,
};
/** Thin-lens: blur scales with focal length² / (f-stop · focus distance). */
const bokehAperture = (focalMm: number, fstop: number) => (focalMm / 1000) ** 2 / fstop * 10;

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  let lastW = 0, lastH = 0, settings = defaultSettings(), composer: EffectComposer | undefined, gtao: GTAOPass, aoLevel = -1, bokeh: BokehPass, bloom: UnrealBloomPass, grade: ShaderPass, sunfx: ShaderPass;
  const baseExposure = EXPOSURE.base, baseToneMap = renderer.toneMapping; // core/light: calibrated base exposure (photo EV multiplies on top)
  const neutral = (s: PhotoSettings) => PHOTO_PARAMS.every(p => p.group === 'Lens' || p.group === 'Guides' || p.key === 'autofocus' || p.key === 'focus' || p.key === 'fstop' || s[p.key] === p.value);
  function build() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }); rt.depthTexture = new THREE.DepthTexture(1, 1); // depth for SUNFX
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(sunfx = new ShaderPass(SUNFX));
    composer.addPass(gtao = new GTAOPass(scene, camera, 512, 512)); // GTAO (Jiménez et al. 2016), three r180 examples/jsm, MIT
    gtao.updateGtaoMaterial({ samples: 8 }); gtao.updatePdMaterial({ samples: 8 }); // bench: 16+16 samples at full res = ~43 ms; half res + 8/8 samples
    composer.addPass(bokeh = new BokehPass(scene, camera, { focus: 8, aperture: .001, maxblur: .02 }));
    composer.addPass(bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, .4, .85));
    composer.addPass(new OutputPass());
    composer.addPass(grade = new ShaderPass(GRADE));
  }
  return {
    get settings() { return settings; },
    set(next: PhotoSettings) { settings = { ...defaultSettings(), ...next }; },
    /** `active` = photo mode; outside it the game renders exactly as before. */
    /** `ao` = ambient-occlusion level from the quality ladder (0 off, 1 half-res, 2 full-res). */
    /** `fx` = sun-driven screen-space lighting from the ladder (contact shadows, god-ray samples). */
    render(active: boolean, focalMmForFov: number, ao = 0, fx?: { contact: number; rays: number; sunDir: THREE.Vector3; sunCol: THREE.Color }) {
      const s = active ? settings : defaultSettings();
      renderer.toneMappingExposure = baseExposure * 2 ** s.ev; // photo EV; the physical adaptation gain is folded into light intensities (render/sky)
      renderer.toneMapping = active ? TONE_MAPS[s.toneMap] ?? baseToneMap : baseToneMap;
      const lightFx = !!fx && fx.sunDir.y > -.05 && (fx.contact > 0 || fx.rays > 0);
      if (!ao && !lightFx && (!active || neutral(s))) { renderer.render(scene, camera); return; }
      if (!composer) build();
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (size.x !== lastW || size.y !== lastH || ao !== aoLevel) { composer!.setPixelRatio(1); composer!.setSize(lastW = size.x, lastH = size.y); aoLevel = ao;
        if (ao === 1) gtao.setSize(size.x >> 1, size.y >> 1); }
      gtao.enabled = ao > 0; sunfx.enabled = lightFx;
      if (lightFx) { const u = sunfx.uniforms as Record<string, { value: any }>, sv = fx!.sunDir.clone().transformDirection(camera.matrixWorldInverse), sp = camera.position.clone().addScaledVector(fx!.sunDir, 1000).project(camera);
        u.tDepth.value = composer!.readBuffer.depthTexture; u.uProj.value.copy(camera.projectionMatrix); u.uProjInv.value.copy(camera.projectionMatrixInverse);
        u.uSunView.value.copy(sv); u.uSunUv.value.set(sp.x * .5 + .5, sp.y * .5 + .5); u.uContact.value = fx!.contact; u.uRays.value = sp.z < 1 ? fx!.rays : 0;
        u.uSunCol.value.copy(fx!.sunCol); u.uRayGain.value = .5 * Math.min(1, fx!.sunDir.y * 6 + .3); }
      const effects = active && !neutral(s);
      grade.enabled = effects;
      bokeh.enabled = s.dof > 0; bloom.enabled = s.bloom > 0; bloom.strength = s.bloom;
      const bu = bokeh.uniforms as Record<string, { value: number }>;
      bu.focus.value = s.focus; bu.aperture.value = bokehAperture(focalMmForFov, s.fstop); bu.maxblur.value = .02;
      const gu = grade.uniforms as Record<string, { value: number }>;
      for (const k of ['temperature', 'tint', 'contrast', 'saturation', 'vibrance', 'sepia', 'fade', 'vignette', 'grain', 'chroma']) gu[k].value = s[k];
      gu.seed.value = (gu.seed.value + 7.31) % 100; // grain changes every frame (visual only)
      composer!.render();
    },
  };
}
export type Post = ReturnType<typeof createPost>;
