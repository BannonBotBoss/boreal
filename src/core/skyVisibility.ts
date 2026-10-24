/** Can the eye see a point source against the sky? Own implementation of the published forms (no code copied):
 *  - airmass X(z) = 1/(cos z + 0.025 e^(-11 cos z))  (Schaefer 1998, Sky & Telescope 95(5):57 "To the visual limits")
 *  - extinction m_obs = m + k X, k = 0.20 mag/airmass in V at a clear low site  (Schaefer 1993, Vistas Astron. 36:311)
 *  - twilight sky B ∝ 10^(0.4 (h_sun + Z/(360 k))) (100/ρ) (1 - 10^(-0.4 k X))  (Schaefer 1993: sky dims 0.4 dex per degree of
 *    solar depression, brighter toward the horizon and toward the Sun). Absolute scale [calibrated]: 64 cd/m² at zenith-ish
 *    (Z = 0, ρ = 90°) with the Sun on the horizon, set so the hemisphere integral (twilightIlluminance) gives 3.4 lx on a
 *    horizontal plane at the end of civil twilight (h = -6°; Bond & Henderson 1963, "The conquest of darkness", DDC AD-346297,
 *    as tabulated by USNO). Same model then gives ~960 lx at h = 0 (observed clear sunset 400-750 lx) and 0.013 lx at -12°
 *    (observed 0.008). Night floor 1.7e-4 cd/m² (21.9 mag/arcsec², Garstang 1989).
 *  - threshold illuminance I_th = C (1 + sqrt(K B))², B in nL; C, K = 10^-9.8, 10^-1.9 (B < 1479 nL) else 10^-8.35, 10^-5.9 ft-cd
 *    (Hecht 1947 as fitted by Schaefer 1990, PASP 102:212); a source of V mag m gives I = 10^(-0.4 (m + 16.57)) ft-cd (Schaefer 1990). */
export const SKY = { k: 0.20, b0Cd: 64, nightCd: 1.7e-4 };
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
/** Scale of the twilight form (cd/m² per unit of the bare 10^(0.4(...))·(100/ρ)·(1-10^(-0.4kX)) term), for shaders that repeat it. */
export const TWILIGHT_B0 = SKY.b0Cd / norm;
/** Horizontal illuminance (lx) from the whole sky for a Sun at altitude hSun ≤ ~0 (deg): E = ∫ L cos θ dΩ over the hemisphere of
 *  skyLuminance (same model as the Venus threshold, so the eye's adaptation and the sky the eye sees agree). Midpoint rule 12 × 24. */
export function twilightIlluminance(hSunDeg: number) {
  const nt = 12, np = 24, sd = [Math.cos(hSunDeg * D), 0, Math.sin(hSunDeg * D)]; let E = 0;
  for (let i = 0; i < nt; i++) { const th = (i + .5) / nt * 90, s = Math.sin(th * D), c = Math.cos(th * D);
    for (let j = 0; j < np; j++) { const ph = (j + .5) / np * 2 * Math.PI, rho = Math.acos(Math.max(-1, Math.min(1, s * Math.cos(ph) * sd[0] + c * sd[2]))) / D;
      E += (skyLuminance(Math.min(0, hSunDeg), th, rho) - SKY.nightCd) * c * s * (90 / nt * D) * (2 * Math.PI / np); } }
  return E;
}
