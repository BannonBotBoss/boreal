/**
 * Ground cover (Grok Bot): WHERE blades grow and WHICH species, as a pure function of (seed, x, z). CPU side of the grass
 * port (render/grass/grass.ts; upstream simondevyoutube/Quick_Grass, MIT, after the Ghost of Tsushima GDC 2021 talk).
 *  - Placement = jittered grid (Quick_Grass / GoT: "evenly spaced points plus a small random offset"), kept with the
 *    probability of the density field, so the field alone decides coverage. Upstream samples a heightmap texture on the
 *    GPU and hashes per blade; here every blade is drawn on the CPU from proc/rng (seeded, reproducible) and the root
 *    height comes from heightAt on the terrain mesh's own vertex lattice + triangulation, so roots sit exactly on the mesh.
 *  - The density field is ONE swappable function (`setCoverSource`): today it reads slope, TWI, lakes and river channels
 *    (stages 1-2c). The soils stage (core/stages, core/ground) can replace it with soil type / moss / canopy later.
 * Species = data rows (rule 2/3): one blade generator, shape = parameters. Kenora-area ground-cover mix and habitat after
 * Baldwin & Sims 1997 (Field Guide to the Common Forest Plants in Northwestern Ontario, OMNR) and the NWO FEC ordination
 * (Sims et al. 1997; moisture axis dry → wet); leaf dimensions from Flora of North America (FNA) treatments.
 */
import { CHUNK_SIZE, heightAt, WORLD_SEED } from '../../core/world';
import { RENDER } from '../../core/renderSettings';
import { covered, footprintsIn, prepareArea, siteAt, type Site } from '../../core/flora/site';
import { CELL } from '../../core/ground';
import { hash, random, sample, type Dist } from '../../proc/rng';
import { smoothstep } from '../../proc/math';

/** profile: 0 grass leaf (convex taper), 1 sedge leaf (straight taper, keeled/stiff), 2 sprig (stem + elliptic leaf: shrubs). */
export interface CoverSpecies {
  id: string; latin: string; form: 'grass' | 'sedge' | 'shrub';
  length: Dist;          // blade/leaf-sprig length (m)
  width: number;         // max blade/leaf width (m)
  profile: 0 | 1 | 2; stem: number; // sprig: share of the length that is stem
  lean: [number, number]; // curl at the tip (rad)
  stiff: number;         // 0 = full wind response, 1 = rigid [game calibration]
  wet: [number, number]; // niche on the site wetness axis 0 dry .. 1 saturated: optimum, tolerance (Gaussian) [verify, after the FEC ordination]
  rock: number;          // relative weight on thin soil over bedrock (outcrop pockets)
  base: [number, number, number]; tip: [number, number, number]; fall: [number, number, number]; // linear albedo (leaf reflectance, green peak 0.1-0.35 incl. sheen: Jacquemoud & Baret 1990 PROSPECT) [verify]
}
export const COVER_SPECIES: CoverSpecies[] = [
  // Canada bluejoint: wet meadows, shores, disturbed moist forest. Leaves 10-30(-60) cm x 3-8 mm (FNA vol. 24) [verify]. Cures straw-tan in fall.
  { id: 'bluejoint', latin: 'Calamagrostis canadensis', form: 'grass', length: { mean: .32, sd: .1, min: .12, max: .6 }, width: .006, profile: 0, stem: 0, lean: [.25, .7], stiff: .1, wet: [.72, .22], rock: .1,
    base: [.036, .072, .018], tip: [.192, .264, .084], fall: [.525, .413, .213] },
  // Water / beaked sedge: shores and fens. Leaves 20-80 cm x 3-8 (-12) mm, stiff, keeled (FNA vol. 23, Carex aquatilis / C. utriculata) [verify]. Blue-green.
  { id: 'sedge', latin: 'Carex aquatilis / C. utriculata', form: 'sedge', length: { mean: .45, sd: .14, min: .2, max: .8 }, width: .006, profile: 1, stem: 0, lean: [.15, .45], stiff: .35, wet: [.95, .14], rock: 0,
    base: [.036, .066, .036], tip: [.132, .204, .108], fall: [.45, .375, .188] },
  // Wavy hairgrass: dry jack pine / rock outcrops. Leaves filiform, 0.3-1 mm wide, 5-20 cm (FNA vol. 24) [verify]; drawn ≥ 2 mm wide (sub-pixel otherwise) [game calibration].
  { id: 'hairgrass', latin: 'Deschampsia flexuosa', form: 'grass', length: { mean: .13, sd: .04, min: .05, max: .22 }, width: .002, profile: 0, stem: 0, lean: [.4, 1], stiff: .05, wet: [.15, .2], rock: 1,
    base: [.048, .072, .024], tip: [.24, .276, .108], fall: [.5, .425, .25] },
  // Poverty oatgrass: dry sand and bedrock pockets. Leaves 6-15 cm x 1-3 mm, curling (FNA vol. 24) [verify].
  { id: 'oatgrass', latin: 'Danthonia spicata', form: 'grass', length: { mean: .1, sd: .03, min: .05, max: .18 }, width: .0025, profile: 0, stem: 0, lean: [.7, 1.4], stiff: .15, wet: [.2, .2], rock: .8,
    base: [.06, .078, .03], tip: [.24, .264, .12], fall: [.562, .475, .275] },
  // Lowbush blueberry: dry-fresh jack pine and outcrops. Shrub 5-60 cm; leaves elliptic 1.5-3.5 x 0.6-1.2 cm (FNA vol. 8, Vaccinium angustifolium) [verify]. Leaves turn red in fall.
  { id: 'blueberry', latin: 'Vaccinium angustifolium', form: 'shrub', length: { mean: .2, sd: .07, min: .07, max: .4 }, width: .011, profile: 2, stem: .7, lean: [.6, 1.2], stiff: .5, wet: [.32, .2], rock: .6,
    base: [.144, .06, .036], tip: [.06, .132, .036], fall: [.4, .0375, .0375] },
  // Labrador tea: wet black spruce / peatland. Shrub 30-100 cm; leaves 2-5 x 0.5-1.5 cm, revolute, evergreen (FNA vol. 8, Rhododendron groenlandicum) [verify].
  { id: 'labradortea', latin: 'Rhododendron groenlandicum', form: 'shrub', length: { mean: .4, sd: .12, min: .2, max: .75 }, width: .01, profile: 2, stem: .78, lean: [.7, 1.1], stiff: .6, wet: [.85, .15], rock: 0,
    base: [.12, .072, .036], tip: [.048, .084, .03], fall: [.0625, .0875, .0375] },
];

