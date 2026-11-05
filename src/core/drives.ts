/**
 * The same drive numbers as rust/boreal-sim/src/drives.rs.
 * Hunger, diet, prey effort, the three senses, danger and protect.
 * The page steps this every tick and copies the result into the Rust engines
 * so the data panel can show the same values.
 */

export const SMELL_M = 40;
export const SIGHT_M = 16;
export const HEARING_M = 20;
export const YIP_HEARING = 1.5;
export const DANGER_M = 8;
export const DANGER_PROTECT_M = 18;
export const PROTECT_M = 12;
export const STRAY_M = 6;
export const PROTECT_RISE = 0.22;
export const PROTECT_FALL = 0.25;
export const PROTECT_COMMIT = 0.5;
/** Where he waits. Outside the 8 m danger disc, and well clear of the pups. */
export const LINGER_RING = 11;
/** How far in front of her the fox starts. Same ring. */
export const FOX_START_M = LINGER_RING;
/** She charges this far toward him, then stops. A few strides, not a pursuit. */
export const CHARGE_M = 4.5;
/** He leaves. Fast enough to cross the view. */
export const FLEE_MPS = 9;

export type FoxMode = 'none' | 'approach' | 'linger' | 'watch' | 'flee';

export interface DriveNow {
  hunger: number;
  effortPup: number;
  effortMama: number;
  scent: number;
  danger: number;
  protect: number;
  threat: number;
  approach: number;
  mode: FoxMode;
  committed: boolean;
  /** She is charging or walking back. The walk step must not move her as well. */
  hold: boolean;
  returning: boolean;
  foxX: number;
  foxZ: number;
  foxYaw: number;
  mamaX: number;
  mamaZ: number;
  mamaYaw: number;
  pupX: number;
  pupZ: number;
  yip: boolean;
}

/** Equations shown in the data panel. The latex matches the Rust engines. */
export const DRIVE_EQUATIONS = [
  { id: 'hunger', title: 'Hunger', latex: String.raw`H_{t+\Delta t}=\mathrm{clamp}(H_t+r_{\mathrm{species}}\Delta t,\,0,\,1)` },
  { id: 'effort', title: 'Prey effort', latex: String.raw`E=\begin{cases}(m_p/m)^{2}&m_p\le m\\ \exp\!\big(4(m_p/m-1)\big)&m_p>m\end{cases}` },
  { id: 'scent', title: 'Scent', latex: String.raw`S=\exp(-d/R_{\mathrm{smell}})` },
  { id: 'danger', title: 'Danger against hunger', latex: String.raw`D=\exp(-d_{mama}/R),\quad A=H/(E+0.05)\,S` },
  { id: 'protect', title: 'Protect offspring', latex: String.raw`P_{t+\Delta t}=\mathrm{clamp}(P_t+r\Delta t,\,0,\,1),\ r=+0.22\ \mathrm{near},\ -0.25\ \mathrm{clear}` },
] as const;

export function hungerRate(species: string) {
  if (species === 'Red Fox') return 0.012;
  if (species === 'Gray Wolf') return 0.006;
  if (species === 'Snowshoe Hare') return 0.02;
  return 0.008;
}

export function diet(species: string) {
  if (species === 'Red Fox' || species === 'Gray Wolf' || species === 'Canada Lynx' || species === 'Coyote') return 'carnivore';
  if (species === 'Snowshoe Hare' || species === 'White-tailed Deer' || species === 'Moose') return 'herbivore';
  return 'omnivore';
}

export function bodyKg(species: string) {
  if (species === 'Red Fox') return 5;
  if (species === 'Gray Wolf') return 40;
  if (species === 'pup') return 2.5;
  return 10;
}

export function effort(predKg: number, preyKg: number) {
  const r = preyKg / Math.max(0.1, predKg);
  return r <= 1 ? r * r : Math.exp(4 * (r - 1));
}

export function hungerStep(hunger: number, species: string, dt: number) {
  return Math.min(1, Math.max(0, hunger + hungerRate(species) * Math.max(0, dt)));
}

export function protectStep(protect: number, near: boolean, dt: number) {
  const rate = near ? PROTECT_RISE : -PROTECT_FALL;
  return Math.min(1, Math.max(0, protect + rate * Math.max(0, dt)));
}

export function scentOf(distM: number) {
  return Math.exp(-Math.max(0, distM) / SMELL_M);
}

