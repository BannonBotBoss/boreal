/**
 * Open elevation and ground photographs for a landing (issue #156).
 *
 * Elevation is the AWS Terrain Tiles set (Mapzen joerd), terrarium PNGs:
 * https://registry.opendata.aws/terrain-tiles/
 * Attribution required, from https://github.com/tilezen/joerd/blob/master/docs/attribution.md :
 * USGS 3DEP, SRTM and GMTED2010 (public domain, courtesy U.S. Geological Survey);
 * ETOPO1 (NOAA); EU-DEM (Copernicus, European Union); Canada (Open Government Licence);
 * and the other national sets named in that file. Height is
 * (R * 256 + G + B / 256) − 32768 metres.
 *
 * Ground colour is EOX Sentinel-2 cloudless, CC BY 4.0:
 * https://s2maps.eu — "Sentinel-2 cloudless by EOX (Contains modified Copernicus Sentinel data)".
 * The 2021 layer is the one fetched.
 *
 * Both are cached. A missing tile returns null and the caller keeps the planet function.
 */
import { smoothstep } from '../../proc/math';

export const OPEN_TILES = {
  demZoom: [8, 11] as const,
  /** 8 covers the horizon. 10 and 12 step in. 14 is about a Sentinel pixel (~10 m) under the drone. */
  photoZoom: [8, 10, 12, 14] as const,
  /** Public-domain USGS orthoimage. Only the continental United States has coverage. */
  orthoZoom: 16,
  orthoUrl: (z: number, x: number, y: number) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`,
  demUrl: (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
  photoUrl: (z: number, x: number, y: number) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/${z}/${y}/${x}.jpg`,
  /** Slippy tiles are 256 px. */
  size: 256,
};

export const OPEN_TILES_CREDIT = {
  dem: 'AWS Terrain Tiles (Mapzen joerd). Attribution: USGS 3DEP / SRTM / GMTED2010 courtesy U.S. Geological Survey; ETOPO1 NOAA; EU-DEM Copernicus Programme; Canada Open Government Licence; full list https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
  photo: 'Sentinel-2 cloudless 2021 by EOX IT Services GmbH (CC BY 4.0), contains modified Copernicus Sentinel data. https://s2maps.eu',
  ortho: 'USGS Imagery Only (public domain), The National Map. Used only inside the continental United States. https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
};

/** Continental United States, where the USGS orthoimage has coverage. */
export function inConus(latDeg: number, lonDeg: number) {
  return latDeg >= 24 && latDeg <= 50 && lonDeg >= -125 && lonDeg <= -66;
}

/** Terrarium metres. R, G, B are 0..255. */
export function terrariumMetres(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768;
}

export function srgbByteToLinear(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** Web-mercator tile coordinate. x and y are continuous (the fraction is the pixel). */
export function slippy(latDeg: number, lonDeg: number, z: number) {
  const n = 2 ** z;
  const lat = Math.max(-85, Math.min(85, latDeg)) * Math.PI / 180;
  const x = (lonDeg + 180) / 360 * n;
  const y = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n;
  return { x, y, z };
}

export interface RgbaTile { w: number; h: number; rgba: Uint8ClampedArray | Uint8Array }

const dem = new Map<string, Float32Array | null>();
const photo = new Map<string, Float32Array | null>();
const inflight = new Map<string, Promise<void>>();
let generation = 0;

export function openTileGeneration() { return generation; }

function key(z: number, x: number, y: number) { return `${z}/${x}/${y}`; }

export function storeTerrarium(z: number, x: number, y: number, tile: RgbaTile | null) {
  const id = key(z, x, y);
  if (!tile) { dem.set(id, null); generation++; return; }
  const n = tile.w * tile.h;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    h[i] = terrariumMetres(tile.rgba[o], tile.rgba[o + 1], tile.rgba[o + 2]);
  }
  dem.set(id, h);
  generation++;
}

export function storePhoto(z: number, x: number, y: number, tile: RgbaTile | null) {
  const id = key(z, x, y);
  if (!tile) { photo.set(id, null); generation++; return; }
  const n = tile.w * tile.h;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    rgb[i * 3] = srgbByteToLinear(tile.rgba[o]);
    rgb[i * 3 + 1] = srgbByteToLinear(tile.rgba[o + 1]);
    rgb[i * 3 + 2] = srgbByteToLinear(tile.rgba[o + 2]);
  }
  photo.set(id, rgb);
  generation++;
}

