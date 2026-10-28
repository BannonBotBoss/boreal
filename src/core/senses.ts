import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { live } from '../config/live';
import { PERCEPTION, readSoundEntry } from './perceptionBuffer';
/** Transient sensory math: no world records are created by hearing or smelling. */
export interface SensePoint { x: number; z: number }
export interface ScentSource extends SensePoint { key: string; kind: string; potency: number; remembered?: boolean; friend?: boolean;
  /** Smeller's cutoff (m). Omitted: the HUD range (SENSES.range). A trace passes the species range (T-0019). */ range?: number }
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
  const range = source.range ?? SENSES.range;
  if (distance >= range || source.potency <= 0) return 0;
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
  return Math.min(1, source.potency * Math.max(local, plume) * (1 - distance / range));
}
export function smell(nose: SensePoint, sources: readonly ScentSource[], wind: SensePoint, heading: number): ScentHit[] {
  return sources.map(s => ({ ...s, level: scentLevel(nose, s, wind), bearing: bearingTo(nose, s, heading), distance: Math.hypot(s.x - nose.x, s.z - nose.z) }))
    .filter(s => s.level >= SENSES.threshold).sort((a, b) => b.level - a.level || a.key.localeCompare(b.key))
    .slice(0, SENSES.thoughtCap);
}
export interface SoundCue extends SensePoint { id: string; level: number; age: number }

/** Eight compass words. Clockwise from forward, the same buckets the scent line uses. */
const COMPASS = ['ahead', 'front-right', 'right', 'behind-right', 'behind', 'behind-left', 'left', 'front-left'] as const;
export function compassWord(bearing: number) {
  return COMPASS[(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
}

/**
 * One heard snap as the 28-byte sound entry in issue #106.
 * The clip id is not stored, and neither is a distance: direction is a unit vector in the listener frame
 * (x right, z forward), so the caption cannot print a species or a range.
 * Urgency is a game-calibration word for the cue's existing 0–1 level, split in thirds: under 1/3 soft (0),
 * under 2/3 clear (1), otherwise loud (2). It is not a hearing distance. The species hearing row is unchanged.
 */
export function cueSoundEntry(cue: { level: number; age: number }, bearing: number): Uint8Array {
  const bytes = new Uint8Array(PERCEPTION.soundBytes);
  const view = new DataView(bytes.buffer);
  const level = Number.isFinite(cue.level) && cue.level > 0 ? cue.level : 0;
  const urgency = level < 1 / 3 ? 0 : level < 2 / 3 ? 1 : 2;
  view.setUint16(0, 0, true);
  view.setUint16(2, urgency, true);
  view.setFloat32(4, level, true);
  view.setFloat32(8, Math.sin(bearing), true);
  view.setFloat32(12, 0, true);
  view.setFloat32(16, Math.cos(bearing), true);
  view.setFloat32(20, Number.isFinite(cue.age) ? cue.age : 0, true);
  return bytes;
}

/** "something, ahead, loud". Direction and urgency come from the 28-byte entry. Category and age are not printed. */
export function soundCaption(entry: ArrayBuffer | ArrayBufferView): string {
  const sound = readSoundEntry(entry);
  const horizontal = Math.hypot(sound.directionX, sound.directionZ);
  const way = horizontal < 1e-4 ? 'that way' : compassWord(Math.atan2(sound.directionX, sound.directionZ));
  const urge = sound.urgency <= 0 ? 'soft' : sound.urgency === 1 ? 'clear' : 'loud';
  return `something, ${way}, ${urge}`;
}

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
