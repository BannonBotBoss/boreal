/**
 * The night sky (Claude). Pure functions, shared by render/stars, render/sky and tests.
 *  - Stars: a seeded procedural catalogue (PROJECT-RULES rule 1: no real catalogue). Counts follow the observed cumulative law
 *    log10 N(<m) ≈ 0.68 + 0.5 m over the whole sky (fit to N(<1) ≈ 15, N(<3) ≈ 150, N(<6) ≈ 5 000, N(<7) ≈ 15 000; Allen's
 *    Astrophysical Quantities, 4th ed., ch. 15) [verify]. Faint stars crowd toward the galactic plane, bright ones barely.
 *    Colours: B−V spread → temperature (Ballesteros 2012, EPL 97:34008) → Planck law at the R, G, B wavelengths.
 *  - Rotation: Greenwich mean sidereal time (Meeus 1998, Astronomical Algorithms, eq. 12.4, linear term) at the game's latitude
 *    and Kenora's longitude, so the sky turns once per sidereal day with the game clock, the same clock as the sun.
 *  - Extinction k·(X − 1) mag with core/light's Kasten & Young air mass; scintillation σ_I/I ∝ X^1.75 (Young 1967, AJ 72:747;
 *    Dravins et al. 1997, PASP 109:173) [verify].
 *  - Limiting magnitude: twilight, moonlight and haze lower it (after Schaefer 1993, Vistas Astron. 36:311) [verify]; looking up
 *    raises it (eye adaptation once the bright ground leaves the view) [game calibration].
 *  - Meteors: shower table (IMO working list: radiant, peak, ZHR, population index r, speed), activity ZHR·10^(−B|Δd|)
 *    (Jenniskens 1994, A&A 287:990), observed rate ZHR·sin(h_R)·r^(lm − 6.5), magnitudes from r, light at ~100 km height
 *    (Ceplecha et al. 1998, Space Sci. Rev. 84:327). One game hour of meteors falls in one game hour (5 real minutes).
 */
import { hash, random, sample } from '../proc/rng';
import { airMass } from './light';
import { LATITUDE } from './timeOfDay';

const RAD = Math.PI / 180;
export type Vec3 = [number, number, number];
/** Kenora, Ontario (degrees east). */
export const LONGITUDE = -94.5;
export const NIGHT_SKY = {
  count: 16000, brightest: -1.5, countLaw: { a: .68, b: .5 },
  extinction: .25,          // V mag per air mass, clean continental site (0.15-0.3) [verify]
  darkLimit: 6.5,           // naked-eye limiting magnitude, dark moonless sky
  // Looking up: limit +1 mag and 1.8× brightness, rising over ~1.5 s and falling over ~0.6 s, between 10° and 55° pitch [game calibration]
  look: { limit: 1, gain: .8, rise: 1.5, fall: .6, from: 10, to: 55 },
  scint: { zenith: .12, power: 1.75 },
  meteorKm: 100, earthKm: 6371,
};
/** Galactic north pole and centre (J2000, degrees). */
export const GALACTIC = { poleRa: 192.85948, poleDec: 27.12825, centreRa: 266.40499, centreDec: -28.93617 };

export const unitRaDec = (ra: number, dec: number): Vec3 => {
  const a = ra * RAD, d = dec * RAD; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: readonly number[]): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** Rows of the equatorial → galactic rotation (x toward the centre, z toward the north pole). */
export function galacticRows(): [Vec3, Vec3, Vec3] {
  const z = unitRaDec(GALACTIC.poleRa, GALACTIC.poleDec), c = unitRaDec(GALACTIC.centreRa, GALACTIC.centreDec);
  const x = norm([c[0] - dot(c, z) * z[0], c[1] - dot(c, z) * z[1], c[2] - dot(c, z) * z[2]]);
  return [x, cross(z, x), z];
}
/** Galactic latitude (radians) of an equatorial unit vector. */
export const galacticLatitude = (eq: readonly number[]) => Math.asin(Math.max(-1, Math.min(1, dot(eq, galacticRows()[2]))));

