/**
 * Full-disc land, ice and (when the shell is off) cloud, one filtered equirectangular.
 *
 * From 23,572 km (film arrival, 3.7 Earth radii) a Minimum tile is level 1 with 16 segments:
 * about 310 km between vertices. Ice and the zoom-0 DEM then draw as axis-aligned rectangles,
 * and the continents are those same vertices blended. The map samples the bilinear DEM and
 * `surfaceColour` once per texel (1024×512: about 0.8 px on that disc) and the GPU filters it.
 * Tiers that already ray-march `cloudDensity` do not also composite the baked deck.
 */
import * as THREE from 'three';
import { hash2u } from '../../proc/rng';
import { smoothstep } from '../../proc/math';
import { coarseMetresLinear } from './coarseRelief';
import { GLOBE_COLOURS, fromLatLon, surfaceColour, type Surface } from './planet';
import { LAYER_LOOK } from './planetLayers';

/** 1024×512. At 3.7 R the disc is ~400 px across a hemisphere, so a texel is under a pixel. */
export const ORBIT_MAP = { width: 1024, height: 512 };
/**
 * The quadtree is finer than a texel below ~700 km (level 4, ~40 km vertices). Full weight
 * by 2,500 km. The arrival orbit is 3.7 R, about 23,572 km.
 */
export const ORBIT_FADE = { offM: 700_000, fullM: 2_500_000 };
/** Same white the shell uses (CLOUDS.albedo). Kept here so this module does not import the atmosphere. */
export const ORBIT_CLOUD_ALBEDO = 0.95;

const EMPTY_RGBA = new THREE.DataTexture(new Uint8Array(4), 1, 1);
const EMPTY_R = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
EMPTY_RGBA.needsUpdate = true;
EMPTY_R.needsUpdate = true;
/**
 * Orbit ocean, linear, chosen so ACES on a sunlit pixel lands near the Apollo 17 sea
 * (AS17-148-22727: saturated blue, not the midnight #030b1e of the close-up water).
 * Land lift brings the boreal albedo up into the same exposure. Ice (already bright) is not lifted.
 */
export const ORBIT_OCEAN = [0.015, 0.07, 0.32] as const;
export const ORBIT_LAND_LIFT = 3.2;
const RAD2DEG = (180 / Math.PI).toFixed(4);
/** uOrbit: 0..1 altitude fade. uOrbitDeck: 1 when the tier draws no cloud shell. uOrbitSun: planet-space sun. */
export const ORBIT_DRAW = {
  uOrbitTex: { value: EMPTY_RGBA as THREE.Texture },
  uOrbitCloud: { value: EMPTY_R as THREE.Texture },
  uOrbit: { value: 0 },
  uOrbitDeck: { value: 0 },
  uOrbitSun: { value: new THREE.Vector3(1, 0, 0) },
};
export const ORBIT_PARS = 'uniform sampler2D uOrbitTex, uOrbitCloud; uniform float uOrbit, uOrbitDeck; uniform vec3 uOrbitSun;\nvec3 orbitAlb;\n';
const INV_TAU = (1 / (2 * Math.PI)).toFixed(8);
const INV_PI = (1 / Math.PI).toFixed(8);
/** Fragment snippet. Runs after the layer paint and before the film era mix, so Today shows the map
 *  and the magma beats keep the colour they already had (`presentW` is 0 until the present eases in).
 *  The divisors are 1/tau and 1/pi, injected so the source does not carry a second copy of those constants. */
export const ORBIT_FRAG = `
  if (uOrbit > 0.001) {
    vec3 od = normalize(vDetW + uCamP);
    vec2 ouv = vec2(atan(od.z, od.x) * ${INV_TAU} + 0.5, asin(clamp(od.y, -1.0, 1.0)) * ${INV_PI} + 0.5);
    vec4 orb = texture2D(uOrbitTex, ouv);
    float pinch = smoothstep(0.55, 0.88, abs(od.y));
    vec4 poleBlur = orb
      + texture2D(uOrbitTex, ouv + vec2(0.02, 0.0)) + texture2D(uOrbitTex, ouv - vec2(0.02, 0.0))
      + texture2D(uOrbitTex, ouv + vec2(0.06, 0.0)) + texture2D(uOrbitTex, ouv - vec2(0.06, 0.0))
      + texture2D(uOrbitTex, ouv + vec2(0.12, 0.0)) + texture2D(uOrbitTex, ouv - vec2(0.12, 0.0));
    poleBlur *= 1.0 / 7.0;
    orb = mix(orb, poleBlur, pinch);
    float ow = clamp(uOrbit, 0.0, 1.0) * presentW;
    float ice = smoothstep(0.45, 0.72, max(orb.r, max(orb.g, orb.b)));
    vec3 land = mix(orb.rgb * ${ORBIT_LAND_LIFT.toFixed(2)}, min(orb.rgb, vec3(0.85)), ice);
    float absLat = abs(asin(clamp(od.y, -1.0, 1.0))) * ${RAD2DEG};
    float desert = smoothstep(14.0, 22.0, absLat) * (1.0 - smoothstep(30.0, 38.0, absLat));
    land = mix(land, vec3(0.42, 0.28, 0.14), desert * (1.0 - ice));
    vec3 ocean = vec3(${ORBIT_OCEAN.map(v => v.toFixed(3)).join(', ')});
    orbitAlb = mix(ocean, land, orb.a);
    float deck = texture2D(uOrbitCloud, ouv).r * uOrbitDeck;
    orbitAlb = mix(orbitAlb, vec3(${ORBIT_CLOUD_ALBEDO.toFixed(2)}), smoothstep(0.4, 0.62, deck));
    landMask = mix(landMask, orb.a, ow);
    diffuseColor.rgb = mix(diffuseColor.rgb, orbitAlb, ow);
  }`;
