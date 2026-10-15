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
/** Thin-lens: blur scales with focal length² / (f-stop · focus distance). */
const bokehAperture = (focalMm: number, fstop: number) => (focalMm / 1000) ** 2 / fstop * 10;

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  let lastW = 0, lastH = 0, settings = defaultSettings(), composer: EffectComposer | undefined, gtao: GTAOPass, aoLevel = -1, bokeh: BokehPass, bloom: UnrealBloomPass, grade: ShaderPass;
  const baseExposure = renderer.toneMappingExposure, baseToneMap = renderer.toneMapping;
  const neutral = (s: PhotoSettings) => PHOTO_PARAMS.every(p => p.group === 'Lens' || p.group === 'Guides' || p.key === 'autofocus' || p.key === 'focus' || p.key === 'fstop' || s[p.key] === p.value);
  function build() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(gtao = new GTAOPass(scene, camera, 512, 512)); // GTAO (Jiménez et al. 2016), three r180 examples/jsm, MIT
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
    render(active: boolean, focalMmForFov: number, ao = 0) {
      const s = active ? settings : defaultSettings();
      renderer.toneMappingExposure = baseExposure * 2 ** s.ev; // photo EV; the physical adaptation gain is folded into light intensities (render/sky)
      renderer.toneMapping = active ? TONE_MAPS[s.toneMap] ?? baseToneMap : baseToneMap;
      if (!ao && (!active || neutral(s))) { renderer.render(scene, camera); return; }
      if (!composer) build();
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (size.x !== lastW || size.y !== lastH || ao !== aoLevel) { composer!.setPixelRatio(1); composer!.setSize(lastW = size.x, lastH = size.y); aoLevel = ao;
        if (ao === 1) gtao.setSize(size.x >> 1, size.y >> 1); }
      gtao.enabled = ao > 0;
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
