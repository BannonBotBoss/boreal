/**
 * COPY ME to add a creature (notes/skills/species-needs-template.md). Replace every NaN with a sourced number, write the
 * source in `src` (paper + table/figure, agency page, or the derivation from other sourced numbers), and put the reason in
 * `est` when it is an estimate. Then paste it into species/index.ts as <ID>_NEEDS and register it. No engine code changes.
 */
import { S, type SpeciesTemplate } from '../template';
const TODO = 'TODO: source';
export const TEMPLATE_SPECIES: SpeciesTemplate = {
  id: 'template', name: 'Common Name As In core/species MAMMALS',
  body: {
    massKg: S(NaN, TODO), // adult mass; reuse the MAMMALS row
    fmrKjPerDay: S(NaN, TODO), // doubly labelled water if measured; else Nagy, Girard & Brown 1999 eutherian 4.21 g^0.772 kJ/d
    speeds: { walk: S(NaN, TODO), run: S(NaN, TODO), sprint: S(NaN, TODO) }, // m/s of the gaits its controls/agent use
  },
  stamina: { sprintSeconds: S(NaN, TODO), runSeconds: S(NaN, TODO), recoverSeconds: S(NaN, TODO) }, // REAL seconds
  needs: {
    water: {
      turnoverMlPerDay: S(NaN, TODO), // measured water flux; else Nagy & Peterson 1988 eutherian 0.326 g^0.818 mL/d
      criticalDeficit: S(NaN, TODO), // body-mass share lost at 0 % (AAHA 2024 dogs: >12 % = shock)
      drinkMlPerS: S(NaN, TODO), heatPerC: S(NaN, TODO), heatAboveC: S(NaN, TODO),
      foodWaterMlPerKg: {}, // per food kind it eats
    },
    energy: { meaning: '100 = one day of FMR', fullSeconds: S(86400, 'convention shared by every species (one day of food)') },
    rest: { activeHoursToEmpty: S(NaN, TODO), restHoursToFull: S(NaN, TODO) },
  },
  behaviour: {
    activity: { pattern: 'cathemeral', activeShare: S(NaN, TODO), offPeak: S(NaN, TODO) },
    drives: { water: { goal: 'drink', seekBelow: S(NaN, TODO) }, energy: { goal: 'forage', seekBelow: S(NaN, TODO) }, rest: { goal: 'bed-down', seekBelow: S(NaN, TODO) } },
    gaitAt: S<[number, number]>([NaN, NaN], TODO),
    alert: { reactSeconds: S(NaN, TODO), freeze: false },
    flight: { fears: [], distanceM: S(NaN, TODO) },
  },
};