function sampleGrid(table: Map<string, Float32Array | null>, latDeg: number, lonDeg: number, zooms: readonly number[], channels: number): number[] | null {
  for (let zi = zooms.length - 1; zi >= 0; zi--) {
    const z = zooms[zi];
    const s = slippy(latDeg, lonDeg, z);
    const size = OPEN_TILES.size;
    const px = s.x * size;
    const py = s.y * size;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;
    const pix = (x: number, y: number): number[] | null => {
      const tx = Math.floor(x / size);
      const ty = Math.floor(y / size);
      const grid = table.get(key(z, tx, ty));
      if (!grid) return null;
      const ix = ((x % size) + size) % size;
      const iy = ((y % size) + size) % size;
      const i = iy * size + ix;
      if (!Number.isFinite(i) || i < 0 || i * channels + channels - 1 >= grid.length) return null;
      const out = [];
      for (let c = 0; c < channels; c++) out.push(grid[i * channels + c]);
      if (out.some(v => !Number.isFinite(v))) return null;
      return out;
    };
    const a = pix(x0, y0);
    if (!a) continue;
    // A missing neighbour must not punch a hole. Clamp to the pixel we do have.
    const b = pix(x0 + 1, y0) ?? a;
    const c = pix(x0, y0 + 1) ?? a;
    const d = pix(x0 + 1, y0 + 1) ?? b;
    const mix = (p: number[], q: number[], t: number) => p.map((v, i) => v + (q[i] - v) * t);
    return mix(mix(a, b, fx), mix(c, d, fx), fy);
  }
  return null;
}

/**
 * Unit normal in the game tangent frame from the elevation model.
 * +x is east, −z is north (the same frame as `planet.fromLocal`). Null when a neighbour tile is missing.
 * `stepM` is the central-difference spacing.
 */
export function demSlope(latDeg: number, lonDeg: number, stepM = 60): [number, number, number] | null {
  const c = sampleDem(latDeg, lonDeg);
  if (c == null || !Number.isFinite(c)) return null;
  const dLat = stepM / 111_320;
  const dLon = stepM / (111_320 * Math.max(0.2, Math.cos(latDeg * Math.PI / 180)));
  const north = sampleDem(latDeg + dLat, lonDeg);
  const south = sampleDem(latDeg - dLat, lonDeg);
  const east = sampleDem(latDeg, lonDeg + dLon);
  const west = sampleDem(latDeg, lonDeg - dLon);
  if (north == null || south == null || east == null || west == null) return null;
  const dhEast = (east - west) / (2 * stepM);
  const dhNorth = (north - south) / (2 * stepM);
  // North is −z, so dh/dz = −dh/dNorth. The normal leans away from the uphill side.
  const nx = -dhEast, ny = 1, nz = dhNorth;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/**
 * The planet's ocean and a real elevation tile disagree on the prairie and northern clicks:
 * the sample says sea, the DEM says land. Land above sea level wins. A lake is left alone.
 */
export function elevationWins(kind: '' | 'ocean' | 'lake', demM: number | null) {
  return kind === 'ocean' && demM != null && demM > 0;
}

/**
 * Ground the cover and the landing census should read: a cached DEM height wins over the seeded planet's
 * height (the prairie click is not a seeded mountain), and DEM land above sea level wins over the planet's
 * ocean, as in `elevationWins`. The same rule the horizon cover ring uses (#192).
 */
export function groundForCover(s: { kind: '' | 'ocean' | 'lake'; h: number; level?: number }, demM: number | null) {
  const water = !elevationWins(s.kind, demM) && (s.kind === 'ocean' || s.kind === 'lake' || s.h < (s.level ?? 0));
  const elevM = water ? 0 : Math.max(0, demM != null && demM > 0 ? demM : s.h);
  return { water, elevM };
}

/** Metres above sea level, or null when the tile is not cached. Finest cached zoom wins. */
export function sampleDem(latDeg: number, lonDeg: number): number | null {
  const v = sampleGrid(dem, latDeg, lonDeg, OPEN_TILES.demZoom, 1);
  return v ? v[0] : null;
}

/** Linear RGB, or null when no photograph is cached. A USGS ortho tile wins inside the continental US. */
export function samplePhoto(latDeg: number, lonDeg: number): [number, number, number] | null {
  if (inConus(latDeg, lonDeg)) {
    const ortho = sampleGrid(photo, latDeg, lonDeg, [OPEN_TILES.orthoZoom], 3);
    if (ortho) return [ortho[0], ortho[1], ortho[2]];
  }
  const v = sampleGrid(photo, latDeg, lonDeg, OPEN_TILES.photoZoom, 3);
  return v ? [v[0], v[1], v[2]] : null;
}

/**
 * Blend a measured height into the planet height. Near the camera the planet
 * (and therefore the chunk mesh) wins, so the square does not become a step.
 * Past `far0` the DEM is the ground. Water stays the planet water surface.
 */
export function blendDem(planetY: number, demY: number, distM: number, water: boolean, far0 = 200, far1 = 1600) {
  if (water) return planetY;
  return planetY + (demY - planetY) * smoothstep(far0, far1, distM);
}

/**
 * Closed forest on Sentinel-2 is a few percent reflectance and reads dark next to a
 * sunlit drone photo. Wasson Lake's frame averages about sRGB 75, 78, 74.
 * This lift is only for land. The caller does not pass water.
 * Prairie (about 32–48°) gets a smaller green lift than closed forest (about 48–70°).
 */
export function biomeGrade(latDeg: number, rgb: readonly [number, number, number]): [number, number, number] {
  const lat = Math.abs(latDeg);
  let r = 1, g = 1, b = 1;
  if (lat >= 48 && lat < 70) { r = 1.2; g = 2.15; b = 1.05; }
  else if (lat >= 32 && lat < 48) { r = 1.05; g = 1.4; b = 0.95; }
  return [Math.min(1, rgb[0] * r), Math.min(1, rgb[1] * g), Math.min(1, rgb[2] * b)];
}

/**
 * Up close the photograph is multiplied by a procedural grain (so a 10 m Sentinel pixel
 * does not go soft at drone height). By 700 m it is the photograph alone.
 */
export function blendPhoto(picture: [number, number, number], distM: number, grain: number): [number, number, number] {
  const t = smoothstep(50, 700, distM);
  const g = grain + (1 - grain) * t;
  return [picture[0] * g, picture[1] * g, picture[2] * g];
}

function tilesAround(lat: number, lon: number, z: number, ring = 1) {
  const s = slippy(lat, lon, z);
  const tx = Math.floor(s.x), ty = Math.floor(s.y);
  const out: { z: number; x: number; y: number }[] = [];
  for (let j = -ring; j <= ring; j++) for (let i = -ring; i <= ring; i++) out.push({ z, x: tx + i, y: ty + j });
  return out;
}

async function decode(blob: Blob): Promise<RgbaTile | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !w || !h) { bmp.close(); return null; }
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  bmp.close();
  // Width has to be read before close(). After close() it is 0, and the tile was stored empty,
  // which sampled as NaN and drew the black gaps between the patches.
  return { w, h, rgba: data.data };
}

