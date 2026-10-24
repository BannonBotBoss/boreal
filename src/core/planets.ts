/** Planets as emergent sky objects: heliocentric Kepler orbits (orbit.ts solver) from the JPL approximate elements, Standish
 *  "Keplerian Elements for Approximate Positions of the Major Planets" table 1 (1800-2050 AD, J2000 ecliptic), then geocentric
 *  RA/Dec, elongation, phase angle and apparent V magnitude (Mallama & Hilton 2018, Astron. Comput. 25:10, Venus eq. for phase
 *  angle < 163.7 deg). Nothing is placed by hand: where and how bright the dot is comes from these numbers; whether you see it
 *  comes from the sky brightness + extinction of the atmosphere shader. */
import { K } from './constants';
import { eccentricAnomaly, trueFromE } from './orbit';
type El = [number, number]; // value at J2000, rate per Julian century
export interface Elements { a: El; e: El; I: El; L: El; peri: El; node: El }
export const ELEMENTS: Record<'venus' | 'earth', Elements> = {
  venus: { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418] },
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0] }, // Earth-Moon barycentre
};
const D = Math.PI / 180, OBLIQ = 23.43928 * D; // J2000 mean obliquity (IAU 2006)
export const jdFromDate = (d: Date) => d.getTime() / 86400000 + 2440587.5;
/** heliocentric J2000 ecliptic xyz (AU) */
export function helio(p: Elements, jd: number): [number, number, number] {
  const T = (jd - K.J2000_JD) / 36525, v = (x: El) => x[0] + x[1] * T;
  const a = v(p.a), e = v(p.e), I = v(p.I) * D, L = v(p.L), w = v(p.peri), O = v(p.node) * D;
  const M = ((L - w) % 360 + 540) % 360 - 180, E = eccentricAnomaly(M * D, e), nu = trueFromE(E, e), r = a * (1 - e * Math.cos(E));
  const u = nu + (w * D - O); // argument of latitude
  return [r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(I)), r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(I)), r * Math.sin(u) * Math.sin(I)];
}
/** Mallama & Hilton 2018 Venus V(1,0,alpha) */
export function venusMag(r: number, delta: number, alphaDeg: number) {
  const a = alphaDeg, h = a < 163.7 ? -4.384 - 1.044e-3 * a + 3.687e-4 * a * a - 2.814e-6 * a ** 3 + 8.938e-9 * a ** 4 : 236.05828 - 2.81914 * a + 8.39034e-3 * a * a;
  return 5 * Math.log10(r * delta) + h;
}
export function venusAt(date: Date) {
  const jd = jdFromDate(date), p = helio(ELEMENTS.venus, jd), e = helio(ELEMENTS.earth, jd);
  const g = [p[0] - e[0], p[1] - e[1], p[2] - e[2]], delta = Math.hypot(...g), r = Math.hypot(...p), R = Math.hypot(...e);
  const eq = [g[0], g[1] * Math.cos(OBLIQ) - g[2] * Math.sin(OBLIQ), g[1] * Math.sin(OBLIQ) + g[2] * Math.cos(OBLIQ)];
  const ra = ((Math.atan2(eq[1], eq[0]) / D) + 360) % 360, dec = Math.asin(eq[2] / delta) / D;
  const sunG = [-e[0], -e[1], -e[2]], elong = Math.acos((g[0] * sunG[0] + g[1] * sunG[1] + g[2] * sunG[2]) / (delta * R)) / D;
  const alpha = Math.acos((r * r + delta * delta - R * R) / (2 * r * delta)) / D;
  const west = (Math.atan2(g[1], g[0]) - Math.atan2(sunG[1], sunG[0]) + 3 * Math.PI) % (2 * Math.PI) - Math.PI < 0; // west of the Sun = morning star
  return { jd, ra, dec, delta, r, elong, alpha, mag: venusMag(r, delta, alpha), morning: west, illum: (1 + Math.cos(alpha * D)) / 2, eqUnit: eq.map(x => x / delta) as [number, number, number] };
}

/** Geocentric Sun RA/Dec (deg) from the same Earth elements */
export function sunAt(date: Date) { const e = helio(ELEMENTS.earth, jdFromDate(date)), g = [-e[0], -e[1], -e[2]], r = Math.hypot(...g);
  const eq = [g[0], g[1] * Math.cos(OBLIQ) - g[2] * Math.sin(OBLIQ), g[1] * Math.sin(OBLIQ) + g[2] * Math.cos(OBLIQ)];
  return { ra: ((Math.atan2(eq[1], eq[0]) / D) + 360) % 360, dec: Math.asin(eq[2] / r) / D }; }
/** Alt/az of RA/Dec for an observer; local sidereal time from GMST (IAU 1982, Meeus 12.4). Same direction convention as timeOfDay.sunPosition. */
export function altAz(ra: number, dec: number, date: Date, latDeg: number, lonDeg: number) {
  const T = (jdFromDate(date) - 2451545), gmst = (280.46061837 + 360.98564736629 * T) % 360, ha = (gmst + lonDeg - ra) * D, d = dec * D, p = latDeg * D;
  const el = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(ha));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(p) - Math.tan(d) * Math.cos(p)) + Math.PI;
  return { elevation: el / D, azimuth: ((az / D) % 360 + 360) % 360, direction: { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az) } };
}
