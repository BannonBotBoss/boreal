/**
 * CPU twin of atmosphere.ts cloudDensity's value (T-0169). The domain warp is stationary, so it is left out of the
 * marginal: a random point has the same distribution as a warped one. Billow, the squared ridge and the Worley bias
 * match the shader. Used to keep mean cover near 0.16 after the convective terms.
 */
import { hash2u } from '../../proc/rng';
import { CLOUDS } from './atmosphere';
import { fromLatLon } from './planet';
function vnoiseU(px: number, py: number, s: number) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (x: number, y: number) => hash2u(x, y, s);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function cloudBase3(p: number[], seed: number) {
  const z = Math.floor(p[2]); let f = p[2] - z; f = f * f * (3 - 2 * f);
  const n0 = vnoiseU(p[0] + z * 37, p[1] + z * 17, seed);
  const n1 = vnoiseU(p[0] + (z + 1) * 37, p[1] + (z + 1) * 17, seed);
  return n0 + (n1 - n0) * f;
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function worleyF1(p: number[]) {
  const ip = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])];
  const f = [p[0] - ip[0], p[1] - ip[1], p[2] - ip[2]];
  let d = 1;
  for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    const ox = hash2u(ip[0] + x, ip[1] + y + ip[2] * 17, 3.1);
    const oy = hash2u(ip[1] + y, ip[2] + z + ip[0] * 13, 5.7);
    const oz = hash2u(ip[2] + z, ip[0] + x + ip[1] * 19, 8.3);
    const rx = x + ox - f[0], ry = y + oy - f[1], rz = z + oz - f[2];
    d = Math.min(d, rx * rx + ry * ry + rz * rz);
  }
  return Math.sqrt(d);
}
/** Normalised cloud value at one point, octave count `oct` (the tier). `convective` false is the pre-T-0169 fBm. */
export function cloudValue(p: number[], oct: number, seed = 0, convective = true) {
  const C = CLOUDS;
  const ps = p.slice();
  let v = 0, a = 0.5, n = 0;
  for (let i = 0; i < C.octaves[0]; i++) {
    const w = Math.min(1, Math.max(0, oct - i));
    if (w <= 0) break;
    let nse = cloudBase3(ps, seed);
    if (convective && oct >= C.billowFrom && i >= 2) {
      const billow = Math.abs(nse * 2 - 1);
      const shaped = i >= 4 ? billow * 0.45 + billow * billow * 0.55 : billow;
      nse = nse * (1 - C.billowMix) + shaped * C.billowMix;
    }
    v += a * w * nse; n += a * w;
    ps[0] = ps[0] * 2.07 + 11.3; ps[1] = ps[1] * 2.07 + 11.3; ps[2] = ps[2] * 2.07 + 11.3;
    a *= C.persistence;
  }
  let fbm = v / Math.max(n, 1e-3);
  if (convective && oct >= C.billowFrom) fbm += C.billowBias;
  if (convective && oct >= C.worleyFrom) {
    const cells = 1 - smoothstep(0, 0.68, worleyF1([p[0] * C.worleyFreq + 2.2, p[1] * C.worleyFreq + 0.7, p[2] * C.worleyFreq + 4.1]));
    const shaped = Math.min(1, Math.max(0, fbm * 0.25 + cells));
    fbm = fbm * (1 - C.worleyMix) + shaped * C.worleyMix;
  }
  return fbm;
}
export function cloudCover(value: number, centre: number, half: number) {
  return smoothstep(centre - half, centre + half, value);
}
/** Mean cover and the std of the value, over `n` uncorrelated points. */
/**
 * Full-disc cloud deck used only when the shell's octave count is 0 (Minimum, SwiftShader).
 * Same construction as cloudDensity's synoptic swirl (domain warp, Coriolis twist, zonal
 * stretch in the westerlies), on the shared hash2u. Two octaves at 1,800 km: a five-octave
 * 420 km fBm read as salt-and-pepper and hid the land. The latitude curve is the zonal
 * cloud amount: ITCZ near the equator, a dry subtropical belt, storm tracks in the
 * westerlies (King et al. 2013, MODIS global mean 0.67). `corrKm` is the shortest lag at
 * which the cover's autocorrelation falls below one half; speckle dies inside a texel.
 */
