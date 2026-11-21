/**
 * Twin of rust/boreal-sim/src/cosmic_time.rs and the cycle helpers in
 * @boreal/world/cosmos/cineBeats — kept local so this app does not pull the film sheet.
 */
export const PLANCK_S = 5.39e-44;
export const YEAR_S = 365.25 * 86400;
export const TODAY_YR = 13.8e9;
export const C_LIGHT = 299_792_458;
/** Observable-universe particle-horizon pin (Gly → m). */
export const R_OBS_M = 46.5e9 * YEAR_S * C_LIGHT;
export const ALPHA_STAR = 1 / 137;

export function cycleToSeconds(cycle: number): number {
  if (!Number.isFinite(cycle)) return NaN;
  if (cycle === 0) return 0;
  const mag = PLANCK_S * 10 ** (Math.abs(cycle) - 1);
  return cycle < 0 ? -mag : mag;
}

export function secondsToCycle(seconds: number): number {
  if (!Number.isFinite(seconds)) return NaN;
  if (seconds === 0) return 0;
  const c = Math.log10(Math.abs(seconds)) - Math.log10(PLANCK_S) + 1;
  return seconds < 0 ? -c : c;
}

export function eraOfSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'outside model';
  if (seconds < 0) return 'outside model — before the expansion';
  if (seconds === 0) return 'nothing — no time has passed';
  if (seconds <= 1e-43) return 'Planck';
  if (seconds < 1e-36) return 'early universe, after the Planck time';
  if (seconds <= 1e-32) return 'inflation';
  if (seconds < 1e-12) return 'electroweak';
  if (seconds < 1) return 'quark';
  if (seconds <= 20 * 60) return 'nucleosynthesis';
  if (seconds < 2e5 * YEAR_S) return 'radiation era';
  if (seconds < 1e6 * YEAR_S) return 'recombination';
  if (seconds < 1e8 * YEAR_S) return 'dark ages';
  if (seconds < 1e9 * YEAR_S) return 'first stars and galaxies';
  const earth = 9.2e9 * YEAR_S;
  const today = TODAY_YR * YEAR_S;
  if (seconds < earth) return 'galaxies, before the Sun and Earth';
  if (Math.abs(seconds - today) < YEAR_S) return 'today';
  if (seconds < today) return 'Sun and Earth';
  return 'planet time — seasons and days';
}

/** Rough flat-ΛCDM stretch: a≈0 near bang, a=1 at today. Good enough for the lab view. */
export function scaleFactor(seconds: number): number {
  if (!(seconds > 0)) return 0;
  const tNow = TODAY_YR * YEAR_S;
  const u = Math.min(1, seconds / tNow);
  // Radiation-like early, matter mid, late acceleration — smooth log blend toward a=1.
  return Math.min(1, Math.pow(u, 0.55));
}

/** Hubble-like rate (1/s). Diverges early; falls toward H0 near today. */
export function expansionRate(seconds: number): number {
  if (!(seconds > 0)) return Number.POSITIVE_INFINITY;
  const H0 = 67.4 * 1e3 / (3.0856775814913673e22); // s^-1
  const a = Math.max(scaleFactor(seconds), 1e-60);
  // Toy: H ~ H0 * a^-1.5 early → H0 late.
  return H0 * Math.pow(a, -1.2);
}

/**
 * Particle-horizon stand-in: R(0)=0, R(now)=R_OBS.
 * Log-maps cosmic seconds from Planck → today so early growth is visible on screen.
 * (Full ∫ c/a dt lands in WASM later; this keeps the lab honest about the boundary conditions.)
 */
export function spaceExtent(seconds: number): number {
  if (!(seconds > 0)) return 0;
  const logT = Math.log10(seconds);
  const logP = Math.log10(PLANCK_S);
  const logNow = Math.log10(TODAY_YR * YEAR_S);
  const u = Math.min(1, Math.max(0, (logT - logP) / (logNow - logP)));
  return R_OBS_M * u;
}

export function expansionRatio(seconds: number): number {
  const R = spaceExtent(seconds);
  const H = expansionRate(seconds);
  if (!(R > 0) || !Number.isFinite(H) || H <= 0) return 0;
  return (R * H) / C_LIGHT;
}

export function formatSeconds(seconds: number): string {
  if (!(seconds > 0)) return '0 s';
  const e = Math.floor(Math.log10(seconds));
  const m = seconds / 10 ** e;
  return `${m.toFixed(2)}×10^${e} s`;
}

export function formatLength(meters: number): string {
  if (!(meters > 0)) return '0 m';
  const ly = meters / (YEAR_S * C_LIGHT);
  if (ly >= 1e6) return `${(ly / 1e9).toFixed(2)} Gly`;
  if (ly >= 1) return `${ly.toExponential(2)} ly`;
  if (meters >= 1) return `${meters.toExponential(2)} m`;
  return `${meters.toExponential(2)} m`;
}
