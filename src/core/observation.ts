/**
 * Observation record (T-0081, step 1 of notes/design-roadmap.md). ONE place that answers: where is the viewer, how high
 * above the ground, how fast does time move, and which creature (if any) are we inside. It copies four live sources and
 * owns none of them:
 *   position  = the render camera (registered by buildScene) — x/z fall back to the interest centre (src/core/interest.ts)
 *   altitude  = camera y minus heightAt(x, z) (src/core/world.ts), the same ground every system uses
 *   rate      = the one clock's rate (0 while paused, else 1, on main until the single-clock branch, PR #92, lands and registers clockRate)
 *   embodied  = the current playable's id (src/render/playables.ts), null in photo mode (free camera, no body)
 * No second interest radius, no second clock, no stored copy: every call reads the sources again.
 */
import { INTEREST } from './interest';
import { heightAt } from './world';
import { isPaused } from './worldClock';

export interface Observation { x: number; y: number; z: number; altitude: number; rate: number; embodied: string | null }
export interface ObservationSources {
  camera: (() => { x: number; y: number; z: number }) | null;
  embodied: () => string | null;
  rate: () => number;
  ground: (x: number, z: number) => number;
}
/** Live sources. buildScene registers camera and embodied; the clock registers rate. Tests may swap any of them. */
export const OBSERVATION_SOURCES: ObservationSources = { camera: null, embodied: () => null, rate: () => isPaused() ? 0 : 1, ground: heightAt };
export function registerObservationSources(s: Partial<ObservationSources>) { Object.assign(OBSERVATION_SOURCES, s); }

export function observationRecord(src: ObservationSources = OBSERVATION_SOURCES): Observation {
  const c = src.camera?.(), x = c?.x ?? INTEREST.x, z = c?.z ?? INTEREST.z, ground = src.ground(x, z), y = c?.y ?? ground;
  return { x, y, z, altitude: y - ground, rate: src.rate(), embodied: src.embodied() };
}
