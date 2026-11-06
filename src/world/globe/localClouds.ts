/**
 * Local volumetric clouds around the camera (grokbot-1, T-0073). Matt: the sim grid is fine; render only the region the camera
 * is in as stacked vertical layers. One sim cell's column (core/atmo/cloudColumn: temperature, humidity, dew point, LCL,
 * buoyant top, layer saturation) is baked into a small R8 Data3DTexture over a box around the camera's ground point, broken
 * into cells horizontally by value noise thresholded at the sim's cloud fraction, and ray-marched. Ray-march structure from
 * three.js examples/webgl_volume_cloud (MIT), written here for this box. WebGL2 (three WebGLRenderer, 3D textures); a WebGPU
 * path can reuse the same baked texture. Beyond the box (and from orbit) the existing cheap shell (atmosphere.ts) draws.
 * Budget: 64 x 64 x 48 bytes = 192 KB VRAM, rebaked only when the camera moves a quarter box or the column changes.
 */
import * as THREE from 'three';
import { cloudColumn, iceOpacity, type Column } from '../../core/atmo/cloudColumn';
import { hash, random } from '../../proc/rng';
import { toLatLon, type Vec3 } from './planet';
import CC from '../../../data/earth/cloud-column.json';

export const LOCAL_CLOUDS = { sizeM: 32000, topM: 12000, nx: 64, nz: 48, showBelowM: 40000, rebakeFrac: .25, cellM: 2500, steps: 96, waterFull: CC.qc_auto_kg_kg as number }; // full bake byte = Kessler qc0 (suspended convective condensate after #329), not the old 1.5e-3 adiabatic-ish scale
/** 0 at showBelowM, 1 at sizeM. The box and the flat shell crossfade across that span instead of swapping in one frame. */
export function localCloudFade(alt: number, L = LOCAL_CLOUDS) {
  const span = L.showBelowM - L.sizeM;
  const u = span <= 0 ? (alt < L.showBelowM ? 1 : 0) : (L.showBelowM - alt) / span;
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}
/** Issue #202: the in-page band (bandTop..fadeFull). The far-layer box shows where the patch has not dithered in yet (1 - patch);
 *  the overlay copy drawn after the game pass covers the rest, so the summed cloud stays localCloudFade(alt) through the band. */
export function bandCloudOpacity(alt: number, patch: number, L = LOCAL_CLOUDS) {
  return localCloudFade(alt, L) * Math.min(1, Math.max(0, patch));
}
/** Issue #202: a camera-relative planet-frame matrix (the globe renders from the origin) -> game metres. basis: gameBasis at the
 *  camera (game -> planet rotation, orthonormal), camPos: the game camera. */
export function toGameFrame(basis: THREE.Matrix4, camPos: THREE.Vector3, m: THREE.Matrix4, out = new THREE.Matrix4()) {
  const r = basis.clone().transpose().setPosition(camPos); return out.multiplyMatrices(r, m);
}
/** Issue #202 (2): CPU mirror of the overlay's BAND_OCCLUDE depth: window depth (0..1, default depth range) of a box-local point. */
export function nearEdgeDepth(p: THREE.Vector3, modelView: THREE.Matrix4, proj: THREE.Matrix4) {
  const c = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(modelView).applyMatrix4(proj); return Math.min(1, Math.max(0, c.z / c.w * .5 + .5));
}
/** Issue #202 (1): after the 60 m handover the overlay box stays, frozen in game metres where it was at the handover. It holds at
 *  full strength while the player is within a quarter box of that centre and fades out by the box edge (no rebake in game mode). */
export function keptCloudFade(distM: number, L = LOCAL_CLOUDS) {
  const t = Math.min(1, Math.max(0, (distM - L.sizeM / 4) / (L.sizeM / 4))); return 1 - t * t * (3 - 2 * t);
}
/** Issue #202 (1): sine of the view elevation below which a ray from the ground reaches the cloud base (baseM above the eye) only
 *  past the box edge (edgeM away). The painted dome fills the sky below it; above it the dew-point box is the cloud. */
export function boxEdgeSin(baseM: number, edgeM: number) { const b = Math.max(1, baseM); return b / Math.hypot(b, Math.max(1, edgeM)); }
export interface ColumnInput { tsC: number; q: number; cover: number }
/** Nearest sim cell to a planet direction (planes from core/planetBudget).
 *  Live globe clouds read `weatherAtLatLon` instead. This stays for the nearest-cell check in tests/cloud-column.test.ts. */