export const ORBIT_DECK = {
  cellKm: 1800, octaves: 2, persistence: 0.42,
  /** how far the warped fBm swings the zonal amount, each way */
  swing: 0.62,
  /** extra warp on the orbit still, so the storm tracks meander instead of sitting in latitude stripes */
  warpGain: 2.4,
  /** pulls mid-gray toward clear or thick so the deck is systems and holes, not a haze */
  contrast: 1.45,
  /** area-weighted cover the curve is aimed at; the test accepts 0.50–0.75 */
  cover: 0.62,
  /** autocorrelation length must clear this. A speckled deck is a few tens of kilometres. */
  corrKm: 300,
};
const ORBIT_ZONAL: [number, number][] = [[0, 0.88], [8, 0.80], [16, 0.34], [26, 0.10], [36, 0.30], [48, 0.58], [58, 0.66], [68, 0.46], [80, 0.30], [90, 0.24]];
/** Zonal cloud amount at |latitude| degrees. Piecewise linear through ORBIT_ZONAL. */
export function orbitZonalCover(absLat: number) {
  const a = Math.max(0, Math.min(90, absLat));
  const z = ORBIT_ZONAL;
  if (a <= z[0][0]) return z[0][1];
  for (let i = 1; i < z.length; i++) {
    if (a <= z[i][0]) {
      const t = (a - z[i - 1][0]) / (z[i][0] - z[i - 1][0]);
      return z[i - 1][1] + (z[i][1] - z[i - 1][1]) * t;
    }
  }
  return z[z.length - 1][1];
}
const v3 = {
  add: (a: number[], b: number[], s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  scale: (a: number[], s: number) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: number[]) => Math.hypot(a[0], a[1], a[2]),
};
/** Two-octave domain-warped fBm, the CPU twin of cloudDensity's swirl without the fine chop.
 *  Returns the normalised noise and a swirl weight (high in the warp cores). */
function orbitSwirl(dir: number[]) {
  const C = CLOUDS, cell = 6371 / ORBIT_DECK.cellKm, warpS = 6371 / C.warpCellKm;
  const sl = Math.max(-1, Math.min(1, dir[1]));
  const alat = Math.abs(Math.asin(sl)) * 180 / Math.PI;
  const pw = v3.scale(dir, warpS);
  const q = [
    cloudBase3(v3.add(pw, [1.7, 9.2, 0]), 0),
    cloudBase3(v3.add(pw, [8.3, 2.8, 5.1]), 0),
    cloudBase3(v3.add(pw, [4.1, 6.3, 2.2]), 0),
  ].map(x => x - 0.5);
  const pw2 = v3.add(v3.scale(pw, 2.07), q, 2);
  q[0] += 0.5 * (cloudBase3(v3.add(pw2, [3.3, 3.3, 3.3]), 0) - 0.5);
  q[1] += 0.5 * (cloudBase3(v3.add(pw2, [7.7, 7.7, 7.7]), 0) - 0.5);
  q[2] += 0.5 * (cloudBase3(v3.add(pw2, [1.1, 1.1, 1.1]), 0) - 0.5);
  const along = v3.dot(q, dir);
  let qt = [q[0] - dir[0] * along, q[1] - dir[1] * along, q[2] - dir[2] * along];
  const tw = C.twistRad * sl, ct = Math.cos(tw), st = Math.sin(tw);
  const cr = v3.cross(dir, qt);
  qt = [qt[0] * ct + cr[0] * st, qt[1] * ct + cr[1] * st, qt[2] * ct + cr[2] * st];
  let east = [-dir[2], 0, dir[0]];
  const el = v3.len(east);
  east = el > 1e-4 ? v3.scale(east, 1 / el) : [1, 0, 0];
  const stretch = C.zonalStretch * smoothstep(20, 35, alat) * (1 - smoothstep(60, 75, alat));
  const eDot = v3.dot(qt, east);
  qt = v3.add(qt, east, eDot * stretch);
  qt = v3.scale(qt, ORBIT_DECK.warpGain);
  let p = v3.add(v3.scale(dir, cell), qt, C.warpAmp * cell);
  let v = 0, a = 0.5, n = 0;
  for (let i = 0; i < ORBIT_DECK.octaves; i++) {
    v += a * cloudBase3(p, 0); n += a;
    p = v3.add(v3.scale(p, 2.07), [11.3, 11.3, 11.3]);
    a *= ORBIT_DECK.persistence;
  }
  return { n: v / Math.max(n, 1e-3), swirl: Math.min(1, v3.len(qt) * 1.6), alat };
}
/** Cover 0..1 at one direction. Zonal amount plus the warped noise, so the subtropics stay
 *  mostly clear and the storm tracks and the ITCZ are broad systems, not speckles. */
