/** Earth's orbit (Kepler) and Milankovitch terms. Sources: NASA Earth Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html);
 *  Meeus 1998, Astronomical Algorithms ch. 25 & 30; IAU 2012 au; Laskar et al. 2004 (A&A 428, 261) periods/ranges.
 *  core/weather.ts sunPosition (NOAA) stays the day-of-year sun for the sim; this module gives distance, speed and the
 *  1/r^2 factor, and deep-time orbital variation. Nothing here replaced existing code (no orbit code existed). */
export const ORBIT = {
  aKm: 1.495978707e8, e: 0.0167086, siderealYearD: 365.25636, tropicalYearD: 365.24219, siderealDayS: 86164.1, obliquityDeg: 23.4393,
  /** Sun's geocentric ecliptic longitude at perihelion (Earth's longitude of perihelion 102.937 + 180), J2000 (Meeus table 31.a) */
  perihelionSunLonDeg: 282.937, perihelionDoy: 3, GM_sun: 1.32712440018e11, // km^3/s^2
};
const RAD = Math.PI / 180;
/** Solve Kepler M = E - e sin E (Newton) */
export function eccentricAnomaly(M: number, e = ORBIT.e) { let E = M; for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
export const trueFromE = (E: number, e = ORBIT.e) => 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
/** Distance (km) and speed (km/s, vis-viva) `days` after perihelion */
export function orbitAt(days: number, e = ORBIT.e) {
  const M = 2 * Math.PI * days / ORBIT.siderealYearD, E = eccentricAnomaly(M, e), r = ORBIT.aKm * (1 - e * Math.cos(E));
  return { r, v: Math.sqrt(ORBIT.GM_sun * (2 / r - 1 / ORBIT.aKm)), nu: trueFromE(E, e), insolationFactor: (ORBIT.aKm / r) ** 2 };
}
/** days from perihelion to the sun's ecliptic longitude `lonDeg` */
export function daysToSunLon(lonDeg: number, e = ORBIT.e) {
  const nu = ((lonDeg - ORBIT.perihelionSunLonDeg) * RAD + 4 * Math.PI) % (2 * Math.PI);
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2)), M = E - e * Math.sin(E);
  return ((M + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * ORBIT.siderealYearD;
}
/** season lengths (days): spring 0->90, summer 90->180, autumn 180->270, winter 270->360 (NH, sun longitude) */
export function seasonLengths(e = ORBIT.e) { const t = [0, 90, 180, 270, 360].map(l => daysToSunLon(l % 360, e)); const Y = ORBIT.siderealYearD;
  const d = (a: number, b: number) => ((b - a) % Y + Y) % Y; return { spring: d(t[0], t[1]), summer: d(t[1], t[2]), autumn: d(t[2], t[3]), winter: d(t[3], t[4]) }; }
/** Milankovitch: APPROXIMATE single sinusoids (not the Laskar 2004 series; ranges and main periods from Laskar 2004 / Berger 1978).
 *  offsetYr from now (negative = past). Phases set so t = 0 gives today's values. [approximate] */
export function milankovitch(offsetYr: number) {
  const ob = 23.3 + 1.2 * Math.sin(2 * Math.PI * offsetYr / 41_000 + Math.asin((ORBIT.obliquityDeg - 23.3) / 1.2) ); // 22.1-24.5 deg
  const ec = Math.max(0, 0.028 + 0.012 * Math.cos(2 * Math.PI * offsetYr / 405_000 + 0.0) + 0.016 * Math.cos(2 * Math.PI * offsetYr / 100_000 + Math.acos(Math.max(-1, Math.min(1, (ORBIT.e - 0.040) / 0.016)))));
  const precessionDeg = (ORBIT.perihelionSunLonDeg + 360 * offsetYr / 25_800) % 360; // axial precession ~25.8 kyr (climatic ~21-23 kyr incl. apsidal)
  return { obliquityDeg: ob, e: ec, precessionDeg, approximate: true };
}
