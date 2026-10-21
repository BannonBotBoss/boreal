/** Senses halo (render/sensesHalo): pure mapping from the senses HUD's live cues to beacons on a ring around the head. */
import { bearingTo, SENSES, type SensePoint, type SoundCue, type ScentHit } from './senses';

export type BeaconKind = 'sound' | 'scent';
export interface Beacon { kind: BeaconKind; x: number; z: number; strength: number; fresh: number; id: string }
export const HALO = { radius: .62, maxBeacons: SENSES.cueCap + SENSES.thoughtCap, fadeFrom: .9, fadeTo: 4, speedEase: .35 };
/** Halo visibility from ground speed (m/s): 1 standing / stealth (0.8), about 0.7 at the 2 m/s walk, 0 at run (6) and sprint (core/wolfModes). */
export function haloFade(speed: number) {
  const t = Math.min(1, Math.max(0, (speed - HALO.fadeFrom) / (HALO.fadeTo - HALO.fadeFrom))); return 1 - t * t * (3 - 2 * t);
}
/** Eased ground speed from drawn head positions: exponential smoothing (no flicker on gait steps); jumps over 2 m (teleports) are ignored. */
export function easeSpeed(prev: number, moved: number, dt: number) {
  if (dt <= 0 || moved > 2) return prev; return prev + (moved / dt - prev) * (1 - Math.exp(-dt / HALO.speedEase));
}

/** Ring-local offset for a bearing (clockwise from the wolf's forward, core/senses bearingTo): forward is -Z, right is +X. */
export function ringOffset(bearing: number, radius: number, out: { x: number; z: number }) {
  out.x = Math.sin(bearing) * radius; out.z = -Math.cos(bearing) * radius; return out;
}
/** Sounds fade over their cue life; scents keep the plume level. Returns how many beacons were written into `out` (reused, no allocation). */
export function cueBeacons(sounds: readonly SoundCue[], scents: readonly ScentHit[], origin: SensePoint, out: Beacon[]) {
  let n = 0;
  const put = (kind: BeaconKind, id: string, x: number, z: number, strength: number, fresh: number) => {
    if (n >= HALO.maxBeacons || strength <= 0) return;
    const b = out[n] ??= { kind, x, z, strength, fresh, id }; b.kind = kind; b.id = id; b.x = x; b.z = z; b.strength = Math.min(1, strength); b.fresh = fresh; n++;
  };
  for (const c of sounds) if (Math.hypot(c.x - origin.x, c.z - origin.z) <= SENSES.range)
    put('sound', c.id, c.x, c.z, c.level * (1 - c.age / SENSES.cueLife), Math.max(0, 1 - c.age / .6));
  for (const s of scents) put('scent', s.key, s.x, s.z, s.level, 0);
  return n;
}
/** Bearing of a beacon from the head, relative to the wolf's heading (not the camera's). */
export const beaconBearing = (b: Beacon, head: SensePoint, heading: number) => bearingTo(head, b, heading);
