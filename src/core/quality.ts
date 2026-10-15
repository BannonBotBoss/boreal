/**
 * Adaptive quality governor (Grok Bot), PROJECT-RULES rule 10. ONE ordered ladder of tiers (best → cheapest) and ONE
 * controller that measures frame time (CPU frame interval, or GPU time from EXT_disjoint_timer_query_webgl2 when available,
 * whichever is worse) and steps along the ladder with hysteresis to hold the target frame rate.
 * Manual settings are CAPS: the applied value of every knob is min(ladder tier, manual cap) in "quality" order.
 * Budgets: desktop 60 fps; Quest 3 WebXR 72/90 Hz (≈13.9/11.1 ms), soft ceilings ≈100 draw calls and 750K triangles
 * per eye, textures ≤ 2048² (skill photoreal-interactive-webxr-assets; Meta Quest performance guidance).
 */
export interface Tier {
  name: string;
  resScale: number;     // × the device pixel ratio (capped at 1.5); Ultra 2 = supersampled
  shadows: number;      // 0 off, 1 = one 1024 map, 2 = 2 cascades 1024, 3 = 3 cascades 2048
  ssao: number;         // 0 off, 1 half-res GTAO, 2 full-res GTAO
  ibl: number;          // 0 hemisphere light only, 1 sky PMREM environment
  gi: number;           // 0 off, 1 = SH light probe of the surroundings (bounce light), re-captured every few seconds
  clouds: number;       // 0 off, 1 = cloud shadows from the weather cells
  lod: number;          // LOD distance multiplier (≤ 1, scales the player's choice)
  near: number; mid: number; // interest radii (m)
  trees: number;        // tree density multiplier (≤ 1, scales the player's choice)
  foliage: number;      // grass/plant density multiplier
  weather: number;      // weather grid cells per side (6/8/12)
}
/** Ordered best → cheapest. Every knob is non-increasing down the ladder (tested). */
export const LADDER: Tier[] = [
  { name: 'Ultra',   resScale: 2,    shadows: 3, ssao: 2, ibl: 1, gi: 1, clouds: 1, lod: 1,   near: 100, mid: 180, trees: 1, foliage: 1, weather: 12 },
  { name: 'High',    resScale: 1.5, shadows: 3, ssao: 1, ibl: 1, gi: 1, clouds: 1, lod: 1,   near: 70, mid: 120, trees: 1, foliage: 1, weather: 8 },
  { name: 'Medium',  resScale: 1,    shadows: 2, ssao: 1, ibl: 1, gi: 0, clouds: 1, lod: .85, near: 60, mid: 100, trees: 1, foliage: .8, weather: 8 },
  { name: 'Low',     resScale: .85,  shadows: 1, ssao: 0, ibl: 1, gi: 0, clouds: 1, lod: .7,  near: 50, mid: 80, trees: .8, foliage: .6, weather: 8 },
  { name: 'Very low', resScale: .7,  shadows: 1, ssao: 0, ibl: 0, gi: 0, clouds: 0, lod: .6,  near: 40, mid: 70, trees: .6, foliage: .4, weather: 6 },
  { name: 'Minimum', resScale: .5,   shadows: 0, ssao: 0, ibl: 0, gi: 0, clouds: 0, lod: .5,  near: 40, mid: 60, trees: .5, foliage: .25, weather: 6 },
];
export const KNOBS = Object.keys(LADDER[0]).filter(k => k !== 'name') as (keyof Omit<Tier, 'name'>)[];

/** Controller ADAPTED from drei's PerformanceMonitor (pmndrs/drei, MIT; src/core/PerformanceMonitor.tsx): average over
 * `ms` windows, keep `iterations` averages, act when ≥ `threshold` of them are outside the [lower, upper] margin, and lock
 * after `flipflops` direction changes (instability → stay on the cheaper tier). drei is React-only, so the algorithm is
 * re-implemented here on plain numbers (baseline copy: vendor/drei, upstream bf6f4addf474). Changes vs upstream: steps a
 * discrete tier ladder instead of a 0–1 factor; counts only direction REVERSALS as flip-flops (cf. drei PR #1791); measures
 * work time instead of wall fps; the cap tier bounds inclines. Input is frame WORK time (CPU frame cost, or GPU time from
 * EXT_disjoint_timer_query_webgl2 when available, whichever is larger) so headroom is visible even under v-sync. */
