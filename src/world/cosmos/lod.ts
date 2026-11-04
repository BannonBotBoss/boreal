/** Level of detail for the early-universe sphere. The choice is a pure function of measured frame times. */

export interface Tier {
  id: 'ultra' | 'high' | 'medium' | 'low';
  label: string;
  width: number;
  height: number;
  segments: number;
  raymarch: number;
  shells: number;
  bloom: number;
  bloomMips: number;
  godrays: number;
  chromatic: number;
  grain: number;
  vignette: number;
  msaa: number;
}

export const TIERS: readonly Tier[] = [
  { id: 'ultra', label: 'Ultra', width: 3840, height: 2160, segments: 128, raymarch: 48, shells: 0, bloom: 1.15, bloomMips: 5, godrays: 0.55, chromatic: 0.004, grain: 0.045, vignette: 0.45, msaa: 8 },
  { id: 'high', label: 'High', width: 2560, height: 1440, segments: 96, raymarch: 24, shells: 0, bloom: 0.9, bloomMips: 5, godrays: 0.4, chromatic: 0.003, grain: 0.04, vignette: 0.4, msaa: 4 },
  { id: 'medium', label: 'Medium', width: 1920, height: 1080, segments: 64, raymarch: 0, shells: 4, bloom: 0.65, bloomMips: 3, godrays: 0, chromatic: 0.002, grain: 0.03, vignette: 0.35, msaa: 2 },
  { id: 'low', label: 'Low', width: 1280, height: 720, segments: 32, raymarch: 0, shells: 0, bloom: 0.4, bloomMips: 2, godrays: 0, chromatic: 0, grain: 0, vignette: 0.25, msaa: 0 },
];

export function tierById(id: string): Tier {
  return TIERS.find(t => t.id === id) ?? TIERS[TIERS.length - 1];
}

export interface TierSample { id: Tier['id']; p50: number; p95: number }

/** Highest tier whose 95th percentile frame time is within the target. */
export function chooseTier(samples: readonly TierSample[], targetMs: number): Tier['id'] {
  for (const tier of TIERS) {
    const s = samples.find(x => x.id === tier.id);
    if (s && s.p95 <= targetMs) return tier.id;
  }
  return 'low';
}

export interface Hysteresis {
  tier: Tier['id'];
  /** Seconds the frame time has stayed over budget. */
  over: number;
  /** Seconds it has stayed comfortably under budget. */
  under: number;
}

/** Step down after `hold` seconds over budget, step up after `hold` seconds under 60% of budget. */
export function stepTier(state: Hysteresis, p95: number, dt: number, targetMs: number, hold = 2): Hysteresis {
  const order = TIERS.map(t => t.id);
  const i = Math.max(0, order.indexOf(state.tier));
  let over = state.over;
  let under = state.under;
  if (p95 > targetMs) { over += dt; under = 0; }
  else if (p95 < targetMs * 0.6) { under += dt; over = 0; }
  else { over = 0; under = 0; }
  let tier = state.tier;
  if (over >= hold && i + 1 < order.length) { tier = order[i + 1]; over = 0; under = 0; }
  if (under >= hold && i > 0) { tier = order[i - 1]; over = 0; under = 0; }
  return { tier, over, under };
}

export function percentile(times: readonly number[], p: number): number {
  if (!times.length) return Infinity;
  const s = [...times].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));
  return s[i];
}
