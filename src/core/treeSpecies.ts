/**
 * Tree species specs (Grok Bot), rule 2/3: a species is DATA; render/trees.ts has one builder per crown FORM, parameterised
 * by these rows. Sources: Burns & Honkala 1990, Silvics of North America (USDA Agric. Handb. 654) per-species chapters;
 * Farrar 1995, Trees in Canada (NRCan); wood SG12 from USDA FPL Wood Handbook GTR-190 (2010) Table 5-3a. Heights/DBH are
 * typical mature ranges; [verify] = from memory, still to be checked against the chapter.
 */
import type { Dist } from '../proc/rng';
export type CrownForm = 'spire' | 'open-pine' | 'broadleaf';
export interface TreeSpec {
  id: string; label: string; latin: string; form: CrownForm;
  height: [number, number];      // m, mature
  dbh: [number, number];         // cm, mature (trunk radius = dbh/200)
  crownWidth: number;            // crown diameter ÷ height
  crownBase: number;             // live crown base ÷ height
  wood: string;                  // MATERIALS id (density)
  /** bark: colours are sRGB; detail params drive the near-tier procedural bark (render/trees): lenticel row share, peel 0–1,
   * fissure 0–1 (furrow depth/darkness), inner = colour under peeling strips. */
  bark: { color: number; base: number; baseFrac: number; lenticel?: number; lenticelShare?: number; peel?: number; fissure?: number; inner?: number };
  leaf: { color: number; fall?: number; deciduous: boolean; flutter: number; sizeCm: number };
  litterfall: number;            // kg/m²/yr under canopy (core/ground)
  /** Per-tree attribute table: every tree samples these with proc/rng `sample` (truncated), traced to the inspector. */
  attr: {
    dbh: Dist;                   // cm at 1.3 m
    hd: { a: number; b: number; c: number; sd: number }; // Chapman–Richards H = 1.3 + a(1 − e^(−b·DBH))^c, lognormal residual SD
    crownRatio: Dist;            // live crown length ÷ height (1 − crown base)
    whorlSpacing: Dist;          // m between branch whorls/nodes (annual leader growth for conifers)
    perWhorl: Dist;              // branches per whorl/node
    angle: Dist;                 // branch insertion angle from the stem, degrees
    lengthRatio: Dist;           // branch length ÷ crown radius at that height
    taper: Dist;                 // Leonardo/pipe exponent Δ: r_parent^Δ = Σ r_child^Δ (Δ = 2 = area rule)
    droop: Dist;                 // gravitropic bend of branch tips, degrees below the insertion line
    divergence: Dist;            // phyllotactic divergence between successive branches, degrees
    deadZone: Dist;              // share of the stem below the crown carrying dead (self-pruned, persisting) branches
  };
  stand: number;                 // share of stems in Kenora-area stands (Lake of the Woods / ecoregion 4S) [verify]
  site: [number, number];        // wetness niche 0 dry sand – 1 lowland (stand weighting) [game mapping of silvics site notes]
  source: string;
}
export const TREE_SPECIES: TreeSpec[] = [
  { id: 'black-spruce', label: 'black spruce', latin: 'Picea mariana', form: 'spire', height: [9, 15], dbh: [15, 25], crownWidth: .18, crownBase: .1, wood: 'spruceWood',
    bark: { color: 0x4e3a2c, base: 0x3f3026, baseFrac: .2 }, leaf: { color: 0x1f3b2f, deciduous: false, flutter: .1, sizeCm: 1 }, litterfall: .121, stand: .2, site: [.5, 1],
    attr: { dbh: { mean: 18, sd: 5, min: 6, max: 35 }, hd: { a: 16, b: .08, c: 1.2, sd: .12 }, crownRatio: { mean: .8, sd: .08, min: .5, max: .95 }, whorlSpacing: { mean: .25, sd: .08, min: .1, max: .5 }, perWhorl: { mean: 5, sd: 1, min: 3, max: 7 }, angle: { mean: 75, sd: 8, min: 55, max: 95 }, lengthRatio: { mean: .9, sd: .1, min: .6, max: 1.2 }, taper: { mean: 2, sd: .2, min: 1.6, max: 2.5 }, droop: { mean: 15, sd: 6, min: 0, max: 35 }, divergence: { mean: 72, sd: 10, min: 50, max: 95 }, deadZone: { mean: .8, sd: .1, min: .4, max: 1 } },
    source: 'Viereck & Johnston 1990 (Silvics); litterfall BFTCS, Norris et al. EGU 2012' },
  { id: 'white-spruce', label: 'white spruce', latin: 'Picea glauca', form: 'spire', height: [18, 30], dbh: [30, 60], crownWidth: .25, crownBase: .1, wood: 'spruceWood',
    bark: { color: 0x5a4636, base: 0x4a392c, baseFrac: .25 }, leaf: { color: 0x2e5a4a, deciduous: false, flutter: .1, sizeCm: 2 }, litterfall: .121, stand: .07, site: [.3, .7],
    attr: { dbh: { mean: 35, sd: 10, min: 10, max: 70 }, hd: { a: 30, b: .04, c: 1.2, sd: .12 }, crownRatio: { mean: .75, sd: .08, min: .5, max: .95 }, whorlSpacing: { mean: .4, sd: .1, min: .15, max: .7 }, perWhorl: { mean: 5, sd: 1, min: 3, max: 8 }, angle: { mean: 80, sd: 8, min: 60, max: 100 }, lengthRatio: { mean: .95, sd: .1, min: .6, max: 1.2 }, taper: { mean: 2, sd: .2, min: 1.6, max: 2.5 }, droop: { mean: 20, sd: 6, min: 0, max: 40 }, divergence: { mean: 72, sd: 10, min: 50, max: 95 }, deadZone: { mean: .6, sd: .15, min: .2, max: 1 } },
    source: 'Nienstaedt & Zasada 1990 (Silvics) [verify]' },
  { id: 'balsam-fir', label: 'balsam fir', latin: 'Abies balsamea', form: 'spire', height: [12, 18], dbh: [30, 45], crownWidth: .2, crownBase: .05, wood: 'firWood',
    bark: { color: 0x7d7a72, base: 0x5f5a52, baseFrac: .15 }, leaf: { color: 0x234a35, deciduous: false, flutter: .1, sizeCm: 2.5 }, litterfall: .15, stand: .08, site: [.4, .8],
    attr: { dbh: { mean: 28, sd: 8, min: 8, max: 50 }, hd: { a: 20, b: .06, c: 1.1, sd: .1 }, crownRatio: { mean: .85, sd: .07, min: .6, max: .97 }, whorlSpacing: { mean: .3, sd: .08, min: .1, max: .6 }, perWhorl: { mean: 4.5, sd: .8, min: 3, max: 6 }, angle: { mean: 85, sd: 6, min: 70, max: 100 }, lengthRatio: { mean: .9, sd: .1, min: .6, max: 1.2 }, taper: { mean: 2, sd: .2, min: 1.6, max: 2.5 }, droop: { mean: 5, sd: 4, min: 0, max: 20 }, divergence: { mean: 80, sd: 10, min: 55, max: 100 }, deadZone: { mean: .6, sd: .15, min: .2, max: 1 } },
    source: 'Frank 1990 (Silvics); grey bark with resin blisters [verify litterfall]' },
  { id: 'jack-pine', label: 'jack pine', latin: 'Pinus banksiana', form: 'open-pine', height: [17, 20], dbh: [20, 30], crownWidth: .3, crownBase: .5, wood: 'pineWood',
    bark: { color: 0x6a4a35, base: 0x55392a, baseFrac: .3 }, leaf: { color: 0x3d5e33, deciduous: false, flutter: .1, sizeCm: 3 }, litterfall: .11, stand: .2, site: [0, .4],
    attr: { dbh: { mean: 24, sd: 6, min: 8, max: 45 }, hd: { a: 21, b: .07, c: 1.1, sd: .1 }, crownRatio: { mean: .45, sd: .1, min: .2, max: .7 }, whorlSpacing: { mean: .45, sd: .12, min: .15, max: .8 }, perWhorl: { mean: 4, sd: 1, min: 2, max: 6 }, angle: { mean: 55, sd: 10, min: 30, max: 80 }, lengthRatio: { mean: .8, sd: .15, min: .4, max: 1.2 }, taper: { mean: 2, sd: .2, min: 1.6, max: 2.5 }, droop: { mean: 5, sd: 5, min: 0, max: 25 }, divergence: { mean: 90, sd: 15, min: 50, max: 130 }, deadZone: { mean: .5, sd: .15, min: .1, max: .9 } },
    source: 'Rudolph & Laidly 1990 (Silvics); litterfall Norris et al. EGU 2012' },
  // Paper birch bark is strongly reflective: visible reflectance ≈ 0.55–0.65 (betulin-rich outer bark; published white-birch bark spectra
  // ) [verify source: value from memory] → linear albedo ≈ 0.63 (sRGB 0xd3d1c9). Peels in papery strips showing orange-pink inner bark.
  { id: 'paper-birch', label: 'paper birch', latin: 'Betula papyrifera', form: 'broadleaf', height: [15, 21], dbh: [25, 35], crownWidth: .45, crownBase: .45, wood: 'birchWood',
    bark: { color: 0xd3d1c9, base: 0x4a4038, baseFrac: .08, lenticel: 0x3a3430, lenticelShare: .35, peel: .8, fissure: .4, inner: 0xc98a62 }, leaf: { color: 0x6f9a3c, fall: 0xd9b43a, deciduous: true, flutter: .5, sizeCm: 7 },
    litterfall: .25, stand: .12, site: [.3, .7], attr: { dbh: { mean: 28, sd: 7, min: 8, max: 50 }, hd: { a: 21, b: .07, c: 1.1, sd: .1 }, crownRatio: { mean: .55, sd: .1, min: .3, max: .8 }, whorlSpacing: { mean: .8, sd: .25, min: .3, max: 1.6 }, perWhorl: { mean: 1, sd: .3, min: 1, max: 2 }, angle: { mean: 40, sd: 10, min: 20, max: 65 }, lengthRatio: { mean: .9, sd: .15, min: .5, max: 1.3 }, taper: { mean: 2.1, sd: .2, min: 1.7, max: 2.6 }, droop: { mean: 25, sd: 10, min: 0, max: 50 }, divergence: { mean: 137.5, sd: 8, min: 110, max: 160 }, deadZone: { mean: .2, sd: .1, min: 0, max: .5 } },
    source: 'Safford et al. 1990 (Silvics) [verify]' },
  // Trembling aspen: 20–25 m, DBH 20–30 cm (Perala 1990, Silvics); bark smooth greenish-white with dark diamond/horizontal lenticels,
  // black furrowed at the base; leaves nearly round 4–7 cm on laterally FLATTENED petioles → flutter in light wind (Niklas 1991,
  // Am. J. Bot. 78:989); golden-yellow in fall; SG12 0.38. BOREAS SSA aspen litterfall ~0.25–0.4 kg/m²/yr (Gower et al. 1997) [verify].
  { id: 'trembling-aspen', label: 'trembling aspen', latin: 'Populus tremuloides', form: 'broadleaf', height: [20, 25], dbh: [20, 30], crownWidth: .35, crownBase: .55, wood: 'aspenWood',
    bark: { color: 0xc9d0b4, base: 0x2e2a26, baseFrac: .1, lenticel: 0x2b2826, lenticelShare: .2, peel: 0, fissure: .7, inner: 0x9a9a78 }, leaf: { color: 0x7fa83a, fall: 0xe6b422, deciduous: true, flutter: 1, sizeCm: 5 },
    litterfall: .25, stand: .25, site: [.2, .7], attr: { dbh: { mean: 25, sd: 6, min: 8, max: 50 }, hd: { a: 25, b: .06, c: 1.2, sd: .1 }, crownRatio: { mean: .4, sd: .08, min: .2, max: .6 }, whorlSpacing: { mean: .9, sd: .25, min: .3, max: 1.8 }, perWhorl: { mean: 1, sd: .3, min: 1, max: 2 }, angle: { mean: 45, sd: 10, min: 25, max: 70 }, lengthRatio: { mean: .85, sd: .15, min: .5, max: 1.3 }, taper: { mean: 2.1, sd: .2, min: 1.7, max: 2.6 }, droop: { mean: 10, sd: 6, min: 0, max: 30 }, divergence: { mean: 137.5, sd: 8, min: 110, max: 160 }, deadZone: { mean: .3, sd: .1, min: 0, max: .6 } },
    source: 'Perala 1990 (Silvics); Niklas 1991; Gower et al. 1997' },
  // Balsam poplar: 18–24 m, DBH 30–60 cm (Zasada & Phipps 1990, Silvics); young bark smooth greenish-brown, mature grey and deeply
  // furrowed; leaves ovate-lanceolate 7–12 cm on ROUND petioles (little flutter), resinous fragrant buds; yellow in fall; SG12 0.34 [verify].
  { id: 'balsam-poplar', label: 'balsam poplar', latin: 'Populus balsamifera', form: 'broadleaf', height: [18, 24], dbh: [30, 60], crownWidth: .4, crownBase: .5, wood: 'poplarWood',
    bark: { color: 0x8d8a7e, base: 0x5c584f, baseFrac: .5, lenticel: 0x6a675e, lenticelShare: .05, peel: 0, fissure: 1, inner: 0x6d5a45 }, leaf: { color: 0x58803a, fall: 0xd2a72e, deciduous: true, flutter: .35, sizeCm: 10 },
    litterfall: .25, stand: .05, site: [.6, 1], attr: { dbh: { mean: 40, sd: 12, min: 10, max: 80 }, hd: { a: 26, b: .05, c: 1.2, sd: .1 }, crownRatio: { mean: .45, sd: .1, min: .25, max: .7 }, whorlSpacing: { mean: 1, sd: .3, min: .4, max: 2 }, perWhorl: { mean: 1, sd: .3, min: 1, max: 2 }, angle: { mean: 35, sd: 8, min: 20, max: 60 }, lengthRatio: { mean: .85, sd: .15, min: .5, max: 1.3 }, taper: { mean: 2.1, sd: .2, min: 1.7, max: 2.6 }, droop: { mean: 10, sd: 6, min: 0, max: 30 }, divergence: { mean: 137.5, sd: 8, min: 110, max: 160 }, deadZone: { mean: .25, sd: .1, min: 0, max: .6 } },
    source: 'Zasada & Phipps 1990 (Silvics) [verify litterfall]' },
];
// Attribute tables [verify]: DBH and crown ratios from Burns & Honkala 1990 (Silvics) chapter ranges; Chapman–Richards
// coefficients are fitted by hand to those ranges pending Ontario FRI / Peng et al. 2001 (Can. J. For. Res. 31:1) values;
// whorl spacing = annual leader growth on medium sites; branch angles/droop from silvics crown descriptions; Δ ≈ 2 ± 0.2
// (Leonardo's rule measured in 7 tree species: Minamino & Tateno 2014, Am. J. Bot. 101:2059); broadleaf 2/5 phyllotaxis →
// mean divergence 137.5° (golden angle; Jean 1994, Phyllotaxis); conifer whorl branches evenly spaced (360°/n).
export const chapmanRichards = (dbh: number, hd: { a: number; b: number; c: number }) => 1.3 + hd.a * (1 - Math.exp(-hd.b * dbh)) ** hd.c;
export const TREE_BY_ID = Object.fromEntries(TREE_SPECIES.map(s => [s.id, s]));
/** Stand mix at a site of wetness w (0 dry – 1 wet): weight = stand share × triangular niche fit. Cumulative table for `choose`. */
export function standTable(wet: number) {
  const w = TREE_SPECIES.map(s => { const [a, b] = s.site, mid = (a + b) / 2, half = (b - a) / 2 + .25; return s.stand * Math.max(.02, 1 - Math.abs(wet - mid) / half); });
  const sum = w.reduce((p, c) => p + c, 0); let acc = 0;
  return TREE_SPECIES.map((s, i) => [s.id, i === TREE_SPECIES.length - 1 ? 1 : (acc += w[i] / sum)] as const);
}
/** Leaf phenology for deciduous species in NW Ontario (day of year): leaf-out ~May 15–25, colouring mid-Sept, leaf-off ~Oct 10
 * (Environment Canada PlantWatch aspen bud-burst/leaf-out records for Manitoba/NW Ontario) [verify]. Returns fall-colour 0..1 and leaf-off 0..1. */
export function phenology(day: number) {
  const s = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const out = s(135, 150, day), colour = s(255, 278, day), off = Math.max(1 - out, s(278, 290, day));
  return { colour, off };
}
