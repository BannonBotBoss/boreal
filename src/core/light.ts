/**
 * Natural light in physical units (Grok Bot), rule 7. Pure functions, shared by the sky, exposure and tests.
 *  - Sun colour from spectral transmittance along the slant path: Rayleigh optical depth (Hansen & Travis 1974, Space Sci.
 *    Rev. 16:527, eq. 2.26 fit; λ in µm) + Ångström aerosol τ = β λ^−α (Ångström 1929; boreal background β ≈ 0.05, α ≈ 1.3
 *    [verify]); Kasten & Young (1989) air mass. Normalised so the overhead sun is white.
 *  - Illuminance: sun E = global shortwave × luminous efficacy ~105 lm/W (Littlefair 1985, Lighting Res. Technol. 17:162:
 *    100–120 lm/W for global daylight) [verify]; full moon at zenith ≈ 0.27 lx with Allen's lunar phase law
 *    10^(−0.4(0.026|φ| + 4e−9 φ⁴)) (Krisciunas & Schaefer 1991, PASP 103:1033); moonless clear sky (stars + airglow)
 *    ≈ 0.001 lx (Kyba et al. 2015, Sci. Rep. 5:8409) [verify].
 *  - Lunar age from the mean synodic month 29.530589 d and the new moon of 2000-01-06 18:14 UT (Meeus 1998, Astronomical
 *    Algorithms, ch. 49).
 */
const WL = [.68, .55, .44]; // µm: R, G, B
export const rayleighTau = (um: number) => .008569 * um ** -4 * (1 + .0113 * um ** -2 + .00013 * um ** -4);
export const aerosolTau = (um: number, beta = .05, alpha = 1.3) => beta * um ** -alpha;
export const airMass = (cosZ: number) => { const z = Math.acos(Math.max(-1, Math.min(1, cosZ))) * 180 / Math.PI; return z >= 90 ? 40 : 1 / (cosZ + .50572 * (96.07995 - z) ** -1.6364); };
/** Linear RGB of direct sunlight (overhead = 1,1,1). `haze` scales β (turbidity from the weather). */
export function sunColour(cosZ: number, haze = 1) {
  const m = airMass(cosZ), t = WL.map(l => Math.exp(-(rayleighTau(l) + aerosolTau(l, .05 * haze)) * m)), t0 = WL.map(l => Math.exp(-(rayleighTau(l) + aerosolTau(l, .05 * haze))));
  const c = t.map((v, i) => v / t0[i]), max = Math.max(...c, 1e-9);
  return { r: c[0] / max, g: c[1] / max, b: c[2] / max, transmittance: t[1] };
}
export const LUX = { efficacy: 105, fullMoon: .27, nightSky: .001, ref: 1e5 }; // ref = clear-day sun on a horizontal plane ≈ 100 klx (CIE)
export const SYNODIC = 29.530589;
/** Lunar age (days) for a day-of-year in `year` (UT noon). */
export function moonAge(dayOfYear: number, year = 2026) {
  const days = (Date.UTC(year, 0, 1) - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 + dayOfYear - 1 + .5; // day 1 = 1 Jan; UT noon
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}
/** Moon illuminance on a horizontal plane: phase law × sin(elevation). Phase angle φ = 180° at new moon, 0° at full. */
export function moonLux(age: number, sinElevation: number) {
  const phi = Math.abs(180 - age / SYNODIC * 360);
  return Math.max(0, sinElevation) * LUX.fullMoon * 10 ** (-.4 * (.026 * phi + 4e-9 * phi ** 4));
}
/** Exposure gain for a scene illuminance: partial adaptation (E_ref/E)^0.85, clamped (game calibration: keeps today's
 * full-moon look; a fully adapting camera would use exponent 1). Photo-mode EV multiplies on top. */
export const exposureFor = (lux: number) => Math.min(4e6, Math.max(1, (LUX.ref / Math.max(lux, 1e-6)) ** .85));
