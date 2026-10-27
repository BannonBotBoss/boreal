/**
 * DEEP TIME (T-0060; Matthew's vision: "a tool to control the value of time. Reversing it will render a globe backwards however long
 * they wish, until there isn't even a globe. Or forward, until the sun's plasma has stripped the planet. Or zoom back to the beginning
 * of life ... as a microscopic entity"). ONE pure module: a signed offset from NOW in years -> what the planet is, from three
 * published models and a dated milestone table. No state, no clock, no DOM: the globe, the chronometer and tools/deep-time.html all
 * read it. The day/hour clock (core/timeOfDay, core/worldClock) is untouched; this is the long axis beside it.
 * The #108 line (T-0093) is `dialToYears`: years since solar-system formation. `deepTimeAt` still takes the offset from now.
 *
 * Models (each cited where used):
 *  - Solar brightening: Gough 1981 (Solar Physics 74:21), L(t)/L0 = 1 / (1 + 2/5 (1 - t/t0)), t0 = 4.57 Gyr; agrees with standard solar
 *    models except the first ~0.2 Gyr (Feulner 2012, Rev. Geophys. 50:RG2006). Valid on the main sequence, which ends ~+5 Gyr
 *    (Schröder & Smith 2008); beyond it the ratio is an extrapolation and says so (`extrapolated`).
 *  - Equilibrium temperature: Te = [S (1 - A) / (4 sigma)]^(1/4), the zero-greenhouse balance of absorbed and emitted flux. S = S0 x
 *    luminosity ratio, with S0, sigma from core/weather AIR (one source). It is NOT the surface temperature: the faint young Sun
 *    paradox (Sagan & Mullen 1972; Feulner 2012) is exactly that Te was far below freezing while oceans were liquid.
 *  - Brightening Earth: Wolf & Toon 2015 (JGR Atmos 120:5775, CESM): abrupt moist-greenhouse shift at +12.5 % S0, significant water
 *    loss to space from +19 %, rapid loss by +21 % (runaway).
 *  - End of the Earth: Schröder & Smith 2008 (MNRAS 386:155): the Sun reaches its RGB tip 7.59 Gyr from now and Earth cannot escape
 *    engulfment.
 * Every number is a published figure or a game choice that says so. [verify] = from memory, source not re-read.
 */
import { AIR } from './weather';

export const YEAR = { kyr: 1e3, myr: 1e6, gyr: 1e9 };
export const DEEP = {
  /** Age of the Sun now, yr: Gough 1981's t0 (Feulner 2012 §2). The luminosity fit only. Not the #108 line. */ sunAgeYr: 4.57e9,
  /** Solar-system formation, yr before now: CAIs 4567.30 ± 0.16 Ma (Connelly et al. 2012, Science 338:651). The same figure as T-0065 `nebula_sun.onsetYearsAgo.mean`. Time zero on the one line. Older than the Earth, so the state there is no planet. */ solarSystemAgeYr: 4.5673e9,
  /** Age of the Earth, yr: 4.54 +- 0.05 Gyr (Dalrymple 2001, Geol. Soc. London Spec. Pub. 190:205). On the formation line this is the span from Earth-formation to the present, not a second zero. Before it there is no globe. */ earthAgeYr: 4.54e9,
  /** Gough's coefficient 2/5 (Gough 1981). */ goughK: .4,
  /** Main sequence end, yr from now: the Sun "grows brighter by 1 % per ~110 Myr ... another ~5 Gyr before the red giant phase"
   *  (Wolf & Toon 2015 §1, after Schröder & Smith 2008). */ mainSequenceEndYr: 5e9,
  /** Earth engulfed, yr from now: 7.59 Gyr (Schröder & Smith 2008, abstract). */ engulfedYr: 7.59e9,
  /** Bond albedo of Earth, 0.306 (NASA Earth Fact Sheet, Williams, NSSDCA); the zero-greenhouse balance uses it for every epoch (game
   *  simplification: albedo did change with ice and cloud). */ bondAlbedo: .306,
  /** Flux ratios to today (Wolf & Toon 2015 abstract): moist greenhouse shift, significant water loss, rapid loss (runaway). */
  flux: { moistGreenhouse: 1.125, waterLoss: 1.19, runaway: 1.21 },
  /** Start of life for the game's microscopic world, yr before now: 3.7 Ga stromatolites (Nutman et al. 2016, Nature 537:535: "life by
   *  3,700 Ma", Isua). Older claims (4.1 Ga carbon in zircon, Bell et al. 2015) and doubts exist; this is the oldest generally
   *  discussed multi-line evidence, taken as the game's start of life. */ lifeStartYr: 3.7e9,
  /** Base of the Cambrian (Fortunian), 538.8 +- 0.6 Ma (ICS International Chronostratigraphic Chart v2026-06): visible animal life. */ animalsYr: 538.8e6,
};

