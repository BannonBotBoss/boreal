/**
 * Orbit clouds, and a CPU bake of the land mask used by tests.
 *
 * The disc itself is the pre-#446 mesh: vertex colours from `sampleSurface`, MeshStandardMaterial,
 * the directional sun and the Hillaire atmosphere. A poster equirectangular (sharp DEM cells, a
 * latitude colour ramp, emissive Lambert) drew coasts as meridians and hid the night side. That
 * poster is not drawn. `bakeOrbitAlbedo` remains so the land-share check can sample the bilinear DEM.
 *
 * Clouds at orbit are NASA Visible Earth Blue Marble clouds, `cloud_combined_2048.jpg`
 * (https://visibleearth.nasa.gov/images/57747/blue-marble-clouds), 2048×1024, composited as albedo.
 * Tiers that already ray-march `cloudDensity` do not also composite the map.
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
/** uOrbit: 0..1 altitude fade. uOrbitDeck: 1 when the NASA cloud map is drawn. */
export const ORBIT_DRAW = {
  uOrbitTex: { value: EMPTY_RGBA as THREE.Texture },
  uOrbitCloud: { value: EMPTY_R as THREE.Texture },
  uOrbit: { value: 0 },
  uOrbitDeck: { value: 0 },
};
export const ORBIT_PARS = 'uniform sampler2D uOrbitTex, uOrbitCloud; uniform float uOrbit, uOrbitDeck;\n';
const INV_TAU = (1 / (2 * Math.PI)).toFixed(8);
const INV_PI = (1 / Math.PI).toFixed(8);
/** Clouds only. Land and ocean stay on the mesh material (vertex colour, the real sun, the
 *  atmosphere). The map is NASA Visible Earth Blue Marble clouds, cloud_combined_2048.jpg
 *  (https://visibleearth.nasa.gov/images/57747/blue-marble-clouds). White on black, north at
 *  the top; three's flipY puts that top at v = 1, which is this shader's north pole. */
export const ORBIT_FRAG = `
  if (uOrbit > 0.001 && uOrbitDeck > 0.5) {
    vec3 od = normalize(vDetW + uCamP);
    vec2 ouv = vec2(atan(od.z, od.x) * ${INV_TAU} + 0.5, asin(clamp(od.y, -1.0, 1.0)) * ${INV_PI} + 0.5);
    float c = texture2D(uOrbitCloud, ouv).r;
    float deck = smoothstep(0.08, 0.55, c);
    float ow = clamp(uOrbit, 0.0, 1.0) * presentW;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${ORBIT_CLOUD_ALBEDO.toFixed(2)}), deck * ow);
  }`;

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

let cloudsRequested = false;
/** Browser load of the Blue Marble cloud map. Node tests never call this. */
export function loadBlueMarbleClouds() {
  if (cloudsRequested || typeof document === 'undefined') return;
  cloudsRequested = true;
  const tex = new THREE.TextureLoader().load('/globe/cloud_combined_2048.jpg');
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  const prev = ORBIT_DRAW.uOrbitCloud.value;
  ORBIT_DRAW.uOrbitCloud.value = tex;
  if (prev && prev !== EMPTY_R) prev.dispose();
}
export function setOrbitView(altM: number, shellOctaves: number) {
  ORBIT_DRAW.uOrbit.value = orbitWeight(altM);
  ORBIT_DRAW.uOrbitDeck.value = shellOctaves > 0 ? 0 : 1;
}