/** After the material lights. Orbit replaces them with Lambert on the geometric normal
 *  (planet space: camera-relative position + camera), so a cube face cannot cut a straight seam.
 *  Twilight is the smoothstep width. The limb feathers into a blue rim. */
export const ORBIT_LIGHT = `
{
  vec3 oN = normalize(vDetW + uCamP);
  float oMu = dot(oN, normalize(uOrbitSun));
  float oDay = smoothstep(-0.05, 0.16, oMu);
  float oNdv = clamp(dot(oN, normalize(-vDetW)), 0.0, 1.0);
  float oLimb = smoothstep(0.0, 0.07, oNdv);
  vec3 oLit = orbitAlb * oDay;
  oLit = mix(vec3(0.22, 0.42, 0.72), oLit, oLimb);
  if (uOrbit * presentW > 0.85) {
    reflectedLight.directDiffuse = vec3(0.0);
    reflectedLight.indirectDiffuse = vec3(0.0);
    reflectedLight.directSpecular = vec3(0.0);
    reflectedLight.indirectSpecular = vec3(0.0);
    totalEmissiveRadiance = oLit;
  }
}
`;

export function orbitWeight(altM: number) {
  const a = ORBIT_FADE;
  if (!(altM > a.offM)) return 0;
  if (altM >= a.fullM) return 1;
  const t = (altM - a.offM) / (a.fullM - a.offM);
  return t * t * (3 - 2 * t);
}

function fade(t: number) { return t * t * (3 - 2 * t); }
/** Value noise on hash2u. Cells are a unit lattice in the scaled direction, so the sphere has no seam. */
function lattice(x: number, y: number, z: number, s: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const ux = fade(x - ix), uy = fade(y - iy), uz = fade(z - iz);
  const h = (a: number, b: number, c: number) => hash2u((a + c * 131) | 0, b | 0, s);
  const m = (a: number, b: number, t: number) => a + (b - a) * t;
  const n00 = m(h(ix, iy, iz), h(ix + 1, iy, iz), ux);
  const n10 = m(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux);
  const n01 = m(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux);
  const n11 = m(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux);
  return m(m(n00, n10, uy), m(n01, n11, uy), uz);
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

export interface OrbitBake { rgba: Uint8Array; width: number; height: number; landShare: number }

/**
 * Land and ocean albedo plus the land mask (alpha). Clouds stay in a second texture so a tier
 * that already draws the shell does not paint them twice. Heights are the bilinear zoom-0 DEM.
 */
export function bakeOrbitAlbedo(): OrbitBake {
  const W = ORBIT_MAP.width, H = ORBIT_MAP.height, rgba = new Uint8Array(W * H * 4);
  const C = GLOBE_COLOURS, rgb = [0, 0, 0];
  const height = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = -90 + (j + 0.5) / H * 180;
    for (let i = 0; i < W; i++) height[j * W + i] = coarseMetresLinear(lat, -180 + (i + 0.5) / W * 360);
  }
  const surf: Surface = {
    h: 0, water: -Infinity, level: 0, kind: '', home: 0, x: 0, z: 0,
    soil: '', wet: -1, soilW: [0, 0, 0, -1], soilB: false, hill: 0, mottle: 0.5,
  };
  let landW = 0, wsum = 0;
  for (let j = 0; j < H; j++) {
    const latDeg = -90 + (j + 0.5) / H * 180, lat = latDeg * Math.PI / 180, wt = Math.max(0, Math.cos(lat));
    const cy = Math.cos(lat);
    for (let i = 0; i < W; i++) {
      const lonDeg = -180 + (i + 0.5) / W * 360, lon = lonDeg * Math.PI / 180;
      const h = height[j * W + i];
      const dir = fromLatLon(lat, lon);
      // Shade from the DEM slope. The orbit mesh normal is the sphere, so ridges would otherwise be flat.
      // Light is the northwest of a shaded-relief plate (the Blue Marble convention), and only a little of it:
      // the live sun still lights the sphere.
      const hE = height[j * W + (i + 1) % W], hW = height[j * W + (i - 1 + W) % W];
      const hN = height[Math.min(H - 1, j + 1) * W + i], hS = height[Math.max(0, j - 1) * W + i];
      const dx = Math.max(2000, (40075017 * Math.max(0.2, cy)) / W), dy = 20003930 / H;
      const dzdx = (hE - hW) / (2 * dx), dzdy = (hN - hS) / (2 * dy);
      const sl = Math.hypot(dzdx, dzdy, 1), lx = -0.45, ly = 0.55, lz = 0.7;
      const ndl = Math.max(0, (-dzdx * lx + dzdy * ly + lz) / (sl * Math.hypot(lx, ly, lz)));
      const shade = 0.84 + 0.16 * ndl;
      let mask = 0;
      if (h >= 0) {
        surf.h = h; surf.kind = ''; surf.water = -Infinity; surf.level = 0; surf.home = 0;
        surf.hill = lattice(dir[0] * 8, dir[1] * 8, dir[2] * 8, 2.1) * 2 - 1;
        surf.mottle = lattice(dir[0] * 22, dir[1] * 22, dir[2] * 22, 4.7);
        surfaceColour(surf, dir, rgb);
        rgb[0] *= shade; rgb[1] *= shade; rgb[2] *= shade;
        mask = 1;
        landW += wt;
      } else {
        const dw = smoothstep(0, 150, -h);
        const deep = [
          C.deep[0] + (C.deepSun[0] - C.deep[0]) * 0.45,
          C.deep[1] + (C.deepSun[1] - C.deep[1]) * 0.45,
          C.deep[2] + (C.deepSun[2] - C.deep[2]) * 0.45,
        ];
        rgb[0] = C.shallow[0] + (deep[0] - C.shallow[0]) * dw;
        rgb[1] = C.shallow[1] + (deep[1] - C.shallow[1]) * dw;
        rgb[2] = C.shallow[2] + (deep[2] - C.shallow[2]) * dw;
        // Pack ice follows the same high-latitude fade as land ice, a few degrees lower, so the
        // polar ocean is not a black ring outside the ice cap. Soft in latitude, not a grid cell.
        const pack = smoothstep(66, 80, Math.abs(latDeg));
        if (pack > 0) {
          rgb[0] += (LAYER_LOOK.ice[0] - rgb[0]) * pack;
          rgb[1] += (LAYER_LOOK.ice[1] - rgb[1]) * pack;
          rgb[2] += (LAYER_LOOK.ice[2] - rgb[2]) * pack;
          if (pack > 0.55) mask = 1;
        }
      }
      wsum += wt;
      const o = (j * W + i) * 4;
      rgba[o] = byte(rgb[0]); rgba[o + 1] = byte(rgb[1]); rgba[o + 2] = byte(rgb[2]); rgba[o + 3] = mask ? 255 : 0;
    }
  }
  return { rgba, width: W, height: H, landShare: wsum > 0 ? landW / wsum : 0 };
}

