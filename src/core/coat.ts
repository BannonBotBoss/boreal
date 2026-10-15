/**
 * Procedural coat layer (Grok Bot): a colour gradient along a body axis plus painted region marks, all as small
 * bounded data in the genome (no textures). Coordinates are the animal's own normalized side profile:
 * u = 0 tail .. 1 nose, v = 0 feet .. 1 back. The render layer turns this into a shader tint (render/appearance.ts).
 */
import { clamp } from '../proc/math';
export interface Stop { t: number; color: string; a: number }
export interface Mark { u: number; v: number; r: number; color: string; a: number }
export interface Coat { mode: 'length' | 'height' | 'radial'; stops: Stop[]; marks: Mark[] }
export const COAT_LIMITS = { stops: 6, marks: 24, r: [.02, .4] as const };
export const DEFAULT_COAT = '{"mode":"length","stops":[],"marks":[]}';
const hex = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '#808080';
const q = (x: unknown, lo = 0, hi = 1) => +clamp(Number(x) || 0, lo, hi).toFixed(4);
/** Parse + clamp anything into a valid coat, canonical JSON (so equal coats compare equal in the edit log). */
export function normalizeCoat(input: string | Coat): string {
  let c: Partial<Coat>; try { c = typeof input === 'string' ? JSON.parse(input) : input; } catch { c = {}; }
  const mode = (['length', 'height', 'radial'] as const).includes(c.mode as never) ? c.mode! : 'length';
  const stops = (Array.isArray(c.stops) ? c.stops : []).slice(0, COAT_LIMITS.stops).map(s => ({ t: q(s.t), color: hex(s.color), a: q(s.a) })).sort((a, b) => a.t - b.t);
  const marks = (Array.isArray(c.marks) ? c.marks : []).slice(-COAT_LIMITS.marks).map(m => ({ u: q(m.u), v: q(m.v), r: q(m.r, ...COAT_LIMITS.r), color: hex(m.color), a: q(m.a) }));
  return JSON.stringify({ mode, stops, marks });
}
export const parseCoat = (s: string) => JSON.parse(normalizeCoat(s)) as Coat;
/** Gradient colour at t (linear between stops), as [r,g,b,a] 0..1; used by tests and the UI preview. */
export function sampleCoat(c: Coat, t: number): number[] {
  if (!c.stops.length) return [1, 1, 1, 0];
  const rgb = (s: Stop) => [1, 3, 5].map(i => parseInt(s.color.slice(i, i + 2), 16) / 255).concat(s.a);
  const i = c.stops.findIndex(s => s.t >= t);
  if (i <= 0) return rgb(c.stops[i < 0 ? c.stops.length - 1 : 0]);
  const a = c.stops[i - 1], b = c.stops[i], k = (t - a.t) / (b.t - a.t || 1);
  return rgb(a).map((x, j) => x + (rgb(b)[j] - x) * k);
}
