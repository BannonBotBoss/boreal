/**
 * Orbit land colour. The class is coverKind, which matches rust cover_class_at.
 * The moisture weight is rust orbit_vegetation. This file only paints the draw.
 */
import { coverKind, type CoverKind } from '../../world/globe/coverKind';
import { coarseMetresLinear } from '../../world/globe/coarseRelief';
import { GLOBE_COLOURS } from '../../world/globe/planet';
import { orbitVegetation } from './orbitVeg';

/**
 * Blue Marble Next Generation, August 2004 (Stöckli, Vermote, Saleous, Simmon
 * and Herring 2005, NASA Earth Observatory). Per-pixel land colour, not a
 * class constant. public/globe/blue-marble-200408.jpg is a 1024×512 WMS grab.
 */
let marble: Uint8Array | null = null;
let marbleW = 0;
let marbleH = 0;

export function setMarble(rgb: Uint8Array, width: number, height: number) {
  marble = rgb;
  marbleW = width;
  marbleH = height;
}

/** IEC 61966-2-1 sRGB byte to a linear byte. The cover texture is uploaded as linear. */
function linearByte(c: number) {
  const u = c / 255;
  const l = u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  return Math.max(0, Math.min(255, Math.round(l * 255)));
}

function marbleAt(lat: number, lon: number): [number, number, number] | null {
  if (!marble) return null;
  let x = ((lon + 180) / 360) * marbleW;
  x = ((x % marbleW) + marbleW) % marbleW;
  const y = Math.max(0, Math.min(marbleH - 1, ((90 - lat) / 180) * (marbleH - 1)));
  const x0 = Math.floor(x) % marbleW;
  const y0 = Math.min(marbleH - 1, Math.floor(y));
  const i = (y0 * marbleW + x0) * 3;
  return [linearByte(marble[i]) / 255, linearByte(marble[i + 1]) / 255, linearByte(marble[i + 2]) / 255];
}

/** Browser decode of the Blue Marble JPEG. Node tests call setMarble with the raw RGB. */
export async function loadMarble() {
  if (marble || typeof document === 'undefined') return;
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const blob = await (await fetch(`${base}globe/blue-marble-200408.jpg`)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const rgb = new Uint8Array(bmp.width * bmp.height * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2]; }
  setMarble(rgb, bmp.width, bmp.height);
}

/** Linear albedo, the same exposure scale as GLOBE_COLOURS (a few percent for canopy). */
export const BIOME_ALBEDO: Record<CoverKind, readonly [number, number, number]> = {
  water: [0.02, 0.05, 0.1],
  tropical: [0.03, 0.055, 0.018],
  boreal: [0.034, 0.05, 0.022],
  prairie: [0.11, 0.085, 0.04],
  desert: [0.2, 0.13, 0.06],
  wetland: [0.045, 0.05, 0.025],
  tundra: [0.12, 0.11, 0.075],
  rock: [0.11, 0.1, 0.09],
  ice: [0.78, 0.8, 0.84],
};

const LAKE = [0.012, 0.02, 0.032] as const;

function oceanRgb(depth: number): [number, number, number] {
  const C = GLOBE_COLOURS;
  const dw = Math.max(0, Math.min(1, -depth / 150));
  const deep = [
    C.deep[0] + (C.deepSun[0] - C.deep[0]) * 0.55,
    C.deep[1] + (C.deepSun[1] - C.deep[1]) * 0.55,
    C.deep[2] + (C.deepSun[2] - C.deep[2]) * 0.55,
  ];
  return [
    C.shallow[0] + (deep[0] - C.shallow[0]) * dw,
    C.shallow[1] + (deep[1] - C.shallow[1]) * dw,
    C.shallow[2] + (deep[2] - C.shallow[2]) * dw,
  ];
}

export interface OrbitCover {
  rgba: Uint8Array;
  width: number;
  height: number;
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** Open ocean: flooded from cells deeper than 1 km, through every below-sea-level neighbour. */
export function floodOcean(height: Float32Array, w: number, h: number) {
  const ocean = new Uint8Array(w * h);
  const q: number[] = [];
  const seed = (i: number) => {
    if (ocean[i] || height[i] >= 0) return;
    ocean[i] = 1;
    q.push(i);
  };
  for (let i = 0; i < height.length; i++) if (height[i] < -1000) seed(i);
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++];
    const y = (i / w) | 0;
    const x = i - y * w;
    const step = (nx: number, ny: number) => {
      if (ny < 0 || ny >= h) return;
      const xx = (nx + w) % w;
      const j = ny * w + xx;
      if (ocean[j] || height[j] >= 0) return;
      ocean[j] = 1;
      q.push(j);
    };
    step(x + 1, y); step(x - 1, y); step(x, y + 1); step(x, y - 1);
  }
  return ocean;
}

