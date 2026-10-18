/**
 * Camera-relative rendering (Grok Bot). The render origin is the camera: every frame each drawn tile's double-precision
 * centre (CPU) minus the double-precision camera position becomes its float32 offset, and the camera itself renders from
 * (0,0,0). Tile vertices are already float32 relative to their centre, so everything the GPU sees is small near the
 * camera: sub-millimetre from orbit to the ground (tests/globe.test.ts), and shaders that use world positions (water,
 * atmosphere) never see 6.4e6-metre coordinates. The render origin is NOT the sim origin: see originBus.ts.
 */
import type { Vec3 } from './planet';

/** Float32 offset of a tile centre from the camera (the subtraction happens in doubles, then rounds once). */
export function renderOffset(centre: Vec3, cam: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = Math.fround(centre[0] - cam[0]); out[1] = Math.fround(centre[1] - cam[1]); out[2] = Math.fround(centre[2] - cam[2]); return out;
}
/** What the vertex shader computes for a float32 local vertex: offset + local, in float32 (rotation omitted; it does not
 *  change magnitudes). For tests and for CPU picking that must agree with the GPU. */
export function gpuRelative(offset: Vec3, local: ArrayLike<number>, k = 0): Vec3 {
  return [Math.fround(offset[0] + local[k]), Math.fround(offset[1] + local[k + 1]), Math.fround(offset[2] + local[k + 2])];
}