export function columnAt(planes: { lat: ArrayLike<number>; lon: ArrayLike<number>; ts: ArrayLike<number>; q: ArrayLike<number>; cloud: ArrayLike<number> }, d: Vec3): ColumnInput | null {
  const { lat, lon } = toLatLon(d), la = lat * 180 / Math.PI, lo = lon * 180 / Math.PI; let best = -1, bd = Infinity;
  for (let i = 0; i < planes.lat.length; i++) { let dl = Math.abs(planes.lon[i] - lo) % 360; if (dl > 180) dl = 360 - dl; const k = (planes.lat[i] - la) ** 2 + (dl * Math.cos(lat)) ** 2; if (k < bd) { bd = k; best = i; } }
  return best < 0 ? null : { tsC: planes.ts[best], q: planes.q[best], cover: Math.max(0, Math.min(1, planes.cloud[best])) };
}
const vnoise2 = (salt: number) => { const L = (i: number, j: number) => random(hash(`lc:${salt}:${i}:${j}`))();
  return (x: number, y: number) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = L(i, j), b = L(i + 1, j), c = L(i, j + 1), e = L(i + 1, j + 1); return a + (b - a) * su + (c - a) * sv + (a - b - c + e) * su * sv; }; };
const n1 = vnoise2(1), n2 = vnoise2(2), n3 = vnoise2(3);
/** Bake density bytes (x fastest, then y = height, then z) for a column; ox, oz: box origin in a fixed local grid (m) so the
 *  cells stay put while the box re-centres. Two kinds of layer, both from the column's dew-point physics:
 *  - convective (parcel) cloud: fBm cells (covered share ~ cover) share one flat base at the LCL, and each cell's top rises
 *    with its strength up to the column's buoyant top; the strongest cells punch into the overshoot dome above that top;
 *  - stratiform (sheet) cloud, where the environment's RH passes the critical value: a broad, low-frequency deck that is
 *    not broken into convective cells;
 *  - anvil: a tower deep enough to glaciate spreads sideways in the ice layers just under its buoyant top. */
