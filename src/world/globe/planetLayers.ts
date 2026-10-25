/** Planet budget layers on the globe tiles (issue #43, T-0061 follow-up). Reuses rust/boreal-sim through core/planetBudget
 *  (loadPlanetSim, TypeScript fallback = no layers) over the globe's own continents (planet.sampleSurface), as the review page
 *  tools/planet-layers.ts does. The governor tier (core/quality LADDER) sets how many layers and the grid size: the grid is
 *  baked into one RGBA8 equirectangular texture (rows south -> north, as the sim) shared by every globe material, so the
 *  cost is one texture fetch per pixel and nlat x 2 nlat x 4 bytes of VRAM (at most 64 KB). Uniform values only, same program. */
import * as THREE from 'three';
import { loadPlanetSim, type PlanetSim } from '../../core/planetBudget';
import { bootGlobe } from './bootOrder';
import { fromLatLon, PLANET, type Vec3 } from './planet';
import { visibleWeight } from './visibility';

/** Per governor tier (0 Ultra .. 5 Minimum): grid rows and layers drawn. snow: snow cover on land, ice: sea ice,
 *  soil: wet soil darkening. Minimum draws none (tiles as before). [game calibration] */
export const LAYER_TIERS: { nlat: number; layers: ('snow' | 'ice' | 'soil')[] }[] = [
  { nlat: 128, layers: ['snow', 'ice', 'soil'] }, { nlat: 90, layers: ['snow', 'ice', 'soil'] }, { nlat: 90, layers: ['snow', 'ice'] },
  { nlat: 64, layers: ['snow', 'ice'] }, { nlat: 45, layers: ['snow'] }, { nlat: 0, layers: [] }];
/** Colours and strengths. Fresh snow albedo ~0.8-0.9, sea ice ~0.5-0.7 (Perovich 1996); wet soil about half the dry
 *  reflectance at saturation (Lobell & Asner 2002), so soil darkens by up to 0.4. soilSat: bucket capacity (mm), as weather.ts. */
export const LAYER_LOOK = { snow: [0.86, 0.88, 0.92], ice: [0.62, 0.68, 0.74], soilDark: 0.4, soilSat: 150 };

/** cloud spin-up after the seed (update_moisture -> update_clouds) [measured: 8 x 6 h, 128x256 grid ~3 s with setLand in Node] */
export const SPINUP = { steps: 8, dtS: 21600 };
const EMPTY = new THREE.DataTexture(new Uint8Array(4), 1, 1); EMPTY.needsUpdate = true;
/** uLayers: x snow on, y ice on, z soil on, w 0/1 texture loaded. uCamP: camera planet position (tiles are camera-relative). */
export const GLOBE_LAYERS = { uLayerTex: { value: EMPTY as THREE.Texture }, uLayers: { value: new THREE.Vector4() }, uCamP: { value: new THREE.Vector3() },
  uSnowC: { value: new THREE.Color().setRGB(...(LAYER_LOOK.snow as [number, number, number])) }, uIceC: { value: new THREE.Color().setRGB(...(LAYER_LOOK.ice as [number, number, number])) } };

/** Bake the sim's planes into RGBA bytes: R snow fraction, G sea-ice fraction, B soil wetness (0..1), A cloud fraction
 *  (update_clouds.rs: humidity + instability; drives the cloud shell's cover in atmosphere.ts, causal, not a texture). */
export function bakeLayers(sim: PlanetSim): Uint8Array {
  const n = sim.n, out = new Uint8Array(n * 4), sf = sim.plane('snowfrac'), ice = sim.plane('ice'), soil = sim.plane('soil'), cl = sim.plane('cloud');
  const b = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v > -900 ? v : 0)));
  for (let i = 0; i < n; i++) { out[i * 4] = b(sf[i]); out[i * 4 + 1] = b(ice[i]); out[i * 4 + 2] = b(soil[i] / LAYER_LOOK.soilSat); out[i * 4 + 3] = b(cl[i]); }
  return out;
}

/** Land fraction and height from the globe's own `sampleSurface` (one mask, not a second generator). */
export function globeLandSample(planet: { sampleSurface(d: Vec3): { h: number } }) {
  return (lat: number, lon: number) => { const s = planet.sampleSurface(fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180)); return { land: s.h > 0 ? 1 : 0, elev: Math.max(0, s.h) }; };
}

