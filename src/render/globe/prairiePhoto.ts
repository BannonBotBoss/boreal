/**
 * Prairie overhead. The Sentinel mosaic is the colour. No soil-threshold
 * outline and no channel polyline: those were the stair-stepped edges and
 * the straight black graph. Local contrast is the photograph plus a DEM
 * hillshade. Zoom 16 is finer than a screen pixel at 2000 m.
 */
import * as THREE from 'three';
import { demSlope, finestPhotoTile, photoTileAt, slippy, warmDemTiles, warmOverheadTiles, warmPhotoTiles } from '../../world/globe/openTiles';
import { coverSampleLatLon } from '../../world/globe/coverSample';
import type { Planet, Vec3 } from '../../world/globe/planet';

/** Overhead of the staged home. A missing photograph is prairie, not boreal salt. */
export function openLandHere(lat: number, lon: number, dir: Vec3, planet: Planet) {
  const cover = coverSampleLatLon(lat, lon, dir, planet);
  if (!cover.water && (cover.biome === 'prairie' || cover.biome === 'desert')) return true;
  const h = planet.home;
  const ang = Math.acos(Math.max(-1, Math.min(1, dir[0] * h[0] + dir[1] * h[1] + dir[2] * h[2])));
  // 0.2° is about 22 km: the overhead and the staged home, not a 670 km disc.
  return ang < 0.2 * Math.PI / 180;
}

type Aerial = {
  uOpenLand: { value: number };
  uSteppe: { value: THREE.Texture };
  uSteppeBox: { value: THREE.Vector4 };
};

let bound = '';

export function attachPrairie(aerial: Record<string, { value: unknown }>) {
  if (aerial.uOpenLand) return;
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  blank.colorSpace = THREE.NoColorSpace;
  blank.needsUpdate = true;
  aerial.uOpenLand = { value: 0 };
  aerial.uSteppe = { value: blank };
  aerial.uSteppeBox = { value: new THREE.Vector4(0, 0, 0, 0) };
}

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

function atlasLatLon(z: number, x0: number, y0: number, span: number, dstSize: number, px: number, py: number) {
  const n = 2 ** z;
  const sx = x0 + (px + 0.5) / dstSize * span;
  const sy = y0 + (py + 0.5) / dstSize * span;
  const lon = sx / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * sy / n))) * 180 / Math.PI;
  return { lat, lon };
}

/** DEM shade only. Alpha stays 0 so the shader cannot draw a drainage edge. */
function bakeHillshade(bytes: Uint8Array, dstSize: number, z: number, x0: number, y0: number, span: number) {
  const step = 32;
  const gw = Math.ceil(dstSize / step) + 1;
  const field = new Float32Array(gw * gw);
  field.fill(1);
  for (let gy = 0; gy < gw; gy++) for (let gx = 0; gx < gw; gx++) {
    const ll = atlasLatLon(z, x0, y0, span, dstSize, Math.min(gx * step, dstSize - 1), Math.min(gy * step, dstSize - 1));
    const nrm = demSlope(ll.lat, ll.lon, 90);
    if (!nrm) continue;
    const ex = 8;
    const sx = -nrm[0] / Math.max(0.2, nrm[1]) * ex;
    const sz = nrm[2] / Math.max(0.2, nrm[1]) * ex;
    const len = Math.hypot(-sx, 1, sz) || 1;
    const hill = Math.max(0, Math.min(1, (-0.45 * -sx + 0.72 + 0.4 * sz) / len));
    field[gy * gw + gx] = 0.82 + 0.36 * hill;
  }
  for (let py = 0; py < dstSize; py++) {
    const fy = py / step, y0i = Math.min(gw - 2, Math.floor(fy)), ty = fy - y0i;
    for (let px = 0; px < dstSize; px++) {
      const fx = px / step, x0i = Math.min(gw - 2, Math.floor(fx)), tx = fx - x0i;
      const k = field[y0i * gw + x0i] * (1 - tx) * (1 - ty) + field[y0i * gw + x0i + 1] * tx * (1 - ty)
        + field[(y0i + 1) * gw + x0i] * (1 - tx) * ty + field[(y0i + 1) * gw + x0i + 1] * tx * ty;
      const o = (py * dstSize + px) * 4;
      bytes[o] = Math.min(255, Math.max(0, Math.round(bytes[o] * k)));
      bytes[o + 1] = Math.min(255, Math.max(0, Math.round(bytes[o + 1] * k)));
      bytes[o + 2] = Math.min(255, Math.max(0, Math.round(bytes[o + 2] * k)));
    }
  }
}

