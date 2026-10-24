/** Sun as a physical light source (T-0067). All numbers cited; nothing painted.
 *  - Teff 5772 K, R_sun 695 700 km, AU 1.495978707e11 m: IAU 2015 Resolution B3 nominal values.
 *  - TSI 1361 W/m^2: Kopp & Lean 2011 (GRL 38 L01706). sigma*Teff^4*(R/AU)^2 reproduces it (test).
 *  - Colour matching: CIE 1931 2deg fit of Wyman, Sloan & Shirley 2013 (JCGT 2(2)); 683 lm/W (CIE photopic Km).
 *  - Limb darkening I(mu)/I(1) = mu^alpha(lambda), alpha = -0.023 + 0.292/lambda[um]: Hestroffer & Magnan 1998 (A&A 333, 338)
 *    power-law fit to Neckel & Labs 1994 disc-centre-to-limb data.
 *  - Air: reuses core/light.ts rayleighTau (Bucholtz-type fit), aerosolTau (Angstrom) and airMass (Kasten & Young 1989).
 *  Honest result: from space the disc is white (x,y ~ 0.32,0.33); it goes yellow-orange only through air. */
import { K } from '../../core/constants';
import { aerosolTau, airMass, rayleighTau } from '../../core/light';

export const SUN = { get Teff() { return K.Teff_sun; }, get R() { return K.R_sun; }, get AU() { return K.AU; }, get TSI() { return K.TSI; } }; // core/constants (IAU 2015 B3)
const H = K.h, C = K.c, KB = K.k_B, SIGMA = K.sigma, KM = K.K_cd;

/** Planck spectral radiance, W m^-2 sr^-1 m^-1 */
export function planck(lambdaM: number, T: number) { return 2 * H * C * C / lambdaM ** 5 / Math.expm1(H * C / (lambdaM * KB * T)); }
export const fluxAt = (distM = SUN.AU, T = SUN.Teff) => SIGMA * T ** 4 * (SUN.R / distM) ** 2;
/** angular radius (rad) at a distance: asin(R/d); 0.2666 deg at 1 AU */
export const angularRadius = (distM = SUN.AU) => Math.asin(SUN.R / distM);

const g = (l: number, m: number, s1: number, s2: number) => Math.exp(-.5 * ((l - m) / (l < m ? s1 : s2)) ** 2);
export function cie(nm: number): [number, number, number] {
  return [1.056 * g(nm, 599.8, 37.9, 31) + .362 * g(nm, 442, 16, 26.7) - .065 * g(nm, 501.1, 20.4, 26.2),
    .821 * g(nm, 568.8, 46.9, 40.5) + .286 * g(nm, 530.9, 16.3, 31.1),
    1.217 * g(nm, 437, 11.8, 36) + .681 * g(nm, 459, 26, 13.8)];
}
export const limbAlpha = (nm: number) => -.023 + .292 / (nm / 1000);
export const limb = (mu: number, nm = 550) => Math.max(0, mu) ** limbAlpha(nm);
/** disc-average / disc-centre ratio for mu^a: 2/(a+2) */
export const limbMean = (nm = 550) => 2 / (limbAlpha(nm) + 2);

/** Transmission of the direct beam at solar zenith cosine cosZ (1 = no air). Reuses core/light. */
export function transmission(nm: number, cosZ: number | null) {
  if (cosZ === null) return 1; if (cosZ <= -0.01) return 0;
  const um = nm / 1000; return Math.exp(-airMass(cosZ) * (rayleighTau(um) + aerosolTau(um)));
}

/** Disc-average XYZ (Y = luminance, cd/m^2) of the Sun, optionally through air. */
export function discXYZ(cosZ: number | null = null, T = SUN.Teff) {
  let X = 0, Y = 0, Z = 0; for (let nm = 380; nm <= 780; nm += 2) { const b = planck(nm * 1e-9, T) * 2e-9 * transmission(nm, cosZ), [x, y, z] = cie(nm); X += x * b; Y += y * b; Z += z * b; }
  return [X * KM, Y * KM, Z * KM] as [number, number, number];
}
export const chromaticity = ([X, Y, Z]: number[]) => [X / (X + Y + Z), Y / (X + Y + Z)];
/** XYZ -> linear sRGB (IEC 61966-2-1 matrix) */
export const xyzToRgb = ([X, Y, Z]: number[]): [number, number, number] => [3.2406 * X - 1.5372 * Y - .4986 * Z, -.9689 * X + 1.8758 * Y + .0415 * Z, .0557 * X - .204 * Y + 1.057 * Z];
/** Brightness of a region at temperature T relative to the photosphere at wavelength nm (spot contrast). */
export const contrast = (T: number, nm = 550, Tq = SUN.Teff) => planck(nm * 1e-9, T) / planck(nm * 1e-9, Tq);
