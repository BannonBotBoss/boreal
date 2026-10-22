/**
 * Species needs records (instances of core/needs/template SpeciesTemplate) and the registry. One file for all species
 * (PROJECT-RULES: no species-specific source files). Add a creature: copy _template.ts's record here, fill it, register it.
 */
import { S, type SpeciesTemplate } from '../template';

/** Gray wolf (Canis lupus), the player's default body. Every number sourced; `est` marks estimates. Number table:
 *  tasks/handoffs/T-0036-grok.md. Derived values are computed in tests/needs.test.ts from the formulas named here. */
const NAGY_PETERSON = 'Nagy & Peterson 1988, Scaling of water flux rate in animals (UC Publ Zool 120): eutherians 0.326 g^0.818 mL/d (115 points, 42 species)';
const NAGY_FMR = 'Nagy, Girard & Brown 1999, Annu Rev Nutr 19:247, Table 2 eq 2: eutherians FMR = 4.21 g^0.772 kJ/d';
export const WOLF_NEEDS: SpeciesTemplate = {
  id: 'wolf', name: 'Gray Wolf',
  body: {
    massKg: S(40, 'core/species MAMMALS Gray Wolf row; adults 30-50 kg (Mech & Boitani 2003, Wolves, ch. 1)'),
    fmrKjPerDay: S(15034, `${NAGY_FMR} at 40 kg`, 'allometric: no doubly-labelled-water FMR for wild gray wolves found'),
    speeds: {
      walk: S(2, 'core/wolfModes modeSpeed.walk (game control speed)'),
      run: S(4, 'core/wolfModes modeSpeed.run; wolves lope 2.2-2.5 m/s (8-9 km/h) for hours (Mech & Boitani 2003)'),
      sprint: S(7, 'core/wolfModes modeSpeed.sprint; real top speed 15.5-17.8 m/s (56-64 km/h, Mech & Boitani 2003)', 'game speed below the real top speed'),
    },
  },
  stamina: {
    sprintSeconds: S(12, "Matthew's minimum 10 s + 20 % margin", 'game design: a real wolf chased an arctic hare for 6-7 min (Mech 2007, "An example of endurance in an old wolf", USGS publication) and lopes for hours'),
    runSeconds: S(36, "Matthew's minimum 30 s + 20 % margin", 'game design: real wolves travel 0.92 km/h averaged over the day (Theuerkauf et al. 2003, J Mammal 84:243) and >72 km/day'),
    recoverSeconds: S(10, 'unchanged game calibration (core/wolfModes recovery 10/s before T-0036)', 'game calibration; mammalian phosphocreatine resynthesis half-time ~30 s (human muscle)'),
  },
  needs: {
    water: {
      turnoverMlPerDay: S(1895, `${NAGY_PETERSON} at 40 kg = 47 mL/kg/day`, 'allometric; within the 40-60 mL/kg/day maintenance water of dogs (NRC 2006)'),
      criticalDeficit: S(.12, 'AAHA 2024 Fluid Therapy Guidelines for dogs and cats, Table 3: 10-12 % dehydration severe, >12 % shock/death'),
      drinkMlPerS: S(7.5, '~2.5 mL per lap (Gart et al. 2015 PNAS 112:15798, citing their ref 24) x ~3 laps/s', 'lap rate read from Gart et al. Fig. 3B for a ~40 kg dog (f ~ M^-1/6)'),
      heatPerC: S(.04, 'panting evaporative loss rises above the thermoneutral zone', 'estimate: no wolf evaporative-loss vs temperature curve found'),
      heatAboveC: S(20, 'upper end of comfortable air temperature for a winter-furred canid', 'estimate'),
      foodWaterMlPerKg: { hare: S(650, 'mammal whole-body water 60-70 % of mass (lean tissue ~73 %; Pace & Rathbun 1945, J Biol Chem 158:685)', 'whole-carcass value assumed for the eaten parts') },
    },
    energy: { meaning: '100 Energy = one day of field metabolic rate (15 MJ); same convention as the hare (core/agent HARE_AGENT)', fullSeconds: S(86400, `${NAGY_FMR}: 100 per day at the daily-average rate`) },
    rest: {
      activeHoursToEmpty: S(7, 'longest activity bout of radio-tracked wolves (Theuerkauf et al. 2003, J Mammal 84:243)'),
      restHoursToFull: S(8.5, 'activity 45.2 % of the day (Theuerkauf et al. 2003): 7 h x 54.8/45.2 = 8.5 h of rest repays 7 h active'),
    },
  },
  behaviour: {
    activity: {
      pattern: 'crepuscular', activeShare: S(.452, 'Theuerkauf et al. 2003: active 45.2 % of the time, peaks at dawn and dusk'),
      offPeak: S(.35, 'Theuerkauf et al. 2003 Fig. 1: troughs at midday and midnight still ~30-40 % active', 'read from the figure'),
    },
    drives: {
      water: { goal: 'drink', seekBelow: S(85, 'drinking starts at ~1-2 % body-water deficit (dogs; osmotic thirst threshold): 1.8 % of 12 % = 85 %', 'dog physiology applied to wolves') },
      energy: { goal: 'hunt', seekBelow: S(60, 'wolves travel and hunt more in the 2 h before a kill (Theuerkauf et al. 2003)', 'estimate: no hunger threshold measured') },
      rest: { goal: 'bed-down', seekBelow: S(30, 'mean inactivity bout 1.02 h (Theuerkauf et al. 2003) restores ~12 %', 'estimate of when a bed-down is chosen') },
    },
    gaitAt: S<[number, number]>([.5, .9], 'urgency at which the walk becomes a run / sprint', 'game calibration'),
    alert: { reactSeconds: S(.5, 'head-up assessment before acting', 'estimate'), freeze: false },
    flight: { fears: ['person'], distanceM: S(100, 'wolves usually retreat from people on foot at tens to hundreds of metres', 'estimate: no single measured wolf flight distance found; order of magnitude') },
  },
};

