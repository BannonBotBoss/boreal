import { isDryLand, type Entity } from './world';
import { random } from './random';
import { smooth01 } from '../proc/math';
import { f } from '../proc/trace';
import { WOLF_SCALE } from './wolfModes';
import { STAGES } from './stages/elevation';
import { soilGrid } from './stages/soils';
import { LEVEL } from './tuning';

/** Wentworth (1922, J. Geol. 30:377) pebbles/cobbles/small boulders (0..8: 0.06..0.50 m) plus Canadian Shield
 *  glacial erratic boulders (9..10: 0.95 m, 1.65 m) and glacially scoured whaleback bedrock outcrops (11: 3.60 m;
 *  Dredge & Cowan 1989, GSC Paper 89-18; NOEGTS 36 Hallett & Roed 1980). */
export const ROCK_SIZES = [.06, .08, .10, .13, .17, .22, .29, .38, .5, .95, 1.65, 3.6] as const;
// Fixed recipes: pebble, slab, wedge, upright, oblong, triangular, knobby, flat shard, asymmetric lump.
export const ROCK_SHAPES = [[1,.8,.9], [1,.35,.85], [1,.65,.6], [.6,1,.65], [1,.55,.45], [.9,.7,1], [1,.85,.8], [1,.25,.5], [.7,.8,1]] as const;
const TIER_MUL = 0x100000000;
export const withRockTier = (seed: number, tier: 0 | 1 | 2 | 3) => (seed >>> 0) + tier * TIER_MUL;
export const PUSH_DISTANCE = .22;
/** Snout tip distance, contact radius and lowered snout height, scaled with the wolf. */
export const SNOUT_REACH = .43 * WOLF_SCALE;
export const SNOUT_RADIUS = .12 * WOLF_SCALE;
export const SNOUT_HEIGHT = .12 * WOLF_SCALE;
export function rockRecipe(seed: number) {
  const rng = random(seed), shape = f('rock', 'shape', Math.floor(rng() * 9));
  const baseSize = Math.min(8, Math.floor(rng() ** 2.5 * 9)), tier = Math.floor(seed / TIER_MUL);
  return { shape, size: f('rock', 'sizeClass', tier >= 1 && tier <= 3 ? 8 + tier : baseSize),
    flipX: f('rock', 'flipX', rng() < .5 ? -1 : 1), flipY: f('rock', 'flipY', rng() < .5 ? -1 : 1),
    tilt: f('rock', 'tilt', rng() * Math.PI * 2), grey: f('rock', 'grey', .28 + rng() * .4) };
}
export function rockDiameter(e: Entity) { return ROCK_SIZES[rockRecipe(e.seed).size]; }

/** O(1) bilinear bedrock share and peat check from stage-3 soilGrid (same nodes as core/flora/site siteAt, zero heightAt/riverAt calls). */
export function fastRockSite(x: number, z: number) {
  if (!STAGES.on) return { rock: 0, peat: false };
  const S = soilGrid(STAGES.seed), n = S.n, cell = S.cell, fx = x / cell, fz = z / cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  let rock = 0, bestW = -1, bestKind = 0;
  for (let di = 0; di <= 1; di++) for (let dj = 0; dj <= 1; dj++) {
    const w = (di ? u : 1 - u) * (dj ? v : 1 - v);
    const c = (((j + dj) % n + n) % n) * n + (((i + di) % n + n) % n), k = S.kind[c];
    if (k === 0) rock += w * .85;
    if (w > bestW && k !== 5) { bestW = w; bestKind = k; }
  }
  const gx = Math.floor(x / 2) * 2 + 1, gz = Math.floor(z / 2) * 2 + 1;
  const nearC = (((Math.round(gz / cell) % n) + n) % n) * n + (((Math.round(gx / cell) % n) + n) % n);
  return { rock, peat: bestKind === 4 || S.kind[nearC] === 4 };
}

/** Causal rock emergence & size tier from site geology and organic floor burial (Sims et al. 1997 NW Ontario FEC;
 *  Yi et al. 2009): pebbles shorter than the organic moss/LFH mat on deep forest floors (rock < 0.2) are buried, while
 *  Shield bedrock ridges (rock >= 0.35) expose whaleback outcrops (tier 3) and glacial erratic boulders (tiers 1-2). */
export function placeRockSeed(x: number, z: number, h: number, baseSeed: number, isCandidate = false): number | undefined {
  if (!isDryLand(x, z, h)) return undefined;
  if (!STAGES.on) return baseSeed;
  const s = fastRockSite(x, z);
  if (s.peat && s.rock < .25) return undefined;
  const u = random((baseSeed ^ 0x5bd1e995) | 0)();
  if (s.rock >= .2) {
    if (isCandidate) return baseSeed;
    if (s.rock >= .35) {
      if (u < .28 * s.rock) return withRockTier(baseSeed, 3);
      if (u < .56 * s.rock) return withRockTier(baseSeed, 2);
      if (u < .82 * s.rock) return withRockTier(baseSeed, 1);
      return baseSeed;
    }
    if (u < .22) return withRockTier(baseSeed, 2);
    if (u < .50) return withRockTier(baseSeed, 1);
    return baseSeed;
  }
  const rec = rockRecipe(baseSeed), rockHeight = ROCK_SIZES[rec.size] * ROCK_SHAPES[rec.shape][1];
  if (rockHeight > .22) return baseSeed;
  if (isCandidate) return undefined;
  if (h <= LEVEL.shore + .85 && u < .32) return withRockTier(baseSeed, 1);
  if (u < .04) return withRockTier(baseSeed, u < .012 ? 2 : 1);
  return undefined;
}

export function pushContact(player: { x: number; z: number; heading?: number }, rock: Entity) {
  if (rock.kind !== 'rock' || rockDiameter(rock) > .22 || player.heading === undefined) return undefined;
  const fx = -Math.sin(player.heading), fz = -Math.cos(player.heading);
  const dx = rock.x - player.x, dz = rock.z - player.z;
  if (dx * fx + dz * fz < SNOUT_REACH * .65) return undefined;
  const sx = player.x + fx * SNOUT_REACH, sz = player.z + fz * SNOUT_REACH;
  const radius = rockDiameter(rock) / 2;
  // Lowered snout sphere against the rock's spherical contact envelope.
  if (Math.hypot(rock.x - sx, rock.z - sz, radius - SNOUT_HEIGHT) > radius + SNOUT_RADIUS) return undefined;
  const sector = ((Math.round(Math.atan2(sz - rock.z, sx - rock.x) / (Math.PI / 3)) % 6) + 6) % 6;
  const angle = sector * Math.PI / 3;
  return { sector, dx: -Math.cos(angle) * PUSH_DISTANCE, dz: -Math.sin(angle) * PUSH_DISTANCE };
}
export function pushProgress(elapsed: number) {
  return smooth01((elapsed - .25) / .55);
}