export { siteAt, type Site } from '../../core/flora/site';
export interface Cover { density: number; weights: number[] }
/** Default density field: 0..1 of the tier's max blade density, plus per-species weights. */
export function defaultCover(x: number, z: number, s = siteAt(x, z)): Cover {
  const weights = COVER_SPECIES.map(c => Math.exp(-(((s.wet - c.wet[0]) / c.wet[1]) ** 2)) * (1 - s.rock + s.rock * c.rock));
  if (s.water) return { density: 0, weights };
  // soil pockets on rock: a 4 m patch is bare where its hash is below the rock share (bare rock carries lichen, not grass)
  const pocket = random(hash(`cover:${WORLD_SEED}:${Math.floor(x / 4)}:${Math.floor(z / 4)}`))();
  const bare = s.rock > pocket ? 1 : 0;
  // closed forest floor is feathermoss-dominated, graminoid cover peaks in wet openings/shores (Baldwin & Sims 1997) [game calibration .45]
  const density = (1 - bare) * (.45 + .55 * smoothstep(.55, .95, s.wet)) * (.4 + .6 * s.light) * (1 - smoothstep(30, 40, s.slopeDeg)); // shade thins graminoids [game calibration]
  return { density, weights };
}
let source: (x: number, z: number) => Cover = defaultCover;
/** Soils stage hook: replace the density field (undefined restores the default). */
export function setCoverSource(fn?: (x: number, z: number) => Cover) { source = fn ?? defaultCover; }
export const coverAt = (x: number, z: number) => source(x, z);

/** Grass tuning; cost scales with LADDER `foliage` (core/quality): density × foliage, radius × √foliage. [game calibration] */
export const GRASS = { tile: CHUNK_SIZE / 4, maxDensity: 120 /* blades/m² at Ultra */, full: 9 /* m at full density */, radius: 48, lodDist: 14, segHigh: 6, segLow: 2 };
/** Kept share of blades at distance d (density falloff): 1 inside `full`, then (full/d)² (constant blades per screen area), 0 at `radius`. */
export function keepAt(d: number, radius: number, full = GRASS.full) { return (d <= full ? 1 : (full / d) ** 2) * (1 - smoothstep(radius * .8, radius, d)); }

