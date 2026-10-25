/**
 * T-0058 globe layer. One equirectangular texture of the pure hydrosphere and surface budgets
 * (snow, sea ice, soil wetness, vegetation). On when the tier's cloud-octave row is above 0, off at
 * Minimum. Same switch as the solar layer (solarLayerOn). No second quality ladder and no spin-up.
 */
import * as THREE from 'three';
import { HYDRO } from '../../core/weather';
import { budgetsAt } from '../../core/planet/surfaceBudget';
import { CLOUDS } from './atmosphere';
import { fromLatLon } from './planet';

/** Rows of latitude. Columns are twice that. 48 × 96 × 4 bytes = 18 KB. One size for every tier that draws it. */
export const HYDRO_NLAT = 48;
const EMPTY = new THREE.DataTexture(new Uint8Array(4), 1, 1); EMPTY.needsUpdate = true;
export const HYDRO_DRAW = { uHydroTex: { value: EMPTY as THREE.Texture }, uHydroLayer: { value: 0 } };
let bakeKey = '';

/** Same rows as solarLayerOn: the layer is on when this tier's cloud-octave count is above 0. */
export function hydroLayerOn(tier: number) {
  const i = Math.max(0, Math.min(CLOUDS.octaves.length - 1, tier | 0));
  return CLOUDS.octaves[i] > 0;
}
export function setHydroLayer(on: boolean) { HYDRO_DRAW.uHydroLayer.value = on ? 1 : 0; }

const byte = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v)));

/** RGBA: R snow, G sea ice, B soil / field capacity, A vegetation. Row 0 is the south pole (shader v = 0, flipY off). */
export function bakeHydro(seed: number, day: number, hour: number, nlat = HYDRO_NLAT): Uint8Array {
  const nlon = nlat * 2, out = new Uint8Array(nlat * nlon * 4);
  for (let j = 0; j < nlat; j++) {
    const lat = (-90 + (j + 0.5) * 180 / nlat) * Math.PI / 180;
    for (let i = 0; i < nlon; i++) {
      const lon = (-180 + (i + 0.5) * 360 / nlon) * Math.PI / 180;
      const { hydro, surface } = budgetsAt(seed, day, hour, fromLatLon(lat, lon));
      const k = (j * nlon + i) * 4;
      out[k] = byte(surface.snow); out[k + 1] = byte(hydro.ice);
      out[k + 2] = byte(hydro.soilMm / HYDRO.bucketMm); out[k + 3] = byte(surface.vegetation);
    }
  }
  return out;
}

/** Share of cells with snow or ice. `winter` is the pole that should be frozen (north: lat >= 70°, south: lat <= −70°).
 *  Tropics are |lat| <= 20°. Score is pole fraction minus tropical fraction: 1 when the winter pole is covered and the
 *  tropics are clear, 0 when those are swapped. */
export function icePlacement(bytes: Uint8Array, nlat: number, winter: 'north' | 'south' = 'north') {
  const nlon = nlat * 2, poleLat = (lat: number) => winter === 'north' ? lat >= 70 : lat <= -70;
  let pole = 0, poleN = 0, trop = 0, tropN = 0;
  for (let j = 0; j < nlat; j++) {
    const lat = -90 + (j + 0.5) * 180 / nlat;
    const band = poleLat(lat) ? 'pole' : Math.abs(lat) <= 20 ? 'trop' : '';
    if (!band) continue;
    for (let i = 0; i < nlon; i++) {
      const k = (j * nlon + i) * 4, covered = bytes[k] > 127 || bytes[k + 1] > 127;
      if (band === 'pole') { poleN++; if (covered) pole++; } else { tropN++; if (covered) trop++; }
    }
  }
  const poleFrac = poleN ? pole / poleN : 0, tropFrac = tropN ? trop / tropN : 0;
  return { poleFrac, tropFrac, score: Math.max(0, Math.min(1, poleFrac - tropFrac)) };
}

/** Upload the bake when the day or the on/off switch changes. `forceOff` is ?hydro=0. */
export function refreshHydroLayer(seed: number, day: number, hour: number, tier: number, forceOff = false) {
  const on = !forceOff && hydroLayerOn(tier);
  const key = on ? `${seed}:${Math.floor(day)}` : 'off';
  if (key === bakeKey) return on;
  bakeKey = key;
  setHydroLayer(on);
  if (!on) return false;
  const bytes = bakeHydro(seed, day, hour, HYDRO_NLAT);
  const tex = new THREE.DataTexture(bytes, HYDRO_NLAT * 2, HYDRO_NLAT, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter);
  tex.flipY = false; tex.generateMipmaps = false; tex.needsUpdate = true;
  const old = HYDRO_DRAW.uHydroTex.value; if (old !== EMPTY) old.dispose();
  HYDRO_DRAW.uHydroTex.value = tex;
  return true;
}

export function hydroLayerState() {
  return { on: HYDRO_DRAW.uHydroLayer.value > 0.5, key: bakeKey, nlat: HYDRO_NLAT };
}