/** Dated milestones the dial can name. `yr` is the offset from now (negative = past). Sources are the dating papers or the ICS chart. */
export const MILESTONES: { id: string; label: string; yr: number; src: string }[] = [
  { id: 'earth', label: 'Earth forms', yr: -DEEP.earthAgeYr, src: 'Dalrymple 2001, Geol. Soc. London Spec. Pub. 190:205 (4.54 +- 0.05 Gyr)' },
  { id: 'life', label: 'Microbial life (Isua stromatolites)', yr: -DEEP.lifeStartYr, src: 'Nutman et al. 2016, Nature 537:535 (3,700 Ma)' },
  { id: 'dynamo', label: 'Geodynamo running (oldest palaeomagnetic record)', yr: -3.5e9, src: 'Tarduno et al. 2010, Science 327:1238 (3.45 Ga Barberton); 4.2 Ga zircons disputed (Tarduno 2015)' },
  { id: 'oxygen', label: 'Great Oxidation Event', yr: -2.4e9, src: 'Bekker et al. 2004, Nature 427:117 (~2.45-2.32 Ga) [verify]' },
  { id: 'innercore', label: 'Inner core starts to freeze [DISPUTED 0.5-1.5 Ga]', yr: -1.0e9, src: 'Biggin et al. 2015, Nature 526:245 (~1-1.5 Ga) vs Bono et al. 2019, Nat. Geosci. 12:143 (~0.565 Ga)' },
  { id: 'animals', label: 'Cambrian: animals with shells and eyes', yr: -DEEP.animalsYr, src: 'ICS chart v2026-06 (538.8 +- 0.6 Ma)' },
  { id: 'kpg', label: 'Non-bird dinosaurs end (K-Pg)', yr: -66.043e6, src: 'Renne et al. 2013, Science 339:684 (66.043 Ma) [verify the +-0.043]' },
  { id: 'brunhes', label: 'Last magnetic reversal (Brunhes-Matuyama)', yr: -773e3, src: 'Singer et al. 2019, Sci. Adv. 5:eaaw4621 (773 ka)' },
  { id: 'sapiens', label: 'Earliest Homo sapiens (Jebel Irhoud)', yr: -315e3, src: 'Richter et al. 2017, Nature 546:293 (315 +- 34 ka)' },
  { id: 'now', label: 'Now', yr: 0, src: 'the game clock' },
];

/** Sun luminosity relative to now, `offsetYr` from now (Gough 1981). `extrapolated` is true past the main sequence, where the formula no longer holds. */
export function luminosityRatio(offsetYr: number): { ratio: number; extrapolated: boolean } {
  const x = (DEEP.sunAgeYr + offsetYr) / DEEP.sunAgeYr; // t/t0
  return { ratio: 1 / (1 + DEEP.goughK * (1 - x)), extrapolated: offsetYr > DEEP.mainSequenceEndYr };
}
/** Inverse of the Gough fit: the offset (yr from now) at which the Sun is `ratio` times as luminous as today. */
export const yearsAtLuminosity = (ratio: number) => (1 - 1 / ratio) / DEEP.goughK * DEEP.sunAgeYr;
/** Solar constant at Earth's orbit, W/m2 (S0 from core/weather AIR; orbit held at 1 AU, a game simplification: the Sun's mass loss moves Earth out only near the RGB tip). */
export const solarConstantAt = (offsetYr: number) => AIR.S0 * luminosityRatio(offsetYr).ratio;
/** Zero-greenhouse equilibrium temperature, K: [S (1 - A) / (4 sigma)]^(1/4). Not the surface temperature (see header). */
export const equilibriumTempK = (offsetYr: number) => (solarConstantAt(offsetYr) * (1 - DEEP.bondAlbedo) / (4 * AIR.sigma)) ** .25;

