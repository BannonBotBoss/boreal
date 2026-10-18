/**
 * Sim floating origin + the ONE origin-shift bus (Grok Bot). Separate from the render origin (origin.ts, the camera).
 *
 * The sim keeps positions as metres from `origin` (doubles on the CPU). When the focus (the player) drifts more than
 * `threshold` (~2 km) from the origin, `request(focus)` queues a shift; `flush()` runs every subscriber exactly once, in
 * one tick, BEFORE render, with the same `offset` (the old→new origin displacement, metres, sim axes). Every subscriber
 * subtracts `offset` from every position it owns, INCLUDING previous-frame positions, so velocities (pos − prev) and
 * interpolation never see a jump.
 *
 * Intended subscribers (owners wire them; requests in AGENT-NOTES.md): physics bodies (translate pos AND prev / clear
 * interpolation history), particle buffers, AI memory and targets, trails and footprints, audio sources.
 *
 *   import { ORIGIN } from '../world/globe/originBus';
 *   const off = ORIGIN.onOriginShift(o => { for (const b of bodies) { b.pos.x -= o[0]; b.prev.x -= o[0]; ... } });
 *   ...each frame, after the sim step, before render:  ORIGIN.request(playerPos); ORIGIN.flush();
 */
export type Offset = readonly [number, number, number];
export type OriginListener = (offset: Offset) => void;

export function createOriginBus(threshold = 2000) {
  const listeners = new Set<OriginListener>();
  const origin: [number, number, number] = [0, 0, 0]; // absolute position of the sim origin (doubles), e.g. on the planet
  let pending: [number, number, number] | null = null, shifts = 0;
  return {
    threshold, origin, get shifts() { return shifts; }, get pending() { return pending; },
    /** Subscribe; returns the unsubscribe function. */
    onOriginShift(fn: OriginListener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    /** Queue a re-centre on `focus` (sim coordinates) when it is past the threshold; snapped to whole metres so repeated
     *  shifts never accumulate fractional drift. Returns whether a shift is pending. */
    request(focus: Offset) {
      if (Math.hypot(focus[0], focus[1], focus[2]) <= threshold) return pending !== null;
      const o: [number, number, number] = [Math.round(focus[0]), Math.round(focus[1]), Math.round(focus[2])];
      pending = o; return true; // focus is in current (pre-flush) coordinates, so a newer request replaces the older one
    },
    /** Run the pending shift through every subscriber, once, in this tick. Call before render. */
    flush() {
      if (!pending) return null; const o = pending; pending = null;
      origin[0] += o[0]; origin[1] += o[1]; origin[2] += o[2]; shifts++;
      for (const fn of [...listeners]) fn(o);
      return o as Offset;
    },
    /** Absolute (pre-shift-independent) position of a sim point, for saves, networking and the globe. */
    toAbsolute(p: Offset): [number, number, number] { return [origin[0] + p[0], origin[1] + p[1], origin[2] + p[2]]; },
  };
}
export type OriginBus = ReturnType<typeof createOriginBus>;
/** The game's single sim-origin bus. */
export const ORIGIN = createOriginBus();