export function inFocus(distM: number, yipping: boolean) {
  const hear = yipping ? HEARING_M * YIP_HEARING : HEARING_M;
  return distM <= SIGHT_M || distM <= hear;
}

export function dangerOf(distMamaM: number, protecting: boolean) {
  const radius = protecting ? DANGER_PROTECT_M : DANGER_M;
  if (distMamaM > radius * 2.5) return 0;
  return Math.exp(-distMamaM / radius);
}

export function approachOf(hunger: number, preyEffort: number, scent: number) {
  return Math.max(0, hunger) / (preyEffort + 0.05) * Math.max(0, scent);
}

/** Place the fox on the ray that already points away from her, at an exact distance. */
function pushOut(foxX: number, foxZ: number, mamaX: number, mamaZ: number, dist: number) {
  let dx = foxX - mamaX, dz = foxZ - mamaZ;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
  return { x: mamaX + dx * dist, z: mamaZ + dz * dist };
}

const toward = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
const away = (x: number, z: number, tx: number, tz: number) => toward(x, z, tx, tz) + Math.PI;
const forward = (x: number, z: number, yaw: number, dist: number) => ({ x: x + Math.sin(yaw) * dist, z: z + Math.cos(yaw) * dist });

/** Test hook. Puts the fox back, or at a chosen place. */
export function resetDrives(at?: { x: number; z: number; hunger?: number; protect?: number }) {
  hunger = at?.hunger ?? 0.75;
  protect = at?.protect ?? 0;
  foxYaw = 0;
  last = null;
  pace = 0;
  phase = 'watch';
  homeX = Number.NaN;
  homeZ = Number.NaN;
  homeYaw = 0;
  if (at) { foxX = at.x; foxZ = at.z; seeded = true; }
  else { foxX = Number.NaN; foxZ = Number.NaN; seeded = false; }
}

let hunger = 0.75;
let protect = 0;
let foxX = Number.NaN;
let foxZ = Number.NaN;
let foxYaw = 0;
let seeded = false;
let last: DriveNow | null = null;
let pace = 0;
let phase: 'watch' | 'charge' | 'return' = 'watch';
let homeX = Number.NaN;
let homeZ = Number.NaN;
let homeYaw = 0;

export function driveSnapshot() { return last; }

export function foxSeeded() { return seeded; }

/** Where the fox mesh stands. Yaw is the game heading (forward is −sin, −cos). */
export function foxPlace() {
  if (!seeded || !last) return null;
  const moving = last.mode !== 'none';
  const motion = last.mode === 'flee' || last.mode === 'approach' ? 'run' : last.mode === 'none' ? 'idle' : 'walk';
  const speed = last.mode === 'flee' ? FLEE_MPS : last.mode === 'linger' ? 0.8 : last.mode === 'approach' ? 1.6 : 0.6;
  return { x: last.foxX, z: last.foxZ, yaw: last.foxYaw + Math.PI, moving, motion, speed };
}

/**
 * One step. Pass the mother's position and the nearest pup.
 * `gameYaw` is only used to place the fox the first time, in front of her.
 */
