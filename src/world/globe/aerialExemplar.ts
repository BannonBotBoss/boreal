/**
 * Aerial cover exemplars for the 400–2000 m band.
 *
 * Proland and flight sims keep the elevation and the land-cover weights, and take colour from a
 * small set of real aerial photographs, one per cover. These four are samples of boreal canopy,
 * fen, shore, and open water. They are not a map of 52 N, 97 W.
 *
 * Repeats are hidden by Deliot and Heitz, GPU Zen 2 (2019), via tilingBlend.glsl.ts.
 * Source and licence: public/aerial/CREDITS.md. Ground sample distance is about 1.6 m
 * (USGS Imagery Only / NAIP, zoom 16). One 128 px crop is uExMetres of world.
 */
import * as THREE from 'three';
import { asset } from '../../core/asset';
import { demSlope, finestPhotoTile, photoTileAt, slippy } from './openTiles';
import { fromLatLon } from './planet';
import { globePlanet } from './home';
import { soilAt } from '../../core/stages/soils';
import { STAGES } from '../../core/stages/elevation';

export const AERIAL_EXEMPLAR = {
  /** Metres of ground across one 128 px crop. Set again from public/aerial/meta.json when it loads. */
  metres: 205,
  /**
   * NAIP sRGB green ~110 is linear ~0.16. The globe sun is intensity 3.2 and Lambert divides by π,
   * so an albedo near the daylight stand table (landMosaic OVERHEAD_STAND, a few percent to ~0.2)
   * is what tone-maps into the EOX frame. 2.5 is the value that put the 2000 m still near that
   * tile's brightness. It is a uniform so a still can change it without a rebuild.
   */
  gain: 2.5,
};

function dataTexture(repeat: boolean) {
  const tex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.generateMipmaps = repeat;
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

export const AERIAL = {
  uExCanopy: { value: dataTexture(true) },
  uExFen: { value: dataTexture(true) },
  uExShore: { value: dataTexture(true) },
  uExWater: { value: dataTexture(true) },
  uExLut: { value: dataTexture(false) },
  uExOn: { value: 0 },
  uExMetres: { value: AERIAL_EXEMPLAR.metres },
  uExGain: { value: AERIAL_EXEMPLAR.gain },
  /** 1 on prairie or desert from coverSampleAt. The conifer crop is the wrong photograph there. */
  uOpenLand: { value: 0 },
  /** Sentinel tile under the camera. w is 1 once a tile is bound. xyz is the slippy index and zoom. */
  uSteppe: { value: dataTexture(false) },
  uSteppeBox: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** 1 while overhead impostors cover this view. The tiled canopy photo is replaced by a smooth floor. */
  uCrownFloor: { value: 0 },
};

const READY = 'aerial-exemplars';

function adopt(slot: { value: THREE.Texture }, tex: THREE.Texture, repeat: boolean) {
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.generateMipmaps = repeat;
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  tex.needsUpdate = true;
  slot.value.dispose();
  slot.value = tex;
}

/** Load the four Gaussian exemplars and the lookup table. Safe to call once from the globe view. */
export function loadAerialExemplars() {
  const g = globalThis as { __aerial?: typeof AERIAL; __aerialReady?: boolean };
  g.__aerial = AERIAL;
  if (g.__aerialReady) return;
  const loader = new THREE.TextureLoader();
  const files: [keyof typeof AERIAL, string, boolean][] = [
    ['uExCanopy', 'aerial/canopy.png', true],
    ['uExFen', 'aerial/fen.png', true],
    ['uExShore', 'aerial/shore.png', true],
    ['uExWater', 'aerial/water.png', true],
    ['uExLut', 'aerial/lut.png', false],
  ];
  let left = files.length;
  const done = () => {
    if (--left > 0) return;
    AERIAL.uExOn.value = 1;
    g.__aerialReady = true;
    console.log(READY);
  };
  for (const [slot, file, repeat] of files) {
    loader.load(asset(file), tex => { adopt(AERIAL[slot] as { value: THREE.Texture }, tex, repeat); done(); }, undefined, () => { console.warn(`aerial exemplar missing: ${file}`); done(); });
  }
  fetch(asset('aerial/meta.json')).then(r => r.ok ? r.json() : null).then(meta => {
    const metres = Number(meta?.metres);
    if (metres > 1) AERIAL.uExMetres.value = metres;
  }).catch(() => { /* the compiled default stands */ });
}

let boundSteppe = '';

function pasteTile(dst: Uint8Array, dstSize: number, ox: number, oy: number, rgb: Float32Array, size: number) {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = (y * size + x) * 3;
    const d = ((oy + y) * dstSize + (ox + x)) * 4;
    dst[d] = Math.round(Math.min(1, Math.max(0, rgb[s])) * 255);
    dst[d + 1] = Math.round(Math.min(1, Math.max(0, rgb[s + 1])) * 255);
    dst[d + 2] = Math.round(Math.min(1, Math.max(0, rgb[s + 2])) * 255);
    dst[d + 3] = 0;
  }
}

/** Slippy y grows south. Pixel row 0 of the atlas is the north edge (flipY is off). */
function atlasLatLon(z: number, x0: number, y0: number, span: number, dstSize: number, px: number, py: number) {
  const n = 2 ** z;
  const sx = x0 + (px + 0.5) / dstSize * span;
  const sy = y0 + (py + 0.5) / dstSize * span;
  const lon = sx / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * sy / n))) * 180 / Math.PI;
  return { lat, lon };
}

/**
 * Hillshade and slope from the cached DEM, and a drainage weight from soilAt
 * (flow distance and wetness). Alpha is that weight, 0 on dry ground.
 * The soil grid repeats every 256 cells, so it is only applied near the origin.
 */
