/**
 * Generic needs engine (T-0036). Species-agnostic: every number comes from a SpeciesTemplate (core/needs/template). Pure TS.
 * Runs for any animal, player-embodied or NPC. Levels are 0..100 %.
 *
 *  water  : loses the species' daily water turnover, scaled by the activity factor (metabolic power / daily-average FMR:
 *           water flux tracks energy flux, Nagy & Peterson 1988's water economy index) and by heat; 0 % = the critical
 *           body-water deficit. Drinking and eating food with preformed water put it back.
 *  energy : the host's existing Energy stat (AnimalBrain.energy / Agent.energy), passed in and returned: 100 = one day of
 *           FMR, drained at that rate x the activity factor. Food adds to it where the host already does (forage, hare).
 *  rest   : drains while moving (x effort relative to walking), refills while still.
 * Metabolic power of a moving quadruped: Taylor, Heglund & Maloiy 1982 (JEB 97:1), E/M = 10.7 M^-0.316 v + 6.03 M^-0.303
 * W/kg (v m/s, M kg); standing still = the intercept. Time: GAME seconds (the world clock), so real play is x12.
 */
import type { NeedId, SpeciesTemplate } from './template';
export interface NeedsState { water: number; rest: number }
export type NeedLevels = Record<NeedId, number>;
export const createNeeds = (init: Partial<NeedsState> = {}): NeedsState => ({ water: init.water ?? 100, rest: init.rest ?? 100 });
const clamp = (x: number) => Math.max(0, Math.min(100, x));
/** Metabolic power (W) at ground speed v (m/s); still (v < 0.05) = standing. */
export function metabolicW(sp: SpeciesTemplate, v: number) {
  const M = sp.body.massKg.v, s = Math.abs(v);
  return M * ((s < .05 ? 0 : 10.7 * M ** -.316 * s) + 6.03 * M ** -.303);
}
/** Metabolic power over the daily-average FMR. */
export const activityFactor = (sp: SpeciesTemplate, v: number) => metabolicW(sp, v) / (sp.body.fmrKjPerDay.v * 1000 / 86400);
/** Hydration % per mL of water. */
export const percentPerMl = (sp: SpeciesTemplate) => 100 / (sp.needs.water.criticalDeficit.v * sp.body.massKg.v * 1000);
/** Heat multiplier on water loss at air temperature tC. */
export const heatFactor = (sp: SpeciesTemplate, tC?: number) => 1 + sp.needs.water.heatPerC.v * Math.max(0, (tC ?? 0) - sp.needs.water.heatAboveC.v);
/** Rates (% per game second) at speed v, temperature tC. */
export function needRates(sp: SpeciesTemplate, v: number, tC?: number, drinking = false) {
  const W = sp.needs.water, f = activityFactor(sp, v), still = Math.abs(v) < .05;
  const water = -W.turnoverMlPerDay.v / 86400 * f * heatFactor(sp, tC) * percentPerMl(sp) + (drinking ? W.drinkMlPerS.v * percentPerMl(sp) : 0);
  const energy = -100 / sp.needs.energy.fullSeconds.v * f;
  const R = sp.needs.rest, rest = still ? 100 / (R.restHoursToFull.v * 3600)
    : -100 / (R.activeHoursToEmpty.v * 3600) * metabolicW(sp, v) / metabolicW(sp, sp.body.speeds.walk.v);
  return { water, energy, rest };
}
export interface NeedsStep { dtGame: number; speed: number; tC?: number; drinking?: boolean; energy: number }
/** One step: returns the new needs state and the host's new energy. Drinking only while still. */
export function stepNeeds(sp: SpeciesTemplate, st: NeedsState, i: NeedsStep): { state: NeedsState; energy: number } {
  const r = needRates(sp, i.speed, i.tC, !!i.drinking && Math.abs(i.speed) < .05);
  return { state: { water: clamp(st.water + r.water * i.dtGame), rest: clamp(st.rest + r.rest * i.dtGame) }, energy: clamp(i.energy + r.energy * i.dtGame) };
}
/** Eating `kg` of food `kind`: its preformed water (Energy is added by the host's existing food transaction). */
export function eatWater(sp: SpeciesTemplate, st: NeedsState, kind: string, kg: number): NeedsState {
  const w = sp.needs.water.foodWaterMlPerKg[kind]?.v ?? 0;
  return { ...st, water: clamp(st.water + w * kg * percentPerMl(sp)) };
}
/** Stamina meter rates (% per REAL second) for the controls (core/wolfModes) and agents. */
export const staminaRates = (sp: SpeciesTemplate) => ({ sprint: 100 / sp.stamina.sprintSeconds.v, run: 100 / sp.stamina.runSeconds.v, recover: 100 / sp.stamina.recoverSeconds.v });
/** The template's levels in the shape of core/agent AgentSpecies.levels (energy drain per s, stamina seconds), so the agent
 *  pipeline (T-0009) can read its numbers from here once it lands on main. */
export const agentLevels = (sp: SpeciesTemplate) => ({ energy: { drain: 100 / sp.needs.energy.fullSeconds.v }, stamina: { max: 100, drainSeconds: sp.stamina.sprintSeconds.v, recoverSeconds: sp.stamina.recoverSeconds.v } });
/** Levels for thoughts/behaviour. */
export const levelsOf = (st: NeedsState, energy: number): NeedLevels => ({ water: st.water, energy, rest: st.rest });
/** Parse saved needs; anything invalid falls back to full. */
export function parseNeeds(raw: string | null): NeedsState {
  try { const o = raw ? JSON.parse(raw) : {}; const ok = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? clamp(x) : undefined;
    return createNeeds({ water: ok(o.water), rest: ok(o.rest) }); } catch { return createNeeds(); }
}