// ---- stars -------------------------------------------------------------------------------------------------------------
export interface StarCatalogue { count: number; dir: Float32Array; mag: Float32Array; colour: Float32Array; phase: Float32Array }
/** Stars brighter than magnitude m in the whole sky (the count law). */
export const starsBrighter = (m: number) => 10 ** (NIGHT_SKY.countLaw.a + NIGHT_SKY.countLaw.b * m);
/** Linear RGB of a blackbody (max channel = 1) from B−V: Ballesteros temperature, Planck at 610/550/465 nm. */
export function starColour(bv: number): Vec3 {
  const T = 4600 * (1 / (.92 * bv + 1.7) + 1 / (.92 * bv + .62));
  const c = [.61, .55, .465].map(l => l ** -5 / (Math.exp(14388 / (l * T)) - 1)), m = Math.max(...c);
  return [c[0] / m, c[1] / m, c[2] / m];
}
/** Seeded catalogue, brightest first (so a draw range can stop at the limiting magnitude). Directions are equatorial. */
export function starCatalogue(seed: number, count = NIGHT_SKY.count): StarCatalogue {
  const r = random(hash(`stars:${seed}`)), { a, b } = NIGHT_SKY.countLaw, nMin = starsBrighter(NIGHT_SKY.brightest);
  const mags = Array.from({ length: count }, () => (Math.log10(nMin + r() * (count - nMin)) - a) / b).sort((x, y) => x - y);
  const pole = galacticRows()[2], cat: StarCatalogue = { count, dir: new Float32Array(count * 3), mag: Float32Array.from(mags),
    colour: new Float32Array(count * 3), phase: new Float32Array(count) };
  for (let i = 0; i < count; i++) {
    const m = mags[i], k = Math.max(0, Math.min(4, .7 * (m - 2.5))); // concentration toward the plane grows with faintness
    let v: Vec3 = [0, 0, 1];
    for (let t = 0; t < 32; t++) {
      const z = 2 * r() - 1, p = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); v = [s * Math.cos(p), s * Math.sin(p), z];
      if (r() * (1 + k) < 1 + k * Math.exp(-Math.abs(dot(v, pole)) / .15)) break;
    }
    cat.dir.set(v, i * 3);
    const c = starColour(sample(r, { mean: .7, sd: .45, min: -.3, max: 1.9 }));
    // Rods see no colour: only stars brighter than ~3 mag keep visible tint.
    const sat = Math.max(.12, Math.min(1, 1 - (m - 1) / 3)), lum = .3 * c[0] + .59 * c[1] + .11 * c[2];
    cat.colour.set(c.map(x => lum + (x - lum) * sat), i * 3);
    cat.phase[i] = r();
  }
  return cat;
}

// ---- sky rotation ------------------------------------------------------------------------------------------------------
/** Local mean sidereal time (hours) at local solar `hour` of `day` (1 = 1 Jan). */
export function localSiderealHours(day: number, hour: number, lon = LONGITUDE, year = 2026) {
  const ut = hour - lon / 15, D = (Date.UTC(year, 0, 1) - Date.UTC(2000, 0, 1, 12)) / 864e5 + day - 1 + ut / 24;
  return ((18.697374558 + 24.06570982441908 * D + lon / 15) % 24 + 24) % 24;
}
/** Column-major 3×3 (THREE.Matrix3.fromArray) taking an equatorial unit vector to world (−z north, +x east, y up). */
export function equatorialToWorld(lstHours: number, lat = LATITUDE): number[] {
  const t = lstHours * 15 * RAD, p = lat * RAD, c = Math.cos(t), s = Math.sin(t);
  const Q = [0, Math.cos(p), Math.sin(p)], E = [1, 0, 0], P = [0, Math.sin(p), -Math.cos(p)]; // meridian-equator point, east, pole
  const col = (q: number, e: number) => [0, 1, 2].map(i => q * Q[i] + e * E[i]);
  return [...col(c, -s), ...col(s, c), ...P];
}
export const apply3 = (m: readonly number[], v: readonly number[]): Vec3 => [0, 1, 2].map(i => m[i] * v[0] + m[3 + i] * v[1] + m[6 + i] * v[2]) as Vec3;

