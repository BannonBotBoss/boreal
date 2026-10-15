/**
 * Animal appearance genome (Grok Bot). genome = species default + edit log replayed: deterministic and serializable.
 * Bounds live ONCE in GENOME_SCHEMA (a SettingDef list, so the generic pause-menu settings renderer draws it);
 * cross-parameter constraints keep proportions anatomically plausible. The log is append-only: undo, redo, reset and
 * jump are themselves appended records, so any state can be rebuilt by replay.
 * Exposable today at the render layer (no Claude file edits): size, body length/height/width, coat hue/saturation/
 * brightness, fur cards on/off. Limb/leg lengths, head/ear/tail size, fur length and pattern need spec hooks (AGENT-NOTES).
 */
import type { SettingDef } from './renderSettings';
import { clamp } from '../proc/math';
import { DEFAULT_COAT, normalizeCoat } from './coat';
import { softWall } from '../ui/haptics';

const slider = (id: string, label: string, group: string, min: number, max: number, step: number, def: number): SettingDef =>
  ({ id, label: `${label} (${min}–${max})`, group, type: 'slider', min, max, step, default: def, apply: () => {} });
export const GENOME_SCHEMA: SettingDef[] = [
  slider('size', 'Overall size ×', 'Proportions', .6, 1.6, .01, 1),
  slider('length', 'Body length ×', 'Proportions', .75, 1.35, .01, 1),
  slider('height', 'Body height ×', 'Proportions', .75, 1.35, .01, 1),
  slider('width', 'Body width ×', 'Proportions', .75, 1.35, .01, 1),
  slider('hue', 'Coat hue shift (°)', 'Coat', -60, 60, 1, 0),
  slider('saturation', 'Coat saturation ±', 'Coat', -.5, .5, .01, 0),
  slider('brightness', 'Coat brightness ×', 'Coat', .4, 1.6, .01, 1),
  { id: 'fur', label: 'Fur cards', group: 'Coat', type: 'toggle', default: true, apply: () => {} },
];
export type Gene = number | boolean | string;
export type Genome = Record<string, Gene>;
/** Every genome param: the slider/toggle schema plus 'coat' (gradient + marks JSON, core/coat.ts). */
export const PARAMS = [...GENOME_SCHEMA.map(d => d.id), 'coat'];
export const defaultGenome = (): Genome => ({ ...Object.fromEntries(GENOME_SCHEMA.map(d => [d.id, d.default as Gene])), coat: DEFAULT_COAT });
/** Cross-parameter limits (ratio pairs): keeps an animal from becoming a pancake or a stilt. */
export const CONSTRAINTS = [{ a: 'height', b: 'length', min: .7, max: 1.4 }, { a: 'width', b: 'length', min: .7, max: 1.4 }, { a: 'width', b: 'height', min: .7, max: 1.4 }];

/** Clamp one proposed value to its schema bounds and to every ratio constraint with the rest of the genome. */
export function clampParam(g: Genome, id: string, v: Gene): Gene {
  if (id === 'coat') return normalizeCoat(v as string);
  const d = GENOME_SCHEMA.find(x => x.id === id); if (!d) throw new Error(`unknown genome param ${id}`);
  if (d.type === 'toggle') return !!v;
  let x = clamp(Number(v), d.min!, d.max!);
  for (const c of CONSTRAINTS) {
    if (c.a === id) x = clamp(x, c.min * (g[c.b] as number), c.max * (g[c.b] as number));
    if (c.b === id) x = clamp(x, (g[c.a] as number) / c.max, (g[c.a] as number) / c.min);
  }
  return +clamp(x, d.min!, d.max!).toFixed(6);
}
/** Limits currently allowed for a param (schema bounds narrowed by constraints), for the UI. */
export function limits(g: Genome, id: string) { return [clampParam(g, id, -Infinity), clampParam(g, id, Infinity)] as number[]; }

export interface Edit { param: string; old: Gene; new: Gene; time: number; op: 'set' | 'undo' | 'redo' | 'reset' | 'jump' | 'load' | 'drag' | 'sketch' | 'paint'; group: number }
export const replay = (log: readonly Edit[], upTo = log.length) => { const g = defaultGenome(); for (const e of log.slice(0, upTo)) g[e.param] = e.new; return g; };

