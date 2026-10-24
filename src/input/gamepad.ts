/**
 * Gamepad reader (Grok Bot, Matt: "all of these need to be accessible through the xbox gamepad"). Builds on core/bindings
 * (the ONE action registry: W3C standard mapping, Xbox names, dead zones in atomValues) and adds what menus need on a
 * couch: press / release edges, auto-repeat for held d-pad and stick directions, and tap vs hold for dual-use buttons.
 * Pure: feed it atom values (bindings.atomValues) and a clock; tests drive it with a mocked pad.
 */
import { ACTIVE, ACTIONS, atomValues, atomsOf, isKeyAtom, type Bindings, type Context, type PadState } from '../core/bindings';

export const REPEAT = { delayMs: 380, rateMs: 110 };
export const HOLD_MS = 350;
const REPEATS = new Set(['dup', 'ddown', 'dleft', 'dright', 'ls.up', 'ls.down', 'ls.left', 'ls.right']);
export interface PadEdges { value: Map<string, number>; down: Set<string>; up: Set<string>; repeat: Set<string>; tap: Set<string>; hold: Set<string> }

export function createPadReader() {
  const since = new Map<string, number>(), lastRep = new Map<string, number>(), held = new Set<string>();
  return {
    update(value: Map<string, number>, now: number): PadEdges {
      const down = new Set<string>(), up = new Set<string>(), repeat = new Set<string>(), tap = new Set<string>(), hold = new Set<string>();
      for (const [a, x] of value) if (x > ACTIVE && !since.has(a)) { since.set(a, now); lastRep.set(a, now); down.add(a); if (REPEATS.has(a)) repeat.add(a); }
      for (const [a, t0] of [...since]) {
        if ((value.get(a) ?? 0) > ACTIVE) {
          if (REPEATS.has(a) && now - t0 >= REPEAT.delayMs && now - lastRep.get(a)! >= REPEAT.rateMs) { repeat.add(a); lastRep.set(a, now); }
          if (!held.has(a) && now - t0 >= HOLD_MS) { held.add(a); hold.add(a); }
        } else { up.add(a); if (!held.has(a)) tap.add(a); since.delete(a); lastRep.delete(a); held.delete(a); }
      }
      return { value, down, up, repeat, tap, hold };
    },
    isHeld: (a: string) => held.has(a), reset() { since.clear(); lastRep.clear(); held.clear(); },
  };
}
/** The first connected standard-mapping pad (the Xbox layout), or undefined. */
export function standardPad(nav: { getGamepads?(): (Gamepad | null)[] } | undefined = typeof navigator === 'undefined' ? undefined : navigator): PadState | undefined {
  try { return [...(nav?.getGamepads?.() ?? [])].find(p => p?.connected && p.mapping === 'standard') ?? undefined; } catch { return undefined; }
}
/** Pad presses of one context's press actions this frame, using edges (and auto-repeat for d-pad / stick directions). */
export function contextPresses(b: Bindings, e: PadEdges, ctx: Context) {
  const out = new Set<string>();
  for (const a of ACTIONS) { if (a.kind !== 'press' || !(a.context === ctx || (a.context === 'any' && ctx !== 'menu'))) continue;
    for (const c of b[a.id]?.pad ?? []) { const at = atomsOf(c), last = at[at.length - 1];
      if (at.slice(0, -1).every(m => (e.value.get(m) ?? 0) > ACTIVE) && (e.repeat.has(last) || (e.down.has(last) && !e.repeat.has(last)))) out.add(a.id); } }
  return out;
}
/** Keyboard event key → the menu-context action it fires, from the same registry. */
export function keyAction(b: Bindings, key: string, ctx: Context) {
  const k = 'k:' + (key === ' ' ? 'space' : key.toLowerCase());
  return ACTIONS.find(a => (a.context === ctx || (a.context === 'any' && ctx !== 'menu')) && a.kind === 'press' && (b[a.id]?.keys ?? []).some(c => atomsOf(c).every(isKeyAtom) && atomsOf(c).length === 1 && atomsOf(c)[0] === k))?.id;
}
export { atomValues };
