/** How the early-universe sphere looks. Every number comes from Rust.
 *  radius = 0.4 + 7 · (log10(a) − log10(a_min)) / (log10(1) − log10(a_min)),
 *  with a_min = 10⁻⁶⁰ so a Planck-era scale factor and a = 1 both fit on screen.
 *  Brightness follows log10(T) and log10(ρ). Colour follows log10 of the Rust
 *  temperature: the Planck-era bath is pink-white, and it cools to deep blue-violet
 *  before the planet. Three.js only copies this colour.
 */
export interface SphereLook {
  radius: number;
  brightness: number;
  color: [number, number, number];
  /** The mapping, shown in the panel. */
  radiusRule: string;
}

const A_MIN = 1e-60;
/** Pink-white. The Rust bath at cycle 1 is about 10²² K. */
const HOT: [number, number, number] = [1, 0.78, 0.88];
/** Deep blue-violet. By the first stars the same bath is tens of kelvin. */
const COOL: [number, number, number] = [0.32, 0.05, 0.78];
/** log10(K). 22 is the Planck-era report. 4 is 10,000 K, still before the planet. */
const HOT_LOG = 22;
const COOL_LOG = 4;

export function sphereLook(a: number, _h: number, temperature: number, rho: number): SphereLook {
  const safeA = Number.isFinite(a) && a > 0 ? a : A_MIN;
  const logA = Math.log10(Math.min(Math.max(safeA, A_MIN), 10));
  const logMin = Math.log10(A_MIN);
  const u = (logA - logMin) / (0 - logMin);
  const radius = 0.4 + 7 * Math.min(1, Math.max(0, u));
  const logT = Math.log10(Math.max(temperature, 1));
  const logR = Math.log10(Math.max(rho, 1));
  const cool = Math.min(1, Math.max(0, (HOT_LOG - logT) / (HOT_LOG - COOL_LOG)));
  const color: [number, number, number] = [
    HOT[0] + (COOL[0] - HOT[0]) * cool,
    HOT[1] + (COOL[1] - HOT[1]) * cool,
    HOT[2] + (COOL[2] - HOT[2]) * cool,
  ];
  const brightness = 1.15 + 0.55 * Math.min(1, logT / 22) + logR / 400;
  return {
    radius, brightness, color,
    radiusRule: 'radius = 0.4 + 7 × (log10 a − log10 1e−60) / 60, clamped. The camera steps back with that radius so the sphere stays in frame, and shifts left while the data panel is open.',
  };
}

/** Camera x so the origin sits in the open area left of a right-hand panel.
 *  `panelFraction` is the panel width divided by the viewport width. */
export function frameShiftX(panelFraction: number, dist: number, vFovDeg: number, aspect: number) {
  const halfH = Math.tan(vFovDeg * Math.PI / 360) * aspect;
  return Math.max(0, panelFraction) * dist * halfH;
}
