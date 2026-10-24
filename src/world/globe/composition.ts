/** Atmosphere composition -> scattering coefficients (Matt: "the atmosphere, find out how it is composed").
 *  The globe's Rayleigh coefficients and density scale height are DERIVED here from the gas mix and the US Standard
 *  Atmosphere 1976 sea-level state, not tuned. atmosphere.ts (Nishita 1993 single scattering) consumes them.
 *  Sources: composition NOAA/NASA Earth Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html), CO2 ~420 ppm
 *  NOAA GML Mauna Loa 2024; sea level T, p, g, M: U.S. Standard Atmosphere 1976 (NOAA-S/T 76-1562); refractivity of air:
 *  Peck & Reeder 1972 (JOSA 62, 958); King factor of air 1.048 (Bates 1984, Planet. Space Sci. 32, 785); Rayleigh cross
 *  section: Bucholtz 1995 (Appl. Opt. 34, 2765); ozone Chappuis absorption: Bruneton 2017 (precomputed atmospheric
 *  scattering, new implementation) ozone coefficients; layers: US Std Atm 1976 and NOAA JetStream "Layers of the atmosphere". */
export const COMPOSITION = {
  dryVolumeFraction: { N2: 0.7808, O2: 0.2095, Ar: 0.0093, CO2: 420e-6 },
  /** water vapour 0..4 % by volume, from the sim's humidity (planetBudget 'q'); its effect on Rayleigh is < 1 % (Bucholtz 1995),
   *  so it is not drawn as scattering: it acts through clouds (update_clouds.rs). */
  h2oVolumeRange: [0, 0.04],
  seaLevel: { T: 288.15, p: 101325, g: 9.80665, M: 0.0289644 }, // K, Pa, m/s2, kg/mol (US Std Atm 1976)
  kingFactor: 1.048,
  /** layer tops, km (US Std Atm 1976; tropopause ~8 km at the poles to ~17 km in the tropics, NOAA JetStream) */
  layers: { troposphereKm: [8, 17], stratosphereKm: 50, mesosphereKm: 85 },
  /** ozone absorption at the layer's peak, per km, RGB 680/550/440 nm (Bruneton 2017), and its layer: peak ~25 km, ~30 km wide */
  ozonePeakPerKm: [0.65e-3, 1.881e-3, 0.085e-3], ozoneWidthKm: 30,
  wavelengthsNm: [680, 550, 440],
};
const R_GAS = 8.314462618, KB = 1.380649e-23;
/** density scale height H = R T / (M g), km (~8.4 km at 288 K) */
export const scaleHeightKm = (T = COMPOSITION.seaLevel.T) => R_GAS * T / (COMPOSITION.seaLevel.M * COMPOSITION.seaLevel.g) / 1000;
/** number density at sea level, m^-3 */
export const numberDensity = () => COMPOSITION.seaLevel.p / (KB * COMPOSITION.seaLevel.T);
/** (n - 1) of standard dry air at 15 C, 101325 Pa (Peck & Reeder 1972), lambda in nm */
export function refractivity(nm: number) { const s2 = (1000 / nm) ** 2; return (8060.51 + 2480990 / (132.274 - s2) + 17455.7 / (39.32957 - s2)) * 1e-8; }
/** Rayleigh scattering coefficient at sea level, per km: beta = 8 pi^3 (n^2-1)^2 / (3 N^2 lambda^4) x N x King */
export function rayleighPerKm(nm: number) {
  const n1 = refractivity(nm), N = numberDensity(), l = nm * 1e-9, n2m1 = n1 * (2 + n1);
  return 8 * Math.PI ** 3 * n2m1 * n2m1 / (3 * N * l ** 4) * COMPOSITION.kingFactor * 1000;
}
/** ozone column absorption spread over the Rayleigh profile (same optical depth: peak x width/2 per scale height), per km at sea level */
export const ozoneEquivPerKm = () => COMPOSITION.ozonePeakPerKm.map(k => k * COMPOSITION.ozoneWidthKm / 2 / scaleHeightKm());
