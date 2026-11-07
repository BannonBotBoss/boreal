/** Shared seeded randomness (Grok Bot). Every procedural system draws from here; never Math.random or render order. */
const f32Bits = new Float32Array(1), u32Bits = new Uint32Array(f32Bits.buffer);
const u32mul = (a: number, b: number) => Math.imul(a, b) >>> 0;
/** CPU twin of `hash2u` in proc/glsl.ts (the integer lattice hash the cloud shell uses). One implementation site
 *  for the multiply; the shader copy stays in the GLSL string. */
export function hash2u(cx: number, cy: number, s: number) {
  f32Bits[0] = s;
  const q0 = u32mul(cx | 0, 1597334673);
  const q1 = u32mul(cy | 0, 3812015801);
  let n = (q0 ^ q1 ^ u32Bits[0]) >>> 0;
  n = u32mul(n, 1597334673);
  n = (n ^ (n >>> 16)) >>> 0;
  n = u32mul(n, 0x7feb352d);
  n = (n ^ (n >>> 15)) >>> 0;
  return n / 4294967295;
}
/** FNV-1a 32-bit hash of a string. */
export function hash(text: string): number {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}
/** mulberry32: the same seed always gives the same sequence in [0, 1). */
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mulberry32 = random;
/** Independent named sub-stream of a seed, e.g. stream(worldSeed, 'hare:3'). */
export const stream = (seed: number, label: string) => random(hash(`${label}:${seed}`));
/** Uniform value in [a, b) from a generator. */
export const range = (r: () => number, [a, b]: readonly number[]) => a + r() * (b - a);
/** ONE bounded-probability helper for every generator (trees, branches; animals can adopt it). A distribution is
 * mean + spread (normal: SD; lognormal: SD of ln x, mean = median) truncated to hard [min, max] by rejection
 * (≤ 16 draws, then clamp). Normal deviates by Box–Muller (Box & Muller 1958). */
export interface Dist { mean: number; sd: number; min: number; max: number; kind?: 'normal' | 'lognormal' }
export function sample(r: () => number, d: Dist) {
  for (let i = 0; i < 16; i++) {
    const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const v = d.kind === 'lognormal' ? d.mean * Math.exp(d.sd * z) : d.mean + d.sd * z;
    if (v >= d.min && v <= d.max) return v;
  }
  return Math.min(d.max, Math.max(d.min, d.mean));
}
