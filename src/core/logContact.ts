/**
 * T-0006: the ONE log-on-earth contact, built at chunk build (render/buildScene). Pure TypeScript, no three.js.
 * It only READS the seat: it never seats, sinks or tilts a log (T-0005, grok-globe, owns that).
 *
 * T-0005 contract (grok-globe/log-grounding-bark, seating 95211cc): render/geometry.ts exports
 *   logSeat(e: Entity): { at: Vec3; normal: Vec3; settle: { trunkDensity; earthDensity; depth /* depth / diameter *\/; soil; onRock } ... }
 * memoised per entity. buildScene detects that export at runtime and passes it here, so this branch compiles and runs
 * with or without T-0005 merged (either merge order). Without it: the centre height and a normal from two forward
 * heightAt differences, with this branch's seating defaults.
 */
import { heightAt, type Entity } from './world';
import { SEAT_DEFAULTS, type Contact, type Vec3 } from './contactBus';
import { COMPOSITIONS, density } from './materials';

/** The part of T-0005's LogSeat that T-0006 reads (structural, so no import of their module is needed). */
export interface LogSeatContract { at: Vec3 | readonly number[]; normal: Vec3 | readonly number[]; settle?: { trunkDensity?: number; earthDensity?: number; depth?: number } }
export type LogSeatFn = (e: Entity) => LogSeatContract;
export const LOG_SEAT_DEFAULTS = { trunkDensity: density(COMPOSITIONS.log.body), earthDensity: SEAT_DEFAULTS.earthDensity, sinkFraction: SEAT_DEFAULTS.sinkFraction };
const vec = (v: readonly number[] | undefined): Vec3 | undefined => v && v.length === 3 && v.every(Number.isFinite) ? [v[0], v[1], v[2]] : undefined;
const pos = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined;

/** Contact for log `e` (centre ground height `y`). With `seatOf` (T-0005's logSeat): its seated point, ground normal,
 *  densities and settled depth (as sinkFraction), source 'chunk-build:log-seat'. Without it, or if it throws or returns
 *  something malformed: the temporary centre sample, source 'chunk-build:log'. Both are render-lifetime edges. */
export function logContact(e: Entity, y: number, seatOf?: LogSeatFn): Contact {
  let seat: LogSeatContract | undefined; try { seat = seatOf?.(e); } catch { seat = undefined; }
  const at = vec(seat?.at), normal = vec(seat?.normal);
  if (seat && at && normal) {
    const s = seat.settle, depth = s?.depth;
    return { a: e.key, b: 'ground', at, normal, kind: 'solid-solid', source: 'chunk-build:log-seat',
      trunkDensity: pos(s?.trunkDensity) ?? LOG_SEAT_DEFAULTS.trunkDensity, earthDensity: pos(s?.earthDensity) ?? LOG_SEAT_DEFAULTS.earthDensity,
      sinkFraction: depth !== undefined && Number.isFinite(depth) && depth >= 0 && depth <= 1 ? depth : LOG_SEAT_DEFAULTS.sinkFraction };
  }
  const d = .5, nx = y - heightAt(e.x + d, e.z), nz = y - heightAt(e.x, e.z + d), l = Math.hypot(nx, d, nz);
  return { a: e.key, b: 'ground', at: [e.x, y, e.z], normal: [nx / l, d / l, nz / l], kind: 'solid-solid', source: 'chunk-build:log', ...LOG_SEAT_DEFAULTS };
}
