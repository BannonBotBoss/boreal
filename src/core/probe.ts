/**
 * Startup resource probe (Grok Bot): turns what the machine reports into the SAFE MAX quality tier (GOVERNOR.probeCap).
 * Adopted: detect-gpu (pmndrs, MIT) for the GPU tier from its benchmark database (served locally from public/detect-gpu);
 * the run-time governor is drei PerformanceMonitor-style (core/quality). Inputs are combined CONSERVATIVELY: every signal
 * gives a cap and the cheapest one wins. Result cached in localStorage per renderer string; a new GPU/driver re-probes.
 */
import { LADDER } from './quality';

export interface ProbeInput {
  renderer: string;           // UNMASKED_RENDERER_WEBGL
  gpuTier?: number;           // detect-gpu tier 0..3 (undefined = unknown)
  maxTexture?: number;        // MAX_TEXTURE_SIZE
  deviceMemory?: number;      // navigator.deviceMemory, GB (Chromium only, rounded and capped at 8)
  cores?: number;             // navigator.hardwareConcurrency
  benchMs?: number;           // median work/GPU ms per frame of the start scene rendered at Ultra
}
export interface ProbeResult extends ProbeInput { cap: number; igpu: boolean; reasons: string[]; at: number; version: number }
export const PROBE = {
  version: 2, raiseAfter: 3, // sustained-headroom windows at the cap before the governor lifts the cap one tier
  key: 'boreal.probe.v1', budgetMs: 1000 / 60, headroom: .85, // a tier must fit in 85 % of the 60 fps budget
  /** Frame cost of each tier relative to Ultra, from the omen ?bench=1 table (RTX 5060 Laptop, 2026-10-15: 13.5/15.9/15.6/
   * 6.4/5.6/3.6 ms) made monotone, so Ultra's measured ms predicts every tier. */
  relCost: [1, .9, .8, .47, .42, .27],
  gpuTierCap: [LADDER.length - 1, 3, 1, 0],   // detect-gpu tier 0 (blocklisted/very slow) .. 3 (≥ 60 fps class)
  minTexture: 4096, minMemoryGb: 4, minCores: 4,
};

export function probeCap(p: ProbeInput) {
  const reasons: string[] = []; let cap = 0;
  const limit = (c: number, why: string) => { if (c > cap) { cap = c; } reasons.push(`${why} → ≤ ${LADDER[c].name}`); };
  // detect-gpu's database lags new GPUs (omen's RTX 5060 Laptop came back tier 1 while it rendered Ultra in 8 ms), so the
  // measured frame time decides when we have one and detect-gpu only stands in without it.
  if (p.gpuTier !== undefined && (p.benchMs === undefined || !isFinite(p.benchMs))) limit(PROBE.gpuTierCap[Math.max(0, Math.min(3, p.gpuTier))], `detect-gpu tier ${p.gpuTier}`);
  if (p.maxTexture !== undefined && p.maxTexture < PROBE.minTexture) limit(3, `max texture ${p.maxTexture}`);
  if (p.deviceMemory !== undefined && p.deviceMemory < PROBE.minMemoryGb) limit(3, `${p.deviceMemory} GB memory`);
  if (p.cores !== undefined && p.cores < PROBE.minCores) limit(2, `${p.cores} cores`);
  if (p.benchMs !== undefined && isFinite(p.benchMs)) {
    let t = PROBE.relCost.findIndex(r => p.benchMs! * r <= PROBE.budgetMs * PROBE.headroom);
    if (t < 0) t = LADDER.length - 1;
    limit(t, `bench ${p.benchMs.toFixed(1)} ms at Ultra`);
  }
  const igpu = isIntegrated(p.renderer); if (igpu) reasons.push('integrated GPU (Intel/AMD iGPU) is rendering: on a hybrid laptop set the browser to the high-performance GPU');
  return { cap, reasons, igpu };
}
/** Integrated GPU from the unmasked renderer string (flags a hybrid laptop running on the iGPU instead of the discrete one). */
export const isIntegrated = (r: string) => /intel|uhd|iris|radeon\(tm\) graphics|vega \d|amd radeon graphics/i.test(r) && !/arc a\d/i.test(r);
/** The cached probe if it was made on this renderer with this probe version. */
export function cachedProbe(storage: Pick<Storage, 'getItem'> | undefined, renderer: string): ProbeResult | undefined {
  try { const r = JSON.parse(storage?.getItem(PROBE.key) ?? 'null') as ProbeResult | null;
    return r && r.renderer === renderer && r.version === PROBE.version ? r : undefined; } catch { return undefined; }
}
export function saveProbe(storage: Pick<Storage, 'setItem'> | undefined, input: ProbeInput, now = Date.now(), cap?: number): ProbeResult {
  const r: ProbeResult = { ...input, ...probeCap(input), at: now, version: PROBE.version }; if (cap !== undefined) { r.cap = cap; r.reasons.push(`raised to ${LADDER[cap].name} by sustained headroom`); }
  try { storage?.setItem(PROBE.key, JSON.stringify(r)); } catch { /* storage blocked: probe again next time */ }
  return r;
}
/** Median, the robust frame statistic (one GC or upload spike must not lower the cap). */
export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : NaN; };
