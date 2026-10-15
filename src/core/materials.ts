/**
 * Shared physical MATERIALS (particle/tissue density, kg/m³) and COMPOSITIONS (volume fractions per region/part).
 * Rule 5 (PROJECT-RULES): real-world values only, one citation comment per row. Rows marked [verify] are taken from
 * the cited source from memory or derived; they still need checking against the original table.
 * Masses are never assigned: mass = Σ region volume (from generated geometry) × composition-weighted density.
 */
export const MATERIALS: Record<string, number> = {
  // Soft tissue / bone: ICRU Report 44 (1989), Tissue Substitutes in Radiation Dosimetry, Table 4.1 [verify]
  bone: 1920,       // cortical bone 1.92 g/cm³ (ICRU 44)
  muscle: 1050,     // skeletal muscle 1.05 g/cm³ (ICRU 44)
  fat: 950,         // adipose tissue 0.95 g/cm³ (ICRU 44)
  organ: 1060,      // liver/soft tissue 1.06 g/cm³ (ICRU 44)
  blood: 1060,      // whole blood 1.06 g/cm³ (ICRU 44)
  cartilage: 1100,  // cartilage 1.10 g/cm³ (ICRU 44)
  keratin: 1300,    // hair keratin ~1.30 g/cm³ (Robbins, Chemical and Physical Behavior of Human Hair, 5th ed., 2012) [verify]
  air: 1.204,       // dry air at 20 °C, 101.325 kPa (ISO 2533 standard atmosphere / CRC Handbook)
  water: 998,       // liquid water at 20 °C (CRC Handbook of Chemistry and Physics)
  // Wood at 12 % moisture: density ≈ SG12 × 1000 × 1.12; SG12 from USDA FPL Wood Handbook (GTR-190, 2010) Table 5-3a [verify]
  spruceWood: 450,  // black/white spruce SG12 0.38–0.42 → 430–470 kg/m³
  pineWood: 480,    // jack pine SG12 0.43
  birchWood: 615,   // paper birch SG12 0.55
  aspenWood: 425,   // quaking aspen SG12 0.38
  bark: 400,        // conifer bark SG ~0.3–0.5 (Miles & Smith 2009, USDA FPL Research Note FPL-RN-0315) [verify]
  foliage: 950,     // fresh needle/leaf tissue: dry leaf density 0.3–0.5 g/cm³ (Niinemets 2001, Ecology 82:453) + ~55–60 % water [derived, verify]
  organicSolid: 1450, // particle density of soil organic matter 1.1–1.5 g/cm³ (Rühlmann et al. 2006, Geoderma 130:272) [verify]
  // Minerals: Klein & Dutrow, Manual of Mineral Science, 23rd ed. (2007), mineral descriptions
  quartz: 2650, feldspar: 2560 /* orthoclase 2.55–2.63 */, mica: 2830 /* muscovite 2.76–2.88 */, plagioclase: 2690,
  pyroxene: 3400 /* augite 3.2–3.6 */, olivine: 3270 /* forsterite */, hornblende: 3200 /* 3.0–3.4 */,
};
export type Mix = Record<string, number>; // material id -> volume fraction (sums to 1, tested)
/** Fur coat: keratin with trapped air. Coat bulk density ~0.08 of keratin for mammalian winter pelage [verify: Scholander et al. 1950 measured insulation, not density]. */
const fur: Mix = { keratin: .08, air: .92 };
/** Mammal regions. Whole-body fractions follow mammalian body composition (muscle ~45 %, skeleton ~13 %, blood ~7 %: Prothero 1995;
 * lung volume ~53.5 ml/kg, Gehr et al. 1981, Respir. Physiol. 44:61 → ~9 % of the torso) [verify per-region split]. */
const mammal = (furShare: number): Record<string, Mix> => {
  const coat = (m: Mix) => Object.fromEntries([...Object.entries(m).map(([k, v]) => [k, v * (1 - furShare)]), ...Object.entries(fur).map(([k, v]) => [k, (m[k] ?? 0) * (1 - furShare) + v * furShare])]);
  return {
    torso: coat({ muscle: .42, bone: .1, fat: .1, organ: .22, blood: .07, air: .09 }),
    neck: coat({ muscle: .6, bone: .14, fat: .08, blood: .08, cartilage: .1 }),
    head: coat({ bone: .3, muscle: .32, organ: .28, blood: .05, cartilage: .05 }),
    legs: coat({ bone: .3, muscle: .52, fat: .06, blood: .07, cartilage: .05 }),
    tail: coat({ bone: .15, muscle: .25, fat: .05, blood: .05, cartilage: .5 }),
  };
};
/** Coat share of region volume per species [verify: no single published table; set from pelage depth vs body radius]. */
export const COMPOSITIONS: Record<string, Record<string, Mix>> = {
  canid: mammal(.12), cervid: mammal(.06), ursid: mammal(.14), leporid: mammal(.2), human: mammal(0),
  // Green stems ~50 % moisture of oven-dry mass in spruce (Wood Handbook ch. 4) → water share of volume; crowns are mostly air.
  tree: { trunk: { spruceWood: .85, bark: .1, water: .05 }, crownConifer: { foliage: .35, spruceWood: .25, bark: .05, water: .1, air: .25 },
    crownBroadleaf: { foliage: .3, birchWood: .25, bark: .05, water: .1, air: .3 } },
  log: { body: { spruceWood: .8, bark: .08, water: .12 } },
  plant: { body: { foliage: .7, water: .25, air: .05 } },
  // Modal compositions: granite/gneiss/basalt typical modes (Philpotts & Ague, Principles of Igneous and Metamorphic Petrology, 2009) [verify]
  rock: { granite: { quartz: .3, feldspar: .6, mica: .1 }, gneiss: { quartz: .25, feldspar: .5, mica: .15, hornblende: .1 }, basalt: { plagioclase: .5, pyroxene: .4, olivine: .1 } },
};
export const density = (mix: Mix) => Object.entries(mix).reduce((d, [m, frac]) => d + MATERIALS[m] * frac, 0);
export const describeMix = (mix: Mix) => Object.entries(mix).filter(([, v]) => v > .005).map(([m, v]) => `${m} ${Math.round(v * 100)}%`).join(', ');
export const RIG_BODY_PLAN: Record<string, string> = { wolf: 'canid', deer: 'cervid', bear: 'ursid', hare: 'leporid' };
