/**
 * Globe atmosphere (Grok Bot): single-scattering Rayleigh + Mie, ray-marched per pixel (the well-known Nishita/O'Neil
 * formulation as in wwwtyro/glsl-atmosphere, Unlicense, adapted: planet shadow, camera-relative km units, terrain
 * aerial perspective). Nothing baked: no LUT images, all from the physical parameters below.
 *  - sky shell: a back-faced sphere at the top of the atmosphere; blue sky from the ground, the limb halo from space,
 *    red sunsets (long light paths lose blue), the planet's shadow at night.
 *  - aerial perspective: chained into the globe tile material: terrain colour × transmittance + in-scattered light
 *    between the camera and the fragment, and sunlight reddened by its path to the fragment.
 * Why not @takram/three-atmosphere (Bruneton, MIT): React is optional and it can generate its LUTs at runtime
 * (PrecomputedTexturesGenerator), but its aerial perspective needs pmndrs `postprocessing` (a required peer) plus
 * three-geospatial/astronomy-engine, i.e. new dependencies in package.json (a shared file). See AGENT-NOTES.md.
 * The sun is the game's: core/timeOfDay sunPosition(gameHour(world clock)) at the home region, turned into planet axes.
 */
import * as THREE from 'three';
import { LOG_DEPTH, LOG_DEPTH_PREFIX } from './logDepth';
import { GLSL_NOISE } from '../../proc/glsl';

/** Earth-like constants (Nishita 1993 / Bruneton 2008 values; per km). [game calibration: sunI, mieG] */
export const ATMOS = {
  heightKm: 100, rayleigh: [5.802e-3, 13.558e-3, 33.1e-3], rayleighH: 8, mie: 3.996e-3, mieExt: 1.11, mieH: 1.2, mieG: .76, sunI: 22, aerial: .16,
};
/** Ray-march sample counts per quality row (GLOBE_LOD order): [sky primary, sky light, terrain primary, terrain light]. */
export const ATMOS_STEPS = [[16, 6, 8, 3], [14, 5, 6, 3], [12, 4, 6, 2], [10, 4, 4, 2], [8, 3, 3, 2], [6, 2, 0, 0]];
/** Cloud layer: a thin shell at `heightKm`, density = octaves of the shared value noise (proc/glsl) on the planet-fixed
 *  direction. Octaves per quality row (0 = no clouds). [game calibration: cell size; Blue Marble look] */
export const CLOUDS = { heightKm: 2.5, cellKm: 900, albedo: .8, octaves: [8, 6, 5, 4, 2, 0],
  /** cloud edges per quality row: fBm persistence (more fine detail than 0.5), the coverage threshold's half width
   *  (contrast: narrower = sharper edges; Ultra 10-90 % edge ~34 km median vs ~310 km before, Medium ~79 vs ~225 km) and
   *  its centre, calibrated per row on the CPU twin of the noise so the mean cover stays 0.16 (as before). Octaves finer
   *  than 2 px fade out by distance (no shimmer from orbit). [game calibration: persistence, widths] */
  persistence: .6, edgeHalf: [.02, .025, .035, .045, .06, .06], edgeCentre: [.613, .616, .621, .629, .675, .675],
  /** the shadow lookup is ONE octave: its own threshold for the same mean cover, soft (penumbra-like) edges */
  shadowCentre: .74, shadowHalf: .08,
  /** drift from the world clock: an eastward wind (m/s) turns the field about the polar axis; the field also evolves
   *  (slides through the noise's 3rd axis) once per `evolveH` game hours [game calibration] */
  windMs: 12, evolveH: 6,
  /** cloud shadows on the terrain: ONE noise lookup (the cloud field's base octave: one 3D value-noise sample) where the
   *  sun ray leaves the shell; on while the tier draws at least `shadowMinOct` cloud octaves (off at Low / Minimum).
   *  Cuts this share of the direct sun under full cover [game calibration] */
  shadow: .6, shadowMinOct: 3 };

