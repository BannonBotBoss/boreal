/**
 * The ONE solid-contact bus (Grok Bot, T-0006). Pure TypeScript: no three.js, no DOM.
 *
 * "Two solid things are touching" is a stored pair; listeners hear only the edges:
 *   begin(c)  -> true only on the rising edge (the pair was not touching); onContact listeners run once.
 *   end(a, b) -> true only on the falling edge; onSeparate listeners run once.
 * Pairs are order-free (log|ground == ground|log). A contact that lasts an hour costs nothing per frame.
 * `touching()` lists the current pairs, so a late subscriber still sees contacts made at spawn.
 *
 * IMPORTANT for listeners: begin/end are not always world events. `Contact.source` says where an edge came from. The
 * first emitter ('chunk-build:log', render/buildScene) fires begin when a chunk is built and end when it is disposed:
 * that is a render-lifetime edge ("this contact became known"), not "the log just fell". Transactions that react to it
 * must be idempotent (core/events solidContact is).
 *
 *   import { CONTACTS } from './contactBus';
 *   const off = CONTACTS.onContact(c => { ... }); ... off();
 */
export type Solid = string; // an entity key, or 'ground' for the earth
export type Vec3 = [number, number, number];
/** Optional seating inputs for whoever seats the object (T-0005 seatLog reads them; T-0006 never seats, sinks or tilts).
 *  Densities in kg/m3 (core/materials); sinkFraction = sunk depth / trunk width (Matthew: ~1/3). */
export interface SeatInputs { trunkDensity?: number; earthDensity?: number; sinkFraction?: number }
export interface Contact extends SeatInputs { a: Solid; b: Solid; at: Vec3; normal: Vec3; kind: 'solid-solid' | 'feed'; source: string } // 'feed': an eater touching its food (core/agent pipeline)
/** Defaults: forest-floor mineral soil bulk density ~1.2-1.5 g/cm3 (core/ground sandy podzol note) [verify]; sink ~1/3 (Matthew). */
export const SEAT_DEFAULTS = { earthDensity: 1300, sinkFraction: 1 / 3 } as const;
/** Seating inputs with defaults and sane bounds (densities finite and > 0, sinkFraction in [0, 1]); trunkDensity stays
 *  undefined when not given (the reader picks it from its own material). Pure; never moves anything. */
export function seatInputs(c: SeatInputs): Required<Pick<SeatInputs, 'earthDensity' | 'sinkFraction'>> & Pick<SeatInputs, 'trunkDensity'> {
  const pos = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined;
  const f = c.sinkFraction !== undefined && Number.isFinite(c.sinkFraction) ? Math.min(1, Math.max(0, c.sinkFraction)) : SEAT_DEFAULTS.sinkFraction;
  return { trunkDensity: pos(c.trunkDensity), earthDensity: pos(c.earthDensity) ?? SEAT_DEFAULTS.earthDensity, sinkFraction: f };
}
export type ContactListener = (c: Contact) => void;
export type SeparateListener = (a: Solid, b: Solid, source: string) => void;

export const pairKey = (a: Solid, b: Solid) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function createContactBus() {
  const pairs = new Map<string, Contact>();
  const begins = new Set<ContactListener>(), ends = new Set<SeparateListener>();
  return {
    /** Rising edge: records the pair; returns true (and notifies) only if it was not already touching. */
    begin(c: Contact) {
      const k = pairKey(c.a, c.b); if (pairs.has(k)) return false;
      pairs.set(k, c); for (const fn of [...begins]) fn(c); return true;
    },
    /** Falling edge: forgets the pair; returns true (and notifies) only if it was touching. */
    end(a: Solid, b: Solid) {
      const k = pairKey(a, b), c = pairs.get(k); if (!c) return false;
      pairs.delete(k); for (const fn of [...ends]) fn(a, b, c.source); return true;
    },
    /** Rising edges only; returns the unsubscribe function. */
    onContact(fn: ContactListener) { begins.add(fn); return () => { begins.delete(fn); }; },
    onSeparate(fn: SeparateListener) { ends.add(fn); return () => { ends.delete(fn); }; },
    /** Current contacts; with `a`, only those involving it; with `a` and `b`, that one pair (0 or 1). */
    touching(a?: Solid, b?: Solid): Contact[] {
      if (a !== undefined && b !== undefined) { const c = pairs.get(pairKey(a, b)); return c ? [c] : []; }
      const all = [...pairs.values()]; return a === undefined ? all : all.filter(c => c.a === a || c.b === a);
    },
    get size() { return pairs.size; },
  };
}
export type ContactBus = ReturnType<typeof createContactBus>;
/** The game's single solid-contact bus. */
export const CONTACTS = createContactBus();
