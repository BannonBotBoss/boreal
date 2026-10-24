/**
 * THE constants store (Grok Bot). Data: src/data/constants.json, a derivation graph: base inputs (SI 2019 defining
 * constants, measured values like alpha and G, IAU/WGS84 nominal values) and derived values computed from them by formula.
 * Locked base constants (G first) always use their CODATA value; core/constantLock.ts unlocks them after a knowledge test.
 * Read live values with `K.name` (getters) or `k('name')`; never copy a value into a module-level const if it can change.
 * Docs: docs/constants.md. Rust mirror: rust/boreal-sim/src/constants.rs (tools/gen-constants.ts, locked values).
 */
import DATA from '../data/constants.json';

export interface BaseConst { value: number; unit: string; uncertainty: number; source: string; locked?: boolean; range?: [number, number] }
export interface DerivedConst { formula: string; unit: string; source: string }
export const BASE = DATA.base as unknown as Record<string, BaseConst>;
export const DERIVED = DATA.derived as Record<string, DerivedConst>;

/** root of x = 5(1 - e^-x) (Wien displacement), Newton iteration */
export function wienX() { let x = 5; for (let i = 0; i < 50; i++) { const g = x - 5 * (1 - Math.exp(-x)), d = 1 - 5 * Math.exp(-x); x -= g / d; } return x; }

const MATH_SRC = DATA.math as Record<string, string>;
const evalExpr = (expr: string, scope: Record<string, number>) =>
  new Function('wienX', ...Object.keys(scope), `return (${expr});`)(wienX, ...Object.values(scope)) as number;
export const MATH: Record<string, number> = {};
for (const [n, ex] of Object.entries(MATH_SRC)) MATH[n] = evalExpr(ex, MATH);

/** Overrides for unlocked base constants only. */
const overrides: Record<string, number> = {};
let values: Record<string, number> = {};
export function evaluate(over: Record<string, number> = {}): Record<string, number> {
  const s: Record<string, number> = { ...MATH };
  for (const [n, b] of Object.entries(BASE)) s[n] = over[n] ?? b.value;
  for (const [n, d] of Object.entries(DERIVED)) s[n] = evalExpr(d.formula, s);
  return s;
}
const recompute = () => { values = evaluate(overrides); };
recompute();

export const k = (name: string) => { const v = values[name]; if (v === undefined) throw new Error(`unknown constant ${name}`); return v; };
/** Live view: K.G, K.sigma, K.PI ... (always the current value, recomputed through the graph). */
export const K = new Proxy({} as Record<string, number>, { get: (_t, p: string) => k(p) });

/** Set a base constant. Refused while locked (see constantLock.ts); clamped to its range. */
export function setBase(name: string, v: number, isUnlocked: (n: string) => boolean) {
  const b = BASE[name]; if (!b) throw new Error(`unknown base constant ${name}`);
  if ((b.locked ?? true) && !isUnlocked(name)) return false;
  const [lo, hi] = b.range ?? [b.value, b.value];
  overrides[name] = Math.min(hi, Math.max(lo, v)); recompute(); return true;
}
export function resetBase(name?: string) { if (name) delete overrides[name]; else for (const n in overrides) delete overrides[n]; recompute(); }
