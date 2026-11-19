/**
 * The page asks Rust for the fox and the mother's protect each frame, then draws them.
 * Hunger, approach, linger, flee, and protect are stepped in the wasm.
 * Until that wasm is loaded, the existing TypeScript step is the fallback.
 */
import { foxPlace, stepDrives, type DriveNow, type FoxMode } from '../core/drives';
import { wasmInstance } from './simWasm';

const MODES: FoxMode[] = ['none', 'approach', 'linger', 'watch', 'flee'];

interface DriveWasm {
  memory: WebAssembly.Memory;
  litter_scratch?(n: number): number;
  drives_tick?(mamaX: number, mamaZ: number, gameYaw: number, pupX: number, pupZ: number, yip: number, dt: number, out: number): void;
}

let loading: Promise<DriveWasm | null> | null = null;
let wasm: DriveWasm | null = null;
let last: DriveNow | null = null;
let usingRust = false;

function boot() {
  if (wasm || loading) return;
  loading = wasmInstance().then(instance => {
    const exports = instance?.exports as DriveWasm | undefined;
    if (!exports?.drives_tick || !exports.litter_scratch) return null;
    wasm = exports;
    return exports;
  });
}

function read(out: Float64Array): DriveNow {
  return {
    hunger: out[0], effortPup: out[1], effortMama: out[2], scent: out[3], danger: out[4], protect: out[5],
    threat: out[6], approach: out[7], mode: MODES[out[8]] ?? 'watch',
    committed: out[9] > 0.5, hold: out[10] > 0.5, returning: out[11] > 0.5,
    foxX: out[12], foxZ: out[13], foxYaw: out[14], mamaX: out[15], mamaZ: out[16], mamaYaw: out[17],
    pupX: out[18], pupZ: out[19], yip: out[20] > 0.5,
  };
}

/** True once the wasm drive step is the one the page is drawing. */
export function driveUsesRust() { return usingRust; }

/** The last step, when Rust took it. The data panel reads this instead of the TypeScript copy. */
export function driveView(): DriveNow | null { return usingRust ? last : null; }

/** Where the fox mesh stands. Same shape as the TypeScript place. */
export function drivePose() {
  const now = usingRust ? last : null;
  if (!now) return foxPlace();
  const moving = now.mode === 'approach' || now.mode === 'flee' || now.mode === 'linger';
  const motion = now.mode === 'flee' || now.mode === 'approach' ? 'run' : now.mode === 'linger' ? 'walk' : 'idle';
  const speed = now.mode === 'flee' ? 9 : now.mode === 'linger' ? 0.8 : now.mode === 'approach' ? 1.6 : 0;
  return { x: now.foxX, z: now.foxZ, yaw: now.foxYaw + Math.PI, moving, motion, speed };
}

/** One frame. Rust steps when its wasm is loaded. Otherwise the TypeScript step runs. */
export function driveFrame(mamaX: number, mamaZ: number, gameYaw: number, pupX: number, pupZ: number, yipping: boolean, dt: number): DriveNow {
  boot();
  const scratch = wasm?.litter_scratch;
  if (wasm?.drives_tick && scratch) {
    const ptr = scratch(21);
    wasm.drives_tick(mamaX, mamaZ, gameYaw, pupX, pupZ, yipping ? 1 : 0, dt, ptr);
    last = read(new Float64Array(wasm.memory.buffer, ptr, 21));
    usingRust = true;
    return last;
  }
  usingRust = false;
  return stepDrives(mamaX, mamaZ, gameYaw, pupX, pupZ, yipping, dt);
}