function bakeRelief(bytes: Uint8Array, dstSize: number, z: number, x0: number, y0: number, span: number) {
  const planet = globePlanet(STAGES.seed, true, STAGES.seed);
  const home = planet.home, east = planet.east, north = planet.north, R = planet.radius;
  let demOn = 0;
  // The soil cell is 30 m. A stride of 4 texels is that scale on a zoom-14 mosaic, and a
  // full 768² walk of the DEM was stalling the frame that binds the photograph.
  const step = 4;
  for (let py = 0; py < dstSize; py += step) for (let px = 0; px < dstSize; px += step) {
    const ll = atlasLatLon(z, x0, y0, span, dstSize, px, py);
    const d = fromLatLon(ll.lat * Math.PI / 180, ll.lon * Math.PI / 180);
    const c = d[0] * home[0] + d[1] * home[1] + d[2] * home[2];
    const gx = c > 0.2 ? R * (d[0] * east[0] + d[1] * east[1] + d[2] * east[2]) / c : 1e9;
    const gz = c > 0.2 ? -R * (d[0] * north[0] + d[1] * north[1] + d[2] * north[2]) / c : 1e9;
    const nrm = demSlope(ll.lat, ll.lon, 60);
    let hill = 0.75, steep = 0;
    if (nrm) {
      demOn = 1;
      hill = Math.max(0, Math.min(1, -0.45 * nrm[0] + 0.72 * nrm[1] + 0.4 * nrm[2]));
      steep = Math.max(0, Math.min(1, (1 - nrm[1]) / 0.06));
    }
    let drain = 0;
    if (Math.hypot(gx, gz) < 3600) {
      const so = soilAt(STAGES.seed, gx, gz);
      // Lakes are a fill, not a line. Flow distance darkens the channels beside them.
      if (so.kind !== 'water') drain = 1 - Math.min(1, Math.max(0, so.dist) / 120);
    }
    const k = (0.84 + 0.28 * hill) * (1 - 0.18 * steep);
    const drainB = Math.round(drain * 255);
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const yy = py + dy, xx = px + dx;
      if (yy >= dstSize || xx >= dstSize) continue;
      const o = (yy * dstSize + xx) * 4;
      bytes[o] = Math.min(255, Math.max(0, Math.round(bytes[o] * k)));
      bytes[o + 1] = Math.min(255, Math.max(0, Math.round(bytes[o + 1] * k)));
      bytes[o + 2] = Math.min(255, Math.max(0, Math.round(bytes[o + 2] * k)));
      bytes[o + 3] = drainB;
    }
  }
  return demOn;
}

/** Upload a 2×2 block of the finest cached Sentinel tiles, mipmapped. One tile is smaller than the 2000 m view. Returns the zoom, or 0. */
export function bindOverheadPhoto(latDeg: number, lonDeg: number) {
  const tile = finestPhotoTile(latDeg, lonDeg);
  if (!tile) {
    if (boundSteppe) { boundSteppe = ''; AERIAL.uSteppeBox.value.w = 0; }
    return 0;
  }
  const s = slippy(latDeg, lonDeg, tile.z);
  const fx = s.x - Math.floor(s.x), fy = s.y - Math.floor(s.y);
  // A 2×2 tile is about 3.1 km. The 45° frame at 2000 m is wider than that, so the
  // far side fell off the atlas and clamped to flat thatch. 3×3 is the warmed ring.
  const block = (span: number, ox: number, oy: number) => {
    const tiles = [];
    for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) {
      const t = photoTileAt(tile.z, ox + dx, oy + dy);
      if (!t) return null;
      tiles.push(t);
    }
    return tiles;
  };
  const x3 = Math.floor(s.x) - 1, y3 = Math.floor(s.y) - 1;
  const x2 = Math.floor(s.x) - (fx < 0.5 ? 1 : 0);
  const y2 = Math.floor(s.y) - (fy < 0.5 ? 1 : 0);
  const span3 = block(3, x3, y3);
  const span2 = span3 ? null : block(2, x2, y2);
  const span = span3 ? 3 : span2 ? 2 : 1;
  const ox = span3 ? x3 : span2 ? x2 : tile.x;
  const oy = span3 ? y3 : span2 ? y2 : tile.y;
  const tiles = span3 ?? span2;
  const demReady = demSlope(latDeg, lonDeg) != null ? 1 : 0;
  const id = `${tile.z}/${ox}/${oy}/${span}/d${demReady}`;
  if (id === boundSteppe) return tile.z;
  boundSteppe = id;
  const size = tile.size;
  const dstSize = size * span;
  const bytes = new Uint8Array(dstSize * dstSize * 4);
  if (tiles) {
    tiles.forEach((t, i) => pasteTile(bytes, dstSize, (i % span) * size, Math.floor(i / span) * size, t.rgb, size));
  } else pasteTile(bytes, dstSize, 0, 0, tile.rgb, size);
  bakeRelief(bytes, dstSize, tile.z, ox, oy, span);
  const tex = new THREE.DataTexture(bytes, dstSize, dstSize);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // Row 0 is north. flipY would put that row at t = 1 and the mercator v = 0 sample would read the south edge.
  tex.flipY = false;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  const prev = AERIAL.uSteppe.value;
  AERIAL.uSteppe.value = tex;
  if (prev) prev.dispose();
  AERIAL.uSteppeBox.value.set(ox, oy, tile.z, span);
  (globalThis as { __steppeSpan?: number }).__steppeSpan = span;
  return tile.z;
}
