/**
 * Where an animal can drink (T-0036): open water it can see, i.e. the same surfaces the renderer draws. Staged terrain
 * (core/stages/surfaceAt): a lake, a river channel, or ground under the water plane; plain terrain: ground under the water
 * plane (render/buildScene draws it at LEVEL.waterSurface). Shore mud above the plane is not drinkable.
 */
import { heightAt } from '../world';
import { STAGES } from '../stages/elevation';
import { surfaceAt } from '../stages/surfaceAt';
import { LEVEL } from '../tuning';
export function waterAt(x: number, z: number) {
  if (STAGES.on) { const p = surfaceAt(x, z); return !!p.lake || !!p.river || p.height < LEVEL.waterSurface; }
  return heightAt(x, z) < LEVEL.waterSurface;
}
/** Muzzle reach: water at 0.6-1.8 m ahead of the body centre, straight or 0.5 rad to either side (heading h: forward = -sin, -cos). */
export const waterAhead = (x: number, z: number, h: number) => [.6, 1.2, 1.8].some(d => [-.5, 0, .5].some(a => waterAt(x - Math.sin(h + a) * d, z - Math.cos(h + a) * d)));
/** Nearest water by ring search (4 m rings out to `maxR`); undefined if none. */
export function nearestWater(x: number, z: number, maxR = 400) {
  for (let r = 4; r <= maxR; r += 4) { const k = Math.max(12, Math.round(2 * Math.PI * r / 6));
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (waterAt(px, pz)) return { x: px, z: pz }; } }
  return undefined;
}
