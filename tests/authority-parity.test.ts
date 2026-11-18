/**
 * The live drive step and the litter's age and size. Rust is the authority.
 * These compare the wasm step with the TypeScript fallback. They must agree
 * before the page draws the Rust result. The rest of the animal tick stays in TypeScript.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageAfter, pupScale, LITTER } from '../src/core/litter';
import { resetDrives, stepDrives, type DriveNow, type FoxMode } from '../src/core/drives';

const MODES: FoxMode[] = ['none', 'approach', 'linger', 'watch', 'flee'];

interface Wasm {
  memory: WebAssembly.Memory;
  litter_scratch(n: number): number;
  drives_reset(hasAt: number, x: number, z: number, hunger: number, protect: number, setHunger: number, setProtect: number): void;
  drives_tick(mamaX: number, mamaZ: number, yaw: number, pupX: number, pupZ: number, yip: number, dt: number, out: number): void;
  litter_reset(): void;
  litter_frame(dt: number, gameSeconds: number, motherX: number, motherZ: number, yaw: number, time: number, moving: number, threatened: number, out: number): void;
}

async function load(): Promise<Wasm> {
  const buf = readFileSync(new URL('../public/wasm/boreal_sim.wasm', import.meta.url));
  const { instance } = await WebAssembly.instantiate(buf, {});
  return instance.exports as unknown as Wasm;
}

function rustDrive(x: Wasm, mamaX: number, mamaZ: number, yaw: number, pupX: number, pupZ: number, yip: boolean, dt: number): DriveNow {
  const ptr = x.litter_scratch(21);
  x.drives_tick(mamaX, mamaZ, yaw, pupX, pupZ, yip ? 1 : 0, dt, ptr);
  const o = new Float64Array(x.memory.buffer, ptr, 21);
  return {
    hunger: o[0], effortPup: o[1], effortMama: o[2], scent: o[3], danger: o[4], protect: o[5],
    threat: o[6], approach: o[7], mode: MODES[o[8]] ?? 'watch',
    committed: o[9] > 0.5, hold: o[10] > 0.5, returning: o[11] > 0.5,
    foxX: o[12], foxZ: o[13], foxYaw: o[14], mamaX: o[15], mamaZ: o[16], mamaYaw: o[17],
    pupX: o[18], pupZ: o[19], yip: o[20] > 0.5,
  };
}

function resetBoth(x: Wasm, at?: { x: number; z: number; hunger?: number; protect?: number }) {
  resetDrives(at);
  x.drives_reset(at ? 1 : 0, at?.x ?? 0, at?.z ?? 0, at?.hunger ?? 0, at?.protect ?? 0, at && 'hunger' in at ? 1 : 0, at && 'protect' in at ? 1 : 0);
}

function same(ts: DriveNow, rust: DriveNow, label: string) {
  assert.equal(rust.mode, ts.mode, `${label} mode`);
  assert.equal(rust.committed, ts.committed, `${label} committed`);
  assert.equal(rust.hold, ts.hold, `${label} hold`);
  assert.equal(rust.returning, ts.returning, `${label} returning`);
  for (const key of ['hunger', 'protect', 'foxX', 'foxZ', 'foxYaw', 'mamaX', 'mamaZ', 'mamaYaw', 'danger', 'approach'] as const) {
    assert.ok(Math.abs(rust[key] - ts[key]) < 1e-6, `${label} ${key} rust ${rust[key]} ts ${ts[key]}`);
  }
}

test('the rust drive step matches the page step', async () => {
  const x = await load();
  const pair = (at: { x: number; z: number; hunger?: number; protect?: number } | undefined, mamaX: number, mamaZ: number, yaw: number, pupX: number, pupZ: number, yip: boolean, dt: number, label: string) => {
    resetBoth(x, at);
    const ts = stepDrives(mamaX, mamaZ, yaw, pupX, pupZ, yip, dt);
    const rust = rustDrive(x, mamaX, mamaZ, yaw, pupX, pupZ, yip, dt);
    same(ts, rust, label);
    return { ts, rust };
  };
  pair({ x: 9.5, z: 0 }, 0, 0, 0, 1.2, 0.2, true, 0.2, 'on the ring');
  pair({ x: 4, z: 0 }, 0, 0, 0, 1, 0.2, false, 0.5, 'inside the ring');
  pair({ x: 9.5, z: 0, protect: 1 }, 0, 0, 0, 1.2, 0.2, true, 0.2, 'she commits');
  pair({ x: 20, z: 0, hunger: 0.9 }, 0, 0, 0, 8, 0, true, 0.2, 'a stray pup');
  pair({ x: 28, z: 0 }, 0, 0, 0, 1, 0.2, false, 0.2, 'a far scent');

  resetBoth(x, { x: 0.05, z: 0, protect: 1 });
  let ts = stepDrives(0, 0, 0, 0.2, 0.3, false, 1 / 30);
  let rust = rustDrive(x, 0, 0, 0, 0.2, 0.3, false, 1 / 30);
  for (let i = 0; i < 30; i++) {
    ts = stepDrives(ts.mamaX, ts.mamaZ, 0, ts.mamaX + 0.2, ts.mamaZ + 0.3, false, 1 / 30);
    rust = rustDrive(x, rust.mamaX, rust.mamaZ, 0, rust.mamaX + 0.2, rust.mamaZ + 0.3, false, 1 / 30);
    same(ts, rust, `pushed out ${i}`);
  }
});

test('pup age and size match, and the rust litter keeps a body gap', async () => {
  const x = await load();
  x.litter_reset();
  const ptr = x.litter_scratch(30);
  x.litter_frame(1 / 30, 7200, 0, 0, 0, 0, 1, 0, ptr);
  const o = new Float64Array(x.memory.buffer, ptr, 30);
  const age = ageAfter(LITTER.emergeYears, 7200);
  assert.ok(Math.abs(o[2] - age) < 1e-9, `age ${o[2]} vs ${age}`);
  assert.ok(Math.abs(o[3] - pupScale(age)) < 1e-9, `scale ${o[3]}`);
  const pts = [0, 1, 2, 3, 4].map(i => ({ x: o[i * 6], z: o[i * 6 + 1] }));
  for (let i = 0; i < pts.length; i++) {
    assert.ok(Math.hypot(pts[i].x, pts[i].z) > 0.4, `pup ${i} is inside mama`);
    for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) > 0.3, `pups ${i} and ${j} overlap`);
  }
});
