/**
 * Stand map (Grok Bot): pre-settlement (fire-driven) Kenora forest as a PURE function of seed + position — far = math.
 *  - Fire patches: seeded Voronoi cells (jittered grid, domain-warped edges), one stand-replacing fire history per patch.
 *  - Stand age = time since the last stand-replacing fire, drawn from Van Wagner's (1978, Can. J. For. Res. 8:220)
 *    negative-exponential age distribution f(a) = e^(−a/C)/C by inverse CDF: a = −C·ln(1 − U).
 *  - Fire cycle C ≈ 100 yr for the pre-settlement Rainy River / Lake of the Woods / BWCA landscape (Heinselman 1973,
 *    Quat. Res. 3:329: natural rotation ~100 yr; NW Ontario estimates 60–200 yr, e.g. Suffling et al. 1982) [verify].
 * ONE shared stand-structure function turns age (+ site wetness) into everything activated cells read: density,
 * diameter distribution, succession weights, canopy closure, snags, coarse woody debris, understory cover.
 */
import { hash, sample, type Dist } from '../proc/rng';
import { WORLD_SEED } from './world';

export const FIRE = {
  cycleYears: 100,   // C (yr), Heinselman 1973 [verify]; setting range 60–200
  patchM: 220,       // mean fire-patch spacing (m) in the game map [game scale: real NW Ontario fires reach 10³–10⁵ ha]
  maxAge: 400,       // oldest stands (cedar/fir ~300+ yr on fire-sheltered sites)
};
const u01 = (s: string) => hash(s) / 4294967296;
/** Van Wagner (1978) negative exponential: inverse CDF of stand age for U ∈ [0,1). */
export const ageFromU = (u: number, C = FIRE.cycleYears) => Math.min(FIRE.maxAge, -C * Math.log(1 - u));

/** Fire patch at (x, z): nearest seeded Voronoi site after a cheap domain warp (spatially coherent, deterministic). */
export function fireAt(x: number, z: number, seed = WORLD_SEED) {
  const P = FIRE.patchM, wx = x + 40 * Math.sin(z / 61 + seed % 7), wz = z + 40 * Math.sin(x / 53 + seed % 11);
  const gx = Math.floor(wx / P), gz = Math.floor(wz / P); let best = Infinity, id = '';
  for (let a = gx - 1; a <= gx + 1; a++) for (let b = gz - 1; b <= gz + 1; b++) {
    const sx = (a + u01(`fx:${seed}:${a}:${b}`)) * P, sz = (b + u01(`fz:${seed}:${a}:${b}`)) * P, d = (sx - wx) ** 2 + (sz - wz) ** 2;
    if (d < best) { best = d; id = `${a}:${b}`; }
  }
  return { id, age: ageFromU(u01(`fireage:${seed}:${id}`)) };
}

/** Succession class per species (shade tolerance; Burns & Honkala 1990): pioneers fade, tolerant species build up with age. */
export const SUCCESSION: Record<string, 'pioneer' | 'mid' | 'late'> = {
  'jack-pine': 'pioneer', 'trembling-aspen': 'pioneer', 'paper-birch': 'pioneer', 'balsam-poplar': 'pioneer',
  'black-spruce': 'mid', 'white-spruce': 'late', 'balsam-fir': 'late',
};
/** Species weight multiplier vs stand age: pioneers dominate 0–80 yr and break up after ~100–150 yr (aspen/jack pine
 *  longevity), shade-tolerant fir/spruce recruit beneath and dominate old stands (Bergeron 2000, Ecology 81:1500) [verify]. */
export function successionWeight(cls: 'pioneer' | 'mid' | 'late', age: number) {
  return cls === 'pioneer' ? .08 + Math.exp(-((Math.max(0, age - 60) / 70) ** 2)) : cls === 'late' ? .05 + (1 - Math.exp(-age / 90)) * 1.6 : 1;
}