export const GOVERNOR = {
  auto: true, targetFps: 60, tier: 1, /** best tier the player allows (Auto never climbs above it) */ capTier: 0, xr: false, gpu: '',
  ms: 250, iterations: 10, threshold: .75, flipflops: 6,
  lower: 1, upper: 1.35, // margin as multiples of the target: decline below target, incline above 1.35 × target (drei default 60/100 ≈ 1.67)
  window: [] as number[], windowMs: 0, averages: [] as number[], flipped: 0, lastDir: 0, locked: false,
  fps: 0, gpuMs: undefined as number | undefined,
};
export const MANUAL: Partial<Omit<Tier, 'name'>> = {}; // caps from the render settings
/** The applied tier: the ladder tier with every knob capped by its manual setting. */
export function applied(tier = GOVERNOR.tier): Tier {
  const t = { ...LADDER[Math.max(GOVERNOR.capTier, Math.min(LADDER.length - 1, tier))] };
  for (const k of KNOBS) if (MANUAL[k] !== undefined) t[k] = Math.min(t[k], MANUAL[k]!);
  if (GOVERNOR.xr) for (const k of KNOBS) if (XR_CAPS[k] !== undefined) t[k] = Math.min(t[k], XR_CAPS[k]!);
  return t;
}
export function resetGovernor() { Object.assign(GOVERNOR, { window: [], windowMs: 0, averages: [], flipped: 0, lastDir: 0, locked: false }); }
/** Feed one frame. `workMs` = CPU work this frame, `gpuMs` = GPU time if measured, `frameMs` = wall interval (window clock).
 * Returns +1 (stepped to a cheaper tier), −1 (stepped up) or 0. */
export function governFrame(workMs: number, gpuMs?: number, frameMs = workMs) {
  const g = GOVERNOR; if (gpuMs !== undefined) g.gpuMs = gpuMs;
  if (!g.auto || g.locked) return 0;
  g.window.push(Math.max(workMs, gpuMs ?? 0)); g.windowMs += frameMs;
  if (g.windowMs < g.ms) return 0;
  const avg = g.window.reduce((a, b) => a + b, 0) / g.window.length; g.window = []; g.windowMs = 0;
  g.fps = 1000 / Math.max(avg, 1e-3); g.averages.push(g.fps); if (g.averages.length > g.iterations) g.averages.shift();
  if (g.averages.length < g.iterations) return 0;
  const lo = g.targetFps * g.lower, hi = g.targetFps * g.upper;
  const below = g.averages.filter(f => f < lo).length / g.iterations, above = g.averages.filter(f => f >= hi).length / g.iterations; // as upstream
  let dir = 0;
  if (below > g.threshold && g.tier < LADDER.length - 1) dir = 1;
  else if (above > g.threshold && g.tier > g.capTier) dir = -1;
  if (!dir) return 0;
  if (g.lastDir && dir !== g.lastDir && ++g.flipped >= g.flipflops) { g.locked = true; if (dir < 0) return 0; } // fallback: stay on the cheaper tier
  g.lastDir = dir; g.tier += dir; g.averages = [];
  return dir;
}
export const budgetMs = () => 1000 / GOVERNOR.targetFps;

/** Starting tier from the GPU renderer string (WEBGL_debug_renderer_info). Discrete desktop GPUs start at Ultra; integrated
 * at Medium; mobile/standalone-XR GPUs at Low. The governor then only steps down on missed frames and recovers. */
export function tierForGpu(renderer: string) {
  if (/adreno|mali|powervr|apple gpu|quest/i.test(renderer)) return 3;
  if (/geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d/i.test(renderer)) return 0;
  if (/intel|uhd|iris|radeon\(tm\) graphics|vega/i.test(renderer)) return 2;
  if (/swiftshader|llvmpipe|software/i.test(renderer)) return LADDER.length - 1;
  return 2;
}
/** WebXR on Quest 3 keeps its own budget (≈100 draw calls, 750K tris/eye, 72/90 Hz): these caps apply on top of any tier. */
export const XR_CAPS: Partial<Omit<Tier, 'name'>> = { gi: 0, resScale: 1, shadows: 1, ssao: 0, near: 50, mid: 80, trees: .6, foliage: .4, weather: 6 };