export function stepDrives(mamaX: number, mamaZ: number, gameYaw: number, pupX: number, pupZ: number, yipping: boolean, dt: number): DriveNow {
  const facing = gameYaw + Math.PI;
  if (!seeded) {
    foxX = mamaX + Math.sin(facing) * LINGER_RING;
    foxZ = mamaZ + Math.cos(facing) * LINGER_RING;
    foxYaw = facing + Math.PI;
    seeded = true;
  }
  const step = Math.max(0, dt);
  pace += step;
  const nextHunger = hungerStep(hunger, 'Red Fox', step);
  const pupD = Math.hypot(pupX - foxX, pupZ - foxZ);
  const mamaD = Math.hypot(mamaX - foxX, mamaZ - foxZ);
  const pupFromMama = Math.hypot(pupX - mamaX, pupZ - mamaZ);
  const scent = scentOf(pupD);
  const focused = inFocus(pupD, yipping);
  const effortPup = effort(bodyKg('Red Fox'), bodyKg('pup'));
  const effortMama = effort(bodyKg('Red Fox'), bodyKg('Gray Wolf'));
  const stray = pupFromMama > STRAY_M;
  const near = mamaD < LINGER_RING + 2 || pupD < PROTECT_M;
  const nextProtect = protectStep(protect, near && phase !== 'return', step);
  const guarding = nextProtect >= PROTECT_COMMIT && phase !== 'return';
  if (guarding && phase === 'watch') {
    phase = 'charge';
    homeX = mamaX;
    homeZ = mamaZ;
    homeYaw = gameYaw;
  }
  if (phase === 'charge' && mamaD > 18) phase = 'return';
  const steered = phase !== 'watch';
  const danger = dangerOf(mamaD, phase === 'charge');
  const useEffort = stray ? effortPup : Math.max(effortPup, 0.35);
  const approach = approachOf(nextHunger, useEffort, focused ? Math.max(scent, 0.35) : scent);
  let mode: FoxMode = 'watch';
  let yaw = foxYaw;
  let fox = { x: foxX, z: foxZ };
  let mama = { x: mamaX, z: mamaZ, yaw: facing };
  if (phase === 'charge') {
    mode = 'flee';
    yaw = away(foxX, foxZ, mamaX, mamaZ);
    fox = pushOut(foxX, foxZ, mamaX, mamaZ, mamaD + FLEE_MPS * step);
    const face = toward(mamaX, mamaZ, foxX, foxZ);
    const fromHome = Math.hypot(mamaX - homeX, mamaZ - homeZ);
    const room = Math.max(0, CHARGE_M - fromHome);
    const stepped = forward(mamaX, mamaZ, face, Math.min(3.4 * step, room));
    mama = { x: stepped.x, z: stepped.z, yaw: face };
  } else if (phase === 'return') {
    mode = 'watch';
    fox = pushOut(foxX, foxZ, mamaX, mamaZ, Math.min(26, mamaD + FLEE_MPS * step));
    yaw = away(fox.x, fox.z, mamaX, mamaZ);
    const face = toward(mamaX, mamaZ, homeX, homeZ);
    const dHome = Math.hypot(homeX - mamaX, homeZ - mamaZ);
    if (dHome < 0.4) {
      phase = 'watch';
      mama = { x: homeX, z: homeZ, yaw: homeYaw + Math.PI };
      homeX = Number.NaN;
    } else {
      const stepped = forward(mamaX, mamaZ, face, Math.min(2.6 * step, dHome));
      mama = { x: stepped.x, z: stepped.z, yaw: face };
    }
  } else if (stray && approach > danger && mamaD > LINGER_RING) {
    mode = 'approach';
    yaw = toward(foxX, foxZ, pupX, pupZ);
    fox = forward(foxX, foxZ, yaw, (1.1 + nextHunger) * step);
  } else if (mamaD < LINGER_RING - 0.4) {
    mode = 'linger';
    fox = pushOut(foxX, foxZ, mamaX, mamaZ, LINGER_RING);
    yaw = toward(fox.x, fox.z, mamaX, mamaZ);
  } else if (mamaD > LINGER_RING + 1.2) {
    mode = 'watch';
    fox = pushOut(foxX, foxZ, mamaX, mamaZ, Math.max(LINGER_RING, mamaD - 4 * step));
    yaw = toward(fox.x, fox.z, mamaX, mamaZ);
  } else {
    mode = 'linger';
    const ang = facing + Math.sin(pace * 0.65) * 0.75;
    fox = { x: mamaX + Math.sin(ang) * LINGER_RING, z: mamaZ + Math.cos(ang) * LINGER_RING };
    yaw = ang + Math.PI;
  }
  hunger = nextHunger;
  protect = nextProtect;
  foxX = fox.x;
  foxZ = fox.z;
  foxYaw = yaw;
  last = {
    hunger, effortPup, effortMama, scent, danger, protect, threat: near ? 1 : 0, approach, mode,
    committed: phase === 'charge', hold: steered || phase !== 'watch', returning: phase === 'return',
    foxX, foxZ, foxYaw, mamaX: mama.x, mamaZ: mama.z, mamaYaw: mama.yaw,
    pupX, pupZ, yip: yipping,
  };
  (globalThis as { __borealDrive?: DriveNow }).__borealDrive = last;
  return last;
}

/** Twelve numbers, the order of `engine_set_drives`. `drive_dt` is 0 so the report does not step again. */
export function driveParams(): number[] | null {
  if (!last) return null;
  return [
    last.hunger, last.foxX, last.foxZ, last.foxYaw,
    last.mamaX, last.mamaZ, last.mamaYaw,
    last.pupX, last.pupZ, last.yip ? 1 : 0, last.protect, 0,
  ];
}
