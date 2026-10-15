/** Shared scalar/angle/vector helpers (Grok Bot). One copy for every procedural and behaviour system. */
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Hermite ease of an already-normalised t (clamped to 0..1). */
export const smooth01 = (t: number) => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** GLSL-style smoothstep: 0 below a, 1 above b, eased between. */
export const smoothstep = (a: number, b: number, x: number) => smooth01((x - a) / (b - a));
/** Wraps an angle difference into [-PI, PI). */
export const wrapAngle = (d: number) => ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
/** Turns `from` toward `to` by at most `max` radians, the short way round. */
export const angleTurn = (from: number, to: number, max: number) => from + clamp(wrapAngle(to - from), -max, max);
/** Position after moving `speed * dt` along a heading (heading 0 faces -z, the game's forward). */
export const stepForward = (x: number, z: number, heading: number, speed: number, dt: number) =>
  ({ x: x - Math.sin(heading) * speed * dt, z: z - Math.cos(heading) * speed * dt });