/** Kilometres to the nearest open-ocean cell. Pixel BFS, then the local latitude scale. */
export function coastDistanceKm(ocean: Uint8Array, w: number, h: number) {
  const pix = new Int16Array(w * h);
  pix.fill(-1);
  const q: number[] = [];
  for (let i = 0; i < ocean.length; i++) if (ocean[i]) { pix[i] = 0; q.push(i); }
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++];
    const y = (i / w) | 0;
    const x = i - y * w;
    const d = pix[i] + 1;
    const step = (nx: number, ny: number) => {
      if (ny < 0 || ny >= h) return;
      const xx = (nx + w) % w;
      const j = ny * w + xx;
      if (pix[j] >= 0) return;
      pix[j] = d;
      q.push(j);
    };
    step(x + 1, y); step(x - 1, y); step(x, y + 1); step(x, y - 1);
  }
  const km = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const lat = -90 + (y + 0.5) / h * 180;
    const dy = 20003.93 / h;
    const dx = 40075.017 * Math.max(0.2, Math.cos(lat * Math.PI / 180)) / w;
    const cell = Math.min(dx, dy);
    for (let x = 0; x < w; x++) km[y * w + x] = Math.max(0, pix[y * w + x]) * cell;
  }
  return km;
}

function blur(src: Uint8Array, w: number, h: number, stride: number, r: number) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    const acc = [0, 0, 0, 0];
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = (x + dx + w) % w;
        const o = (yy * w + xx) * stride;
        for (let k = 0; k < stride; k++) acc[k] += src[o + k];
        n++;
      }
    }
    const o = (y * w + x) * stride;
    for (let k = 0; k < stride; k++) out[o + k] = Math.round(acc[k] / n);
  }
  return out;
}

/**
 * Equirectangular cover. North is row height-1, the same orientation as
 * bakeOrbitAlbedo (lat = -90 at row 0). Alpha is land (255) or ocean (0)
 * before the blur, then a 2-pixel mean so the coast is not a one-cell stair.
 */
export function buildOrbitCover(width = 1024, height = 512): OrbitCover {
  const w = width, h = height;
  const heightM = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const lat = -90 + (j + 0.5) / h * 180;
    for (let i = 0; i < w; i++) heightM[j * w + i] = coarseMetresLinear(lat, -180 + (i + 0.5) / w * 360);
  }
  const ocean = floodOcean(heightM, w, h);
  const coast = coastDistanceKm(ocean, w, h);
  const rgba = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    const lat = -90 + (j + 0.5) / h * 180;
    for (let i = 0; i < w; i++) {
      const p = j * w + i;
      const elev = heightM[p];
      const o = p * 4;
      let rgb: readonly [number, number, number];
      let a = 255;
      if (ocean[p]) {
        rgb = oceanRgb(elev);
        a = 0;
      } else {
        const shot = marbleAt(lat, -180 + (i + 0.5) / w * 360);
        if (shot) rgb = shot;
        else if (elev < 0) rgb = LAKE;
        else {
          const kind = coverKind(lat, elev, orbitVegetation(Math.abs(lat), coast[p]), false, coast[p] * 1000);
          rgb = BIOME_ALBEDO[kind];
        }
      }
      rgba[o] = byte(rgb[0]); rgba[o + 1] = byte(rgb[1]); rgba[o + 2] = byte(rgb[2]); rgba[o + 3] = a;
    }
  }
  return { rgba: blur(rgba, w, h, 4, 2), width: w, height: h };
}

export function coverPixel(cover: OrbitCover, lat: number, lon: number) {
  const x = Math.floor(((lon + 180) / 360) * cover.width) % cover.width;
  const y = Math.min(cover.height - 1, Math.max(0, Math.floor(((lat + 90) / 180) * cover.height)));
  const o = (y * cover.width + (x + cover.width) % cover.width) * 4;
  const d = cover.rgba;
  return { r: d[o], g: d[o + 1], b: d[o + 2], a: d[o + 3] };
}
