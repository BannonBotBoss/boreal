/**
 * The page asks Rust for the litter each frame and draws the answer.
 * Age, size, following, and personal space are stepped in the wasm.
 * Until that wasm is loaded, the existing TypeScript follow is the fallback.
 */
import { ageAfter, followStep, pupScale, type PupPlace } from '../core/litter';
import { wasmInstance } from './simWasm';

interface LitterWasm {
  memory: WebAssembly.Memory;
  litter_scratch?(n: number): number;
  litter_frame?(dt: number, gameSeconds: number, motherX: number, motherZ: number, yaw: number, time: number, moving: number, threatened: number, out: number): void;
}

let loading: Promise<LitterWasm | null> | null = null;
let wasm: LitterWasm | null = null;
let cacheKey = '';
let cache: { x: number; z: number; age: number; scale: number }[] | null = null;

function boot() {
  if (wasm || loading) return;
  loading = wasmInstance().then(instance => {
    const exports = instance?.exports as LitterWasm | undefined;
    if (!exports?.litter_frame || !exports.litter_scratch) return null;
    wasm = exports;
    return exports;
  });
}

/** Where this pup is after Rust has stepped the litter. The first pup of the frame runs the step. */
export function adoptLitter(litter: { pup: PupPlace }[], pup: PupPlace, dt: number, gameSeconds: number, motherX: number, motherZ: number, yaw: number, time: number, moving: boolean, threatened: boolean) {
  boot();
  const first = litter[0]?.pup === pup;
  if (first) {
    cacheKey = `${time}:${dt}:${motherX}:${motherZ}:${yaw}`;
    cache = null;
    const scratch = wasm?.litter_scratch;
    if (wasm?.litter_frame && scratch) {
      const out = scratch(20);
      wasm.litter_frame(dt, gameSeconds, motherX, motherZ, yaw, time, moving ? 1 : 0, threatened ? 1 : 0, out);
      const got = new Float64Array(wasm.memory.buffer, out, 20);
      cache = [];
      for (let i = 0; i < 5; i++) cache.push({ x: got[i * 4], z: got[i * 4 + 1], age: got[i * 4 + 2], scale: got[i * 4 + 3] });
    }
  }
  const fromRust = cache?.[pup.slot];
  if (fromRust && cacheKey === `${time}:${dt}:${motherX}:${motherZ}:${yaw}`) return fromRust;
  const age = ageAfter(pup.ageYears, gameSeconds);
  const next = followStep(pup.x, pup.z, pup.slot, motherX, motherZ, yaw, dt, age, time, moving, threatened);
  return { x: next.x, z: next.z, age, scale: pupScale(age) };
}