// loop caps = the largest counts in the tables: ANGLE (D3D) unrolls loops to their cap, so a loose cap means a slow first
// compile (a long main-thread frame at startup), not just dead iterations
const MAX_N = Math.max(...ATMOS_STEPS.map(r => Math.max(r[0], r[2]))), MAX_L = Math.max(...ATMOS_STEPS.map(r => Math.max(r[1], r[3])));
const GLSL = /* glsl */`
const float ATM_AERIAL = ${ATMOS.aerial.toFixed(3)}; // in-scatter in the terrain's light units: ~ sun light (3.2) / sunI (22), so haze vs lit ground matches a real sky/ground ratio [reference calibration: Blue Marble land/ocean contrast]
uniform vec3 uCentre; uniform vec3 uSun; uniform float uRp, uRa, uSunI; uniform vec4 uSteps; // ray-march samples: sky, sky light, terrain, terrain light (governor tier)
uniform mat3 uViewToWorld; uniform float uCloudOct, uCloudSeed, uCloudEvolve; uniform vec2 uCloudSpin; // spin = (cos, sin) of the drift angle
uniform float uCloudClear; // 0 = the field as calibrated .. 1 = no clouds (cover and shadows fade; in-page descent, T-0034/T-0041)
uniform vec3 uCloudEdge; // threshold centre, half width (governor tier), pixel angle (rad per px: octave fade by distance)
const vec3 BR = vec3(${ATMOS.rayleigh.map(v => v.toExponential(4)).join(', ')});
const float BM = ${ATMOS.mie.toExponential(4)}, BME = ${(ATMOS.mie * ATMOS.mieExt).toExponential(4)}, HR = ${ATMOS.rayleighH.toFixed(2)}, HM = ${ATMOS.mieH.toFixed(2)}, MG = ${ATMOS.mieG.toFixed(3)};
vec2 atmRsi(vec3 ro, vec3 rd, float r) { vec3 oc = ro - uCentre; float b = dot(oc, rd), c = dot(oc, oc) - r * r, d = b * b - c; if (d < 0.0) return vec2(1e9, -1e9); d = sqrt(d); return vec2(-b - d, -b + d); }
vec2 atmDensity(vec3 x) { float h = max(length(x - uCentre) - uRp, 0.0); return vec2(exp(-h / HR), exp(-h / HM)); }
// optical depth (Rayleigh, Mie) from x toward the sun; < 0 when the planet blocks the sun
vec2 atmSunDepth(vec3 x, int n) {
  vec2 g = atmRsi(x, uSun, uRp - 0.5); if (g.x > 0.0 && g.x < g.y) return vec2(-1.0);
  float L = atmRsi(x, uSun, uRa).y, ds = L / float(n); vec2 od = vec2(0.0);
  for (int j = 0; j < ${MAX_L}; j++) { if (j >= n) break; od += atmDensity(x + uSun * ds * (float(j) + 0.5)) * ds; }
  return od;
}
// in-scattered light along the ray (camera at the origin, km) up to tEnd; trans = transmittance over the same segment
vec3 atmScatter(vec3 rd, float tEnd, int n, int nl, out vec3 trans) {
  trans = vec3(1.0); vec2 p = atmRsi(vec3(0.0), rd, uRa); float t0 = max(p.x, 0.0), t1 = min(p.y, tEnd);
  if (p.x > p.y || t1 <= t0) return vec3(0.0);
  float ds = (t1 - t0) / float(n), mu = dot(rd, uSun), gg = MG * MG;
  float pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu), pM = 3.0 / (8.0 * PI) * ((1.0 - gg) * (1.0 + mu * mu)) / (pow(1.0 + gg - 2.0 * mu * MG, 1.5) * (2.0 + gg));
  vec2 od = vec2(0.0); vec3 sR = vec3(0.0), sM = vec3(0.0);
  for (int i = 0; i < ${MAX_N}; i++) { if (i >= n) break;
    vec3 x = rd * (t0 + ds * (float(i) + 0.5)); vec2 d = atmDensity(x) * ds; od += d;
    vec2 l = atmSunDepth(x, nl); if (l.x < 0.0) continue;
    vec3 att = exp(-(BR * (od.x + l.x) + BME * (od.y + l.y))); sR += d.x * att; sM += d.y * att;
  }
  trans = exp(-(BR * od.x + BME * od.y));
  return uSunI * (pR * BR * sR + pM * BM * sM);
}
// sunlight colour reaching x (transmittance), 0 in the planet's shadow
vec3 atmSunlight(vec3 x, int nl) { vec2 l = atmSunDepth(x, nl); return l.x < 0.0 ? vec3(0.0) : exp(-(BR * l.x + BME * l.y)); }
${GLSL_NOISE}
// 3D value noise from two seeded 2D slices of the shared vnoiseU (proc/glsl), so the clouds have no seams on the sphere.
// vnoiseU, not vnoise: the fract(sin) hash gave dotted lines / specks along lattice planes in the clouds and their shadows
// (the base octave's x = 0 plane is the +z face's centre tile line: the "crack" seen from orbit and at 40 km)
float cloudSlice3(vec3 p) { float z = floor(p.z), f = p.z - z; f = f * f * (3.0 - 2.0 * f);
  return mix(vnoiseU(p.xy + z * vec2(37.0, 17.0), uCloudSeed), vnoiseU(p.xy + (z + 1.0) * vec2(37.0, 17.0), uCloudSeed), f); }
float cloudDensity(vec3 dir, float oct, float c, float hw) { // dir: planet-fixed unit direction; oct: octaves (tier and distance, fractional = fade); c, hw: threshold
  dir = vec3(uCloudSpin.x * dir.x - uCloudSpin.y * dir.z, dir.y, uCloudSpin.y * dir.x + uCloudSpin.x * dir.z); // drift about the polar (+y) axis
  vec3 p = dir * (${(6371 / CLOUDS.cellKm).toFixed(3)}); float v = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < ${CLOUDS.octaves[0]}; i++) { float w = clamp(oct - float(i), 0.0, 1.0); if (w <= 0.0) break;
    v += a * w * cloudSlice3(p + vec3(0.0, 0.0, uCloudEvolve)); n += a * w; p = p * 2.07 + 11.3; a *= ${CLOUDS.persistence.toFixed(3)}; }
  return smoothstep(c - hw, c + hw, v / max(n, 1e-3));
}
// the cloud shell along a view ray (camera at the origin, km) before tEnd: rgb = lit cloud (terrain light units), a = cover
vec4 atmClouds(vec3 rd, float tEnd, int nl) {
  if (uCloudOct < 0.5) return vec4(0.0);
  vec2 g = atmRsi(vec3(0.0), rd, uRp + ${CLOUDS.heightKm.toFixed(2)}); float t = g.x > 0.0 ? g.x : g.y;
  if (g.x > g.y || t <= 0.0 || t > tEnd) return vec4(0.0);
  // octaves whose cells are under ~2 px at this distance fade out (octave i: cell ${CLOUDS.cellKm} km / 2.07^i)
  float octD = 1.0 + log2(${CLOUDS.cellKm.toFixed(1)} / max(2.0 * t * uCloudEdge.z, 1e-6)) / log2(2.07);
  vec3 x = rd * t, n = normalize(x - uCentre); float a = cloudDensity(normalize(uViewToWorld * n), clamp(octD, 1.0, uCloudOct), uCloudEdge.x, uCloudEdge.y);
  if (a <= 0.0) return vec4(0.0);
  vec3 sunT = atmSunlight(x, nl); float lam = max(dot(n, uSun), 0.0);
  return vec4(${CLOUDS.albedo.toFixed(2)} * (sunT * (0.25 + 0.75 * lam) * 1.12 + 0.08), a * 0.9 * (1.0 - uCloudClear));
}
`;

