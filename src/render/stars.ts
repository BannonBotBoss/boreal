/**
 * Stars, Milky Way inputs and meteors (Claude). The physics lives in core/celestial; this file draws it:
 *  - one Points draw for ~16 000 catalogue stars fixed on the turning celestial sphere (brightest first, the draw range stops
 *    at the limiting magnitude). Each star is a small Gaussian PSF ≥ 1.5 px, so stars stay put and don't crawl as the view
 *    moves; bright ones add the eye's glare: a halo and a fine starburst of rays fixed to the screen (the eye's, not the sky's).
 *  - twinkling (scintillation) grows toward the horizon, turning colourful low down; extinction dims low stars.
 *  - meteors: deterministic per world-clock second (same sky on every replay), heads drawn with the star PSF, a hot wake behind
 *    the head, and for bright fast ones a glowing train that lingers, widens and drifts.
 *  - clouds hide all of it: every vertex samples the same cloud field as the sky dome (render/sky SKY_CLOUD).
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../proc/glsl';
import { hash, random } from '../proc/rng';
import { WORLD_SEED } from '../core/world';
import { REAL_SECONDS_PER_GAME_HOUR } from '../core/timeOfDay';
import {
  NIGHT_SKY, SHOWERS, apply3, equatorialToWorld, meteorLight, sampleMeteor, showerRate, sporadicRate, SPORADIC, starCatalogue,
  starsBrighter, unitRaDec, zhrOn, type Meteor, type Vec3,
} from '../core/celestial';

const R = 520; // inside the 550 m cloud dome, drawn at the far plane anyway
const AIRMASS_GLSL = /* glsl */`
float airMassY(float cz) { // Kasten & Young 1989, as core/light airMass
  cz = clamp(cz, 0.0, 1.0); float z = degrees(acos(cz));
  return z >= 89.9 ? 40.0 : 1.0 / (cz + 0.50572 * pow(96.07995 - z, -1.6364));
}`;
export function skyUniforms(cloud: Record<string, THREE.IUniform>) {
  return { ...cloud, uLimit: { value: 6.5 }, uGain: { value: 1 }, uTime: { value: 0 }, uK: { value: NIGHT_SKY.extinction },
    uDpr: { value: 1 }, uSeeing: { value: 1 }, uViewport: { value: new THREE.Vector2(1, 1) } };
}
const STAR_VERT = (cloudGlsl: string) => /* glsl */`
attribute float mag, phase; attribute vec3 colour;
uniform mat3 uToWorld; uniform float uLimit, uGain, uTime, uK, uDpr, uSeeing;
varying vec3 vCol; varying float vSize, vGlare, vCore;
${GLSL_NOISE}
${cloudGlsl}
${AIRMASS_GLSL}
void main() {
  vec3 d = normalize(uToWorld * position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(d * ${R}.0, 1.0);
  gl_Position = p.xyww; gl_PointSize = 0.0; vSize = 1.0; vCore = 0.0; vGlare = 0.0; vCol = vec3(0.0);
  if (d.y < -0.01 || p.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float X = airMassY(d.y);
  float f = pow(10.0, -0.4 * (mag + uK * (X - 1.0) - uLimit));
  float tw = 1.0; vec3 twc = vec3(1.0);
  if (phase >= 0.0) { // scintillation: a few Hz, deeper toward the horizon, chromatic low down (dispersion)
    float s = min(0.9, 0.12 * pow(X, 1.75) * uSeeing), q = phase * 6.2832;
    tw = max(0.04, 1.0 + s * (0.6 * sin(uTime * (19.0 + 9.0 * phase) + q * 7.0) + 0.3 * sin(uTime * (41.0 + 13.0 * phase) + q * 13.0)
      + 0.2 * sin(uTime * (73.0 + 5.0 * phase) + q * 3.0)));
    float chroma = smoothstep(1.8, 6.0, X) * s * 1.4;
    twc = max(vec3(0.0), 1.0 + chroma * vec3(sin(uTime * 23.0 + q * 5.0), sin(uTime * 29.0 + q * 11.0), sin(uTime * 31.0 + q * 17.0)));
  }
  float e = f * tw * uGain * (1.0 - skyCloudAlpha(d));
  vCore = min(1.0, 0.045 * pow(e, 0.55));
  if (vCore < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vGlare = clamp(log2(max(e, 1.0) / 80.0) / 6.0, 0.0, 1.0);
  vSize = uDpr * (1.8 + 1.5 * sqrt(vCore) + 22.0 * vGlare * vGlare + 6.0 * vGlare);
  gl_PointSize = 2.0 * vSize; vCol = colour * twc;
}`;
const STAR_FRAG = /* glsl */`
uniform float uDpr;
varying vec3 vCol; varying float vSize, vGlare, vCore;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * 2.0 * vSize; float r = length(q), sc = 0.72 * uDpr;
  float core = vCore * exp(-r * r / (2.0 * sc * sc));
  float edge = smoothstep(vSize, vSize * 0.55, r);
  float halo = vGlare * 0.5 * vCore / (1.0 + r * r / (6.0 * uDpr * uDpr));
  float a = atan(q.y, q.x); // the eye's starburst (ciliary corona): fine rays fixed to the screen
  float rays = vGlare * vGlare * 0.8 * exp(-r / (vSize * 0.3)) * (pow(0.5 + 0.5 * cos(a * 6.0 + 0.7), 60.0)
    + 0.7 * pow(0.5 + 0.5 * cos(a * 10.0 + 2.1), 110.0) + 0.5 * pow(0.5 + 0.5 * cos(a * 17.0 + 4.0), 160.0));
  float v = core + (halo + rays) * edge;
  if (v < 0.002) discard;
  gl_FragColor = vec4(vCol * v, 1.0);
  #include <colorspace_fragment>
}`;
const RIBBON_VERT = (cloudGlsl: string) => /* glsl */`
attribute vec3 other; attribute float side; attribute vec4 tint; // rgb = display intensity, a = half width (px)
uniform vec2 uViewport; uniform float uDpr;
varying vec3 vCol; varying float vSide;
${GLSL_NOISE}
${cloudGlsl}
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0), b = projectionMatrix * modelViewMatrix * vec4(other, 1.0);
  vSide = side; vCol = vec3(0.0);
  if (a.w <= 0.0 || b.w <= 0.0 || tint.a <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 dir = (b.xy / b.w - a.xy / a.w) * uViewport; dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
  a.xy += vec2(-dir.y, dir.x) * side * tint.a * uDpr * 2.0 / uViewport * a.w;
  gl_Position = a.xyww;
  vCol = tint.rgb * (1.0 - skyCloudAlpha(normalize(position)));
}`;
const RIBBON_FRAG = /* glsl */`
varying vec3 vCol; varying float vSide;
void main() {
  float v = exp(-vSide * vSide * 2.6);
  gl_FragColor = vec4(vCol * v, 1.0);
  #include <colorspace_fragment>
}`;

