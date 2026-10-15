/** Shared seeded randomness (Grok Bot). Every procedural system draws from here; never Math.random or render order. */
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
