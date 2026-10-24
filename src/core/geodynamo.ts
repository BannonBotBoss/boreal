/** Earth's interior, geodynamo and solar-wind coupling: cited constants + light causal formulas. Inspectable: every output
 *  is a function of the inputs shown (why chain in `auroraFromSolarWind().why`). Not sim-heavy, so TypeScript (no Rust).
 *  Interior: PREM (Dziewonski & Anderson 1981, PEPI 25, 297); core composition McDonough 2003 (Treatise Geochem. 2.15);
 *  temperatures Anzellini et al. 2013 (Science 340, 464). Field: IGRF-14 (Alken et al. 2021 for IGRF-13; NOAA NCEI), dipole
 *  moment ~7.7-8.0e22 A m^2, tilt ~9.4-11 deg. Reversals: Ogg 2020 GTS; Brunhes-Matuyama 773 ka (Singer et al. 2019, Sci. Adv. 5).
 *  Magnetopause: Shue et al. 1998 (JGR 103, 17691). Bow shock: Farris & Russell 1994 (JGR 99, 17681). Parker spiral: Parker 1958.
 *  Coupling: Newell et al. 2007 (JGR 112, A01206); dayside reconnection voltage Milan et al. 2012 (JGR 117, A03226);
 *  polar-cap saturation Hill-Siscoe (Siscoe et al. 2002); open flux expanding/contracting polar cap (Milan 2007, GRL 34).
 *  Aurora emissions: O(1S) 557.7 nm ~100-150 km, O(1D) 630.0 nm > ~200 km, N2+ 427.8 nm blue (NASA/NOAA SWPC aurora pages). */
export const INTERIOR = {
  innerCore: { radiusKm: 1221.5, state: 'solid', composition: 'Fe ~85 %, Ni 5-10 %, light elements', T_K: [5200, 5700], P_GPa: [330, 364], rho: [12.8, 13.1] },
  outerCore: { depthKm: [2891, 5150], state: 'liquid', composition: 'Fe-Ni + ~10 % light (S, O, Si, H)', T_K: [4000, 5000], rho: [9.9, 12.2] },
  mantle: { thicknessKm: 2891 - 35 }, crust: { thicknessKm: [5, 70] },
  earthRadiusKm: 6371,
};
export const FIELD = { dipoleMoment: 7.8e22, tiltDeg: 9.7, mu0: 4e-7 * Math.PI, lastReversalKa: 773, meanReversalKyr: [200, 300],
  dynamoEvidenceGa: [3.5, 4.2] /* Tarduno et al. 2015 Science 349, 521 (4.2 Ga zircons disputed); 3.5 Ga Barberton Tarduno 2010 */,
  innerCoreNucleationGa: [0.5, 1.5] /* DISPUTED: Biggin et al. 2015 Nature 526, 245 (~1-1.5 Ga) vs Bono et al. 2019 Nat. Geosci. (~0.565 Ga) */ };
