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
/** How far in front of her the fox starts, just outside the danger ring. */
export const FOX_START_M = 9.2;

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

const toward = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
const away = (x: number, z: number, tx: number, tz: number) => toward(x, z, tx, tz) + Math.PI;
const tangent = (x: number, z: number, tx: number, tz: number) => toward(x, z, tx, tz) + Math.PI / 2;
const forward = (x: number, z: number, yaw: number, dist: number) => ({ x: x + Math.sin(yaw) * dist, z: z + Math.cos(yaw) * dist });

/** Test hook. Puts the fox back, or at a chosen place. */
export function resetDrives(at?: { x: number; z: number; hunger?: number; protect?: number }) {
  hunger = at?.hunger ?? 0.75;
  protect = at?.protect ?? 0;
  foxYaw = 0;
  last = null;
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

export function driveSnapshot() { return last; }

export function foxSeeded() { return seeded; }

/** Where the fox mesh stands. Yaw is the game heading (forward is −sin, −cos). */
export function foxPlace() {
  if (!seeded || !last) return null;
  const moving = last.mode !== 'none';
  const motion = last.mode === 'flee' || last.mode === 'approach' ? 'run' : last.mode === 'none' ? 'idle' : 'walk';
  const speed = last.mode === 'flee' ? 3.4 : last.mode === 'linger' ? 0.7 : last.mode === 'approach' ? 1.6 : 0.55;
  return { x: last.foxX, z: last.foxZ, yaw: last.foxYaw + Math.PI, moving, motion, speed };
}

/**
 * One step. Pass the mother's position and the nearest pup.
 * `gameYaw` is only used to place the fox the first time, in front of her.
 */
export function stepDrives(mamaX: number, mamaZ: number, gameYaw: number, pupX: number, pupZ: number, yipping: boolean, dt: number): DriveNow {
  if (!seeded) {
    const fx = -Math.sin(gameYaw), fz = -Math.cos(gameYaw);
    foxX = mamaX + fx * FOX_START_M;
    foxZ = mamaZ + fz * FOX_START_M;
    foxYaw = 0;
    seeded = true;
  }
  const nextHunger = hungerStep(hunger, 'Red Fox', dt);
  const pupD = Math.hypot(pupX - foxX, pupZ - foxZ);
  const mamaD = Math.hypot(mamaX - foxX, mamaZ - foxZ);
  const pupFromMama = Math.hypot(pupX - mamaX, pupZ - mamaZ);
  const scent = scentOf(pupD);
  const focused = inFocus(pupD, yipping);
  const effortPup = effort(bodyKg('Red Fox'), bodyKg('pup'));
  const effortMama = effort(bodyKg('Red Fox'), bodyKg('Gray Wolf'));
  const stray = pupFromMama > STRAY_M;
  const near = mamaD < PROTECT_M || pupD < PROTECT_M;
  const nextProtect = protectStep(protect, near, dt);
  const guarding = nextProtect >= PROTECT_COMMIT;
  const danger = dangerOf(mamaD, guarding);
  const useEffort = stray ? effortPup : Math.max(effortPup, 0.35);
  const approach = approachOf(nextHunger, useEffort, focused ? Math.max(scent, 0.35) : scent);
  const radius = guarding ? DANGER_PROTECT_M : DANGER_M;
  let mode: FoxMode = 'none';
  let speed = 0;
  let yaw = foxYaw;
  if (guarding && mamaD < radius) { mode = 'flee'; speed = 3.4; yaw = away(foxX, foxZ, mamaX, mamaZ); }
  else if (mamaD <= DANGER_M) { mode = 'linger'; speed = 1.15; yaw = away(foxX, foxZ, mamaX, mamaZ); }
  else if (mamaD < DANGER_M * 1.35 && approach > 0.02) { mode = 'linger'; speed = 0.7; yaw = tangent(foxX, foxZ, mamaX, mamaZ); }
  else if (approach > danger && (focused || scent > 0.15) && stray) { mode = 'approach'; speed = 1.1 + nextHunger; yaw = toward(foxX, foxZ, pupX, pupZ); }
  else if (scent > 0.05) { mode = 'watch'; speed = 0.55; yaw = toward(foxX, foxZ, pupX, pupZ); }
  const fox = forward(foxX, foxZ, yaw, speed * Math.max(0, dt));
  let mama = { x: mamaX, z: mamaZ, yaw: 0 };
  if (guarding) {
    const face = toward(mamaX, mamaZ, foxX, foxZ);
    const stepped = forward(mamaX, mamaZ, face, 2.8 * Math.max(0, dt));
    mama = { x: stepped.x, z: stepped.z, yaw: face };
  }
  hunger = nextHunger;
  protect = nextProtect;
  foxX = fox.x;
  foxZ = fox.z;
  foxYaw = yaw;
  last = {
    hunger, effortPup, effortMama, scent, danger, protect, threat: near ? 1 : 0, approach, mode,
    committed: guarding, foxX, foxZ, foxYaw, mamaX: mama.x, mamaZ: mama.z, mamaYaw: mama.yaw,
    pupX, pupZ, yip: yipping,
  };
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