// ---- seeing ------------------------------------------------------------------------------------------------------------
export const extinctionMag = (cosZ: number) => NIGHT_SKY.extinction * (airMass(cosZ) - 1);
export const scintillation = (cosZ: number, seeing = 1) => Math.min(.9, NIGHT_SKY.scint.zenith * airMass(cosZ) ** NIGHT_SKY.scint.power * seeing);
const TWILIGHT: [number, number][] = [[-18, 6.5], [-12, 5.2], [-6, 2.2], [-2, -1], [4, -4]]; // sun elevation → limit [verify]
/** Naked-eye limiting magnitude at the zenith. moonIllum 0..1, haze 0..1, adapt 0..1 (looking up). */
export function limitingMagnitude(sunElevation: number, moonIllum = 0, moonElevation = -90, haze = 0, adapt = 0) {
  let tw = TWILIGHT[TWILIGHT.length - 1][1];
  if (sunElevation <= TWILIGHT[0][0]) tw = TWILIGHT[0][1];
  else for (let i = 1; i < TWILIGHT.length; i++) if (sunElevation <= TWILIGHT[i][0]) {
    const [e0, m0] = TWILIGHT[i - 1], [e1, m1] = TWILIGHT[i]; tw = m0 + (m1 - m0) * (sunElevation - e0) / (e1 - e0); break;
  }
  const moonUp = Math.max(0, Math.sin(moonElevation * RAD));
  return Math.min(NIGHT_SKY.darkLimit, tw) - 2 * moonIllum * Math.sqrt(moonUp) - .5 * haze + NIGHT_SKY.look.limit * adapt;
}
/** Illuminated fraction of the moon for a lunar age (days). */
export const moonIllumination = (age: number, synodic = 29.530589) => (1 - Math.cos(age / synodic * 2 * Math.PI)) / 2;

// ---- meteors -----------------------------------------------------------------------------------------------------------
/** ra/dec of the radiant (°), peak day of year, ZHR at peak, B (activity falls 10^−B per day), population index r, speed km/s. */
export interface Shower { name: string; ra: number; dec: number; peak: number; zhr: number; slope: number; r: number; v: number }
export const SHOWERS: Shower[] = [ // IMO working list (peaks for 2026, ±1 d) [verify]
  { name: 'Quadrantids', ra: 230, dec: 49, peak: 3.5, zhr: 110, slope: .8, r: 2.1, v: 41 },
  { name: 'Lyrids', ra: 271, dec: 34, peak: 112.5, zhr: 18, slope: .4, r: 2.1, v: 49 },
  { name: 'eta Aquariids', ra: 338, dec: -1, peak: 125.5, zhr: 50, slope: .08, r: 2.4, v: 66 },
  { name: 'Perseids', ra: 48, dec: 58, peak: 224.6, zhr: 100, slope: .2, r: 2.2, v: 59 },
  { name: 'Orionids', ra: 95, dec: 16, peak: 294.5, zhr: 20, slope: .12, r: 2.5, v: 66 },
  { name: 'Leonids', ra: 152, dec: 22, peak: 321.5, zhr: 15, slope: .3, r: 2.5, v: 71 },
  { name: 'Geminids', ra: 112, dec: 33, peak: 348, zhr: 150, slope: .4, r: 2.6, v: 35 },
];
/** Sporadic background: ~10/h, more before dawn (the apex rises), population index 3, ~30 km/s [verify]. */
export const SPORADIC = { hr: 10, dawn: .5, r: 3, v: 30 };
export function zhrOn(s: Shower, day: number) {
  const d = Math.abs(day - s.peak), dd = Math.min(d, 365.25 - d);
  return s.zhr * 10 ** (-s.slope * dd);
}
/** Meteors per hour an observer sees from a radiant at `altitude` (°) with limiting magnitude lm. */
export const showerRate = (zhr: number, altitude: number, lm: number, r: number) => zhr * Math.max(0, Math.sin(altitude * RAD)) * r ** (lm - 6.5);
export const sporadicRate = (hour: number, lm: number) => SPORADIC.hr * (1 + SPORADIC.dawn * Math.cos(2 * Math.PI * (hour - 6) / 24)) * SPORADIC.r ** (lm - 6.5);