export function bakeLocal(col: Column, cover: number, ox: number, oz: number, L = LOCAL_CLOUDS) {
  const out = new Uint8Array(L.nx * L.nx * L.nz), dz = L.topM / L.nz, n = L.nx * L.nx, h = new Float32Array(n), sh = new Float32Array(n), cut = 1 - cover;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) { const x = (ox + (i + .5) / L.nx * L.sizeM) / L.cellM, z = (oz + (k + .5) / L.nx * L.sizeM) / L.cellM;
    const f = (n1(x, z) * .55 + n2(x * 2.1, z * 2.1) * .3 + n3(x * 4.3, z * 4.3) * .15); h[k * L.nx + i] = Math.max(0, Math.min(1, (f - (.25 + .5 * cut)) / .12)); // fBm spans ~.25-.75
    sh[k * L.nx + i] = Math.max(0, Math.min(1, (n1(x * .35, z * .35) - (.2 + .5 * cut)) / .3)); } // broad sheet: low frequency, soft edge
  const ly = col.layers, step = ly[1]?.z || 250, conv = new Float32Array(L.nz), strat = new Float32Array(L.nz), zr = new Float32Array(L.nz);
  const base = col.lcl, top = col.top >= base && base >= 0 ? col.top + step / 2 : -1;
  const over = top > base ? Math.max(0, col.overshootM) : 0, tip = top > base ? Math.min(L.topM, top + over) : -1; // Houze overshoot dome; clamp to the local box
  for (let j = 0; j < L.nz; j++) { const z = (j + .5) * dz, li = Math.min(ly.length - 1, Math.round(z / step)), l = ly[li];
    const s = l?.strat ?? 0, w = l?.water ?? 0, op = iceOpacity(l?.ice ?? 0); strat[j] = Math.min(1, s * op / L.waterFull); conv[j] = Math.min(1, Math.max(0, w - s) * op / L.waterFull); // ice is thinner per kg (#192)
    zr[j] = top > base ? (z - base) / (top - base) : 2; } // height through the convective layer, 0 at the base, 1 at the buoyant top
  // anvil (data/earth/cloud-column.json "anvil"): a tower deep enough to glaciate spreads sideways at its buoyant top, so the
  // top layers take a widened footprint of the towers that reach them (a box blur of the mature cells), not just the cores
  const anv = new Float32Array(n), an = new Float32Array(L.nz), deep = top > base && col.top - base >= CC.anvil_min_tower_m;
  if (deep) { const r = Math.max(1, Math.round(CC.anvil_spread_m / L.sizeM * L.nx)), m = new Float32Array(n);
    for (let c = 0; c < n; c++) m[c] = h[c] >= .85 ? 1 : 0; // cells whose tops reach the anvil level
    for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) { let s = 0, w = 0;
      for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const kk = k + b, ii = i + a; if (kk < 0 || ii < 0 || kk >= L.nx || ii >= L.nx || a * a + b * b > r * r) continue; s += m[kk * L.nx + ii]; w++; }
      anv[k * L.nx + i] = Math.min(1, 1.5 * s / Math.max(1, w)); }
    for (let j = 0; j < L.nz; j++) { const z = (j + .5) * dz, li = Math.min(ly.length - 1, Math.round(z / step)), d = top - z;
      an[j] = d >= 0 && d <= CC.anvil_depth_m && (ly[li]?.ice ?? 0) >= .5 ? 1 : 0; } }
  for (let k = 0; k < L.nx; k++) for (let j = 0; j < L.nz; j++) for (let i = 0; i < L.nx; i++) { const c = k * L.nx + i;
    const z = (j + .5) * dz;
    let cv = 0;
    if (zr[j] >= 0 && zr[j] <= 1) { // up to the buoyant top: strength scales cell height
      const reach = h[c] > 0 ? .35 + .65 * h[c] : 0, edge = Math.max(0, Math.min(1, (reach - zr[j]) * 6));
      cv = Math.max(h[c] * edge, an[j] * anv[c] * .6);
    } else if (tip > top && z > top && z <= tip && h[c] >= .85) { // overshooting dome: only the strongest towers (Houze 2014 ch. 8)
      const u = (z - top) / (tip - top); // 0 at anvil level, 1 at (clamped) overshoot tip
      // layers above the equilibrium level carry no suspended water in the column; paint a tapered ice plume at ~half anvil density
      const plume = (1 - u) * (1 - u) * .45;
      out[i + L.nx * (j + L.nz * k)] = Math.round(255 * Math.min(1, plume));
      continue;
    }
    out[i + L.nx * (j + L.nz * k)] = Math.round(255 * Math.min(1, conv[j] * cv + strat[j] * sh[c])); }
  return out;
}

/** Extinction per metre per unit baked density (density = byte / 255), chosen so a vertical ray through the densest cell of
 *  every level sums to the column's optical depth col.tau (Stephens 1978, from cloudColumn). The shader multiplies it by the
 *  march step in metres, so a thin stratus deck lets the sun through and a deep tower goes opaque, instead of one fixed gain. */
export function boxExtinction(col: Column, bake: Uint8Array, L = LOCAL_CLOUDS) {
  const dz = L.topM / L.nz, n = L.nx * L.nx; let path = 0;
  for (let j = 0; j < L.nz; j++) { let m = 0; for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) m = Math.max(m, bake[i + L.nx * (j + L.nz * k)]); path += m / 255 * dz; }
  return path > 0 && n > 0 ? Math.max(0, col.tau) / path : 0;
}
/** Sun transmittance toward the light from the shader's two shadow samples (summed density sh), lit by the same column optical
 *  depth: a thin deck stays bright inside, a deep tower self-shadows (Beer-Lambert). CPU mirror for tests. */
export function sunTransmittance(sh: number, ext: number, sun: [number, number, number], L = LOCAL_CLOUDS) {
  return Math.exp(-sh * ext * Math.hypot(sun[0] * L.sizeM, sun[1] * L.topM, sun[2] * L.sizeM) * .05);
}
/** Vertical transmittance exp(-tau) through one cell of a bake at extinction ext (CPU mirror of the shader, for tests). */
export function cellTransmittance(bake: Uint8Array, ext: number, i: number, k: number, L = LOCAL_CLOUDS) {
  let t = 0; for (let j = 0; j < L.nz; j++) t += bake[i + L.nx * (j + L.nz * k)] / 255 * ext * L.topM / L.nz; return Math.exp(-t);
}
/** Henyey-Greenstein phase function (1941), scaled so an isotropic scatterer is 1 (i.e. 4*pi*p_HG). Cloud droplets are strongly
 *  forward-scattering, asymmetry g about 0.85 in the visible (Hansen & Travis 1974), which brightens cloud edges seen toward the
 *  sun (the silver lining). CPU mirror of the shader's phase term. */
