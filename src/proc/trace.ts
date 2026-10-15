/**
 * Generation trace hook (Grok Bot). Generators and behaviour layers report the named factors behind what they make:
 *   const h = f('tree', 'height', 8 + rng() * 5);      const kind = choose('chunk', 'kind', roll, KIND_TABLE);
 * With no active trace, `f` returns its input and `choose` a plain table lookup: no allocation, no behaviour change.
 * The inspector runs the SAME generator code under `withTrace` (or a live trace) to read the factors, and to apply
 * what-if overrides by factor name. `filter` limits a trace to one scope (entity key) set with `scope(key)`.
 */
export type Value = number | string | boolean;
export type Table = readonly (readonly [string, number])[]; // [label, cumulative upper bound], last bound 1
export interface Factor { group: string; name: string; value: Value; scope: string; table?: Table; roll?: number }
export interface Trace { factors: Factor[]; filter?: string; overrides?: Record<string, Value>; record?: boolean; scope?: string }

let active: Trace | undefined;
export const tracing = () => active !== undefined;
/** Mark which entity the following factors belong to ('' = none). Free when no trace is active. */
export function scope(key: string) { if (active) active.scope = key; }
function report<V extends Value>(group: string, name: string, value: V, extra?: Pick<Factor, 'table' | 'roll'>): V {
  const t = active!;
  if (t.filter !== undefined && t.scope !== t.filter) return value;
  const o = t.overrides?.[name];
  if (o !== undefined && typeof o === typeof value) value = o as V;
  if (t.record !== false) t.factors.push({ group, name, value, scope: t.scope ?? '', ...extra });
  return value;
}
/** Report a factor; returns it (or its what-if override). */
export function f<V extends Value>(group: string, name: string, value: V): V { return active ? report(group, name, value) : value; }
/** Weighted pick from a cumulative table; the trace keeps the roll and every weight. */
export function choose<L extends string>(group: string, name: string, roll: number, table: readonly (readonly [L, number])[]): L {
  let pick = table[table.length - 1][0];
  for (const [label, upTo] of table) if (roll < upTo) { pick = label; break; }
  return active ? report(group, name, pick, { table, roll }) : pick;
}
/** Run `fn` with `t` as the active trace (nested traces restore the outer one). */
export function withTrace<T>(t: Trace, fn: () => T): T {
  const outer = active; active = t; t.scope ??= '';
  try { return fn(); } finally { active = outer; }
}
/** Live trace for behaviour layers that run every frame (inspector on); undefined switches tracing off. */
export function setLiveTrace(t?: Trace) { active = t; if (t) t.scope ??= ''; }