export interface Atmosphere { dome: THREE.Mesh; uniforms: Record<string, THREE.IUniform>; readonly tier: number; update(camera: THREE.Camera, camPos: THREE.Vector3, sunDir: THREE.Vector3, timeSec?: number, viewH?: number): void; patch(m: THREE.Material): void; setTier(tier: number): void; setClear(k: number): void }
const stepsFor = (tier: number) => ATMOS_STEPS[Math.max(0, Math.min(ATMOS_STEPS.length - 1, tier))];

/** Sky shell + aerial-perspective patcher for a planet of radius `R` metres (centre at the world origin). */
export function createAtmosphere(R: number, tier = 0, seed = 0): Atmosphere {
  let [sn, sl, tn, tl] = stepsFor(tier), cur = tier;
  const Rp = R / 1000, Ra = Rp + ATMOS.heightKm;
  const uniforms = { uCentre: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uRp: { value: Rp }, uRa: { value: Ra }, uSunI: { value: ATMOS.sunI }, uSteps: { value: new THREE.Vector4() }, uViewToWorld: { value: new THREE.Matrix3() }, uCloudOct: { value: 0 }, uCloudSeed: { value: (seed % 997) * .173 }, uCloudSpin: { value: new THREE.Vector2(1, 0) }, uCloudEvolve: { value: 0 }, uCloudEdge: { value: new THREE.Vector3(.6, .05, 1e-3) }, uCloudClear: { value: 0 } };
  const setSteps = () => { uniforms.uSteps.value.set(sn, sl, tn, tl); const row = Math.max(0, Math.min(CLOUDS.octaves.length - 1, cur)); uniforms.uCloudOct.value = CLOUDS.octaves[row]; uniforms.uCloudEdge.value.x = CLOUDS.edgeCentre[row]; uniforms.uCloudEdge.value.y = CLOUDS.edgeHalf[row]; }; setSteps();
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: LOG_DEPTH_PREFIX + /* glsl */`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vView;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: '' });
  const domeFrag = () => /* glsl */`#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL}
varying vec3 vView;
void main() {
#include <logdepthbuf_fragment>
  vec3 rd = normalize(vView), tr; vec2 g = atmRsi(vec3(0.0), rd, uRp - 0.3); if (g.x > 0.0 && g.x < g.y) discard; float tEnd = 1e9; // rays that reach the ground are the tiles' job (aerial perspective)
  vec3 c = atmScatter(rd, tEnd, int(uSteps.x), int(uSteps.y), tr);
  if (tEnd > 1e8) c += tr * smoothstep(0.99996, 0.99999, dot(rd, uSun)) * 40.0; // sun disc (0.53°), reddened by its path
  { vec4 cl = atmClouds(rd, tEnd, int(uSteps.y)); c = mix(c, cl.rgb, cl.a); }
  gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
  mat.fragmentShader = LOG_DEPTH_PREFIX + domeFrag(); mat.uniforms.uGlobeLogDepthFC = LOG_DEPTH.uniform; // per-material log depth (logDepth.ts)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(Ra * 1000, 96, 48), mat); dome.frustumCulled = false; dome.renderOrder = 1; dome.matrixAutoUpdate = false;
  const centre = new THREE.Vector3(), sunV = new THREE.Vector3();
  return {
    dome, uniforms, get tier() { return cur; },
    /** Governor tier changed: new ray-march sample counts. Uniforms only (loops break at the count), so no shader
     *  recompile and no hitch when the governor moves. */
    /** 0..1: open the cloud deck (the cover and its shadows fade out evenly; T-0041, was a threshold switch). Uniform only. */
    setClear(k) { uniforms.uCloudClear.value = k; },
    setTier(t) { if (t === cur) return; cur = t; [sn, sl, tn, tl] = stepsFor(t); setSteps(); },
    /** Per frame, after the camera is placed (camera-relative: camera renders from the origin, `camPos` is its double
     *  world position): planet centre and sun in view space, km. */
    update(camera, camPos, sunDir, timeSec = 0, viewH = 900) {
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 45; uniforms.uCloudEdge.value.z = 2 * Math.tan(fov * Math.PI / 360) / Math.max(1, viewH); // rad per pixel (cloud octave fade)
      // cloud drift: angle and evolution reduced in double precision on the CPU (the GPU only sees small numbers)
      const ang = (timeSec * CLOUDS.windMs / R) % (2 * Math.PI); uniforms.uCloudSpin.value.set(Math.cos(ang), Math.sin(ang));
      uniforms.uCloudEvolve.value = (timeSec / (CLOUDS.evolveH * 3600)) % 256;
      centre.copy(camPos).negate(); dome.position.copy(centre); dome.updateMatrix(); // camera-relative: the shell sits at −camera
      const rot = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
      uniforms.uCentre.value.copy(centre).applyMatrix4(rot).multiplyScalar(1e-3);
      uniforms.uSun.value.copy(sunV.copy(sunDir).normalize()).applyMatrix4(rot).normalize();
      uniforms.uViewToWorld.value.setFromMatrix4(camera.matrixWorld); // view-space direction → planet-fixed (camera rotation)
    },
    /** Chain aerial perspective into a lit material (keeps its own onBeforeCompile). */
    patch(m) {
      const prev = m.onBeforeCompile.bind(m);
      m.onBeforeCompile = (sh, r) => {
        prev(sh, r); Object.assign(sh.uniforms, uniforms);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL}`)
          
          .replace('#include <opaque_fragment>', `if (uSteps.z > 0.5) { vec3 fp = -vViewPosition * 1e-3, tr; float d = length(fp); vec3 rd = fp / max(d, 1e-6);
    // only the DIRECT sun is reddened (sunset) / cut (planet shadow) on its way to the fragment (x1.12 = noon
    // transmittance^-1); sky (hemisphere) light stays, so ground facing away from a low sun is lit by the sky, not black
    float cs = 1.0; if (uCloudOct > ${CLOUDS.shadowMinOct - .5}) { vec3 nU = normalize(fp - uCentre); float mu = dot(nU, uSun); // cloud shadow: one cloud-field lookup up the sun ray
      if (mu > 0.02) cs = 1.0 - ${CLOUDS.shadow.toFixed(2)} * (1.0 - uCloudClear) * cloudDensity(normalize(uViewToWorld * normalize(fp + uSun * (${CLOUDS.heightKm.toFixed(2)} / mu) - uCentre)), 1.0, ${CLOUDS.shadowCentre.toFixed(3)}, ${CLOUDS.shadowHalf.toFixed(3)}); }
    outgoingLight = (reflectedLight.directDiffuse + reflectedLight.directSpecular) * (1.12 * cs) * atmSunlight(fp, int(uSteps.w)) + reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular + totalEmissiveRadiance;
    vec3 ins = atmScatter(rd, d, int(uSteps.z), int(uSteps.w), tr); outgoingLight = outgoingLight * tr + ins * ATM_AERIAL;
    vec4 cl = atmClouds(rd, d, int(uSteps.w)); outgoingLight = mix(outgoingLight, cl.rgb * tr + ins * ATM_AERIAL, cl.a); } // clouds between camera and ground
#include <opaque_fragment>`);
      };
      m.needsUpdate = true;
    },
  };
}