export const CLOUD_G = .85;
export const PHASE_CAP = 6; // [game calibration: caps the forward peak (82x at g=.85) so the sun-facing rim does not blow out]
export function hgPhase(cosT: number, g = CLOUD_G) { const d = 1 + g * g - 2 * g * cosT; return (1 - g * g) / (d * Math.sqrt(d)); }
export function cloudPhase(cosT: number, g = CLOUD_G) { return Math.min(PHASE_CAP, hgPhase(cosT, g)); }
/** Multiple scattering by octaves (Wrenninge 2013; Hillaire 2016, Frostbite): octave n has energy a^n, sees optical depth b^n*tau
 *  and phase asymmetry c^n*g, so light that scattered many times still reaches deep cloud and spreads wider. a=b=c=0.5, 3 octaves.
 *  Without it a thick cloud's sun-shadowed core goes black instead of the grey seen from below. CPU mirror of the shader's sun term. */
export const MS_OCTAVES = 3, MS_A = .5, MS_B = .5, MS_C = .5;
export function multiScatterSun(tau: number, cosT: number, g = CLOUD_G) {
  let s = 0, a = 1, b = 1, c = 1; for (let n = 0; n < MS_OCTAVES; n++) { s += a * Math.exp(-b * tau) * cloudPhase(cosT, c * g); a *= MS_A; b *= MS_B; c *= MS_C; } return s; }
/** Skylight (ambient) reaching a point inside the cloud, from the optical depth of cloud above it. Diffuse sky light is
 *  isotropic, so it takes the same octaves without a phase term, normalised so clear sky above gives SKY_AMB. Cloud tops stay
 *  bright and bases under a deep tower go darker grey, as seen from below, instead of one flat ambient everywhere. CPU mirror. */
export const SKY_AMB = .25; // [game calibration: ambient level of the old flat term, now the clear-sky value]
export function skyAmbient(tauUp: number) {
  let s = 0, n0 = 0, a = 1, b = 1; for (let n = 0; n < MS_OCTAVES; n++) { s += a * Math.exp(-b * Math.max(0, tauUp)); n0 += a; a *= MS_A; b *= MS_B; } return SKY_AMB * s / n0; }
/** Colour of direct sunlight after the air path to the cloud: Rayleigh extinction of a sea-level column (beta * H, H = 8 km,
 *  beta = 5.8, 13.5, 33.1 per 1e6 m for 680, 550, 440 nm, Bruneton & Neyret 2008) times the Kasten-Young (1989) air mass,
 *  normalised to the overhead sun so noon stays white. A low sun loses its blue first, so cloud tops go gold, then red at
 *  sunset, from the physics of the air path instead of a painted tint. CPU only: set as the uSunCol uniform. */
export const RAYLEIGH_TAU = [5.8e-6 * 8000, 13.5e-6 * 8000, 33.1e-6 * 8000] as const;
export function airMass(cosZ: number) { const c = Math.max(0, Math.min(1, cosZ)), zd = Math.acos(c) * 180 / Math.PI; return 1 / (c + .50572 * Math.pow(96.07995 - zd, -1.6364)); }
export function sunTint(cosZ: number): [number, number, number] { const m = airMass(cosZ) - 1; return RAYLEIGH_TAU.map(t => Math.exp(-t * m)) as [number, number, number]; }
/** The planet's shadow on the cloud. A point zM above the ground sees the sun until it sinks past the geometric horizon dip
 *  acos(R / (R + z)) ~ sqrt(2 z / R), so after sunset a tower's top stays lit (pink) after its base goes dark, and at night the
 *  direct term is 0 instead of the old floor that kept lighting clouds from below the horizon. Softened over the sun's disc
 *  (0.53 deg wide). mu: sine of the sun's elevation at the ground. CPU mirror of the shader's sunVis. */
export const SUN_HALF = .265 * Math.PI / 180;
export function sunVisible(mu: number, zM: number, R = 6.371e6) {
  const dip = Math.sqrt(2 * Math.max(0, zM) / R), e = Math.asin(Math.max(-1, Math.min(1, mu))), t = Math.min(1, Math.max(0, (e + dip + SUN_HALF) / (2 * SUN_HALF)));
  return t * t * (3 - 2 * t); }