function upload(data: Uint8Array, w: number, h: number, format: THREE.PixelFormat, current: THREE.Texture) {
  const tex = new THREE.DataTexture(data, w, h, format, THREE.UnsignedByteType, THREE.UVMapping, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearMipmapLinearFilter);
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  if (current !== EMPTY_RGBA && current !== EMPTY_R) current.dispose();
  return tex;
}

let baked = false;
type CloudBake = (w: number, h: number) => Uint8Array;
let cloudBake: CloudBake | null = null;
/** The deck baker lives in cloudCover.ts. Binding it here keeps that import off this module. */
export function bindOrbitCloud(fn: CloudBake) { cloudBake = fn; }

/** Bake once, then set the fade and whether the baked deck is drawn. */
export function setOrbitView(altM: number, shellOctaves: number, sun?: [number, number, number]) {
  if (!baked) {
    const map = bakeOrbitAlbedo();
    ORBIT_DRAW.uOrbitTex.value = upload(map.rgba, map.width, map.height, THREE.RGBAFormat, ORBIT_DRAW.uOrbitTex.value);
    // The deck is a 900 km fBm. Half the albedo grid is still several samples per cell, and it
    // keeps the first orbit frame from baking two million noise points.
    const cw = map.width >> 1, ch = map.height >> 1;
    const clouds = cloudBake ? cloudBake(cw, ch) : new Uint8Array(cw * ch);
    const rgba = new Uint8Array(cw * ch * 4);
    for (let i = 0; i < clouds.length; i++) { const c = clouds[i]; const o = i * 4; rgba[o] = rgba[o + 1] = rgba[o + 2] = rgba[o + 3] = c; }
    ORBIT_DRAW.uOrbitCloud.value = upload(rgba, cw, ch, THREE.RGBAFormat, ORBIT_DRAW.uOrbitCloud.value);
    baked = true;
  }
  ORBIT_DRAW.uOrbit.value = orbitWeight(altM);
  ORBIT_DRAW.uOrbitDeck.value = shellOctaves > 0 ? 0 : 1;
  if (sun) ORBIT_DRAW.uOrbitSun.value.set(sun[0], sun[1], sun[2]);
}

/** Tests rebuild the bytes without touching the GPU texture. */
export function resetOrbitBake() { baked = false; }