export function createGenomeEditor(log: Edit[] = [], now: () => number = () => Date.now()) {
  let undo: number[] = [], redo: number[] = [], nextGroup = log.reduce((m, e) => Math.max(m, e.group + 1), 0);
  let genome = replay(log);
  const records = (group: number) => log.filter(e => e.group === group);
  function commit(target: Genome, op: Edit['op']) {
    const group = nextGroup++, time = now(); let n = 0;
    for (const id of PARAMS) if (target[id] !== genome[id]) { log.push({ param: id, old: genome[id], new: target[id], time, op, group }); n++; }
    genome = replay(log); return n ? group : -1;
  }
  const userOp = (g: number) => { if (g >= 0) { undo.push(g); redo = []; } return g; };
  return {
    log: log as readonly Edit[], get genome() { return { ...genome }; },
    /** Set one param (clamped). Returns the value actually applied. */
    set(id: string, v: Gene) { const x = clampParam(genome, id, v); userOp(commit({ ...genome, [id]: x }, 'set')); return x; },
    undo() { const g = undo.pop(); if (g === undefined) return false; const t = { ...genome }; for (const e of records(g)) t[e.param] = e.old; commit(t, 'undo'); redo.push(g); return true; },
    redo() { const g = redo.pop(); if (g === undefined) return false; const t = { ...genome }; for (const e of records(g)) t[e.param] = e.new; commit(t, 'redo'); undo.push(g); return true; },
    reset: () => userOp(commit(defaultGenome(), 'reset')) >= 0,
    /** Jump to the genome as it was after log entry `index` (exclusive count). */
    jump: (count: number) => userOp(commit(replay(log, count), 'jump')) >= 0,
    load: (g: Genome) => userOp(commit(Object.fromEntries(PARAMS.map(id => [id, clampParam(defaultGenome(), id, g[id] ?? defaultGenome()[id])])), 'load')) >= 0,
    /** Several params as ONE record group (a handle drag or an accepted sketch fit); values are clamped in order. */
    setMany(values: Genome, op: Edit['op'] = 'set') { const t = { ...genome }; for (const [id, v] of Object.entries(values)) t[id] = clampParam(t, id, v); return userOp(commit(t, op)) >= 0; },
    canUndo: () => undo.length > 0, canRedo: () => redo.length > 0,
    toJSON: () => JSON.stringify(log),
  };
}
export type GenomeEditor = ReturnType<typeof createGenomeEditor>;

/** Handle drag -> param: a world-space drag along the handle's axis, relative to the body's base half-extent on that
 * axis, scales the param linearly (the render layer's effect is exactly linear). Pen pressure < .5 = fine (x0.25). */
export function handleWall(g: Genome, param: string, startValue: number, worldDelta: number, baseExtent: number, pressure = 1) {
  const fine = pressure > 0 && pressure < .5 ? .25 : 1, total = baseExtent * (g.size as number) * startValue, [lo, hi] = limits(g, param);
  const w = softWall(startValue * (1 + fine * worldDelta / (total || 1)), lo, hi); return { ...w, value: +w.value.toFixed(6) };
}
export const solveHandle = (...a: Parameters<typeof handleWall>) => handleWall(...a).value;
/** Slider input -> value: the slider's travel is mapped one soft zone past each bound, so the ends are the walls. */
export function sliderWall(g: Genome, id: string, raw: number, zone = .1) {
  const d = GENOME_SCHEMA.find(x => x.id === id)!, [lo, hi] = limits(g, id), z = (d.max! - d.min!) * zone;
  const w = softWall(d.min! - z + (raw - d.min!) / (d.max! - d.min!) * (d.max! - d.min! + 2 * z), lo, hi, zone); return { ...w, value: +w.value.toFixed(6) };
}
/** Sketch fit: least squares (chamfer) of stroke points against the base side silhouette scaled by length/height,
 * over a grid of in-bounds values, then clamped through the constraints. Points are in base-normalized units
 * (centre 0, the base silhouette spans about -0.5..0.5). Returns the nearest valid {length, height}. */
export function fitProfile(g: Genome, stroke: readonly [number, number][], silhouette: readonly [number, number][]) {
  const [l0, l1] = limits(g, 'length'), [h0, h1] = [GENOME_SCHEMA.find(d => d.id === 'height')!.min!, GENOME_SCHEMA.find(d => d.id === 'height')!.max!];
  let best = { length: g.length as number, height: g.height as number }, err = Infinity;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const L = l0 + (l1 - l0) * i / 24, H = h0 + (h1 - h0) * j / 24;
    let e = 0; for (const [x, y] of stroke) { let m = Infinity; for (const [sx, sy] of silhouette) m = Math.min(m, (x - sx * L) ** 2 + (y - sy * H) ** 2); e += m; }
    if (e < err - 1e-12) { err = e; best = { length: L, height: H }; }
  }
  const t = { ...g, length: clampParam(g, 'length', best.length) }; return { length: t.length as number, height: clampParam(t, 'height', best.height) as number, error: err / Math.max(1, stroke.length) };
}