/** Spin the already-booted grid and bind the layer texture. The boot itself does not take these steps. */
export function spinAndBake(sim: PlanetSim, tier: number): boolean {
  const t = LAYER_TIERS[Math.max(0, Math.min(LAYER_TIERS.length - 1, tier))];
  if (!t.nlat || !t.layers.length) return false;
  for (let i = 0; i < SPINUP.steps; i++) sim.step(SPINUP.dtS); // humidity -> cloud needs time after the boot; 48 h: RH + convective + stratocumulus + frontal + free-troposphere upglide cloud (update_clouds.rs) global (MODIS 0.67, King et al. 2013: low, SH winter storm tracks missing; July 30-90N 0.56-0.77 matches)
  const tex = new THREE.DataTexture(bakeLayers(sim), t.nlat * 2, t.nlat, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter);
  tex.generateMipmaps = false; tex.needsUpdate = true;
  const old = GLOBE_LAYERS.uLayerTex.value; if (old !== EMPTY) old.dispose(); GLOBE_LAYERS.uLayerTex.value = tex;
  tierOn = [+t.layers.includes('snow'), +t.layers.includes('ice'), +t.layers.includes('soil')];
  GLOBE_LAYERS.uLayers.value.set(tierOn[0], tierOn[1], tierOn[2], 1);
  return true;
}

/** Load the wasm, boot the grid for `day` over `planet` (issue #47), then spin and bake. Resolves false (tiles unchanged)
 *  when the tier draws nothing or the wasm is missing. Call again when the tier changes. */
export async function startPlanetLayers(planet: { sampleSurface(d: Vec3): { h: number } }, tier: number, day: number, sim?: PlanetSim | null, utcHour = 0): Promise<boolean> {
  const t = LAYER_TIERS[Math.max(0, Math.min(LAYER_TIERS.length - 1, tier))];
  tierOn = [0, 0, 0]; GLOBE_LAYERS.uLayers.value.set(0, 0, 0, 0); if (!t.nlat || !t.layers.length) return false;
  sim = sim ?? await loadPlanetSim(); if (!sim) return false;
  // Boot one spin-up earlier so the steps end at (day, utcHour). The boot itself does not advance the clock.
  bootGlobe(sim, t.nlat, t.nlat * 2, globeLandSample(planet), day - SPINUP.steps * SPINUP.dtS / 86400, utcHour);
  return spinAndBake(sim, tier);
}
let tierOn = [0, 0, 0], snowIceOn = 1;
/** layer panel: snow/ice off (still simulated: the budget needs its albedo; only the drawing stops) */
export function setSnowIceShown(on: boolean) { snowIceOn = on ? 1 : 0; }
/** Camera + physical visibility gate (visibility.ts): each layer's weight = its characteristic size in pixels at the camera's
 *  range to the surface (nadir altitude), so wet soil (~2 km) only appears below ~1300 km at 1080p / 45 deg. Uniform only. */
export function setLayerCamera(cam: Vec3, fovDeg = 45, hPx = 1080) {
  GLOBE_LAYERS.uCamP.value.set(cam[0], cam[1], cam[2]);
  const range = Math.max(1, Math.hypot(cam[0], cam[1], cam[2]) - PLANET.radius), u = GLOBE_LAYERS.uLayers.value;
  u.x = snowIceOn * tierOn[0] * visibleWeight('snowCover', range, fovDeg, hPx); u.y = snowIceOn * tierOn[1] * visibleWeight('seaIceEdge', range, fovDeg, hPx); u.z = tierOn[2] * visibleWeight('soilMoisture', range, fovDeg, hPx);
}

/** Fragment code (after the land/water mix in globeMaterial). Planet direction = camera-relative world position + camera;
 *  lat/lon as planet.ts toLatLon (lat = asin y, lon = atan2(z, x)); u = (lon + pi) / 2pi matches the sim's -180..180 columns. */
export const LAYERS_FRAG = `
  if (uLayers.w > 0.5) {
    vec3 pd = normalize(vDetW + uCamP); vec2 luv = vec2(atan(pd.z, pd.x) / 6.2831853 + 0.5, asin(clamp(pd.y, -1.0, 1.0)) / 3.1415927 + 0.5);
    vec4 L = texture2D(uLayerTex, luv);
    diffuseColor.rgb *= 1.0 - uLayers.z * ${LAYER_LOOK.soilDark.toFixed(3)} * L.b * landMask; // wet soil darker
    diffuseColor.rgb = mix(diffuseColor.rgb, uSnowC, uLayers.x * L.r * landMask); // snow cover
    diffuseColor.rgb = mix(diffuseColor.rgb, uIceC, uLayers.y * L.g * (1.0 - landMask)); } // sea ice`;
export const LAYERS_PARS = 'uniform sampler2D uLayerTex; uniform vec4 uLayers; uniform vec3 uCamP, uSnowC, uIceC;\n';
