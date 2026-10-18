/**
 * Per-pixel shorelines for the globe's home region (Grok Bot). Globe tiles are hundreds of metres across at band
 * altitudes, so a per-vertex land/water field (even an exact one) contours to straight segments inside each triangle:
 * big triangular lakes and a diagonal water edge at the handover. Following the water-mask idea of terrain streamers
 * (Cesium quantized-mesh extension 2: a 256x256 mask per tile sampled per pixel, values in between antialias the coast),
 * this builds ONE signed-field texture over the home region at runtime from the game's own seeded hydrology (nothing
 * baked) and the tile shader contours it per pixel with fwidth.
 * Field: height above the local water surface (m) = ground - water, < 0 under water. The water surface is the game's:
 * a stage-2b lake body's flat level (a node of the point's cell in that body, as core/stages lakeAt decides), a river
 * channel's surface, or the base water plane (LEVEL.waterSurface). Dry points next to a lake measure from THAT lake's
 * level, so the zero crossing between texels is the real shoreline (where the game's water sheet meets its terrain).
 * The home region is one period of the stage grids (ELEV.n x ELEV.cell = 2 x PLANET.home.halfSize), so the texture
 * repeats seamlessly: texel i sits on x = i * size / n (game metres; same for z).
 * Encoding: R8, 128 + 16 x field, clamped to +-8 m (1/16 m steps; only the crossing and the first metres matter).
 */
import { STAGES, ELEV, elevationGrid, lakeAt, lakeGrid, sampleGrid, toWorld } from '../../core/stages/elevation';
import { carve, riverAt } from '../../core/stages/rivers';
import { heightAt } from '../../core/world';
import { LEVEL } from '../../core/tuning';

export const LAKE_MASK = { n: 1024, size: ELEV.n * ELEV.cell, scale: 16, clamp: 8 };
/** Signed field at a game point (m above the local water surface, < 0 in water). Staged: core/stages surfaceAt's water
 *  rules (lakeAt body, base water under LEVEL.waterSurface, river channel) on its height minus core/surface's micro detail
 *  (+-7 cm, and ~90 % of surfaceAt's cost; well under the 1/16 m encoding step). */
export function lakeField(x: number, z: number, staged: boolean, seed = STAGES.seed) {
  if (!staged) return heightAt(x, z) - LEVEL.waterSurface;
  const g = elevationGrid(seed), rv = riverAt(seed, x, z), h0 = toWorld(g, sampleGrid(g, x, z)), h = rv ? carve(h0, rv) : h0;
  const lk = lakeAt(seed, x, z), W = lk ? lk.surface : h < LEVEL.waterSurface ? LEVEL.waterSurface : rv && rv.d < rv.half ? rv.surface : undefined;
  if (W !== undefined) return Math.min(-.02, h - W);
  let f = h - LEVEL.waterSurface; // dry: measured from the nearest surface it borders (a corner node's lake body, the river)
  const L = lakeGrid(seed), n = g.n, i0 = Math.floor(x / g.cell), j0 = Math.floor(z / g.cell);
  for (let k = 0; k < 4; k++) { const i = (((i0 + (k & 1)) % n) + n) % n, j = (((j0 + (k >> 1)) % n) + n) % n, b = L.id[j * n + i]; if (b >= 0) f = Math.min(f, h - L.bodies[b].level); }
  if (rv) f = Math.min(f, h - rv.surface);
  return Math.max(.02, f);
}
/** The mask (n x n bytes, row = z). A generator: yields every few rows so a worker or a job can slice it. */
export function* buildLakeMask(staged: boolean, seed = STAGES.seed, n = LAKE_MASK.n): Generator<void, Uint8Array> {
  const out = new Uint8Array(n * n), c = LAKE_MASK.size / n, half = LAKE_MASK.size / 2, { scale, clamp } = LAKE_MASK;
  for (let j = 0; j < n; j++) {
    let z = j * c; if (z >= half) z -= LAKE_MASK.size; // wrap to the centred home region (layered terrain is not periodic)
    for (let i = 0; i < n; i++) {
      let x = i * c; if (x >= half) x -= LAKE_MASK.size;
      const f = Math.max(-clamp, Math.min(clamp, lakeField(x, z, staged, seed)));
      out[j * n + i] = Math.max(0, Math.min(255, Math.round(128 + f * scale)));
    }
    if ((j & 7) === 7) yield;
  }
  return out;
}
