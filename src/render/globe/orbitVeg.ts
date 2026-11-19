/**
 * Orbit vegetation comes from rust/boreal-sim cover::orbit_vegetation.
 * The page uses the one boreal_sim.wasm in simWasm.ts (planet, litter, drives).
 * This module does not instantiate a second copy. A test that passes bytes gets
 * the separate instance that loader already documents.
 */
import { wasmInstance } from '../simWasm';

let veg: ((absLat: number, coastKm: number) => number) | null = null;

export function orbitVegetation(absLat: number, coastKm: number) {
  if (!veg) throw new Error('orbit vegetation wasm is not loaded');
  return veg(absLat, coastKm);
}

export async function loadOrbitVegetation(bytes?: BufferSource) {
  if (veg) return;
  const instance = await wasmInstance(bytes);
  const fn = (instance?.exports as { orbit_vegetation?: (a: number, b: number) => number } | undefined)?.orbit_vegetation;
  if (!fn) throw new Error('boreal_sim.wasm has no orbit_vegetation export');
  veg = fn;
}
