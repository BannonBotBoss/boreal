/**
 * CPU twin of atmosphere.ts cloudDensity's value (T-0169). The domain warp is stationary, so it is left out of the
 * marginal: a random point has the same distribution as a warped one. Billow, the squared ridge and the Worley bias
 * match the shader. Used to keep mean cover near 0.16 after the convective terms.
 */
import { hash2u } from '../../proc/rng';
import { CLOUDS } from './atmosphere';
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