/** Parallel JPEG decodes were failing all at once and then cached as permanent holes.
 *  Photos and elevation do not share a queue: a slow elevation host must not hold the mosaic. */
function makePump(limit: number) {
  const queue: { id: string; start: () => void }[] = [];
  let active = 0;
  const stats = { active: 0, queued: 0 };
  function pump() {
    while (active < limit && queue.length) queue.shift()!.start();
    stats.active = active; stats.queued = queue.length;
  }
  function schedule(id: string, run: () => Promise<void>) {
    let go: () => void = () => {};
    const ready = new Promise<void>(r => { go = r; });
    queue.push({
      id,
      start() {
        active++;
        run().finally(() => { active--; go(); pump(); });
      },
    });
    pump();
    return ready;
  }
  /** Drop work that has not started. The caller forgets those inflight keys so a new landing can fetch. */
  function clear(forget: (id: string) => void) {
    for (const item of queue) forget(item.id);
    queue.length = 0;
    stats.queued = 0;
  }
  return { schedule, clear, stats };
}
const photoPump = makePump(4);
const demPump = makePump(2);

function pull(kind: 'dem' | 'photo', z: number, x: number, y: number) {
  const id = `${kind}/${key(z, x, y)}`;
  const table = kind === 'dem' ? dem : photo;
  if (table.has(key(z, x, y)) || inflight.has(id)) return inflight.get(id);
  let finish: () => void = () => {};
  const job = new Promise<void>(r => { finish = r; });
  inflight.set(id, job);
  (kind === 'photo' ? photoPump : demPump).schedule(id, async () => {
    try {
      const url = kind === 'dem' ? OPEN_TILES.demUrl(z, x, y) : (z >= 15 ? OPEN_TILES.orthoUrl(z, x, y) : OPEN_TILES.photoUrl(z, x, y));
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) { (kind === 'dem' ? storeTerrarium : storePhoto)(z, x, y, null); return; }
      const tile = await decode(await res.blob());
      // A decode miss is not a 404. Leave it uncached so the next warm tries again.
      if (tile) (kind === 'dem' ? storeTerrarium : storePhoto)(z, x, y, tile);
    } catch {
      /* a network miss is not a 404: leave it uncached so the next warm retries */
    } finally {
      inflight.delete(id);
      finish();
    }
  });
  return job;
}