/** Snowshoe hare (Lepus americanus): the second species that proves the template is generic. Behaviour numbers mirror
 *  core/agent HARE_AGENT (grok/rabbit-clover, T-0009) with the same sources; T-0009 locomotion/look code is not touched. */
export const HARE_NEEDS: SpeciesTemplate = {
  id: 'hare', name: 'Snowshoe Hare',
  body: {
    massKg: S(1.5, 'core/species MAMMALS Snowshoe Hare row; ADW 1.43-1.55 kg'),
    fmrKjPerDay: S(1113, 'free-ranging winter DLW 742 kJ/kg/day (Differential sex-related winter energetics in snowshoe hares, Can J Zool 2015, doi:10.1139/cjz-2015-0074) x 1.5 kg; Nagy 1999 eutherian eq. predicts 1192 (93 %)'),
    speeds: {
      walk: S(1.2, 'HARE_AGENT speed.approach (relaxed hop)'),
      run: S(2.91, 'preferred gallop 2.78 M^0.116 (Heglund & Taylor 1988, JEB 138:301) at 1.5 kg'),
      sprint: S(8.5, 'HARE_AGENT speed.flee; top 11.6 m/s (Seton 1928 via MacLulich 1937)'),
    },
  },
  stamina: {
    sprintSeconds: S(8, "HARE_AGENT levels.stamina.drainSeconds (Matthew's numbers)"),
    runSeconds: S(24, '3x the sprint, as for the wolf (36 / 12)', 'estimate: no hare endurance data'),
    recoverSeconds: S(8, "HARE_AGENT levels.stamina.recoverSeconds (Matthew's numbers)"),
  },
  needs: {
    water: {
      turnoverMlPerDay: S(129, 'Nagy & Peterson 1988 eutherian 0.326 g^0.818 mL/d at 1.5 kg', 'allometric: no snowshoe hare water flux found'),
      criticalDeficit: S(.12, 'AAHA 2024 (dogs) >12 % dehydration = shock', 'dog value applied to a lagomorph'),
      drinkMlPerS: S(.5, 'small-mammal lapping', 'estimate: no leporid drinking rate found'),
      heatPerC: S(.04, 'as the wolf', 'estimate'), heatAboveC: S(20, 'as the wolf', 'estimate'),
      foodWaterMlPerKg: { clover: S(830, 'fresh white clover ~17 % dry matter (Feedipedia, white clover fresh herbage)', 'leaf-stage average') },
    },
    energy: { meaning: '100 Energy = one day of food, 167 g DM (HARE_AGENT, UMT thesis)', fullSeconds: S(86400, 'HARE_AGENT levels.energy.drain = 100/86400 per s') },
    rest: {
      activeHoursToEmpty: S(14, 'winter movement 18:00-08:00 (Feierabend & Kielland 2014, J Mammal, doi:10.1644/13-MAMM-A-199)', 'window length used as the longest bout'),
      restHoursToFull: S(14, 'active ~50 % of the day (accelerometers, Studd et al. 2019, Front Ecol Evol, doi:10.3389/fevo.2019.00154): rest repays activity 1:1'),
    },
  },
  behaviour: {
    activity: { pattern: 'nocturnal', activeShare: S(.5, 'Studd et al. 2019: ~50 % foraging, mostly at night'), offPeak: S(.2, 'daylight mainly rest (Studd et al. 2019)', 'read from text') },
    drives: {
      water: { goal: 'drink', seekBelow: S(50, 'hares meet most water from food and snow (fresh clover 83 % water)', 'estimate') },
      energy: { goal: 'forage', seekBelow: S(80, 'HARE_AGENT levels.energy.fed (above it, no hunger)') },
      rest: { goal: 'bed-down', seekBelow: S(30, 'as the wolf', 'estimate') },
    },
    gaitAt: S<[number, number]>([.5, .9], 'as the wolf', 'game calibration'),
    alert: { reactSeconds: S(1, 'HARE_AGENT timing.react: freeze first (Emmel 2024 UMT MSc; Chapman & Flux 2008)', 'read from the reference video'), freeze: true },
    flight: { fears: ['wolf'], distanceM: S(3.7, 'mean flight initiation distance, 224 approaches (Emmel 2024, UMT MSc, Fig. 1)') },
  },
};

export const NEEDS_SPECIES: Record<string, SpeciesTemplate> = { wolf: WOLF_NEEDS, hare: HARE_NEEDS };
