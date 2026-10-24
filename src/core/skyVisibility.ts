/** Can the eye see a point source against the sky? Own implementation of the published forms (no code copied):
 *  - airmass X(z) = 1/(cos z + 0.025 e^(-11 cos z))  (Schaefer 1998, Sky & Telescope 95(5):57 "To the visual limits")
 *  - extinction m_obs = m + k X, k = 0.20 mag/airmass in V at a clear low site  (Schaefer 1993, Vistas Astron. 36:311)
 *  - twilight sky B ∝ 10^(0.4 (h_sun + Z/(360 k))) (100/ρ) (1 - 10^(-0.4 k X))  (Schaefer 1993: sky dims 0.4 dex per degree of
 *    solar depression, brighter toward the horizon and toward the Sun). Absolute scale [calibrated]: 200 cd/m² at zenith-ish
 *    (Z = 0, ρ = 90°) with the Sun on the horizon, which puts the end of civil twilight (h = -6°) at ~1 cd/m² and astronomical
 *    night at the natural floor 1.7e-4 cd/m² (21.9 mag/arcsec², Garstang 1989).
 *  - threshold illuminance I_th = C (1 + sqrt(K B))², B in nL; C, K = 10^-9.8, 10^-1.9 (B < 1479 nL) else 10^-8.35, 10^-5.9 ft-cd
 *    (Hecht 1947 as fitted by Schaefer 1990, PASP 102:212); a source of V mag m gives I = 10^(-0.4 (m + 16.57)) ft-cd (Schaefer 1990). */
export const SKY = { k: 0.20, b0Cd: 200, nightCd: 1.7e-4 };
const D = Math.PI / 180;
export const airmass = (zDeg: number) => { const c = Math.cos(Math.min(90, zDeg) * D); return 1 / (c + 0.025 * Math.exp(-11 * c)); };
const norm = (100 / 90) * (1 - 10 ** (-0.4 * SKY.k * airmass(0)));
/** sky luminance (cd/m²) at an object at zenith distance zDeg, ρ deg from a Sun at altitude hSun (deg). Daytime: capped at the h=0 value scaled by ρ. */
export function skyLuminance(hSunDeg: number, zDeg: number, rhoDeg: number) {
  const h = Math.min(0, hSunDeg), tw = SKY.b0Cd / norm * 10 ** (0.4 * (h + Math.min(90, zDeg) / (360 * SKY.k))) * (100 / Math.max(1, rhoDeg)) * (1 - 10 ** (-0.4 * SKY.k * airmass(zDeg)));
  const day = hSunDeg > 0 ? tw * (1 + 30 * Math.sin(hSunDeg * D)) : tw; // [calibrated] clear day ~6e3 cd/m² at h = 30° (CIE clear sky order)
  return day + SKY.nightCd;
}
/** ratio of the source's illuminance to the eye's threshold (> 1 visible) after extinction */
export function visibility(m: number, zDeg: number, hSunDeg: number, rhoDeg: number) {
  if (zDeg >= 90) return { ratio: 0, mObs: Infinity, skyCd: 0 };
  const mObs = m + SKY.k * airmass(zDeg), B = skyLuminance(hSunDeg, zDeg, rhoDeg), nL = B / 3.183e-6;
  const [C, K] = nL < 1479 ? [10 ** (-98 / 10), 10 ** (-19 / 10)] : [10 ** -8.35, 10 ** -5.9];
  const Ith = C * (1 + Math.sqrt(K * nL)) ** 2, I = 10 ** (-0.4 * (mObs + 16.57));
  return { ratio: I / Ith, mObs, skyCd: B };
}