export function orbitCloudAt(dir: number[]) {
  const s = orbitSwirl(dir);
  const prior = orbitZonalCover(s.alat);
  // Swirl cores (the warp) gather cloud; the quiet lanes between them stay clearer, mean kept.
  const storm = smoothstep(30, 46, s.alat) * (1 - smoothstep(66, 78, s.alat));
  const itcz = 1 - smoothstep(5, 16, s.alat);
  const swing = ORBIT_DECK.swing * (0.28 + 0.85 * Math.max(storm, itcz * 0.75));
  const org = (s.swirl - 0.4) * 0.22 * Math.max(storm, itcz);
  const raw = prior + (s.n - 0.5) * swing * 2 + org;
  const shaped = (raw - 0.4) * ORBIT_DECK.contrast + 0.4;
  const cover = Math.max(0, Math.min(1, shaped));
  // The pole of an equirectangular map stretches one texel into spokes. Above 68° the
  // amount follows the zonal curve only, so the cap is smooth.
  const pole = smoothstep(68, 80, s.alat);
  return cover * (1 - pole) + prior * pole;
}
/** Equirectangular cover, 0..255, row 0 at the south pole. Same orientation as the orbit albedo. */
export function orbitCloudBytes(width: number, height: number) {
  const out = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    const lat = (-90 + (j + 0.5) / height * 180) * Math.PI / 180;
    for (let i = 0; i < width; i++) {
      const lon = (-180 + (i + 0.5) / width * 360) * Math.PI / 180;
      const cov = orbitCloudAt(fromLatLon(lat, lon));
      out[j * width + i] = Math.max(0, Math.min(255, Math.round(cov * 255)));
    }
  }
  return out;
}
/**
 * Area-weighted cover, the clear and opaque shares, and the autocorrelation length.
 * Length is the shortest longitude lag, at the equator and at 50°N, where the
 * correlation of that parallel falls below one half. A flat row has no variance and
 * does not count.
 */
export function orbitCloudReport(width = 360, height = 180) {
  const bytes = orbitCloudBytes(width, height);
  let cover = 0, wsum = 0, clear = 0, thick = 0;
  for (let j = 0; j < height; j++) {
    const lat = (-90 + (j + 0.5) / height * 180) * Math.PI / 180;
    const wt = Math.max(0, Math.cos(lat));
    for (let i = 0; i < width; i++) {
      const c = bytes[j * width + i] / 255;
      wsum += wt; cover += wt * c;
      if (c < 0.2) clear += wt;
      if (c > 0.7) thick += wt;
    }
  }
  const corrKm = (latDeg: number) => {
    const j = Math.max(0, Math.min(height - 1, Math.round(((latDeg + 90) / 180) * height - 0.5)));
    const row = Array.from({ length: width }, (_, i) => bytes[j * width + i] / 255);
    const m = row.reduce((a, b) => a + b, 0) / width;
    let v = 0;
    for (const x of row) v += (x - m) * (x - m);
    if (v < 1e-4) return Infinity;
    const kmPer = 40075 * Math.cos(latDeg * Math.PI / 180) / width;
    for (let lag = 1; lag < width / 2; lag++) {
      let c = 0;
      for (let i = 0; i < width; i++) c += (row[i] - m) * (row[(i + lag) % width] - m);
      if (c / v < 0.5) return lag * kmPer;
    }
    return (width / 2) * kmPer;
  };
  const lengths = [corrKm(0), corrKm(50)].filter(x => Number.isFinite(x));
  return {
    cover: cover / wsum, clear: clear / wsum, thick: thick / wsum,
    corrKm: lengths.length ? Math.min(...lengths) : 0,
    bytes, width, height,
  };
}
export function cloudCoverStats(oct: number, centre: number, half: number, n = 480, convective = true) {
  let cover = 0, mean = 0;
  for (let i = 0; i < n; i++) {
    const p = [(i * 12.9898) % 40, (i * 78.233) % 40, (i * 37.719) % 40];
    const value = cloudValue(p, oct, 0, convective);
    mean += value; cover += cloudCover(value, centre, half);
  }
  let m = mean / n, v = 0;
  for (let i = 0; i < n; i++) {
    const p = [(i * 12.9898) % 40, (i * 78.233) % 40, (i * 37.719) % 40];
    const d = cloudValue(p, oct, 0, convective) - m; v += d * d;
  }
  return { cover: cover / n, mean: m, sd: Math.sqrt(v / n) };
}