/** One frame of the overhead: prairie cover, Sentinel warm, and the photo bind. */
export function stepPrairieOverhead(latDeg: number, lonDeg: number, dir: Vec3, planet: Planet, alt: number) {
  const aerial = (globalThis as { __aerial?: Aerial }).__aerial;
  const open = openLandHere(latDeg, lonDeg, dir, planet);
  if (aerial) aerial.uOpenLand.value = open ? 1 : 0;
  const g = globalThis as { __openLand?: number; __steppeZ?: number; __photoDown?: number };
  g.__openLand = open ? 1 : 0;
  g.__photoDown = 0;
  if (!open || alt >= 80000) return;
  // These only schedule fetches. bind reads tiles already in memory and returns.
  // Nothing here is awaited, so the loading screen is not gated on a network tile.
  warmPhotoTiles(latDeg, lonDeg);
  warmDemTiles(latDeg, lonDeg);
  if (alt < 8000) {
    warmOverheadTiles(latDeg, lonDeg);
    g.__steppeZ = bindOverheadPhoto(latDeg, lonDeg);
    g.__photoDown = aerial && aerial.uSteppeBox.value.w > 0.5 ? 1 : 0;
  }
}

export function bindOverheadPhoto(latDeg: number, lonDeg: number) {
  const aerial = (globalThis as { __aerial?: Aerial }).__aerial;
  if (!aerial) return 0;
  const tile = finestPhotoTile(latDeg, lonDeg);
  if (!tile) {
    if (bound) { bound = ''; aerial.uSteppeBox.value.w = 0; }
    return 0;
  }
  const s = slippy(latDeg, lonDeg, tile.z);
  const block = (span: number, ox: number, oy: number) => {
    const tiles = [];
    for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) {
      const t = photoTileAt(tile.z, ox + dx, oy + dy);
      if (!t) return null;
      tiles.push(t);
    }
    return tiles;
  };
  const fine = tile.z >= 16;
  const xF = Math.floor(s.x) - 5, yF = Math.floor(s.y) - 5;
  const spanF = fine ? block(11, xF, yF) : null;
  const span = spanF ? 11 : 1;
  const ox = spanF ? xF : tile.x;
  const oy = spanF ? yF : tile.y;
  const demReady = demSlope(latDeg, lonDeg) != null ? 1 : 0;
  const id = `${tile.z}/${ox}/${oy}/${span}/d${demReady}`;
  if (id === bound) return tile.z;
  bound = id;
  const size = tile.size;
  const dstSize = size * span;
  const bytes = new Uint8Array(dstSize * dstSize * 4);
  if (spanF) spanF.forEach((t, i) => pasteTile(bytes, dstSize, (i % span) * size, Math.floor(i / span) * size, t.rgb, size));
  else pasteTile(bytes, dstSize, 0, 0, tile.rgb, size);
  if (demReady) bakeHillshade(bytes, dstSize, tile.z, ox, oy, span);
  const tex = new THREE.DataTexture(bytes, dstSize, dstSize);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  const prev = aerial.uSteppe.value;
  aerial.uSteppe.value = tex;
  if (prev) prev.dispose();
  aerial.uSteppeBox.value.set(ox, oy, tile.z, span);
  (globalThis as { __steppeSpan?: number; __steppeZ?: number; __photoDown?: number }).__steppeSpan = span;
  (globalThis as { __steppeZ?: number }).__steppeZ = tile.z;
  return tile.z;
}

