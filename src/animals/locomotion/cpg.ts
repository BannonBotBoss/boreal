/**
 * Central pattern generator: four coupled phase oscillators with a Hopf amplitude, one per leg (Ijspeert 2008,
 * Neural Networks 21:642; Righetti & Ijspeert 2008 ICRA; same polar form as the EPFL BioRob course hopf_network):
 *   ṙ  = α (μ − r²) r
 *   θ̇ᵢ = ω + Σⱼ w·r·sin(θⱼ − θᵢ − φⱼᵢ),   φⱼᵢ = 2π (offsetⱼ − offsetᵢ)
 * Phases are kept in cycles (θ/2π). ω comes from distance travelled (speed / stride length), as in Claude's
 * AnimalBrain.expend, so planted feet don't skate. Coupling is scaled per cycle so a gait change settles in about one
 * stride at any speed (game calibration). A new gait only changes φ; the phases glide to it instead of snapping.
 */
const TAU = 2 * Math.PI;
export interface Cpg { theta: number[]; r: number }
/** Coupling per stride (game calibration: ~1 stride to settle) and the floor frequency so phases re-form at a standstill. */
export const CPG = { coupling: 1.2, alpha: 8, minFreq: .6, substep: 1 / 240 };

export const createCpg = (offsets: readonly number[], start = 0): Cpg => ({ theta: offsets.map(o => start + o), r: 1 });

/** Advance by dt. `freq` = strides per second (≥ 0); `mu` = 1 moving, 0 stopping. */
export function stepCpg(c: Cpg, offsets: readonly number[], freq: number, dt: number, mu = 1) {
  const n = Math.max(1, Math.ceil(dt / CPG.substep)), h = dt / n, w = CPG.coupling * TAU * Math.max(freq, CPG.minFreq);
  const d = [0, 0, 0, 0];
  for (let s = 0; s < n; s++) {
    c.r = Math.max(1e-3, c.r + h * CPG.alpha * (mu - c.r * c.r) * c.r);
    for (let i = 0; i < 4; i++) {
      let k = 0;
      for (let j = 0; j < 4; j++) if (j !== i) k += Math.sin(TAU * ((c.theta[j] - c.theta[i]) - (offsets[j] - offsets[i])));
      d[i] = freq + w * c.r * k / (TAU * 3);
    }
    for (let i = 0; i < 4; i++) c.theta[i] += h * d[i];
  }
  if (c.theta[1] > 1e4) { const f = Math.floor(c.theta[1]); for (let i = 0; i < 4; i++) c.theta[i] -= f; }
}
/** Per-leg phase in [0, 1). */
export const phases = (c: Cpg) => c.theta.map(t => t - Math.floor(t));
/** Signed circular difference a − b in cycles, in [−0.5, 0.5). */
export const phaseDiff = (a: number, b: number) => { const d = a - b; return d - Math.floor(d + .5); };
