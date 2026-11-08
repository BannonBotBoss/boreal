import { smoothstep } from '../proc/math';
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
/** Base tone-mapping exposure (renderer.toneMappingExposure before photo EV). Lights are scaled so a 100 klx sun has intensity 3;
 *  three's ACES applies a further 1/0.6 gain, so at exposure 1 a sunlit 18 % grey card plus sky fill rendered ~1 EV hot (sRGB ~175
 *  instead of ~118) and the Preetham sky clipped to white. 0.5 is the value three.js uses for this Sky + ACES combination
 *  (examples/webgl_shaders_sky.html, MIT) and brings the grey card back to mid-grey [game calibration, verify with a grey card]. */
export const EXPOSURE = { base: .5 };
/** Ambient (sky + bounce) levels relative to the sun. On a clear day the diffuse sky is ~10-20 % of global horizontal
 *  irradiance (e.g. Erbs, Klein & Duffie 1982 diffuse fraction ~0.15 at clearness index 0.75; Perez sky models). The unscaled
 *  Preetham-sky PMREM (env 1) plus the SH bounce probe (.6) and the hemisphere fill made ambient rival the sun, flattening and
 *  washing out the ground (measured headless, Ultra, 11:00: ground sRGB 180,207,182 -> 116,148,114 with these values).
 *  env = scene.environmentIntensity under IBL, probe = GI LightProbe intensity, hemiIbl = hemisphere factor while IBL is on
 *  [game calibration against the diffuse fraction; verify with a grey card]. */
export const AMBIENT = { env: .3, probe: .2, hemiIbl: .11 };
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
/** Wolf low-light vision. A wolf's rod-rich retina and tapetum lucidum give it several times a human's sensitivity in dim
 *  light (dogs: ~3x lower threshold, Kemp & Jacobs; tapetum reflects ~2x more light back through the rods), so on a moonless
 *  night under canopy it still reads its legs and the ground. Below `photopic` lux the view adapts up to `wolf` x more gain,
 *  fully by `scotopic` lux (moonless starlight ~0.001 lx); full moon (~0.25 lx) and twilight stay as before.
 *  sky = night-sky diffuse (starlight/airglow + moonlight scattered by the sky) as a share of the gain-scaled light;
 *  key = an overhead skylight key from behind the viewer while the moon is down (the brightest part of the night sky stands in
 *  for the moon so the player's silhouette and gait read) [game calibration: tuned headless, ?trees=v2&hour=3.7]. */
export const NIGHT = { wolf: 6, photopic: .3, scotopic: .003, moonDiffuse: .2, sky: 2.5, key: 1.2 };
/** 0 in daylight/full moon .. 1 fully dark-adapted (log-lux smoothstep between NIGHT.photopic and NIGHT.scotopic). */
export function darkAdapted(lux: number) {
  const a = Math.log10(NIGHT.photopic), b = Math.log10(NIGHT.scotopic), t = Math.min(1, Math.max(0, (a - Math.log10(Math.max(lux, 1e-9))) / (a - b)));
  return t * t * (3 - 2 * t);
}
export const wolfEyes = (lux: number) => 1 + (NIGHT.wolf - 1) * darkAdapted(lux);
/** Hemisphere (sky) light at night for an adapted gain: starlight/airglow plus the sky-scattered share of moonlight. */
export const nightSkyLight = (Emoon: number, gain: number) => 3 * NIGHT.sky * (LUX.nightSky + NIGHT.moonDiffuse * Emoon) / LUX.ref * gain;
/** Overhead key from behind the viewer while the moon is down: fades out as real moonlight takes over. */
export const nightKey = (gain: number) => 3 * NIGHT.key * LUX.nightSky / LUX.ref * gain;

/**
 * Readable night on a real GPU (Matthew, 03:40 and 18:56).
 * Daylight later multiplies the hemisphere by AMBIENT.hemiIbl (0.11) because the IBL
 * map already has the sky. That same scale ran at dusk, while darkAdapted was still ~0,
 * so the fill fell to about 0.04 and the ground went black under a lit sky.
 *
 * η = 1 − smoothstep(−6°, 4°) on solar elevation. 0 with the sun up, 1 once it is 6° down.
 * Hemisphere floor H = 1.6 η. Moon and starlight key K = max(physical key, 1.05 η).
 * Keep κ = max(dark-adapted share, η), and the draw uses
 *   H_kept = max(H_raw, H) · (0.11 + 0.89 κ).
 * A horizontal Lambert patch of albedo a, with a low moon (μ ≈ 0.45), reads
 *   L = a (0.5 H_kept + K μ).
 * Hours 0, 3 and 22 must stay above the near-black line. Noon stays brighter.
 */
export const NIGHT_READ = { hemi: 1.6, key: 1.05, sunDownDeg: -6, sunUpDeg: 4, groundAlbedo: 0.12, wolfAlbedo: 0.42, mu: 0.45, minL: 0.1 };
export function nightAmount(sunElevationDeg: number) {
  return 1 - smoothstep(NIGHT_READ.sunDownDeg, NIGHT_READ.sunUpDeg, sunElevationDeg);
}
export function sceneFill(o: { elevation: number; rawHemi: number; rawKey: number; dark: number }) {
  const eta = nightAmount(o.elevation);
  const hemi = Math.max(o.rawHemi, NIGHT_READ.hemi * eta);
  const key = Math.max(o.rawKey, NIGHT_READ.key * eta);
  const keep = Math.max(o.dark, eta);
  const hemiKept = hemi * (AMBIENT.hemiIbl + (1 - AMBIENT.hemiIbl) * keep);
  const patch = (albedo: number) => albedo * (0.5 * hemiKept + key * NIGHT_READ.mu);
  return { eta, hemi, key, keep, hemiKept, ground: patch(NIGHT_READ.groundAlbedo), wolf: patch(NIGHT_READ.wolfAlbedo) };
}