/** Thatch stand-in when the aerial crop would be conifer salt. */
export function prairieNearGlsl(invPi: string) {
  return `
      float clump = detN(vDetW / 420.0, uDetail.w + 4.0);
      float fleck = detN(vDetW / 90.0, uDetail.w + 6.0);
      vec3 soilC = vec3(0.22, 0.13, 0.06);
      vec3 thatchC = vec3(0.42, 0.30, 0.11);
      vec3 strawC = vec3(0.50, 0.34, 0.11);
      vec3 openC = mix(soilC, mix(thatchC, strawC, fleck), 0.45 + 0.55 * clump);
      vec3 nrmO = normalize(vNormal);
      float hillO = clamp(dot(nrmO, normalize(vec3(-0.45, 0.72, 0.35))), 0.0, 1.0);
      float steepO = smoothstep(0.04, 0.55, length(vec2(dFdx(nrmO.x), dFdy(nrmO.y))));
      if (uSteppeBox.w > 0.5) {
        vec3 pdO = normalize(vDetW + uCamP);
        float latO = degrees(asin(clamp(pdO.y, -1.0, 1.0)));
        float lonO = degrees(atan(pdO.z, pdO.x));
        float nTilesO = exp2(uSteppeBox.z);
        float mxO = (lonO + 180.0) / 360.0 * nTilesO;
        float latcO = radians(clamp(latO, -85.0, 85.0));
        float myO = (1.0 - log(tan(latcO) + 1.0 / cos(latcO)) / ${invPi}) * 0.5 * nTilesO;
        vec2 uvO = vec2(mxO - uSteppeBox.x, myO - uSteppeBox.y) / max(uSteppeBox.w, 1.0);
        if (uvO.x > 0.001 && uvO.y > 0.001 && uvO.x < 0.999 && uvO.y < 0.999) {
          openC = textureLod(uSteppe, uvO, 0.0).rgb * 0.76;
        }
      }
      photo = mix(photo, openC, clamp(uOpenLand, 0.0, 1.0) * landMask);`;
}

/** The far steppe sample. No alpha darken: the photograph already has the drainage. */
export function prairieFarGlsl(invPi: string) {
  return `
    if (uOpenLand > 0.5 && landMask > 0.5 && uSteppeBox.w < 0.5) {
      float eyeFar = length(vViewPosition);
      float nearDisc = 1.0 - smoothstep(80000.0, 400000.0, eyeFar);
      vec3 nrmF = normalize(vNormal);
      float hillF = clamp(dot(nrmF, normalize(vec3(-0.45, 0.72, 0.35))), 0.0, 1.0);
      vec3 openFar = vec3(0.40, 0.29, 0.11) * (0.58 + 0.55 * hillF);
      diffuseColor.rgb = mix(diffuseColor.rgb, openFar, nearDisc);
    } else if (uOpenLand > 0.5 && landMask > 0.5 && uSteppeBox.w > 0.5) {
      vec3 pd = normalize(vDetW + uCamP);
      float lat = degrees(asin(clamp(pd.y, -1.0, 1.0)));
      float lon = degrees(atan(pd.z, pd.x));
      float nTiles = exp2(uSteppeBox.z);
      float mx = (lon + 180.0) / 360.0 * nTiles;
      float latc = radians(clamp(lat, -85.0, 85.0));
      float my = (1.0 - log(tan(latc) + 1.0 / cos(latc)) / ${invPi}) * 0.5 * nTiles;
      vec2 uvS = vec2(mx - uSteppeBox.x, my - uSteppeBox.y) / max(uSteppeBox.w, 1.0);
      float nearDisc = 1.0 - smoothstep(80000.0, 400000.0, length(vViewPosition));
      if (uvS.x > 0.001 && uvS.y > 0.001 && uvS.x < 0.999 && uvS.y < 0.999) {
        diffuseColor.rgb = textureLod(uSteppe, uvS, 0.0).rgb * 0.76;
      } else {
        vec3 steppe = vec3(0.40, 0.29, 0.11);
        diffuseColor.rgb = mix(diffuseColor.rgb, steppe, nearDisc);
      }
    }`;
}
