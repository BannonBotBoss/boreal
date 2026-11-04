/** How the early-universe sphere looks. Every number comes from Rust.
 *  radius = 0.4 + 7 · (log10(a) − log10(a_min)) / (log10(1) − log10(a_min)),
 *  with a_min = 10⁻⁶⁰ so a Planck-era scale factor and a = 1 both fit on screen.
 *  Brightness follows log10(T) and log10(ρ). Colour shifts from deep violet toward blue-white as T rises.
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
  const brightness = Math.min(8, 0.35 + logT / 14 + logR / 80);
  const hot = Math.min(1, Math.max(0, (logT - 3) / 12));
  const color: [number, number, number] = [
    0.45 + 0.55 * hot,
    0.15 + 0.7 * hot,
    0.85 + 0.15 * hot,
  ];
  return {
    radius, brightness, color,
    radiusRule: 'radius = 0.4 + 7 × (log10 a − log10 1e−60) / 60, clamped',
  };
}
