/**
 * SPECIES NEEDS + BEHAVIOUR TEMPLATE (Grok Bot, T-0036; Matthew: "like a template", "with all needs", any creature can be
 * embodied later). ONE typed data shape. A new creature = copy `species/_template.ts`, fill every slot with a sourced number,
 * register it in `species/index.ts` (records live in that one file). The engine (core/needs/engine), the behaviour chooser (core/needs/behaviour) and the
 * thought bubbles (core/needs/thoughts, render/thoughtBubbles) have NO species numbers and need no code change.
 *
 * Every number is a `Sourced`: { v, src, est? }. `src` names the paper/agency/derivation; `est` (when present) says why it
 * is an estimate and what it was read from. tests/needs.test.ts fails on a number with an empty `src`.
 *
 * Units: mass kg; rates per day or per hour of GAME time (the world clock: core/timeOfDay REAL_SECONDS_PER_GAME_HOUR, 1 real
 * s = 12 game s); stamina in REAL seconds (it is the moment-to-moment breather meter of the controls, core/wolfModes).
 */
export interface Sourced<T = number> { v: T; src: string; est?: string }
/** Mark a sourced value. */
export const S = <T = number>(v: T, src: string, est?: string): Sourced<T> => (est ? { v, src, est } : { v, src });

/** Needs every template can declare. 'energy' is the existing Energy stat (hunger): the engine drains the host's value. */
export type NeedId = 'water' | 'energy' | 'rest';
export type ActivityPattern = 'diurnal' | 'crepuscular' | 'nocturnal' | 'cathemeral';
/** Goals a need or a threat can drive (the NPC behaviour; the embodied player only sees the thoughts). */
export type Goal = 'drink' | 'hunt' | 'forage' | 'bed-down' | 'explore' | 'rest' | 'alert' | 'flee';
/** Gait words shared with core/wolfModes (walk, run, sprint) and the agent pipeline. */
export type Gait = 'idle' | 'walk' | 'run' | 'sprint';