export const SOLAR_WIND = { v: [350, 800], n1AU: 5, imfNT: 5, sunOmega: 2.865e-6 /* rad/s, 25.38 d sidereal */, auKm: 1.495978707e8, mp: 1.6726e-27 };
const R_E = INTERIOR.earthRadiusKm * 1e3, RAD = Math.PI / 180;
/** equatorial surface field (T): mu0 m / (4 pi R^3) ~ 30 uT */
export const B0 = () => FIELD.mu0 * FIELD.dipoleMoment / (4 * Math.PI * R_E ** 3);
/** dipole surface field magnitude at magnetic latitude (T): B0 sqrt(1 + 3 sin^2) */
export const dipoleB = (mlatDeg: number) => B0() * Math.sqrt(1 + 3 * Math.sin(mlatDeg * RAD) ** 2);
/** dipole field line r = L cos^2(mlat), Re: for overlays (inspectable vector field) */
export const fieldLineR = (L: number, mlatDeg: number) => L * Math.cos(mlatDeg * RAD) ** 2;
/** dipole field vector (Br, Btheta) in T at r (Re) and magnetic colatitude th (rad) */
export const dipoleVec = (rRe: number, th: number) => { const k = B0() / rRe ** 3; return { Br: -2 * k * Math.cos(th), Bth: -k * Math.sin(th) }; };
/** solar-wind dynamic pressure, nPa (n /cm3, v km/s) */
export const dynPressure = (n: number, v: number) => 1.6726e-6 * n * v * v;
/** Shue 1998 subsolar magnetopause, Re */
export const shueR0 = (bz: number, dp: number) => (10.22 + 1.29 * Math.tanh(0.184 * (bz + 8.14))) * dp ** (-1 / 6.6);
/** Chapman-Ferraro pressure balance stand-off (Re), compressed dipole (factor 2 field doubling) */
export const chapmanFerraroR = (n: number, v: number) => { const p = dynPressure(n, v) * 1e-9; return (4 * B0() ** 2 / (2 * FIELD.mu0 * p)) ** (1 / 6); };
/** Farris & Russell 1994 bow-shock stand-off from the magnetopause, Re (gamma 5/3, fast Mach M) */
export const bowShockR = (r0: number, M = 8) => r0 * (1 + 1.1 * ((2 / 3) * M * M + 2) / ((8 / 3) * (M * M - 1)));
/** Parker spiral angle (deg) at r km for speed v km/s */
export const parkerAngle = (v: number, rKm = SOLAR_WIND.auKm) => Math.atan(SOLAR_WIND.sunOmega * rKm / v) / RAD;
/** Newell 2007 coupling dPhi/dt = v^(4/3) Bt^(2/3) sin^(8/3)(theta/2) (v km/s, B nT) */
export const newell = (v: number, by: number, bz: number) => { const bt = Math.hypot(by, bz), th = Math.atan2(by, bz); return v ** (4 / 3) * bt ** (2 / 3) * Math.abs(Math.sin(th / 2)) ** (8 / 3); };
/** Milan 2012 dayside reconnection voltage (V), Hill-Siscoe saturated at PHI_SAT */
export const PHI_SAT = 250e3, TAU_S = 2e4 /* open-flux closure time ~5.5 h [calibration, Milan 2007 range 1-10 h] */, OVAL_WIDTH_DEG = 7 /* Feldstein & Starkov 1967 typical [approx] */;
export function daysideVoltage(v: number, by: number, bz: number) { const byz = Math.hypot(by, bz) * 1e-9, th = Math.atan2(by, bz);
  const phi = 3.3e5 * (v * 1e3) ** (4 / 3) * byz * Math.abs(Math.sin(th / 2)) ** 4.5; return phi * PHI_SAT / (phi + PHI_SAT); }
/** Hemisphere dipole flux poleward of magnetic colatitude th: 2 pi R^2 B0 sin^2 th (Wb) */
export const capFlux = (thColat: number) => 2 * Math.PI * R_E * R_E * B0() * Math.sin(thColat) ** 2;
export type OmniHour = { t: string; by: number; bz: number; v: number; n: number };
/** Emergent aurora from measured solar wind (OMNI hours): open flux F integrates dF/dt = Phi_D - F/tau, the open/closed boundary
 *  follows from dipole flux, the oval sits equatorward of it; brightness ~ energy input. No Kp, no drawn oval. */
export function auroraFromSolarWind(hours: OmniHour[], F0 = 0.3e9) {
  let F = F0; const out = hours.map(h => { const phi = daysideVoltage(h.v, h.by, h.bz);
    for (let s = 0; s < 6; s++) F += (phi - F / TAU_S) * 600; // 10-min Euler steps within the hour
    const th = Math.asin(Math.min(1, Math.sqrt(F / capFlux(Math.PI / 2)))), ocb = 90 - th / RAD;
    return { t: h.t, phiKV: phi / 1e3, openFluxGWb: F / 1e9, ocbMlat: ocb, ovalEqMlat: ocb - OVAL_WIDTH_DEG, newell: newell(h.v, h.by, h.bz),
      emission: { green5577: { km: [100, 150] }, red630: { km: [200, 300] }, blueN2p: { km: [100, 130] }, relBrightness: phi / 50e3 },
      why: `v=${h.v} km/s, By=${h.by}, Bz=${h.bz} nT -> Phi_D=${(phi / 1e3).toFixed(0)} kV -> open flux ${(F / 1e9).toFixed(2)} GWb -> OCB ${ocb.toFixed(1)} deg -> oval edge ${(ocb - OVAL_WIDTH_DEG).toFixed(1)} deg MLAT` }; });
  return out;
}