const MAX = 10, K = 32, RIB = 2 * MAX, VPR = (K + 1) * 2; // meteors, segments per ribbon, ribbons (wake + train), verts/ribbon
interface Live { m: Meteor; t0: number }

export function createStars(scene: THREE.Scene, cloudGlsl: string, uniforms: ReturnType<typeof skyUniforms>) {
  const cat = starCatalogue(WORLD_SEED);
  const toWorld = { value: new THREE.Matrix3() };
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(cat.dir, 3));
  starGeo.setAttribute('mag', new THREE.BufferAttribute(cat.mag, 1));
  starGeo.setAttribute('colour', new THREE.BufferAttribute(cat.colour, 3));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(cat.phase, 1));
  const pointMat = (toW: { value: THREE.Matrix3 }) => new THREE.ShaderMaterial({ vertexShader: STAR_VERT(cloudGlsl), fragmentShader: STAR_FRAG,
    uniforms: { ...uniforms, uToWorld: toW }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const stars = new THREE.Points(starGeo, pointMat(toWorld)); stars.frustumCulled = false; stars.renderOrder = -.5;

  // meteor heads: the same PSF (identity matrix: world directions), no twinkle
  const hDir = new Float32Array(MAX * 3), hMag = new Float32Array(MAX).fill(99), hCol = new Float32Array(MAX * 3), hPh = new Float32Array(MAX).fill(-1);
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.BufferAttribute(hDir, 3)); headGeo.setAttribute('mag', new THREE.BufferAttribute(hMag, 1));
  headGeo.setAttribute('colour', new THREE.BufferAttribute(hCol, 3)); headGeo.setAttribute('phase', new THREE.BufferAttribute(hPh, 1));
  const heads = new THREE.Points(headGeo, pointMat({ value: new THREE.Matrix3() })); heads.frustumCulled = false; heads.renderOrder = -.4;

  // wakes and trains: screen-space ribbons along great-circle arcs
  const rPos = new Float32Array(RIB * VPR * 3), rOther = new Float32Array(RIB * VPR * 3), rSide = new Float32Array(RIB * VPR), rTint = new Float32Array(RIB * VPR * 4);
  for (let i = 0; i < RIB * VPR; i++) rSide[i] = i % 2 ? 1 : -1;
  const idx: number[] = [];
  for (let rb = 0; rb < RIB; rb++) for (let k = 0; k < K; k++) { const o = rb * VPR + k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3)); ribGeo.setAttribute('other', new THREE.BufferAttribute(rOther, 3));
  ribGeo.setAttribute('side', new THREE.BufferAttribute(rSide, 1)); ribGeo.setAttribute('tint', new THREE.BufferAttribute(rTint, 4)); ribGeo.setIndex(idx);
  const ribbons = new THREE.Mesh(ribGeo, new THREE.ShaderMaterial({ vertexShader: RIBBON_VERT(cloudGlsl), fragmentShader: RIBBON_FRAG,
    uniforms, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  ribbons.frustumCulled = false; ribbons.renderOrder = -.45;
  scene.add(stars, ribbons, heads);

  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : undefined;
  const boost = Math.max(0, Number(q?.get('meteors') ?? 1) || 0); // ?meteors=20: a storm, for looking at the animation
  const live: Live[] = []; let lastSec = NaN;
  const slerp = (a: Vec3, b: Vec3, t: number): Vec3 => {
    const c = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), w = Math.acos(c);
    if (w < 1e-6) return [a[0], a[1], a[2]];
    const s = Math.sin(w), ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  };
  /** Writes one ribbon: K+1 arc points from fraction x0 to x1 of the meteor's path; f(x) → [r, g, b, halfWidthPx, wobble rad]. */
  function ribbon(rb: number, m: Meteor, x0: number, x1: number, f: (x: number) => [number, number, number, number, number]) {
    const n: Vec3 = (() => { const c = [m.start[1] * m.end[2] - m.start[2] * m.end[1], m.start[2] * m.end[0] - m.start[0] * m.end[2], m.start[0] * m.end[1] - m.start[1] * m.end[0]];
      const l = Math.hypot(c[0], c[1], c[2]) || 1; return [c[0] / l, c[1] / l, c[2] / l]; })();
    const pts: Vec3[] = [];
    for (let k = 0; k <= K; k++) {
      const x = x0 + (x1 - x0) * k / K, t = f(x), p = slerp(m.start, m.end, x);
      pts.push([(p[0] + n[0] * t[4]) * R, (p[1] + n[1] * t[4]) * R, (p[2] + n[2] * t[4]) * R]);
      for (let s = 0; s < 2; s++) rTint.set([t[0], t[1], t[2], t[3]], ((rb * VPR) + k * 2 + s) * 4);
    }
    for (let k = 0; k <= K; k++) {
      const p = pts[k], o = k < K ? pts[k + 1] : [2 * p[0] - pts[k - 1][0], 2 * p[1] - pts[k - 1][1], 2 * p[2] - pts[k - 1][2]];
      for (let s = 0; s < 2; s++) { const v = (rb * VPR) + k * 2 + s; rPos.set(p, v * 3); rOther.set(o, v * 3); }
    }
  }
  const clearRibbon = (rb: number) => { for (let v = rb * VPR; v < (rb + 1) * VPR; v++) rTint[v * 4 + 3] = 0; };

  return {
    stars,
    /** Per frame. `time` = world-clock seconds, `lst` = local sidereal hours, `lm` = limiting magnitude (after adaptation). */
    update(time: number, day: number, hour: number, lst: number, lm: number, gain: number) {
      const M = equatorialToWorld(lst); toWorld.value.fromArray(M);
      const visible = lm > -1.8; stars.visible = visible; heads.visible = ribbons.visible = visible || live.length > 0;
      starGeo.setDrawRange(0, Math.min(cat.count, Math.ceil(starsBrighter(lm + .8))));
      uniforms.uTime.value = time % 600; uniforms.uLimit.value = lm; uniforms.uGain.value = gain;
      if (typeof window !== 'undefined') { const dpr = window.devicePixelRatio || 1; uniforms.uDpr.value = dpr; uniforms.uViewport.value.set(window.innerWidth * dpr, window.innerHeight * dpr); }
      // spawn: one seeded draw per world-clock second, rate per game hour → per real second
      const sec = Math.floor(time);
      if (!(sec >= lastSec) || sec - lastSec > 5) lastSec = sec - 1;
      for (let s = lastSec + 1; s <= sec; s++) {
        if (!visible || boost <= 0) continue;
        const rnd = random(hash(`meteor:${WORLD_SEED}:${s}`));
        const sources: { rate: number; r: number; v: number; rad?: Vec3 }[] = [{ rate: sporadicRate(hour, lm), r: SPORADIC.r, v: SPORADIC.v }];
        for (const sh of SHOWERS) {
          const z = zhrOn(sh, day); if (z < 1) continue;
          const rad = apply3(M, unitRaDec(sh.ra, sh.dec)); sources.push({ rate: showerRate(z, Math.asin(rad[1]) * 180 / Math.PI, lm, sh.r), r: sh.r, v: sh.v, rad });
        }
        for (const src of sources) {
          const lambda = src.rate * boost / REAL_SECONDS_PER_GAME_HOUR; // a game hour's meteors fall in its 5 real minutes
          if (rnd() < 1 - Math.exp(-lambda) && live.length < MAX)
            live.push({ m: sampleMeteor(rnd, lm, src.r, src.v, src.rad), t0: s + rnd() });
        }
      }
      lastSec = sec;
      // animate
      for (let i = live.length - 1; i >= 0; i--) if (time - live[i].t0 > live[i].m.duration + live[i].m.train || time < live[i].t0 - 2) live.splice(i, 1);
      for (let i = 0; i < MAX; i++) {
        const L = live[i]; hMag[i] = 99;
        if (!L || time < L.t0) { clearRibbon(2 * i); clearRibbon(2 * i + 1); continue; }
        const m = L.m, t = time - L.t0, x = t / m.duration, peak = 10 ** (-.4 * (m.mag - lm)) * gain;
        if (x < 1) { // head + wake
          const lx = meteorLight(x, m.flares); hDir.set(slerp(m.start, m.end, x), i * 3); hCol.set(m.head, i * 3);
          hMag[i] = lx > 1e-4 ? m.mag - 2.5 * Math.log10(lx) : 99;
          const e = peak * lx, wl = Math.max(.06, Math.min(.35, .12 + .04 * (2 - m.mag))), I = Math.min(1.2, .03 * Math.sqrt(e)), w = Math.min(4, 1 + .6 * Math.log10(Math.max(e, 1)));
          ribbon(2 * i, m, Math.max(0, x - wl), x, xv => { const u = (xv - (x - wl)) / wl, k = I * Math.exp(-3 * (1 - u)), c = u;
            return [k * (m.wake[0] + (m.head[0] - m.wake[0]) * c), k * (m.wake[1] + (m.head[1] - m.wake[1]) * c), k * (m.wake[2] + (m.head[2] - m.wake[2]) * c), w * (.5 + .5 * u), 0]; });
        } else clearRibbon(2 * i);
        if (m.train > 0) { // the train: each stretch glows from when the head passed it, decays, widens and drifts in the wind
          const tau = m.persistent ? m.train / 3 : m.train / 2, I0 = Math.min(m.persistent ? .6 : .25, (m.persistent ? .006 : .004) * peak ** .45), xe = Math.min(1, x);
          ribbon(2 * i + 1, m, 0, xe, xv => {
            const age = t - xv * m.duration, k = I0 * Math.min(1, meteorLight(xv) + .15) * Math.exp(-age / tau) * Math.min(1, age / .05 + .2);
            return [k * m.glow[0], k * m.glow[1], k * m.glow[2], 1.2 + age * (m.persistent ? 2.2 : 1), m.persistent ? .0016 * age * Math.sin(xv * 9 + m.seed * 30 + age * .6) : 0];
          });
        } else clearRibbon(2 * i + 1);
      }
      for (const a of ['position', 'mag', 'colour'] as const) (headGeo.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
      for (const a of ['position', 'other', 'tint'] as const) (ribGeo.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
    },
    /** Live meteor count (tests/dev). */
    get meteors() { return live.length; },
  };
}