/** Skylight level relative to the day value: 1 with the sun up, then Schaefer's 0.4 dex per degree of depression (core/skyVisibility
 *  twilightIlluminance: ~960 lx at sunset, 3.4 lx at -6 deg), floored at -30 deg like the globe's atmSkyF, so night clouds go dark. */
export function skyLevel(mu: number) { const h = Math.asin(Math.max(-1, Math.min(1, mu))) * 180 / Math.PI; return h >= 0 ? 1 : Math.pow(10, .4 * Math.max(h, -30)); }
/** Aerial perspective on the layered clouds. Air between the eye and the cloud's near edge scatters light out of the view ray
 *  (Rayleigh, 550 nm: beta = 13.5e-6 /m at sea level, scale height 8 km, Bruneton & Neyret 2008), so the cloud is blended toward
 *  the sky behind it by that transmittance: distant towers fade into the horizon sky instead of standing sharp at 30 km.
 *  Density is taken at the mean height of the two ends. CPU mirror of the shader's airT. */
/** Light reflected off the ground onto the cloud from below. The ground returns albedo * mu of the sun's irradiance (Lambert), and
 *  that upwelling light reaches a point through the cloud below it, with the same octaves as the skylight. So bases over fresh
 *  snow glow while bases over dark summer forest stay grey. Albedo from the surface temperature: snow-free boreal forest ~0.12,
 *  snow-covered boreal forest ~0.45 with open snow showing between crowns (Betts & Ball 1997, JGR 102:28901), ramped over
 *  -2..+2 C. CPU mirror of the shader's bounce term (uAlb). */
export const ALB_FOREST = .12, ALB_SNOW = .45;
export function groundAlbedo(tsC: number) { const t = Math.max(0, Math.min(1, (tsC + 2) / 4)); return ALB_SNOW + (ALB_FOREST - ALB_SNOW) * t; }
export function groundBounce(albedo: number, mu: number, tauDown: number) { return albedo * Math.max(0, mu) * skyAmbient(tauDown) / SKY_AMB; }
export const AIR_BETA = 13.5e-6, AIR_H = 8000;
export function airTransmittance(distM: number, z0M: number, z1M: number) { const zm = .5 * (Math.max(0, z0M) + Math.max(0, z1M)); return Math.exp(-AIR_BETA * Math.max(0, distM) * Math.exp(-zm / AIR_H)); }

const VERT = `out vec3 vOrigin; out vec3 vDir; uniform vec3 uCamLocal;
void main() { vOrigin = uCamLocal; vDir = position - uCamLocal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const LOCAL_CLOUDS_FRAG = `precision highp float; precision highp sampler3D; in vec3 vOrigin; in vec3 vDir; out vec4 outColor;
uniform sampler3D uVol; uniform vec3 uSunLocal; uniform float uSteps; uniform float uOpacity; uniform vec3 uBoxM; uniform float uExt; uniform vec3 uSunCol; uniform float uSunMu; uniform float uSkyF; uniform float uGroundR; uniform float uAlb;
const float G = 0.85, PHASE_CAP = 6.0; /* Henyey-Greenstein asymmetry of cloud droplets, cap: see cloudPhase */
float hgp(float ct, float g) { float hd = 1.0 + g * g - 2.0 * g * ct; return min(PHASE_CAP, (1.0 - g * g) / (hd * sqrt(hd))); }
float msSun(float tau, float ct) { float s = 0.0, a = 1.0, b = 1.0, c = 1.0; for (int n = 0; n < 3; n++) { s += a * exp(-b * tau) * hgp(ct, c * G); a *= 0.5; b *= 0.5; c *= 0.5; } return s; } /* multiple scattering by octaves: see multiScatterSun */
float skyAmb(float tau) { float s = 0.0, a = 1.0, b = 1.0; for (int n = 0; n < 3; n++) { s += a * exp(-b * tau); a *= 0.5; b *= 0.5; } return 0.25 * s / 1.75; } /* skylight under cloud above: see skyAmbient */
float sunVis(float zM) { float dip = sqrt(2.0 * max(zM, 0.0) / uGroundR), e = asin(clamp(uSunMu, -1.0, 1.0)); return smoothstep(-dip - 0.004625, -dip + 0.004625, e); } /* planet's shadow: see sunVisible */
float airT(vec3 a, vec3 b) { float zm = 0.5 * (max((a.y + 0.5) * uBoxM.y, 0.0) + max((b.y + 0.5) * uBoxM.y, 0.0)); return exp(-13.5e-6 * length((b - a) * uBoxM) * exp(-zm / 8000.0)); } /* aerial perspective: see airTransmittance */
#ifdef BAND_OCCLUDE
uniform mat4 modelViewMatrix, projectionMatrix;
#endif
vec2 hitBox(vec3 o, vec3 d) { vec3 bmin = vec3(-.5), bmax = vec3(.5), ti = 1.0 / d, t0 = (bmin - o) * ti, t1 = (bmax - o) * ti, tmin = min(t0, t1), tmax = max(t0, t1);
  return vec2(max(tmin.x, max(tmin.y, tmin.z)), min(tmax.x, min(tmax.y, tmax.z))); }
