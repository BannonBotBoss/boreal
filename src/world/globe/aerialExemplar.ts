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
import { globePlanet } from './home';
import { soilGrid, SOIL_KINDS } from '../../core/stages/soils';
import { flowGrid, STAGES } from '../../core/stages/elevation';

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
 * Drainage weight from the soil flow distance. Alpha is that weight, 0 on open
 * water (a lake is a fill, not a line) and 0 once the distance has fallen off.
 * The photograph's own pixels stay as stored: stamping the colour in blocks was
 * the square pattern. Distance is bilinear over the 30 m soil nodes, then the
 * falloff is evaluated per texel, so the line follows the drainage instead of
 * the node squares.
 * The soil grid repeats every 256 cells, so the weight is only applied near the origin.
 */
function bakeRelief(bytes: Uint8Array, dstSize: number, z: number, x0: number, y0: number, span: number) {
  const planet = globePlanet(STAGES.seed, true, STAGES.seed);
  const home = planet.home, east = planet.east, north = planet.north, R = planet.radius;
  const S = soilGrid(STAGES.seed), n = S.n, cell = S.cell, water = SOIL_KINDS.indexOf('water');
  const F = flowGrid(STAGES.seed), km2 = cell * cell / 1e6;
  const sinLat = new Float32Array(dstSize), cosLat = new Float32Array(dstSize);
  const sinLon = new Float32Array(dstSize), cosLon = new Float32Array(dstSize);
  for (let i = 0; i < dstSize; i++) {
    const row = atlasLatLon(z, x0, y0, span, dstSize, 0, Math.min(i, dstSize - 1));
    const lat = row.lat * Math.PI / 180;
    sinLat[i] = Math.sin(lat); cosLat[i] = Math.cos(lat);
    const col = atlasLatLon(z, x0, y0, span, dstSize, Math.min(i, dstSize - 1), 0);
    const lon = col.lon * Math.PI / 180;
    sinLon[i] = Math.sin(lon); cosLon[i] = Math.cos(lon);
  }
  const distAt = (i: number, j: number) => S.dist[(((j % n) + n) % n) * n + ((i % n) + n) % n];
  const wetAt = (i: number, j: number) => S.kind[(((j % n) + n) % n) * n + ((i % n) + n) % n] === water ? 1 : 0;
  for (let py = 0; py < dstSize; py++) {
    const dy = sinLat[py], cy = cosLat[py];
    for (let px = 0; px < dstSize; px++) {
      const dx = cy * cosLon[px], dz = cy * sinLon[px];
      const c = dx * home[0] + dy * home[1] + dz * home[2];
      let drain = 0;
      if (c > 0.2) {
        const gx = R * (dx * east[0] + dy * east[1] + dz * east[2]) / c;
        const gz = -R * (dx * north[0] + dy * north[1] + dz * north[2]) / c;
        if (gx * gx + gz * gz < 3600 * 3600) {
          const fi = gx / cell, fj = gz / cell;
          const i0 = Math.floor(fi), j0 = Math.floor(fj);
          const tx = fi - i0, ty = fj - j0;
          const dist = distAt(i0, j0) * (1 - tx) * (1 - ty) + distAt(i0 + 1, j0) * tx * (1 - ty) + distAt(i0, j0 + 1) * (1 - tx) * ty + distAt(i0 + 1, j0 + 1) * tx * ty;
          const wet = wetAt(i0, j0) * (1 - tx) * (1 - ty) + wetAt(i0 + 1, j0) * tx * (1 - ty) + wetAt(i0, j0 + 1) * (1 - tx) * ty + wetAt(i0 + 1, j0 + 1) * tx * ty;
          // Open water stays the photograph. Full on the bank, gone by 88 m.
          // wet fades across the cell so the edge follows the drainage, not the node squares.
          if (wet < 0.65) {
            const land = wet <= 0.2 ? 1 : 1 - (wet - 0.2) / 0.45;
            const t = dist <= 0 ? 0 : dist >= 88 ? 1 : dist / 88;
            const s = t * t * (3 - 2 * t);
            drain = (1 - s) * land;
          }
          // Channel cells join their downstream neighbour, so the line is the
          // segment and not a dot on each node. 9 m is under half a screen pixel-row.
          let line = 0;
          for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) {
            const ia = i0 + di, ja = j0 + dj;
            const iaw = ((ia % n) + n) % n, jaw = ((ja % n) + n) % n;
            const idx = jaw * n + iaw;
            if (F.outlet[idx] || F.acc[idx] * km2 < 0.04) continue;
            const ax = ia * cell, az = ja * cell;
            const r = F.dir[idx];
            let cd = Math.hypot(gx - ax, gz - az);
            if (r >= 0) {
              const ri = r % n, rj = (r / n) | 0;
              const stepI = (ri - iaw + n + 1) % n - 1, stepJ = (rj - jaw + n + 1) % n - 1;
              const bx = (ia + stepI) * cell, bz = (ja + stepJ) * cell;
              const abx = bx - ax, abz = bz - az, denom = abx * abx + abz * abz;
              if (denom > 0) {
                const u = Math.max(0, Math.min(1, ((gx - ax) * abx + (gz - az) * abz) / denom));
                cd = Math.hypot(gx - (ax + abx * u), gz - (az + abz * u));
              }
            }
            if (cd < 9) {
              const u = cd / 9, w = 1 - u * u * (3 - 2 * u);
              if (w > line) line = w;
            }
          }
          if (line > drain) drain = line;
        }
      }
      bytes[(py * dstSize + px) * 4 + 3] = Math.round(drain * 255);
    }
  }
  // The flow grid is 30 m, so an unfiltered bank is a stair. A short blur
  // rounds that corner without lifting the line back into the brown.
  const radius = 2, tmp = new Float32Array(dstSize * dstSize), blurred = new Uint8Array(dstSize * dstSize);
  const spanW = radius * 2 + 1;
  const ax = (x: number, y: number) => bytes[(y * dstSize + Math.min(dstSize - 1, Math.max(0, x))) * 4 + 3];
  for (let y = 0; y < dstSize; y++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += ax(k, y);
    tmp[y * dstSize] = sum / spanW;
    for (let x = 1; x < dstSize; x++) {
      sum += ax(x + radius, y) - ax(x - radius - 1, y);
      tmp[y * dstSize + x] = sum / spanW;
    }
  }
  for (let x = 0; x < dstSize; x++) {
    const ay = (y: number) => tmp[Math.min(dstSize - 1, Math.max(0, y)) * dstSize + x];
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += ay(k);
    blurred[x] = Math.round(sum / spanW);
    for (let y = 1; y < dstSize; y++) {
      sum += ay(y + radius) - ay(y - radius - 1);
      blurred[y * dstSize + x] = Math.round(sum / spanW);
    }
  }
  for (let i = 0; i < dstSize * dstSize; i++) bytes[i * 4 + 3] = blurred[i];
  return 1;
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
  // Zoom 16 tiles are ~400 m. The 2000 m frame is ~3 km, so the mosaic is 11 tiles.
  const fine = tile.z >= 16;
  const x3 = Math.floor(s.x) - 1, y3 = Math.floor(s.y) - 1;
  const x2 = Math.floor(s.x) - (fx < 0.5 ? 1 : 0);
  const y2 = Math.floor(s.y) - (fy < 0.5 ? 1 : 0);
  const xF = Math.floor(s.x) - 5, yF = Math.floor(s.y) - 5;
  const spanF = fine ? block(11, xF, yF) : null;
  const span3 = spanF ? null : block(3, x3, y3);
  const span2 = spanF || span3 ? null : block(2, x2, y2);
  const span = spanF ? 11 : span3 ? 3 : span2 ? 2 : 1;
  const ox = spanF ? xF : span3 ? x3 : span2 ? x2 : tile.x;
  const oy = spanF ? yF : span3 ? y3 : span2 ? y2 : tile.y;
  const tiles = spanF ?? span3 ?? span2;
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