export type DeepStage = 'no-planet' | 'hadean' | 'microbial' | 'living-earth' | 'moist-greenhouse' | 'oceans-lost' | 'red-giant' | 'engulfed';
/** What the dial points at, from the offset alone. Boundaries are the cited figures above (flux thresholds are turned into years by the Gough fit). */
export function stageAt(offsetYr: number): DeepStage {
  if (offsetYr < -DEEP.earthAgeYr) return 'no-planet';
  if (offsetYr < -DEEP.lifeStartYr) return 'hadean';
  if (offsetYr < -DEEP.animalsYr) return 'microbial';
  if (offsetYr >= DEEP.engulfedYr) return 'engulfed';
  if (offsetYr >= DEEP.mainSequenceEndYr) return 'red-giant';
  if (offsetYr >= yearsAtLuminosity(DEEP.flux.waterLoss)) return 'oceans-lost';
  if (offsetYr >= yearsAtLuminosity(DEEP.flux.moistGreenhouse)) return 'moist-greenhouse';
  return 'living-earth';
}
/** Player-facing text per stage: what you would see, and the game's embodiable scale (microbe world, animals, or nothing). */
export const STAGE_INFO: Record<DeepStage, { title: string; sees: string; embody: 'none' | 'microbe' | 'animal' }> = {
  'no-planet': { title: 'Before the Earth', sees: 'No globe: the Sun is alone with a disc of dust and rock still falling together.', embody: 'none' },
  hadean: { title: 'Hadean', sees: 'A molten, bombarded young world; nothing alive yet.', embody: 'none' },
  microbial: { title: 'The microbial world', sees: 'Living seas only: you are a microscopic cell chasing chemical nutrients and avoiding harsh water.', embody: 'microbe' },
  'living-earth': { title: 'Living Earth', sees: 'Oceans, forests and animals: any creature can be embodied.', embody: 'animal' },
  'moist-greenhouse': { title: 'Moist greenhouse', sees: 'Hot, humid air carries water high up where sunlight breaks it apart; the sea begins to drain to space.', embody: 'animal' },
  'oceans-lost': { title: 'Oceans lost', sees: 'Water is escaping fast; the surface is bare, hot rock under a thick steam atmosphere.', embody: 'none' },
  'red-giant': { title: 'The swollen Sun', sees: 'The Sun fills much of the sky and strips the atmosphere; the surface is molten.', embody: 'none' },
  engulfed: { title: 'Engulfed', sees: 'The Sun\'s outer plasma has reached Earth\'s orbit; there is no globe left.', embody: 'none' },
};

/** The dial: a signed slider position -1..1 on a log scale of years, so one drag spans a day to billions of years. Position 0 is the present. The returned year is counted from solar-system formation (#108): 0 is formation, and the present is `DEEP.solarSystemAgeYr`. Past end = just past Earth's formation, future end = just past engulfment (both x1.01 / x1.05, a game choice). `deepTimeAt` and `stageAt` still take an offset from now: subtract `DEEP.solarSystemAgeYr`. */
export const DIAL = { pastSpanYr: DEEP.earthAgeYr * 1.01, futureSpanYr: DEEP.engulfedYr * 1.05 };
export function dialToYears(s: number): number {
  const a = Math.min(1, Math.abs(s));
  const fromNow = a === 0 ? 0 : (s < 0 ? -1 : 1) * ((s < 0 ? DIAL.pastSpanYr : DIAL.futureSpanYr) ** a - 1);
  return DEEP.solarSystemAgeYr + fromNow;
}
export function yearsToDial(lineYr: number): number {
  const offsetYr = lineYr - DEEP.solarSystemAgeYr;
  const span = offsetYr < 0 ? DIAL.pastSpanYr : DIAL.futureSpanYr, a = Math.min(1, Math.log(1 + Math.abs(offsetYr)) / Math.log(span));
  return offsetYr < 0 ? -a : a;
}
/** "3.70 Gyr ago", "66.0 Myr from now", "315 kyr ago", "12 yr ago", "now". */
export function formatYears(offsetYr: number): string {
  const a = Math.abs(offsetYr); if (a < .5) return 'now';
  const [v, u] = a >= 1e9 ? [a / 1e9, 'Gyr'] : a >= 1e6 ? [a / 1e6, 'Myr'] : a >= 1e3 ? [a / 1e3, 'kyr'] : [a, 'yr'];
  return `${v >= 100 || u === 'yr' ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${u} ${offsetYr < 0 ? 'ago' : 'from now'}`;
}
/** Signed log10 of a year offset: keeps past and future apart and spaces 1 yr .. 5 Gyr evenly (the dial's own scale). */
const slog = (y: number) => Math.sign(y) * Math.log10(1 + Math.abs(y));
/** The milestone nearest the offset on the dial's log scale (past and future never mix). */
export const nearestMilestone = (offsetYr: number) => MILESTONES.reduce((best, m) => Math.abs(slog(m.yr) - slog(offsetYr)) < Math.abs(slog(best.yr) - slog(offsetYr)) ? m : best);
/** Everything the dial's readout needs at one offset. */
export function deepTimeAt(offsetYr: number) {
  const stage = stageAt(offsetYr), L = luminosityRatio(offsetYr), planet = stage !== 'no-planet' && stage !== 'engulfed';
  return { offsetYr, label: formatYears(offsetYr), stage, ...STAGE_INFO[stage], luminosity: L.ratio, extrapolated: L.extrapolated,
    solarConstant: solarConstantAt(offsetYr), equilibriumK: planet ? equilibriumTempK(offsetYr) : NaN };
}