export interface Meteor {
  start: Vec3; end: Vec3; mag: number; v: number; duration: number; seed: number;
  flares: { x: number; a: number }[]; train: number; persistent: boolean; head: Vec3; wake: Vec3; glow: Vec3;
}
/** Distance (km) to a point at the meteor height seen at elevation sinA. */
export const meteorDistance = (sinA: number) => { const R = NIGHT_SKY.earthKm, h = NIGHT_SKY.meteorKm, s = R * Math.max(0, sinA); return Math.sqrt(s * s + 2 * R * h + h * h) - s; };
/** One meteor in world directions (y up). `radiant` = world unit vector, or undefined for a sporadic. */
export function sampleMeteor(rnd: () => number, lm: number, r: number, v: number, radiant?: Vec3): Meteor {
  const mag = lm + Math.log(1 - rnd()) / Math.log(r); // N(≤m) ∝ r^m
  let rad = radiant;
  if (!rad) { const y = rnd(), a = 2 * Math.PI * rnd(), s = Math.sqrt(1 - y * y); rad = [s * Math.cos(a), y, s * Math.sin(a)]; }
  let p: Vec3 = [0, 1, 0], cosPsi = 1;
  for (let i = 0; i < 24; i++) {
    const y = Math.sin(8 * RAD) + rnd() * (1 - Math.sin(8 * RAD)), a = 2 * Math.PI * rnd(), s = Math.sqrt(1 - y * y);
    p = [s * Math.cos(a), y, s * Math.sin(a)]; cosPsi = dot(p, rad); if (cosPsi < Math.cos(4 * RAD)) break;
  }
  const t = norm([p[0] * cosPsi - rad[0], p[1] * cosPsi - rad[1], p[2] * cosPsi - rad[2]]); // along the great circle, away from the radiant
  const sinPsi = Math.sqrt(Math.max(0, 1 - cosPsi * cosPsi));
  const km = Math.max(8, Math.min(110, 12 + 6 * (5 - mag))); // brighter meteoroids burn longer [game calibration after Ceplecha 1998]
  const A = Math.min(70 * RAD, km * Math.max(.08, sinPsi) / meteorDistance(p[1]));
  const end: Vec3 = [p[0] * Math.cos(A) + t[0] * Math.sin(A), p[1] * Math.cos(A) + t[1] * Math.sin(A), p[2] * Math.cos(A) + t[2] * Math.sin(A)];
  const flares: { x: number; a: number }[] = [];
  if (mag < 1.5) for (let i = Math.floor(rnd() * 3); i > 0; i--) flares.push({ x: .3 + .65 * rnd(), a: 1 + 3 * rnd() });
  if (mag < -3) flares.push({ x: .82 + .12 * rnd(), a: 5 + 6 * rnd() }); // fireball terminal burst
  const persistent = mag < -2.5 && v > 40;
  const train = persistent ? Math.min(10, 1.5 + 1.2 * (-2.5 - mag)) : mag < 2 ? .25 + .15 * (2 - mag) : 0;
  const fast = Math.max(0, Math.min(1, (v - 30) / 30)); // Mg/Fe/O blue-green heads when fast, Na yellow-orange when slow
  const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  return { start: p, end, mag, v, duration: km / v, seed: rnd(), flares, train, persistent,
    head: mix([1, .86, .62], [.78, 1, .86], fast), wake: mix([1, .62, .3], [1, .78, .55], fast), glow: persistent ? [.42, 1, .55] : [1, .7, .45] };
}
/** Relative brightness along the path x ∈ [0, 1]: the classic late-peaking curve (peak 1 at x = 2/3) plus flares. */
export function meteorLight(x: number, flares: readonly { x: number; a: number }[] = []) {
  if (x <= 0 || x >= 1) return 0;
  let l = 6.75 * x * x * (1 - x);
  for (const f of flares) l += f.a * Math.exp(-(((x - f.x) / .035) ** 2));
  return l;
}