export interface Blades { count: number; pos: Float32Array; blade: Float32Array; kind: Float32Array; data: Float32Array /* interleaved ×8, as render/grass packs it */; minY: number; maxY: number }
/** One tile's blades as a sliced job (yields per row). Instances are sorted by their keep hash, so drawing the first
 * `keep × count` instances thins the tile uniformly (distance / quality) without rebuilding. */
export function* bladesJob(tx: number, tz: number, seed = WORLD_SEED): Generator<unknown, Blades> {
  const T = GRASS.tile, x0 = tx * T, z0 = tz * T, step = CHUNK_SIZE / RENDER.terrainSegments, m = Math.round(T / step);
  yield* prepareArea(x0 - 1, z0 - 1, x0 + T + 1, z0 + T + 1); // canopy + footprint caches, sliced
  const H = new Float32Array((m + 1) * (m + 1));
  for (let j = 0; j <= m; j++) { for (let i = 0; i <= m; i++) H[j * (m + 1) + i] = heightAt(x0 + i * step, z0 + j * step); if (j % 4 === 0) yield; }
  const cm = Math.round(T / CELL), C: Cover[] = [];
  for (let j = 0; j <= cm; j++) { for (let i = 0; i <= cm; i++) C.push(coverAt(x0 + i * CELL, z0 + j * CELL)); yield; }
  // terrain mesh height: PlaneGeometry quads split along (ix, iz+1)-(ix+1, iz) (render/math terrainJob)
  const ground = (x: number, z: number) => { const fx = (x - x0) / step, fz = (z - z0) / step, i = Math.min(m - 1, Math.floor(fx)), j = Math.min(m - 1, Math.floor(fz)), u = fx - i, v = fz - j;
    const a = H[j * (m + 1) + i], d = H[j * (m + 1) + i + 1], b = H[(j + 1) * (m + 1) + i], c = H[(j + 1) * (m + 1) + i + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v); };
  const feet = footprintsIn(x0, z0, x0 + T, z0 + T); // rocks, logs, trunks, props: no blade grows through them
  const r = random(hash(`grass:${seed}:${tx}:${tz}`)), sp = 1 / Math.sqrt(GRASS.maxDensity), g = Math.round(T / sp), rows: number[][] = [];
  for (let j = 0; j < g; j++) {
    for (let i = 0; i < g; i++) {
      const x = x0 + (i + r()) * sp, z = z0 + (j + r()) * sp, keep = r(); // jittered grid (GoT / Quick_Grass)
      const fx = (x - x0) / CELL, fz = (z - z0) / CELL, ci = Math.min(cm - 1, Math.floor(fx)), cj = Math.min(cm - 1, Math.floor(fz)), u = fx - ci, v = fz - cj;
      const q = [C[cj * (cm + 1) + ci], C[cj * (cm + 1) + ci + 1], C[(cj + 1) * (cm + 1) + ci], C[(cj + 1) * (cm + 1) + ci + 1]], wq = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
      if (q.some(c => c.density === 0) || r() >= q.reduce((s, c, k) => s + c.density * wq[k], 0)) continue; // hard edge at water / bare rock
      const w = COVER_SPECIES.map((_, s) => q.reduce((a, c, k) => a + c.weights[s] * wq[k], 0)), tot = w.reduce((a, b) => a + b, 0);
      let pick = r() * tot, k = 0; while (k < w.length - 1 && (pick -= w[k]) > 0) k++;
      const sp_ = COVER_SPECIES[k], row = [x, ground(x, z) - .01, z, r() * Math.PI * 2, sample(r, sp_.length), sp_.lean[0] + r() * (sp_.lean[1] - sp_.lean[0]), keep, k];
      if (!feet.length || !covered(feet, x, z, .02)) rows.push(row); // tested after every draw, so the rng stream (the field elsewhere) is unchanged
    }
    yield;
  }
  rows.sort((a, b) => a[6] - b[6]); yield;
  const n = rows.length, pos = new Float32Array(n * 3), blade = new Float32Array(n * 4), kind = new Float32Array(n), data = new Float32Array(n * 8); let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { const b = rows[i]; for (let k = 0; k < 8; k++) data[i * 8 + k] = b[k]; for (let k = 0; k < 3; k++) pos[i * 3 + k] = b[k]; for (let k = 0; k < 4; k++) blade[i * 4 + k] = b[3 + k]; kind[i] = b[7]; if (b[1] < minY) minY = b[1]; if (b[1] + b[4] > maxY) maxY = b[1] + b[4]; } // no per-row allocations (perf audit)
  return { count: n, pos, blade, kind, data, minY: n ? minY : 0, maxY: n ? maxY : 0 };
}
