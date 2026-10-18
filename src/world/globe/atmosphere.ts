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

/** Earth-like constants (Nishita 1993 / Bruneton 2008 values; per km). [game calibration: sunI, mieG] */
export const ATMOS = {
  heightKm: 100, rayleigh: [5.802e-3, 13.558e-3, 33.1e-3], rayleighH: 8, mie: 3.996e-3, mieExt: 1.11, mieH: 1.2, mieG: .76, sunI: 22, aerial: .45,
};
/** Ray-march sample counts per quality row (GLOBE_LOD order): [sky primary, sky light, terrain primary, terrain light]. */
export const ATMOS_STEPS = [[16, 6, 8, 3], [14, 5, 6, 3], [12, 4, 6, 2], [10, 4, 4, 2], [8, 3, 3, 2], [6, 2, 0, 0]];

const GLSL = /* glsl */`
const float ATM_AERIAL = ${ATMOS.aerial.toFixed(3)}; // terrain haze strength vs the sky shell [game calibration: Blue Marble land/ocean contrast]
uniform vec3 uCentre; uniform vec3 uSun; uniform float uRp, uRa, uSunI;
const vec3 BR = vec3(${ATMOS.rayleigh.map(v => v.toExponential(4)).join(', ')});
const float BM = ${ATMOS.mie.toExponential(4)}, BME = ${(ATMOS.mie * ATMOS.mieExt).toExponential(4)}, HR = ${ATMOS.rayleighH.toFixed(2)}, HM = ${ATMOS.mieH.toFixed(2)}, MG = ${ATMOS.mieG.toFixed(3)};
vec2 atmRsi(vec3 ro, vec3 rd, float r) { vec3 oc = ro - uCentre; float b = dot(oc, rd), c = dot(oc, oc) - r * r, d = b * b - c; if (d < 0.0) return vec2(1e9, -1e9); d = sqrt(d); return vec2(-b - d, -b + d); }
vec2 atmDensity(vec3 x) { float h = max(length(x - uCentre) - uRp, 0.0); return vec2(exp(-h / HR), exp(-h / HM)); }
// optical depth (Rayleigh, Mie) from x toward the sun; < 0 when the planet blocks the sun
vec2 atmSunDepth(vec3 x, int n) {
  vec2 g = atmRsi(x, uSun, uRp - 0.5); if (g.x > 0.0 && g.x < g.y) return vec2(-1.0);
  float L = atmRsi(x, uSun, uRa).y, ds = L / float(n); vec2 od = vec2(0.0);
  for (int j = 0; j < n; j++) od += atmDensity(x + uSun * ds * (float(j) + 0.5)) * ds;
  return od;
}
// in-scattered light along the ray (camera at the origin, km) up to tEnd; trans = transmittance over the same segment
vec3 atmScatter(vec3 rd, float tEnd, int n, int nl, out vec3 trans) {
  trans = vec3(1.0); vec2 p = atmRsi(vec3(0.0), rd, uRa); float t0 = max(p.x, 0.0), t1 = min(p.y, tEnd);
  if (p.x > p.y || t1 <= t0) return vec3(0.0);
  float ds = (t1 - t0) / float(n), mu = dot(rd, uSun), gg = MG * MG;
  float pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu), pM = 3.0 / (8.0 * PI) * ((1.0 - gg) * (1.0 + mu * mu)) / (pow(1.0 + gg - 2.0 * mu * MG, 1.5) * (2.0 + gg));
  vec2 od = vec2(0.0); vec3 sR = vec3(0.0), sM = vec3(0.0);
  for (int i = 0; i < n; i++) {
    vec3 x = rd * (t0 + ds * (float(i) + 0.5)); vec2 d = atmDensity(x) * ds; od += d;
    vec2 l = atmSunDepth(x, nl); if (l.x < 0.0) continue;
    vec3 att = exp(-(BR * (od.x + l.x) + BME * (od.y + l.y))); sR += d.x * att; sM += d.y * att;
  }
  trans = exp(-(BR * od.x + BME * od.y));
  return uSunI * (pR * BR * sR + pM * BM * sM);
}
// sunlight colour reaching x (transmittance), 0 in the planet's shadow
vec3 atmSunlight(vec3 x, int nl) { vec2 l = atmSunDepth(x, nl); return l.x < 0.0 ? vec3(0.0) : exp(-(BR * l.x + BME * l.y)); }
`;