const EARTH_M = 6_378_137;

/** Ground metres one web-mercator tile spans east-west at this latitude. */
export function tileMetres(z: number, latDeg: number) {
  const c = Math.cos(Math.max(-85, Math.min(85, latDeg)) * Math.PI / 180);
  return (2 * Math.PI * EARTH_M * Math.max(0.05, c)) / (2 ** z);
}

/**
 * Tiles around the camera so the mosaic covers `radiusM` of ground.
 * Zoom 8 is at least two tiles: a camera on a tile edge would otherwise leave
 * the horizon in a neighbour that was never fetched, and that neighbour is the
 * black gap between photo patches.
 */
export function tileRing(kind: 'dem' | 'photo', z: number, latDeg = 50, radiusM?: number) {
  const radius = radiusM ?? (z <= 8 ? 160_000 : z <= 10 ? 40_000 : kind === 'photo' ? 14_000 : 18_000);
  const need = Math.ceil(radius / Math.max(1, tileMetres(z, latDeg)));
  // Zoom 12 stays a small valley. A 11×11 ring sat in front of the next landing's horizon tiles.
  const cap = z >= 14 ? 1 : z >= 12 ? 2 : z >= 10 ? 1 : 2;
  const min = z <= 8 ? 2 : 1;
  return Math.max(min, Math.min(cap, need));
}

/** Share of the coarse (zoom 8) elevation tiles around this point that have arrived. */
export function demCoverage(latDeg: number, lonDeg: number) {
  const z = OPEN_TILES.demZoom[0];
  const tiles = tilesAround(latDeg, lonDeg, z, tileRing('dem', z, latDeg));
  let have = 0;
  for (const t of tiles) {
    const grid = dem.get(key(t.z, t.x, t.y));
    if (grid && grid.length) have++;
  }
  return tiles.length ? have / tiles.length : 0;
}

/** Share of the coarse (zoom 8) tiles around this point that have arrived. 1 means the horizon mosaic has no hole. */
export function photoCoverage(latDeg: number, lonDeg: number) {
  const z = OPEN_TILES.photoZoom[0];
  const tiles = tilesAround(latDeg, lonDeg, z, tileRing('photo', z, latDeg));
  let have = 0;
  for (const t of tiles) {
    const grid = photo.get(key(t.z, t.x, t.y));
    if (grid && grid.length) have++;
  }
  return tiles.length ? have / tiles.length : 0;
}

let photoHere = '';
function warm(kind: 'dem' | 'photo', latDeg: number, lonDeg: number) {
  if (typeof fetch !== 'function') return;
  if (kind === 'photo') {
    const here = `${latDeg.toFixed(1)},${lonDeg.toFixed(1)}`;
    if (here !== photoHere) {
      photoHere = here;
      photoPump.clear(id => inflight.delete(id));
    }
  }
  const zooms = kind === 'dem' ? OPEN_TILES.demZoom : OPEN_TILES.photoZoom;
  // Coarse first so the horizon fills before the valley tiles compete for connections.
  for (const z of zooms) for (const t of tilesAround(latDeg, lonDeg, z, tileRing(kind, z, latDeg))) void pull(kind, t.z, t.x, t.y);
  if (kind === 'photo' && inConus(latDeg, lonDeg)) {
    for (const t of tilesAround(latDeg, lonDeg, OPEN_TILES.orthoZoom, 1)) void pull('photo', t.z, t.x, t.y);
  }
}

/**
 * The globe's land table is canopy reflectance (~3 %). A Sentinel pixel of the same forest is
 * several times brighter. A hole that keeps the raw table reads as black next to the mosaic.
 * This lift is only the vertex fallback; the shader replaces a missing photo with the globe
 * texture itself (the far layer).
 */
export const GLOBE_PHOTO_LIFT = 5;
export function globeMatch(albedo: readonly [number, number, number]): [number, number, number] {
  return [
    Math.min(1, albedo[0] * GLOBE_PHOTO_LIFT),
    Math.min(1, albedo[1] * GLOBE_PHOTO_LIFT),
    Math.min(1, albedo[2] * GLOBE_PHOTO_LIFT),
  ];
}

/** Elevation tiles only. Photographs are a later step so a landing can show relief before the pictures arrive. */
export function warmDemTiles(latDeg: number, lonDeg: number) { warm('dem', latDeg, lonDeg); }
/** Sentinel-2 cloudless tiles. Safe to call every frame. */
export function warmPhotoTiles(latDeg: number, lonDeg: number) { warm('photo', latDeg, lonDeg); }

/** Test hook. */
export function resetOpenTiles() {
  dem.clear(); photo.clear(); inflight.clear(); generation++;
}