float dens(vec3 p) { return texture(uVol, p + .5).r; }
void main() { vec3 rd = normalize(vDir); vec2 b = hitBox(vOrigin, rd); if (b.x > b.y) discard; b.x = max(b.x, 0.0);
  float dt = (b.y - b.x) / uSteps, dm = length(rd * uBoxM) * dt, sm = length(uSunLocal * uBoxM) * .05; /* each of the two sun samples stands for 0.05 box units of path, in metres */ float ct = dot(normalize(rd * uBoxM), normalize(uSunLocal * uBoxM)); /* cosine between view ray and sun, for the droplet phase function */ vec3 p = vOrigin + rd * b.x; vec4 acc = vec4(0.0); vec3 first = vec3(0.0); bool hit = false;
  for (float i = 0.0; i < 256.0; i++) { if (i >= uSteps || acc.a > .97) break;
    float d = dens(p); if (d > .01) { if (!hit) { hit = true; first = p; } float sh = dens(p + uSunLocal * .03) + dens(p + uSunLocal * .07); float up = dens(p + vec3(0.0, .03, 0.0)) + dens(p + vec3(0.0, .07, 0.0)); vec3 lit = uSunCol * (msSun(sh * uExt * sm, ct) * max(uSunLocal.y + .25, .15) * sunVis((p.y + .5) * uBoxM.y)) + uSkyF * skyAmb(up * uExt * uBoxM.y * .05) + uSunCol * (uAlb * max(uSunMu, 0.0) * skyAmb((dens(p - vec3(0.0, .03, 0.0)) + dens(p - vec3(0.0, .07, 0.0))) * uExt * uBoxM.y * .05) * 4.0); /* ground bounce from below: see groundBounce (skyAmb is SKY_AMB-scaled, so x4) */ /* skylight through the cloud above, same two-sample path as the sun */
      float a = 1.0 - exp(-d * uExt * dm); /* optical depth of this step: extinction (1/m) times the step in metres */ acc.rgb += (1.0 - acc.a) * a * lit; /* sun term tinted by the air path (sunTint), skylight stays neutral */ acc.a += (1.0 - acc.a) * a; }
    p += rd * dt; }
  if (acc.a < .01) discard;
#ifdef BAND_OCCLUDE
  vec4 c = projectionMatrix * (modelViewMatrix * vec4(first, 1.0)); gl_FragDepth = clamp(c.z / c.w * .5 + .5, 0.0, 1.0); // issue #202: depth of the cloud's near edge, so ground in front culls it
#endif
  outColor = vec4(acc.rgb / max(acc.a, 1e-3), acc.a * uOpacity * airT(vOrigin, first)); } /* air in front of the cloud lets the sky behind show through */`;

export interface LocalClouds { mesh: THREE.Mesh; /** issue #202: the same box for the game pass in the band (shared volume, own opacity); placed by inpage */ overlay: THREE.Mesh; update(camPos: ArrayLike<number>, groundR: number, alt: number, sunDir: THREE.Vector3, input: ColumnInput | null, groundM?: number): void; column(): Column | null }
/** The local box. The mesh is placed camera-relative (the globe renders from the origin, globeView renderTo). */
export function createLocalClouds(L = LOCAL_CLOUDS): LocalClouds {
  const tex = new THREE.Data3DTexture(new Uint8Array(L.nx * L.nx * L.nz), L.nx, L.nz, L.nx); tex.format = THREE.RedFormat; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1; tex.needsUpdate = true;
  const uniforms = { uVol: { value: tex }, uCamLocal: { value: new THREE.Vector3() }, uSunLocal: { value: new THREE.Vector3(0, 1, 0) }, uSteps: { value: L.steps }, uOpacity: { value: 1 }, uBoxM: { value: new THREE.Vector3(L.sizeM, L.topM, L.sizeM) }, uExt: { value: 0 }, uSunCol: { value: new THREE.Vector3(1, 1, 1) }, uSunMu: { value: 1 }, uSkyF: { value: 1 }, uGroundR: { value: 6.371e6 }, uAlb: { value: ALB_FOREST } };
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; in vec3 position;\n' + VERT, fragmentShader: LOCAL_CLOUDS_FRAG, uniforms, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
  const omat = mat.clone(); omat.uniforms = { ...uniforms, uOpacity: { value: 0 }, uCamLocal: { value: new THREE.Vector3() } }; // shared volume and sun; own opacity and camera (game metres, set by inpage)
  // issue #202 (2): the overlay writes the depth of the cloud's near edge (BAND_OCCLUDE) and is depth-tested against the game
  // pass, so a ridge in front hides the cloud behind it while cloud in front of the ground stays. The globe copy keeps depthTest off.
  omat.defines = { BAND_OCCLUDE: 1 }; omat.depthTest = true;
  const overlay = new THREE.Mesh(mesh.geometry, omat); overlay.frustumCulled = false; overlay.renderOrder = 10; overlay.visible = false; overlay.matrixAutoUpdate = false; overlay.userData.bandClouds = true;
  const frame = new THREE.Matrix4(), inv = new THREE.Matrix4(), up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3();
  let centre: THREE.Vector3 | null = null, key = '', col: Column | null = null;
  return { mesh, overlay, column: () => col,
    update(cp, groundR, alt, sunDir, input, groundM = 0) {
      const fade = localCloudFade(alt, L); mesh.visible = !!input && fade > 0; uniforms.uOpacity.value = fade; if (!mesh.visible || !input) return;
      const cam = new THREE.Vector3(cp[0], cp[1], cp[2]); up.copy(cam).normalize();
      const gk = Math.round(Math.max(0, groundM) / 100) * 100, k = `${input.tsC.toFixed(1)}:${input.q.toFixed(5)}:${input.cover.toFixed(2)}:${gk}`; // ground to 100 m: the column's pressure follows the terrain
      if (!centre || centre.distanceTo(up.clone().multiplyScalar(groundR)) > L.sizeM * L.rebakeFrac || k !== key) {
        east.set(0, 1, 0).cross(up); if (east.lengthSq() < 1e-8) east.set(1, 0, 0); east.normalize(); north.crossVectors(up, east);
        centre = up.clone().multiplyScalar(groundR); key = k; col = cloudColumn(input.tsC, input.q, input.cover, L.topM, undefined, gk);
        const { lat, lon } = toLatLon([up.x, up.y, up.z]), R = groundR, ox = lon * R * Math.cos(lat) - L.sizeM / 2, oz = lat * R - L.sizeM / 2; // fixed lat/lon metre grid
        const bk = bakeLocal(col, input.cover, ox, oz, L); tex.image.data = bk; tex.needsUpdate = true; uniforms.uExt.value = boxExtinction(col, bk, L);
        frame.makeBasis(east.clone().multiplyScalar(L.sizeM), up.clone().multiplyScalar(L.topM), north.clone().multiplyScalar(L.sizeM)).setPosition(centre.clone().addScaledVector(up, L.topM / 2));
        inv.copy(frame).invert();
      }
      // camera-relative placement: the scene renders from the origin
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(frame); mesh.matrix.elements[12] -= cam.x; mesh.matrix.elements[13] -= cam.y; mesh.matrix.elements[14] -= cam.z; mesh.matrixWorldNeedsUpdate = true;
      uniforms.uCamLocal.value.copy(cam).applyMatrix4(inv);
      const s = sunDir.clone().transformDirection(inv); uniforms.uSunLocal.value.copy(s); const tn = sunTint(up.dot(sunDir) / (sunDir.length() || 1)); uniforms.uSunCol.value.set(tn[0], tn[1], tn[2]);
      const mu = up.dot(sunDir) / (sunDir.length() || 1); uniforms.uSunMu.value = mu; uniforms.uSkyF.value = skyLevel(mu); uniforms.uGroundR.value = groundR; uniforms.uAlb.value = groundAlbedo(input.tsC);
    } };
}
