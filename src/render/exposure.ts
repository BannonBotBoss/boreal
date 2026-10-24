/** Physical camera + eye adaptation (T-0067).
 *  EV100 / exposure: Lagarde & de Rousiers 2014, "Moving Frostbite to PBR" sec. 4.5 (EV100 = log2(N^2/t * 100/S),
 *  meter EV100 = log2(Lavg*S/K) with K = 12.5, exposure = 1 / (1.2 * 2^EV100)).
 *  Adaptation: exponential approach (Pattanaik et al. 2000, SIGGRAPH "Time-dependent visual adaptation"): light (cone)
 *  adaptation tau ~0.1-0.5 s -> 0.4 s; dark adaptation is slow: cone plateau ~7-10 min, rods ~30 min (Hecht et al. 1937),
 *  tau 120 s here. Glare: pupil is at its ~2 mm minimum above ~1e4 cd/m^2 (Watson & Yellott 2012, J. Vision 12(10):12),
 *  so beyond GLARE the eye can no longer stop down and the metered target is pulled toward the brightest source; the
 *  unattenuated Sun (~1.6e9 cd/m^2 at the ground) is ~5 orders above it. Tone map: three's ACESFilmicToneMapping (MIT). */
export const CAM = { K: 12.5, tauLight: .4, tauDark: 120, GLARE: 1e4, shoulder: 1.5 };
export const ev100FromSettings = (N: number, t: number, S: number) => Math.log2(N * N / t * 100 / S);
export const ev100FromLuminance = (L: number, K = CAM.K) => Math.log2(Math.max(L, 1e-9) * 100 / K);
export const exposureFromEV100 = (ev: number) => 1 / (1.2 * 2 ** ev);
/** log-average luminance from (fraction, luminance) parts of the frame (Reinhard 2002 key) */
export const logAverage = (parts: [number, number][]) => Math.exp(parts.reduce((s, [f, L]) => s + f * Math.log(1e-4 + L), 0) / parts.reduce((s, [f]) => s + f, 0));
/** metered target: average key, but once the peak passes GLARE, blend in an EV that puts the peak at the ACES shoulder
 *  (so the disc reads as a coloured orb instead of clipping white). w rises with log10(peak/GLARE) over 5 decades. */
export function targetEV(Lavg: number, Lpeak: number, comp = 0) {
  const avg = ev100FromLuminance(Lavg), w = Math.min(1, Math.max(0, Math.log10(Lpeak / CAM.GLARE) / 5));
  const peak = Math.log2(Lpeak / (CAM.shoulder * 1.2));
  return avg * (1 - w) + Math.max(avg, peak) * w - comp;
}
/** one adaptation step; brightening (EV up) uses the fast tau, darkening the slow one */
export function adapt(ev: number, target: number, dt: number, speed = 1) {
  const tau = (target > ev ? CAM.tauLight : CAM.tauDark) / speed; return target + (ev - target) * Math.exp(-dt / tau);
}
export interface CameraSettings { auto: boolean; comp: number; N: number; t: number; S: number; nd: number; focalMm: number; adaptSpeed: number }
export const defaultCamera = (): CameraSettings => ({ auto: true, comp: 0, N: 8, t: 1 / 125, S: 100, nd: 0, focalMm: 50, adaptSpeed: 1 });
/** final EV100 used for exposure; ND filters add stops (ND 16.5 stops = ISO 12312-2 solar filter, ~1e-5 transmission) */
export const cameraEV = (c: CameraSettings, adaptedEV: number) => c.auto ? adaptedEV : ev100FromSettings(c.N, c.t, c.S) + c.nd; // auto meters through the filter, so ND cancels
/** full-frame 36x24 mm vertical FOV (deg) */
export const fovFromFocal = (mm: number) => 2 * Math.atan(12 / mm) * 180 / Math.PI;
/** level-of-detail rule: a feature of angular size a (rad) is drawn only if it spans >= 2 px */
export const pixelsFor = (aRad: number, fovDeg: number, heightPx: number) => aRad / (fovDeg * Math.PI / 180 / heightPx);
