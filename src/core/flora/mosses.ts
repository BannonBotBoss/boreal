/**
 * Ground layer of the boreal forest floor (Grok Bot): feathermosses, reindeer lichens and peat mosses as COVER on the
 * terrain, not geometry (render/flora/moss draws them as a ground-shader layer). Niche = the same site gradients and
 * Gaussian suitability as the vascular flora (core/flora/site siteAt + suitability: soils, wetness, light under crowns).
 * Albedo is linear reflectance in the visible (R, G, B ≈ 650 / 550 / 470 nm). Sources:
 *  - Feathermosses (Pleurozium schreberi, Hylocomium splendens) carpet mesic conifer stands: mean cover 58 % in N Alberta
 *    spruce-fir (FEIS Cornus canadensis stand data), continuous under closed black/white spruce, sparse in open or broadleaf
 *    litter (Baldwin & Sims 1997, NWO forest plants; Bisbee et al. 2001 Oecologia 129:261) [verify].
 *  - Reindeer lichens (Cladonia rangiferina, C. stellaris, C. mitis) on dry open bedrock and jack pine outwash sand
 *    (lichen woodland; Baldwin & Sims 1997; Kershaw 1977 Can J Bot 55:393) [verify].
 *  - Sphagnum (S. fuscum, S. magellanicum, S. angustifolium) on saturated peat, hummocks red-brown (Vitt 2000, Bryophyte
 *    Biology ch. 10; Crum 1988) [verify].
 *  - Reflectance: feathermoss green peak ~8-10 %, red ~5 % (Bubier et al. 1997 Remote Sens Environ 61:116); dry Cladina mats
 *    20-35 % across the visible, albedo ~0.2-0.3 (Petzold & Goward 1988 Can J Bot 66:2279); Sphagnum green 6-10 % /
 *    red forms ~10 % red, 4 % green (Bubier 1997; Harris 2008) [verify].
 */
import { suitability, type Niche, type Site } from './site';

export interface GroundLayer { id: string; latin: string; niche: Niche; cover: number /* max share of the ground */; albedo: [number, number, number][] /* variants, linear */ }
export const GROUND_LAYERS: GroundLayer[] = [
  { id: 'feathermoss', latin: 'Pleurozium schreberi / Hylocomium splendens', cover: .9,
    niche: { wet: [.5, .3], light: [.25, .4], rock: .15, soils: { peat: .35, sand: .5, bedrock: .3, clay: 1, till: 1 } },
    albedo: [[.055, .09, .024], [.08, .088, .03]] }, // Pleurozium yellow-green, Hylocomium olive-brown
  { id: 'lichen', latin: 'Cladonia rangiferina / C. stellaris', cover: .85,
    niche: { wet: [.1, .28], light: [.9, .35], rock: 1, soils: { bedrock: 1, sand: 1, till: .25, clay: .05, peat: .05 } },
    albedo: [[.25, .26, .19], [.21, .23, .16]] },     // pale grey-green to cream; low end of the 0.2-0.3 mat albedo (texel mix of mats, crust and gaps)
  { id: 'sphagnum', latin: 'Sphagnum fuscum / magellanicum / angustifolium', cover: .95,
    niche: { wet: [.95, .15], light: [.6, .5], rock: 0, soils: { peat: 1, clay: .35, till: .2, sand: .05, bedrock: 0 } },
    albedo: [[.05, .09, .03], [.1, .045, .03]] },    // green lawns, red-brown hummocks
];

/** Ground-layer patch-noise octaves (render/flora/moss) at a LADDER foliage factor: Ultra/High 1 -> 5, Medium .8 -> 4, Low .6 and
 * Very low .4 -> 3, Minimum .25 -> 2, 0 -> layer off. A uniform, so tier changes never recompile the terrain shader. */
export const mossOctaves = (foliage: number) => foliage <= 0 ? 0 : Math.max(2, Math.min(5, Math.round(1 + 4 * foliage)));

/** Cover share of each ground layer at a site (sums to ≤ 1; the rest is litter / bare soil / rock). */
export function groundCover(s: Site): number[] {
  const w = GROUND_LAYERS.map(l => l.cover * suitability(l.niche, s)), t = w.reduce((a, b) => a + b, 0);
  return t > 1 ? w.map(v => v / t) : w;
}
