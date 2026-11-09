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
  /** How far a pup may sit to one side and still be in the chase view. */
  lateralM: 1.15,
  /** The chase camera is 4.4 m behind her. Further back than this is under the lens. */
  viewBackM: 1.55,
  /** A step longer than a walk is the drop. She does not leave the litter at the old spot. */
  rejoinM: 4,
  /** Game seconds for one year of pup growth. Ten real minutes at the default clock (×12) is half a year. */
  growthGameSPerYear: 14400,
  youngStepHz: 2.6,
  yearStepHz: 1.3,
} as const;

export type GrowthStage = 'pup' | 'juvenile' | 'adult';

export interface PupPlace { slot: number; x: number; z: number; ageYears: number; yaw: number; act: PupAct }

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
      yaw: a + Math.PI,
      act: 'trot',
    });
  }
  return out;
}

export type PupAct = 'trot' | 'sniff' | 'sit' | 'pounce' | 'tumble' | 'straggle';

/** Uneven homes around her hips. Not a row, and not inside her hocks. The last pup starts further back.
 *  Spread uses the chase-view limits already in LITTER (viewBackM 1.55, lateralM 1.15), so the five
 *  do not share one patch of ground under the camera. The same pairs are in rust litter.rs. */
const PUP_HOME: ReadonlyArray<readonly [number, number]> = [
  [0.62, -1.05],
  [0.4, 0.55],
  [0.88, -0.15],
  [1.2, 0.85],
  [1.45, -0.55],
];
const PUP_PHASE = [0.4, 2.2, 3.8, 5.1, 1.1];

/** What this pup is doing. Each slot has its own phase, so they do not switch together. */
export function pupAct(slot: number, time: number): PupAct {
  const acts: PupAct[] = ['trot', 'sniff', 'sit', 'pounce', 'tumble'];
  const period = 5.2 + (slot % 3) * 1.1;
  const phase = PUP_PHASE[slot] ?? 0;
  const u = ((Math.max(0, time) + phase) % period) / period;
  if (slot === LITTER.count - 1 && u < 0.4) return 'straggle';
  return acts[Math.min(acts.length - 1, Math.floor(u * acts.length))] ?? 'trot';
}

export interface PupAim { x: number; z: number; yaw: number; act: PupAct }

/**
 * Where one pup is trying to be, and which way it faces.
 * The home is uneven. A slow wander, its own to each pup, keeps the clump from lining up.
 * When she is still the cloud pulls in. The straggler hangs back. Forward is (−sin yaw, −cos yaw).
 */
export function pupAim(slot: number, motherX: number, motherZ: number, yaw: number, time = 0, moving = true, ageYears = LITTER.emergeYears, threatened = false): PupAim {
  const act = pupAct(slot, time);
  const home = PUP_HOME[slot] ?? PUP_HOME[0];
  const phase = PUP_PHASE[slot] ?? 0;
  const cluster = (moving ? 1 : 0.55) * (threatened ? 0.78 : 1);
  const wander = (moving ? 0.08 : 0.04) * (1 - 0.25 * growthU(ageYears));
  const agePull = 1 - 0.35 * growthU(ageYears);
  let back = home[0] * cluster * agePull + Math.sin(time * 0.65 + phase) * wander;
  let side = home[1] * cluster * agePull + Math.cos(time * 0.5 + phase * 1.3) * wander * 0.85;
  if (act === 'straggle') back += 0.45;
  if (act === 'sniff') side += 0.18 * Math.sin(time * 1.7 + phase);
  if (act === 'sit') { back *= 0.9; side *= 0.92; }
  if (act === 'pounce') {
    back += Math.sin(time * 3.1 + phase) * 0.08;
    side += 0.1 * Math.cos(phase);
  }
  if (act === 'tumble') {
    back += Math.sin(time * 2.2 + phase) * 0.12;
    side += Math.cos(time * 2.2 + phase) * 0.12;
  }
  back = Math.min(LITTER.viewBackM, Math.max(0.08, back));
  side = Math.max(-LITTER.lateralM, Math.min(LITTER.lateralM, side));
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = motherX - fx * back + rx * side;
  const z = motherZ - fz * back + rz * side;
  const bias = [0.45, -0.7, 1.05, -0.35, 0.2][slot] ?? 0;
  let face = yaw + bias * 0.35;
  if (act === 'sniff' || act === 'sit') face = yaw + bias + (act === 'sniff' ? 0.8 * Math.sin(time * 0.8 + phase) : 0);
  else if (act === 'tumble') face = yaw + time * 1.7 + phase;
  else if (act === 'pounce') face = yaw + bias * 1.6;
  return { x, z, yaw: face, act };
}

/** Where the five are when she is already on her feet. */
export function besideMother(x: number, z: number, yaw: number, ageYears = LITTER.emergeYears): PupPlace[] {
  const out: PupPlace[] = [];
  for (let slot = 0; slot < LITTER.count; slot++) {
    const at = pupAim(slot, x, z, yaw, 0, true, ageYears);
    out.push({ slot, x: at.x, z: at.z, ageYears, yaw: at.yaw, act: at.act });
  }
  return out;
}

/** The pup's aim at time 0 while she is moving. Forward is (−sin yaw, −cos yaw). */
export function trailSlot(slot: number, motherX: number, motherZ: number, yaw: number, ageYears = LITTER.emergeYears, time = 0, moving = true, threatened = false) {
  const at = pupAim(slot, motherX, motherZ, yaw, time, moving, ageYears, threatened);
  return { x: at.x, z: at.z };
}

/** How fast this activity moves. Sitting and sniffing linger. A pounce is quicker. */
export function actMps(act: PupAct, ageYears: number) {
  const walk = walkMps(ageYears);
  if (act === 'sit' || act === 'sniff') return walk * 0.15;
  if (act === 'tumble') return walk * 0.45;
  if (act === 'pounce') return walk * 1.25;
  if (act === 'straggle') return walk * 0.55;
  return walk;
}

/** One follow step. The pup walks toward its aim and does not overshoot it.
 *  While she is walking, a pup that is off its home steps onto that home, so the
 *  loose clump stays beside her in the chase view instead of dragging under the camera. */
export function followStep(x: number, z: number, slot: number, motherX: number, motherZ: number, yaw: number, dt: number, ageYears = LITTER.emergeYears, time = 0, moving = true, threatened = false) {
  const act = pupAct(slot, time);
  const slotAt = trailSlot(slot, motherX, motherZ, yaw, ageYears, time, moving, threatened);
  const dx = slotAt.x - x, dz = slotAt.z - z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6 || dt <= 0) return { x, z };
  if (d > LITTER.rejoinM || (moving && d > 0.2)) return { x: slotAt.x, z: slotAt.z };
  const step = Math.min(actMps(act, ageYears) * dt, d);
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
