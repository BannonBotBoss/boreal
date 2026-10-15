/** Player wolf is modelled at half size and scaled to real wolf proportions: ~0.74 m at the shoulder, ears ~1 m (wolves stand roughly 0.65–0.8 m). */
export const WOLF_SCALE = 2;
export type WolfMode = 'walk' | 'run' | 'stealth' | 'sprint' | 'super-stealth';
export interface WolfModes {
  stamina: number; maxStamina?: number; mode: WolfMode; first: 'left' | 'right' | null;
  left: boolean; right: boolean; sprintTime: number; sprintSpent: boolean; exhausted: boolean;
}
export const modeSpeed: Record<WolfMode, number> = { walk: 2, run: 4, stealth: .8, sprint: 7, 'super-stealth': .35 };
export function createWolfModes(maxStamina = 100): WolfModes {
  return { stamina: maxStamina, maxStamina, mode: 'walk', first: null, left: false, right: false, sprintTime: 0, sprintSpent: false, exhausted: false };
}
/** The first trigger owns a chord until BOTH are released. Same-sample ties choose stealth. */
export function stepWolfModes(state: WolfModes, leftValue: number, rightValue: number, moving: boolean, dt: number): WolfModes {
  const next = { ...state };
  next.left = leftValue > (state.left ? .15 : .25);
  next.right = rightValue > (state.right ? .15 : .25);
  if (!next.left && !next.right) {
    next.first = null; next.sprintTime = 0; next.sprintSpent = false;
    if (next.stamina >= (next.maxStamina ?? 100) * .2) next.exhausted = false;
  } else if (!next.first) next.first = next.left ? 'left' : 'right';
  const both = next.left && next.right;
  next.mode = both ? next.first === 'left' ? 'super-stealth' : !next.sprintSpent ? 'sprint' : 'run'
    : next.left ? 'stealth' : next.right ? 'run' : 'walk';
  if (next.exhausted && (next.mode === 'run' || next.mode === 'sprint')) next.mode = 'walk';
  if (next.mode === 'sprint') {
    next.sprintTime += dt;
    if (next.sprintTime >= 1.5) { next.sprintSpent = true; next.mode = 'run'; }
  }
  const drain = moving ? next.mode === 'sprint' ? 16 : next.mode === 'run' ? 7 : 0 : 0;
  next.stamina = Math.max(0, Math.min(next.maxStamina ?? 100, next.stamina + (drain ? -drain : 10) * dt));
  if (next.stamina <= 0) { next.exhausted = true; next.sprintSpent = true; next.mode = 'walk'; }
  return next;
}
