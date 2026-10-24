/** Wavelength filters (T-0067): what the Sun emits in each passband, from where it forms.
 *  Formation temperatures: Lemen et al. 2012 (Sol. Phys. 275, 17, AIA Table 1); GOES XRS 1-8 A (Hanser & Sellers 1996).
 *  Thick bands (visible, H-alpha, UV continuum) show the disc with limb darkening; optically thin coronal lines (EUV, X-ray)
 *  integrate along the line of sight, so path length ~1/mu gives limb BRIGHTENING, and emission extends off the limb with
 *  the hydrostatic scale height H = k T / (mu_mol m_p g_sun), mu_mol = 0.6, g_sun = 274 m/s^2.
 *  Emission measure ~ n^2: quiet corona is faint in hot lines, active regions (spot groups) dominate; above ~5 MK (X-ray)
 *  the quiet disc is nearly dark. Display colours are the SDO/AIA standard tables (as shipped in SunPy's colormaps, BSD).
 *  Spot regions: dark in photospheric bands (cool umbra), bright plage/loops in chromospheric and coronal bands. */
export type BandId = 'visible' | 'halpha' | 'uv1600' | 'uv1700' | 'euv304' | 'euv171' | 'euv193' | 'xray';
export interface Band { id: BandId; label: string; nm: number; T: number; thin: boolean; spot: number; ar: number; quiet: number; colour: [number, number, number]; source: string }
const kB = 1.380649e-23, mp = 1.67262192e-27, G_SUN = 274, R_SUN = 695_700e3;
/** coronal scale height as a fraction of R_sun */
export const scaleHeight = (T: number) => kB * T / (.6 * mp * G_SUN) / R_SUN;
export const BANDS: Band[] = [
  { id: 'visible', label: 'Visible (white light)', nm: 550, T: 5772, thin: false, spot: 1, ar: 0, quiet: 1, colour: [1, 1, 1], source: 'photosphere' },
  { id: 'halpha', label: 'H-alpha 656.3 nm', nm: 656.3, T: 1e4, thin: false, spot: .6, ar: .5, quiet: .9, colour: [1, .25, .1], source: 'chromosphere' },
  { id: 'uv1700', label: 'UV 1700 A', nm: 170, T: 4500, thin: false, spot: .7, ar: .8, quiet: .8, colour: [1, .45, .6], source: 'temperature minimum / photosphere' },
  { id: 'uv1600', label: 'UV 1600 A', nm: 160, T: 1e5, thin: false, spot: .5, ar: 1.2, quiet: .7, colour: [.85, .85, .25], source: 'upper photosphere + transition region (C IV)' },
  { id: 'euv304', label: 'EUV 304 A (He II)', nm: 30.4, T: 5e4, thin: true, spot: 0, ar: 2, quiet: .55, colour: [1, .35, .1], source: 'chromosphere / transition region' },
  { id: 'euv171', label: 'EUV 171 A (Fe IX)', nm: 17.1, T: 6.3e5, thin: true, spot: 0, ar: 3, quiet: .35, colour: [1, .78, .25], source: 'quiet corona, upper transition region' },
  { id: 'euv193', label: 'EUV 193 A (Fe XII)', nm: 19.3, T: 1.6e6, thin: true, spot: 0, ar: 4, quiet: .25, colour: [.85, .6, .35], source: 'corona (coronal holes dark)' },
  { id: 'xray', label: 'X-ray 1-8 A (GOES XRS)', nm: .45, T: 1e7, thin: true, spot: 0, ar: 8, quiet: .02, colour: [.9, .9, 1], source: 'hot active-region corona / flares' },
];
export const band = (id: BandId) => BANDS.find(b => b.id === id)!;
/** relative brightness for the quiet Sun (no active regions), 1 = disc centre of a thick band.
 *  Thin bands: emissivity ~ n^2 ~ exp(-2h/H). Disc path P0/mu with P0 = H/2; tangent path sqrt(pi R H) at the limb, so
 *  off-limb = 2 sqrt(pi/H) exp(-2h/H) relative to disc centre, and the disc saturates at that limb value. */
export function quietBrightness(b: Band, mu: number, rho: number, limbAlpha: number) {
  if (!b.thin) return rho > 1 ? 0 : Math.max(0, mu) ** limbAlpha;
  const H = scaleHeight(b.T), limbMax = 2 * Math.sqrt(Math.PI / H);
  return b.quiet * (rho > 1 ? limbMax * Math.exp(-2 * (rho - 1) / H) : Math.min(1 / Math.max(mu, 1e-3), limbMax));
}
