/**
 * Shared physical MATERIALS (kg/m³) and COMPOSITIONS (volume fractions of materials per body region / object part).
 * Masses are never assigned: mass = Σ region volume (from the generated geometry) × composition-weighted density.
 * Add a material or a composition = add one data entry. Fractions of every composition sum to 1 (tested).
 */
export const MATERIALS: Record<string, number> = {
  bone: 1900, muscle: 1060, fat: 900, organ: 1050, blood: 1060, keratin: 1300, air: 1.2, cartilage: 1100,
  heartwood: 560, sapwood: 480, bark: 340, needles: 900, leaves: 800, water: 1000, deadwood: 400, herb: 700,
  quartz: 2650, feldspar: 2560, mica: 2850, plagioclase: 2690, pyroxene: 3300, olivine: 3300, hornblende: 3200,
};
export type Mix = Record<string, number>; // material id -> volume fraction
/** Fur coat: keratin with trapped air (bulk factor ~8% keratin). */
const fur: Mix = { keratin: .08, air: .92 };
const mammal = (furShare: number): Record<string, Mix> => {
  const coat = (m: Mix) => Object.fromEntries([...Object.entries(m).map(([k, v]) => [k, v * (1 - furShare)]), ...Object.entries(fur).map(([k, v]) => [k, (m[k] ?? 0) * (1 - furShare) + v * furShare])]);
  return {
    torso: coat({ muscle: .42, bone: .1, fat: .1, organ: .22, blood: .07, air: .09 }), // lungs ~9% of torso
    neck: coat({ muscle: .6, bone: .14, fat: .08, blood: .08, cartilage: .1 }),
    head: coat({ bone: .3, muscle: .32, organ: .28, blood: .05, cartilage: .05 }),
    legs: coat({ bone: .3, muscle: .52, fat: .06, blood: .07, cartilage: .05 }),
    tail: coat({ bone: .15, muscle: .25, fat: .05, blood: .05, cartilage: .5 }),
  };
};
/** Per species (body plan) per region. Proposal for Claude: move these into species.ts specs (AGENT-NOTES). */
export const COMPOSITIONS: Record<string, Record<string, Mix>> = {
  canid: mammal(.12), cervid: mammal(.06), ursid: mammal(.14), leporid: mammal(.2),
  human: mammal(0),
  tree: { trunk: { heartwood: .45, sapwood: .4, bark: .1, water: .05 }, crownConifer: { needles: .35, sapwood: .25, bark: .05, water: .1, air: .25 }, crownBroadleaf: { leaves: .3, sapwood: .25, bark: .05, water: .1, air: .3 } },
  log: { body: { deadwood: .8, bark: .08, water: .12 } },
  plant: { body: { herb: .7, water: .25, air: .05 } },
  rock: { granite: { quartz: .3, feldspar: .6, mica: .1 }, gneiss: { quartz: .25, feldspar: .5, mica: .15, hornblende: .1 }, basalt: { plagioclase: .5, pyroxene: .4, olivine: .1 } },
};
/** Composition-weighted density (kg/m³) of a mix. */
export const density = (mix: Mix) => Object.entries(mix).reduce((d, [m, frac]) => d + MATERIALS[m] * frac, 0);
export const describeMix = (mix: Mix) => Object.entries(mix).filter(([, v]) => v > .005).map(([m, v]) => `${m} ${Math.round(v * 100)}%`).join(', ');
/** Which composition each playable/rig uses. */
export const RIG_BODY_PLAN: Record<string, string> = { wolf: 'canid', deer: 'cervid', bear: 'ursid', hare: 'leporid' };