/** The ONE stand-structure function: everything a cell needs from stand age and site wetness (0 dry … 1 wet). */
export function standStructure(age: number, wet = .5) {
  // stems/ha: self-thinning from dense post-fire regeneration (~10⁴/ha) to old-growth ~600–900/ha (Reineke-type decline;
  // boreal chronosequences, e.g. Harper et al. 2005 / Bergeron 2000) [verify]
  const stems = 650 + 9000 * Math.exp(-age / 18);
  // canopy closure: closes by ~30 yr, opens slightly in gap-phase old growth (>150 yr) (Harper et al. 2002) [verify]
  const canopy = Math.min(.95, .92 * (1 - Math.exp(-age / 14))) - .15 * Math.min(1, Math.max(0, (age - 150) / 100));
  // DBH age factor (0 → 1): stand mean diameter growth with age, used to shift each species' DBH distribution
  const growth = 1 - Math.exp(-age / 55);
  // uneven-aged (reverse-J) share of stems: develops after the first cohort breaks up (~100+ yr) (Bergeron 2000) [verify]
  const reverseJ = Math.min(.75, Math.max(0, (age - 90) / 120));
  // snags/ha: fire-killed peak decaying (half-life ~15 yr) + self-thinning/senescence mortality in old stands [verify]
  const snags = 400 * Math.exp(-age / 20) + 60 * (1 - Math.exp(-age / 120));
  // coarse woody debris (kg/m²): U-shaped (Sturtevant et al. 1997, Can. J. For. Res. 27:1803): fire legacy decaying at
  // k ≈ 0.03 /yr (boreal CWD k 0.02–0.05; Harmon et al. 1986) + recruitment rising with stand age
  const k = .03, legacy = 4.5 * Math.exp(-k * age), input = .1 * (1 - Math.exp(-age / 80)), cwd = legacy + input / k * (1 - Math.exp(-k * age)) * .5;
  // understory ground cover (fractions) under closed conifer canopy, NW Ontario FEC V-types (Sims et al. 1997) [verify]:
  const shade = Math.max(0, canopy - .5) / .45, old = 1 - Math.exp(-Math.max(0, age - 25) / 45);
  const cover = {
    feathermoss: Math.min(.85, .8 * old * shade * (1 - .4 * Math.abs(wet - .55))),  // Pleurozium schreberi, Hylocomium splendens
    sphagnum: Math.min(.7, .7 * old * Math.max(0, wet - .6) / .4),                  // wet lowlands (paludification)
    bunchberry: .12 * (1 - .5 * shade) + .04,                                         // Cornus canadensis
    twinflower: .08 * old,                                                            // Linnaea borealis
    clubmoss: .05 * old * shade,                                                      // Lycopodium spp.
    seedlings: .02 + .06 * old * shade,                                               // shade-tolerant fir/spruce advance regeneration
    shrubs: .5 * Math.exp(-age / 30) + .1,                                           // post-fire shrubs (Rubus, Prunus, Alnus)
  };
  return { age, stems, canopy, growth, reverseJ, snags, cwd, cover };
}
export type Stand = ReturnType<typeof standStructure>;

/** Stand at a position (seeded, pure). Cached per fire patch is unnecessary: it is a few hashes. */
export function standAt(x: number, z: number, wet = .5, seed = WORLD_SEED): Stand & { patch: string } {
  const f = fireAt(x, z, seed); return { ...standStructure(f.age, wet), patch: f.id };
}

/** DBH for one tree in a stand: even-aged cohort sampled from the species table shifted by stand growth (old canopy
 *  trees toward the upper bound); with probability `reverseJ` an understory stem from a de Liocourt (1898) negative-
 *  exponential diameter distribution (reverse-J), truncated to the species bounds. */
export function standDbh(r: () => number, d: Dist, s: Pick<Stand, 'growth' | 'reverseJ'>) {
  if (r() < s.reverseJ) { const q = (d.mean - d.min) * .45, x = d.min - q * Math.log(1 - r() * (1 - Math.exp(-(d.max - d.min) / q))); return x; }
  const mean = d.min + (d.mean - d.min) * (.35 + .65 * s.growth) + d.sd * Math.max(0, s.growth - .8) * 4; // old growth → toward upper bound
  return sample(r, { ...d, mean: Math.min(d.max - d.sd * .2, mean) });
}
