/**
 * Draw-side call into the Rust litter. Steering and personal space run in
 * rust/boreal-sim. Until that wasm is loaded, the step uses the existing
 * TypeScript follow, which does not add a second copy of the new rule.
 */
import { followStep, type PupPlace } from '../core/litter';
import { wasmInstance } from './simWasm';

interface LitterWasm {
  memory: WebAssembly.Memory;
  litter_scratch?(n: number): number;
  litter_body_radius?(ageYears: number): number;
  litter_follow?(x: number, z: number, slot: number, motherX: number, motherZ: number, yaw: number, dt: number, ageYears: number, time: number, moving: number, threatened: number, vx: number, vz: number, out: number): void;
  litter_separate?(n: number, data: number, motherX: number, motherZ: number): void;
}

let loading: Promise<LitterWasm | null> | null = null;
let wasm: LitterWasm | null = null;
const vel = new Map<number, { vx: number; vz: number }>();

function boot() {
  if (wasm || loading) return;
  loading = wasmInstance().then(instance => {
    const exports = instance?.exports as LitterWasm | undefined;
    if (!exports?.litter_follow || !exports.litter_separate || !exports.litter_scratch) return null;
    wasm = exports;
    return exports;
  });
}

/** One pup's eased step. On the last pup of the litter, Rust also separates the bodies. */
export function herdStep(litter: { pup: PupPlace }[], pup: PupPlace, motherX: number, motherZ: number, yaw: number, dt: number, time: number, moving: boolean, threatened: boolean) {
  boot();
  const v = vel.get(pup.slot) ?? { vx: 0, vz: 0 };
  let x = pup.x;
  let z = pup.z;
  let vx = 0;
  let vz = 0;
  const scratch = wasm?.litter_scratch;
  if (wasm?.litter_follow && scratch) {
    const out = scratch(4);
    wasm.litter_follow(pup.x, pup.z, pup.slot, motherX, motherZ, yaw, dt, pup.ageYears, time, moving ? 1 : 0, threatened ? 1 : 0, v.vx, v.vz, out);
    const got = new Float64Array(wasm.memory.buffer, out, 4);
    x = got[0]; z = got[1]; vx = got[2]; vz = got[3];
  } else {
    const next = followStep(pup.x, pup.z, pup.slot, motherX, motherZ, yaw, dt, pup.ageYears, time, moving, threatened);
    x = next.x; z = next.z;
  }
  vel.set(pup.slot, { vx, vz });
  pup.x = x;
  pup.z = z;
  const last = litter[litter.length - 1]?.pup;
  if (last === pup && wasm?.litter_separate && wasm.litter_body_radius && scratch) {
    const n = litter.length;
    const data = scratch(n * 3);
    const buf = new Float64Array(wasm.memory.buffer, data, n * 3);
    for (let i = 0; i < n; i++) {
      const at = litter[i].pup;
      buf[i * 3] = at.x;
      buf[i * 3 + 1] = at.z;
      buf[i * 3 + 2] = wasm.litter_body_radius(at.ageYears);
    }
    wasm.litter_separate(n, data, motherX, motherZ);
    const after = new Float64Array(wasm.memory.buffer, data, n * 3);
    for (let i = 0; i < n; i++) {
      litter[i].pup.x = after[i * 3];
      litter[i].pup.z = after[i * 3 + 1];
    }
    x = pup.x;
    z = pup.z;
  }
  return { x, z };
}
