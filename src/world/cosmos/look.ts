/** How the early-universe sphere looks. Every number comes from Rust.
 *  radius = 0.4 + 7 · (log10(a) − log10(a_min)) / (log10(1) − log10(a_min)),
 *  with a_min = 10⁻⁶⁰ so a Planck-era scale factor and a = 1 both fit on screen.
 *  Brightness follows log10(T) and log10(ρ). The hue stays violet: hotter temperatures
 *  lift the blue and a little red, and the green channel stays low so the core
 *  cannot tone-map to white.
 */
export interface SphereLook {
  radius: number;
  brightness: number;
  color: [number, number, number];
  /** The mapping, shown in the panel. */
  radiusRule: string;
}

const A_MIN = 1e-60;

export function sphereLook(a: number, _h: number, temperature: number, rho: number): SphereLook {
  const safeA = Number.isFinite(a) && a > 0 ? a : A_MIN;
  const logA = Math.log10(Math.min(Math.max(safeA, A_MIN), 10));
  const logMin = Math.log10(A_MIN);
  const u = (logA - logMin) / (0 - logMin);
  const radius = 0.4 + 7 * Math.min(1, Math.max(0, u));
  const logT = Math.log10(Math.max(temperature, 1));
  const logR = Math.log10(Math.max(rho, 1));
  const hot = Math.min(1, Math.max(0, (logT - 1) / 22));
  // Violet-dominant at every temperature. Blue leads, green stays small.
  const color: [number, number, number] = [
    0.22 + 0.20 * hot,
    0.02 + 0.06 * hot,
    0.58 + 0.32 * hot,
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
