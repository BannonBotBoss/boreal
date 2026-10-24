/**
 * Figure of the Earth, derived rather than declared (Grok Bot, T-0070 stage 1; Matthew: "that is how it should be generated, not (create a sphere)").
 * The surface radius is where the material field (rust interior.rs: PREM inside, gas.rs outside) drops from condensed to gas: 6371.0005 km.
 * The shape is the hydrostatic figure of that mass distribution spinning at omega: Darwin–Radau (Jeffreys 1976 §4.03),
 *   f = (5m/2) / (1 + 25/4 (1 − 3C/(2Ma²))²),  m = ω²a³/GM,  a = R (1−f)^(−1/3)  (equal volume),
 * with GM, ω and C/MR² (PREM-integrated) from the constants graph. Result 1/f = 299.69 against WGS84 298.257 (0.48 %, the known
 * Darwin–Radau + non-hydrostatic gap). Mirrors interior.rs figure(); tests/figure.test.ts locks the two together.
 */
import { K } from '../../core/constants';
import type { Vec3 } from './planet';

export function earthFigure(rSurf = K.R_earth_mean) {
  let f = 0;
  for (let i = 0; i < 20; i++) { const a = rSurf * (1 - f) ** (-1 / 3), m = K.omega_earth ** 2 * a ** 3 / K.GM_earth, ka = K.earth_moi_prem * (rSurf / a) ** 2;
    f = 2.5 * m / (1 + 6.25 * (1 - 1.5 * ka) ** 2); }
  const a = rSurf * (1 - f) ** (-1 / 3); return { f, a, c: a * (1 - f) };
}
let FIG: ReturnType<typeof earthFigure> | null = null;
/** Surface radius (m) of the hydrostatic figure along unit direction d (spin axis +y). */
export function figureRadius(d: Vec3): number { const { a, c } = FIG ??= earthFigure(); const xz = d[0] * d[0] + d[2] * d[2], y = d[1] * d[1];
  return a * c / Math.sqrt(c * c * xz + a * a * y); }
