/**
 * Orbit vegetation comes from rust/boreal-sim cover::orbit_vegetation.
 * This module only loads that export. It does not restate the Hadley belts.
 */
let veg: ((absLat: number, coastKm: number) => number) | null = null;

export function orbitVegetation(absLat: number, coastKm: number) {
  if (!veg) throw new Error('orbit vegetation wasm is not loaded');
  return veg(absLat, coastKm);
}

export async function loadOrbitVegetation(bytes?: BufferSource) {
  if (veg) return;
  const buf = bytes ?? await (await fetch(wasmUrl())).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buf, {});
  const fn = (instance.exports as { orbit_vegetation?: (a: number, b: number) => number }).orbit_vegetation;
  if (!fn) throw new Error('boreal_sim.wasm has no orbit_vegetation export');
  veg = fn;
}

function wasmUrl() {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base}wasm/boreal_sim.wasm`;
}
