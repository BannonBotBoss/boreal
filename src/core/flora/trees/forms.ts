/**
 * Procedural tree crown forms (Grok Bot): Weber & Penn 1995 parameters per species id of core/treeSpecies, plus the
 * age -> size allometry and the colours measured from reference photos. Data only; render/trees/conifer builds from it.
 *
 * Black spruce (Picea mariana) references:
 *  - Crown "narrowly conic to spirelike; branches short and drooping, frequently layering" (Taylor 1993, Flora of North
 *    America vol. 2, via conifers.org); "lower branches drooping, lowest branches with tips upturned; tip often club-shaped;
 *    most trees have a cluster of persistent cones near the top" (Manitoba Field Guide to Trees, gov.mb.ca); the club is
 *    "the accumulation of several years of cone crops in the short crown branches" (Flora of Newfoundland & Labrador).
 *  - Needles 6-15 mm, 4-angled, stiff, blue-green and glaucous, spirally all round the twig (Taylor 1993; Manitoba guide).
 *  - Bark thin, scaly, grey-brown (Taylor 1993); inner bark olive-green (Manitoba guide).
 *  - Height-DBH: Peng et al. 2001 Chapman-Richards (core/treeSpecies attr.hd); crown width .18 x H (core/treeSpecies).
 *  - Photos: tools/tree-ref (Wikimedia Commons; SOURCES.json lists author, licence, place).
 */
import { TREE_BY_ID } from '../../treeSpecies';

/** Per child-level arrays: index 0 = trunk, 1 = primary branches, 2 = laterals ... */
export interface WPParams {
  levels: number;
  shape: number;          // W&P ShapeRatio of the trunk's children: 0 conical, 1 spherical, 2 hemispherical, ... 7 tend flame
  baseSize: number;       // bare (or dead) share of the trunk below the first live branch
  flare: number;          // trunk base swell (x radius at the ground)
  ratioPower: number;     // pipe model: child r = parent r x (child len / parent len)^ratioPower
  attractionUp: number;   // vertical tropism per stem, levels >= 2
  length: number[]; lengthV: number[];
  curveRes: number[]; curve: number[]; curveV: number[];
  downAngle: number[]; downAngleV: number[];
  rotate: number[]; rotateV: number[];
  whorlSize: number[];    // > 1 groups children into whorls at one node (conifer whorls)
  branches: number[];     // trunk: total children; deeper levels: children per metre of parent (branchSpacing form)
  radialSegments: number[];
  /** dead self-pruned stubs from deadFrom x baseSize up to baseSize (no foliage): share of whorls kept, stub length (x L1) */
  dead?: { from: number; keep: number; length: number };
  /** top band (share of the trunk) with denser, shorter, upturned shoots: density x, length x, down angle (deg) */
  club?: { frac: number; density: number; length: number; downAngle: number };
}
export interface TreeForm {
  id: string;
  wp: WPParams;
  /** height growth H(age) = 1.3 + (hMax - 1.3)(1 - e^(-k age))^p (Richards 1959 form) */
  growth: { hMax: number; k: number; p: number };
  /** foliage cards: spray width (m), share of each primary branch carrying cards (from the tip) */
  spray: { width: number; outer: number };
  /** sRGB colours: needles (sunlit, shade), bark, twig, cones */
  colour: { needle: number; shade: number; bark: number; twig: number; cone: number; palette: number[] };
}

export const TREE_FORMS: Record<string, TreeForm> = {
  'black-spruce': {
    id: 'black-spruce',
    wp: {
      levels: 3, shape: 0 /* conical */, baseSize: .2 /* 1 - crown ratio .8 (core/treeSpecies attr.crownRatio) */, flare: .35, ratioPower: 1.3, attractionUp: .25,
      //          trunk  L1     L2
      length:    [1,    .1,    .42],  lengthV: [0, .02, .1],   // L1 at the base = crownWidth/2 / H (.18 / 2 ~ .09-.11)
      curveRes:  [10,   4,     3],    curve: [0, -38, -10], curveV: [3, 20, 25], // drooping limbs with upturned tips (negative = tips up)
      downAngle: [0,    104,   55],   downAngleV: [0, 10, 15],                   // limbs below horizontal (drooping), laterals spread in a spray
      rotate:    [0,    36,    180],  rotateV: [0, 12, 35],                       // whorl offset 360/5/2; laterals alternate in the branch plane
      whorlSize: [1,    5,     1],                                                 // 5 per whorl (attr.perWhorl)
      branches:  [0,    0,     9],                                                 // L1 total from the whorl spacing (set per tree); L2 per metre of limb [game calibration]
      radialSegments: [10, 4, 3],
      dead: { from: .15, keep: .6, length: .35 },                                  // self-pruned stubs persist on the lower bole (attr.deadZone .8)
      club: { frac: .08, density: 2.2, length: .6, downAngle: 60 },                // dense upturned top band [game calibration from tools/tree-ref photos]
    },
    // Plonski (1974) Ontario normal yield tables, black spruce site class 1-2: ~11-15 m at 70-100 yr; hMax 16.5 = 1.1 x the
    // Silvics upper height (15 m). k, p fitted by eye to those points [verify against Plonski 1974 / Carmean et al. 1989].
    growth: { hMax: 16.5, k: .022, p: 1.6 },
    spray: { width: .24, outer: .85 },
    // Medians of reference photos (tools/tree-ref, measured on green pixels): close-up needles #5a7239 / #668944 (sunlit),
    // crown-level stands #4f5d4a / #57633a; bark close-up #897863 (with lichen; the trunk in shade reads darker). Cone: dark
    // purple ripening purple-brown (Taylor 1993).
    colour: { needle: 0x5a7239, shade: 0x2e3a26, bark: 0x6b5a4a, twig: 0x5b4636, cone: 0x4a3030, palette: [0x4a5c50, 0x52624a, 0x46594a, 0x566554, 0x415246] }, // palette: crown-level photo medians (#4f5d4a #57633a #556a53, refs in tools/tree-ref), blue raised to the near LOD's rendered hue [game calibration]
  },
};

/** Height (m) of a tree of this form at `age` years. */
export function heightAt(form: TreeForm, age: number) { const g = form.growth; return 1.3 + (g.hMax - 1.3) * (1 - Math.exp(-g.k * age)) ** g.p; }
/** DBH (cm) at height H: Peng et al. 2001 Chapman-Richards (core/treeSpecies) inverted; 0 below breast height. */
export function dbhAt(id: string, h: number) {
  const hd = TREE_BY_ID[id].attr.hd, x = (h - 1.3) / hd.a;
  return x <= 0 ? 0 : x >= .999 ? 80 : -Math.log(1 - x ** (1 / hd.c)) / hd.b;
}
