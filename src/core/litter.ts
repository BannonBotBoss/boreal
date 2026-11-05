/**
 * The same litter rules as rust/boreal-sim/src/litter.rs.
 * Five pups, the middle of the common gray-wolf range of 4–6 (Mech & Boitani 2003).
 * They are four weeks old, old enough to walk out of the den, and each step
 * moves them toward the trail behind their mother. The page uses this when
 * the wasm build is not loaded. The numbers are the Rust numbers.
 */
export const LITTER = {
  count: 5,
  emergeYears: 4 / 52,
  speedMps: 0.9,
  yearSpeedMps: 1.6,
  denRingM: 1.2,
  trailYoungM: 0.22,
  trailYearM: 0.12,
  trailGapM: 0.03,
  /** Beside her hips, at her depth, not stretched toward the lens. */
  lateralM: 0.58,
  /** The chase camera is behind her. Closer than this and a pup is under the lens. */
  viewBackM: 0.5,
  /** A step longer than a walk is the drop. She does not leave the litter at the old spot. */
  rejoinM: 4,
  /** Game seconds for one year of pup growth. Ten real minutes at the default clock (×12) is half a year. */
  growthGameSPerYear: 14400,
  youngStepHz: 2.6,
  yearStepHz: 1.3,
} as const;

export type GrowthStage = 'pup' | 'juvenile' | 'adult';

export interface PupPlace { slot: number; x: number; z: number; ageYears: number }

export function growthStage(ageYears: number): GrowthStage {
  if (ageYears < 0.5) return 'pup';
  if (ageYears < 1) return 'juvenile';
  return 'adult';
}

const growthU = (ageYears: number) => Math.min(1, Math.max(0, ageYears));

/** Age after game seconds of the world clock. Rewind does not make them younger. */
export function ageAfter(ageYears: number, gameSeconds: number) {
  if (!(gameSeconds > 0)) return ageYears;
  return ageYears + gameSeconds / LITTER.growthGameSPerYear;
}

/** How big a pup draws next to an adult. Four weeks is a bit under a third. One year is full size. */
export function pupScale(ageYears: number) {
  return 0.3 + 0.7 * growthU(ageYears);
}

/** Metres behind the mother, before the slot gap. Older pups walk closer. */
export function trailBackM(ageYears: number) {
  const u = growthU(ageYears);
  return LITTER.trailYoungM * (1 - u) + LITTER.trailYearM * u;
}

/** Walking speed. Four weeks is the young speed. A yearling is quicker. */
export function walkMps(ageYears: number) {
  const u = growthU(ageYears);
  return LITTER.speedMps * (1 - u) + LITTER.yearSpeedMps * u;
}

/** Stride cycles per second. A young pup takes short quick steps. */
export function stepHz(ageYears: number) {
  const u = growthU(ageYears);
  return LITTER.youngStepHz * (1 - u) + LITTER.yearStepHz * u;
}

/** Five pups on a ring around the den. Slot 0 is east of the den. */
export function birthPlaces(denX: number, denZ: number): PupPlace[] {
  const out: PupPlace[] = [];
  for (let slot = 0; slot < LITTER.count; slot++) {
    const a = slot / LITTER.count * Math.PI * 2;
    out.push({
      slot,
      x: denX + Math.cos(a) * LITTER.denRingM,
      z: denZ + Math.sin(a) * LITTER.denRingM,
      ageYears: LITTER.emergeYears,
    });
  }
  return out;
}

/** Where the five stand when she is already on her feet: beside her, in front of the chase camera. */
export function besideMother(x: number, z: number, yaw: number, ageYears = LITTER.emergeYears): PupPlace[] {
  const out: PupPlace[] = [];
  for (let slot = 0; slot < LITTER.count; slot++) {
    const at = trailSlot(slot, x, z, yaw, ageYears);
    out.push({ slot, x: at.x, z: at.z, ageYears });
  }
  return out;
}

/** The point in the trail behind the mother. Forward is (−sin yaw, −cos yaw). */
export function trailSlot(slot: number, motherX: number, motherZ: number, yaw: number, ageYears = LITTER.emergeYears) {
  const back = Math.min(LITTER.viewBackM, trailBackM(ageYears) + slot * LITTER.trailGapM);
  const side = (slot - (LITTER.count - 1) / 2) * LITTER.lateralM;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return { x: motherX - fx * back + rx * side, z: motherZ - fz * back + rz * side };
}

/** One follow step. The pup walks toward its trail slot and does not overshoot it. */
export function followStep(x: number, z: number, slot: number, motherX: number, motherZ: number, yaw: number, dt: number, ageYears = LITTER.emergeYears) {
  const slotAt = trailSlot(slot, motherX, motherZ, yaw, ageYears);
  const dx = slotAt.x - x, dz = slotAt.z - z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6 || dt <= 0) return { x, z };
  if (d > LITTER.rejoinM) return { x: slotAt.x, z: slotAt.z };
  const step = Math.min(walkMps(ageYears) * dt, d);
  return { x: x + dx / d * step, z: z + dz / d * step };
}

export type PupCall = 'yip' | 'whimper' | 'huff' | 'call';

/** When a pup makes a sound. The same numbers are in rust/boreal-sim/src/litter.rs. */
export const PUP_VOICE = {
  /** Past the trail, not yet the rejoin. A short separation. */
  briefM: 2.2,
  /** The rejoin gap. She has left this pup behind. */
  farM: LITTER.rejoinM,
  /** A closed paw reaches a pup this close to her. */
  nudgeM: 1.5,
  yipS: 5.5,
  whimperS: 7,
  callS: 9,
  huffS: 1.2,
} as const;

/**
 * The sound for one pup this step, or none.
 * A nudge of her paw is a huff. Far behind is a call. Hungry, tired, or a short
 * gap is a whimper. Following or playing (under half a year and still near her) is a yip.
 */
export function pupCall(o: { distM: number; moving: boolean; ageYears: number; hungry: boolean; tired: boolean; nudged: boolean }): PupCall | null {
  if (o.nudged) return 'huff';
  if (o.distM >= PUP_VOICE.farM) return 'call';
  if (o.hungry || o.tired || o.distM >= PUP_VOICE.briefM) return 'whimper';
  if (o.moving || o.ageYears < 0.5) return 'yip';
  return null;
}

export function pupGap(kind: PupCall) {
  if (kind === 'yip') return PUP_VOICE.yipS;
  if (kind === 'whimper') return PUP_VOICE.whimperS;
  if (kind === 'huff') return PUP_VOICE.huffS;
  return PUP_VOICE.callS;
}

/** Playback rate before a small random wobble. Four weeks is higher. A year is 1. */
export function pupPitch(ageYears: number) {
  const u = Math.min(1, Math.max(0, ageYears));
  return 1.22 + (1 - 1.22) * u;
}