export interface SpeciesTemplate {
  /** id used by the registry and saves, e.g. 'wolf' */ id: string;
  /** common name in core/species MAMMALS (body mass is read from there) */ name: string;
  body: {
    /** adult body mass (kg) */ massKg: Sourced;
    /** field metabolic rate, the free-living DAILY AVERAGE (kJ/day); the activity factor is metabolic power / this */ fmrKjPerDay: Sourced;
    /** speeds (m/s) the controls / agent use for each gait; walk is the rest-need reference gait */ speeds: Record<'walk' | 'run' | 'sprint', Sourced>;
  };
  stamina: {
    /** REAL seconds of sprint from full before the breather (exhausted) */ sprintSeconds: Sourced;
    /** REAL seconds of run from full before the breather */ runSeconds: Sourced;
    /** REAL seconds to refill 0 -> full while walking or still */ recoverSeconds: Sourced;
  };
  needs: {
    water: {
      /** daily water turnover, free-living (mL/day) */ turnoverMlPerDay: Sourced;
      /** body-water deficit (share of body mass) at hydration 0 % (critical) */ criticalDeficit: Sourced;
      /** mL drunk per GAME second while drinking at water */ drinkMlPerS: Sourced;
      /** extra water loss per degC above `heatAboveC` (share of the base rate) */ heatPerC: Sourced; heatAboveC: Sourced;
    };
    energy: {
      /** what 100 Energy means; the host owns the value (AnimalBrain.energy / Agent.energy) */ meaning: string;
      /** GAME seconds for 100 Energy at the daily-average (FMR) rate */ fullSeconds: Sourced;
    };
    rest: {
      /** GAME hours of activity (at walk effort) from 100 to 0 */ activeHoursToEmpty: Sourced;
      /** GAME hours of rest (still) from 0 to 100 */ restHoursToFull: Sourced;
    };
  };
  /** Senses (T-0036): one shape for every species; core/needs/senses perceives with it (sight in the field of view, hearing of
   *  footfalls, smell through core/senses scentLevel). Same fields as core/agent AgentSpecies.senses plus the field of view. */
  senses: {
    sight: { /** m a moving body is seen at */ rangeM: Sourced; /** total visual field (deg) */ fovDeg: Sourced; /** vision floor in the dark 0..1 */ night: Sourced;
      /** speed band (m/s): not moving .. clearly moving */ motion: Sourced<[number, number]>; /** m a still body is seen at */ presenceM: Sourced; /** presence factor of a crouched body */ crouched: Sourced };
    hearing: { /** m footfalls are heard at */ rangeM: Sourced; /** speed band (m/s) silent .. loud footfalls */ loud: Sourced<[number, number]> };
    smell: { /** scent strength at this nose (scentLevel potency) */ potency: Sourced };
  };
  /** Diet (T-0036): one interface for every diet kind (core/needs/diet). Food rows are per kg WET mass. */
  diet: {
    kind: 'carnivore' | 'herbivore' | 'omnivore';
    foods: Record<string, { /** gross energy kJ per kg wet */ kJPerKg: Sourced; /** share of it assimilated */ assimilation: Sourced;
      /** preformed water mL per kg wet */ waterMlPerKg: Sourced; /** kg taken per eat action (a whole prey, or one bite bout) */ biteKg: Sourced; /** s one eat action takes */ eatSeconds: Sourced }>;
  };
  /** Social / group (T-0036, core/needs/social): group size and spacing, shared vigilance (an alarm passes to group mates through
   *  THEIR senses: a heard signal or the sight of a fleeing neighbour) and scatter on alarm (the confusion effect). */
  social: {
    /** animals usually together (min, max); 1 = solitary */ groupSize: Sourced<[number, number]>;
    /** m to the nearest neighbour at a typical density */ spacingM: Sourced;
    /** m: mates closer than this are LINKED and share detections, so the group's awareness is the union of the linked members'
     *  own sense ranges; walking out of it loses the shared alarms (Matthew 01:47) */ linkM: Sourced;
    /** s an alarm takes to pass one link (signal + reaction) */ relaySeconds: Sourced;
    /** Group-size effect on vigilance (Roberts 1996): each animal's share of time scanning = loneShare x (1 + linked mates)^-exponent;
     *  the group still detects earlier (corporate vigilance 1 - (1 - share)^n, Monaghan & Metcalfe 1985). */
    vigilance: { /** share of time a lone animal scans */ loneShare: Sourced; /** decline exponent with group size */ exponent: Sourced };
    /** alarm signal mates can hear: kind and how loud as a footfall-equivalent speed (m/s, read by hearing.loud) */ alarm: { signal: 'thump' | 'bark' | 'none'; loudness: Sourced };
    /** what a mate does on hearing the signal (snowshoe hares freeze) and on seeing a mate flee */ onSignal: 'freeze' | 'flee'; onFleeSeen: 'freeze' | 'flee';
    /** rad a fleeing mate bends away from the group centre (0 = no scatter) */ scatter: Sourced;
  };
  behaviour: {
    /** Flight: speeds and turns when fleeing (core/needs/diet evadeStep). */
    evasion: { /** m/s REAL (core/needs/diet scales to game speed by the player wolf's sprint) */ burstSpeed: Sourced; /** m/s after the burst */ tiredSpeed: Sourced;
      /** s between direction changes */ zigEvery: Sourced<[number, number]>; /** rad of a direction change */ zigAngle: Sourced; /** m/s^2 sideways grip: turn rate = a / v */ lateralAccel: Sourced };
    activity: { pattern: ActivityPattern; /** share of the day active */ activeShare: Sourced; /** day share outside the peaks that is still active (0..1) */ offPeak: Sourced };
    /** need -> goal: below `seekBelow` (%) the NPC goes for it; the lowest relative level wins */
    drives: Record<NeedId, { goal: Goal; seekBelow: Sourced }>;
    /** urgency (0..1) at which the chosen gait steps up: [walk -> run, run -> sprint] */ gaitAt: Sourced<[number, number]>;
    alert: { /** s held (freeze / head-up) before a cue may bolt it */ reactSeconds: Sourced; freeze: boolean };
    flight: { /** kinds it fears (core/agent fear table) */ fears: string[]; /** m: a feared animal this close bolts it */ distanceM: Sourced };
  };
  thoughts?: Partial<Record<NeedId, { /** % below which bubbles float */ low?: number; /** % at/below which the alert pulses */ critical?: number }>>;
}

/** Thought-bubble timings and opacities are system properties, not species data: src/config/systemProperties.ts
 *  SYSTEM_PROPERTIES.needsThoughts. A species may override `low`/`critical` per need via `thoughts`. */
/** Every Sourced value inside a template, with its path (for the source test and the number table). */
export function sourcedEntries(o: unknown, path = ''): [string, Sourced<unknown>][] {
  if (!o || typeof o !== 'object') return [];
  if ('v' in (o as object) && 'src' in (o as object)) return [[path, o as Sourced<unknown>]];
  return Object.entries(o as object).flatMap(([k, v]) => sourcedEntries(v, path ? `${path}.${k}` : k));
}
