import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { live } from '../config/live';
/** Transient sensory math: no world records are created by hearing or smelling. */
export interface SensePoint { x: number; z: number }
export interface ScentSource extends SensePoint { key: string; kind: string; potency: number; remembered?: boolean; friend?: boolean }
export interface ScentHit extends ScentSource { level: number; bearing: number; distance: number }
// Detection ranges, plume width and HUD lifetimes are game calibration, not wolf measurements.
export const SENSES = live(SYSTEM_PROPERTIES.senses);
/** Clockwise angle from forward; world forward is -Z, positive heading turns toward -X. */
export function bearingTo(origin: SensePoint, target: SensePoint, heading: number) {
  const dx = target.x - origin.x, dz = target.z - origin.z;
  return Math.atan2(Math.cos(heading) * dx - Math.sin(heading) * dz,
    -Math.sin(heading) * dx - Math.cos(heading) * dz);
}
/**
 * Ground-level Gaussian plume cross-section (EPA ISC model, Section 6, eq. 6-1):
 * https://archive.epa.gov/epawaste/hazard/web/pdf/1_06_air.pdf
 * Normalized gameplay approximation: local diffusion plus a downwind plume.
 * No claim of chemical concentrations or measured wolf detection thresholds.
 */
export function scentLevel(nose: SensePoint, source: ScentSource, wind: SensePoint) {
  const dx = nose.x - source.x, dz = nose.z - source.z, distance = Math.hypot(dx, dz);
  if (distance >= SENSES.range || source.potency <= 0) return 0;
  const speed = Math.hypot(wind.x, wind.z);
  const local = Math.exp(-distance * distance / (2 * 4 * 4));
  let plume = 0;
  if (speed > .05) {
    const down = (dx * wind.x + dz * wind.z) / speed;
    const cross = (dx * wind.z - dz * wind.x) / speed;
    if (down > 0) {
      const width = 2 + down * .22;
      plume = Math.exp(-.5 * (cross / width) ** 2) / (1 + down / 14) * Math.min(1, speed);
    }
  }
  return Math.min(1, source.potency * Math.max(local, plume) * (1 - distance / SENSES.range));
}
export function smell(nose: SensePoint, sources: readonly ScentSource[], wind: SensePoint, heading: number): ScentHit[] {
  return sources.map(s => ({ ...s, level: scentLevel(nose, s, wind), bearing: bearingTo(nose, s, heading), distance: Math.hypot(s.x - nose.x, s.z - nose.z) }))
    .filter(s => s.level >= SENSES.threshold).sort((a, b) => b.level - a.level || a.key.localeCompare(b.key))
    .slice(0, SENSES.thoughtCap);
}
export interface SoundCue extends SensePoint { id: string; level: number; age: number }
export function createSoundCues() {
  let cues: SoundCue[] = [];
  return {
    add(id: string, at: SensePoint, level = 1) {
      if (!Number.isFinite(at.x + at.z + level) || level <= 0) return;
      const same = cues.find(c => c.id === id && Math.hypot(c.x - at.x, c.z - at.z) < 3);
      if (same) Object.assign(same, at, { age: 0, level });
      else cues.push({ id, ...at, level, age: 0 });
      cues = cues.slice(-SENSES.cueCap);
    },
    step(dt: number) { for (const c of cues) c.age += Math.max(0, dt); cues = cues.filter(c => c.age < SENSES.cueLife); },
    clear() { cues = []; },
    list: () => cues as readonly SoundCue[],
  };
}