export interface Atmosphere { dome: THREE.Mesh; uniforms: Record<string, THREE.IUniform>; readonly tier: number; update(camera: THREE.Camera, camPos: THREE.Vector3, sunDir: THREE.Vector3): void; patch(m: THREE.Material): void; setTier(tier: number): void }
const stepsFor = (tier: number) => ATMOS_STEPS[Math.max(0, Math.min(ATMOS_STEPS.length - 1, tier))];

/** Sky shell + aerial-perspective patcher for a planet of radius `R` metres (centre at the world origin). */
export function createAtmosphere(R: number, tier = 0): Atmosphere {
  let [sn, sl, tn, tl] = stepsFor(tier), cur = tier; const patched: THREE.Material[] = [];
  const Rp = R / 1000, Ra = Rp + ATMOS.heightKm;
  const uniforms = { uCentre: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uRp: { value: Rp }, uRa: { value: Ra }, uSunI: { value: ATMOS.sunI } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`#include <common>
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
  vec3 rd = normalize(vView), tr; vec2 g = atmRsi(vec3(0.0), rd, uRp); if (g.x > 0.0 && g.x < g.y) discard; float tEnd = 1e9; // rays that reach the ground are the tiles' job (aerial perspective)
  vec3 c = atmScatter(rd, tEnd, ${sn}, ${sl}, tr);
  if (tEnd > 1e8) c += tr * smoothstep(0.99996, 0.99999, dot(rd, uSun)) * 40.0; // sun disc (0.53°), reddened by its path
  gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
  mat.fragmentShader = domeFrag();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(Ra * 1000, 96, 48), mat); dome.frustumCulled = false; dome.renderOrder = 1; dome.matrixAutoUpdate = false;
  const centre = new THREE.Vector3(), sunV = new THREE.Vector3();
  return {
    dome, uniforms, get tier() { return cur; },
    /** Governor tier changed: new ray-march sample counts (recompiles the sky shell and the patched materials once). */
    setTier(t) {
      if (t === cur) return; cur = t; [sn, sl, tn, tl] = stepsFor(t);
      mat.fragmentShader = domeFrag(); mat.needsUpdate = true;
      for (const m of patched) m.needsUpdate = true;
    },
    /** Per frame, after the camera is placed (camera-relative: camera renders from the origin, `camPos` is its double
     *  world position): planet centre and sun in view space, km. */
    update(camera, camPos, sunDir) {
      centre.copy(camPos).negate(); dome.position.copy(centre); dome.updateMatrix(); // camera-relative: the shell sits at −camera
      const rot = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
      uniforms.uCentre.value.copy(centre).applyMatrix4(rot).multiplyScalar(1e-3);
      uniforms.uSun.value.copy(sunV.copy(sunDir).normalize()).applyMatrix4(rot).normalize();
    },
    /** Chain aerial perspective into a lit material (keeps its own onBeforeCompile). */
    patch(m) {
      const prev = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m); patched.push(m);
      m.customProgramCacheKey = () => `${key()}|atm${tn},${tl}`; // one program per sample-count row
      m.onBeforeCompile = (sh, r) => {
        prev(sh, r); if (!tn) return; Object.assign(sh.uniforms, uniforms);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL}`)
          .replace('#include <opaque_fragment>', `{ vec3 fp = -vViewPosition * 1e-3, tr; float d = length(fp); vec3 rd = fp / max(d, 1e-6);
    // only the DIRECT sun is reddened (sunset) / cut (planet shadow) on its way to the fragment (x1.12 = noon
    // transmittance^-1); sky (hemisphere) light stays, so ground facing away from a low sun is lit by the sky, not black
    outgoingLight = (reflectedLight.directDiffuse + reflectedLight.directSpecular) * 1.12 * atmSunlight(fp, ${tl}) + reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular + totalEmissiveRadiance;
    vec3 ins = atmScatter(rd, d, ${tn}, ${tl}, tr); outgoingLight = outgoingLight * tr + ins * ATM_AERIAL; }
#include <opaque_fragment>`);
      };
      m.needsUpdate = true;
    },
  };
}
