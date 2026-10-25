/** Player wolf is modelled at half size and scaled to real wolf proportions: ~0.74 m at the shoulder, ears ~1 m (wolves stand roughly 0.65–0.8 m). */
export const WOLF_SCALE = 2;
import { staminaRates } from './needs/engine';
import { WOLF_NEEDS } from './needs/species';
/** Stamina rates (% per real s) of the embodied species: core/needs template (T-0036). Wolf: sprint 12 s, run 36 s, refill 10 s. */
export type StaminaRates = ReturnType<typeof staminaRates>;
export const WOLF_STAMINA = staminaRates(WOLF_NEEDS);
export type WolfMode = 'walk' | 'run' | 'stealth' | 'sprint' | 'super-stealth';
export interface WolfModes {
  stamina: number; maxStamina?: number; mode: WolfMode; first: 'left' | 'right' | null;
  left: boolean; right: boolean; sprintTime: number; sprintSpent: boolean; exhausted: boolean;
}
export const modeSpeed: Record<WolfMode, number> = { walk: 2, run: 4, stealth: .8, sprint: 7, 'super-stealth': .35 };
/** Stamina fraction at which `exhausted` clears. Panting uses the same line (T-0017). */
export const STAMINA_UP = .2;
export function createWolfModes(maxStamina = 100): WolfModes {
  return { stamina: maxStamina, maxStamina, mode: 'walk', first: null, left: false, right: false, sprintTime: 0, sprintSpent: false, exhausted: false };
}
/** The first trigger owns a chord until BOTH are released. Same-sample ties choose stealth. */
export function stepWolfModes(state: WolfModes, leftValue: number, rightValue: number, moving: boolean, dt: number, rates: StaminaRates = WOLF_STAMINA): WolfModes {
  const next = { ...state };
  next.left = leftValue > (state.left ? .15 : .25);
  next.right = rightValue > (state.right ? .15 : .25);
  if (!next.left && !next.right) {
    next.first = null; next.sprintTime = 0; next.sprintSpent = false;
    if (next.stamina >= (next.maxStamina ?? 100) * STAMINA_UP) next.exhausted = false;
  } else if (!next.first) next.first = next.left ? 'left' : 'right';
  const both = next.left && next.right;
  next.mode = both ? next.first === 'left' ? 'super-stealth' : !next.sprintSpent ? 'sprint' : 'run'
    : next.left ? 'stealth' : next.right ? 'run' : 'walk';
  if (next.exhausted && (next.mode === 'run' || next.mode === 'sprint')) next.mode = 'walk';
  if (next.mode === 'sprint') next.sprintTime += dt; // T-0036: a sprint lasts until the stamina is spent (was a 1.5 s burst)
  const drain = moving ? next.mode === 'sprint' ? rates.sprint : next.mode === 'run' ? rates.run : 0 : 0;
  next.stamina = Math.max(0, Math.min(next.maxStamina ?? 100, next.stamina + (drain ? -drain : rates.recover) * dt));
  if (next.stamina <= 0) { next.exhausted = true; next.sprintSpent = true; next.mode = 'walk'; }
  return next;
}
