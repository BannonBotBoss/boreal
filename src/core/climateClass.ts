/**
 * Climate class (roadmap step 8, issue #100, T-0094).
 *
 * Average temperature, yearly rain, and the seasonal pattern produce one Köppen–Geiger class.
 * The class is an output. Deer and wolves do not read it. Surface colours are not this class.
 *
 * Thresholds: Peel, Finlayson and McMahon 2007, Hydrol. Earth Syst. Sci. 11:1633–1644, Table 1
 * and the Herberton tie-break in the text. doi:10.5194/hess-11-1633-2007
 * Issue #100's four example names (tropical forest, temperate forest, grassland, desert) have no
 * published bounds. They are not a second scheme. Issue #101's 35 °C span is not used.
 *
 * Where the PDF table and the authors' later HTML list disagree, the PDF wins:
 * temperate and cold need the hottest month above 10 °C (Table 1 prints "Thot > 10"), and
 * Tmon10 counts months above 10 °C (the footnote says "above 10"). The very-cold winter
 * letter is the authors' list of that same table: coldest month below −38 °C, and only after
 * hot-summer and warm-summer have failed.
 */
import type { PlanetSim } from './planetBudget';
import { FOREST_SPIN, weatherAtLatLon } from './planetWeather';

/** Peel et al. 2007 Table 1, in the units of that table (temperature °C, precipitation mm). */
export const PEEL = {
  /** Tcold ≥ 18 → tropical, once arid has been excluded. */
  tropicalColdC: 18,
  /** Pdry ≥ 60 → rainforest. */
  rainforestDryMm: 60,
  /** Monsoon: Pdry ≥ 100 − MAP/25. */
  monsoonOffsetMm: 100,
  monsoonMapDivisor: 25,
  /** MAP < 10 × Pthreshold → arid. Identified before A, C, D, and E. */
  aridFactor: 10,
  /** MAP < 5 × Pthreshold → desert; otherwise steppe. */
  desertFactor: 5,
  /** MAT ≥ 18 → hot arid; otherwise cold arid. */
  hotMeanC: 18,
  /** 70% of the yearly rain in one six-month block, compared as sevenths so the boundary is exact. */
  concentrationTenths: 7,
  /** Pthreshold = 2 × MAT, plus 28 when summer holds the 70%, plus 14 otherwise. */
  pthPerDegree: 2,
  pthSummerAddMm: 28,
  pthEvenAddMm: 14,
  /** Hottest month above this, not at it, for temperate and cold. A hottest month of 10 °C is polar. */
  temperateHotAboveC: 10,
  /** Temperate: coldest month above 0 °C and below 18 °C. Cold: coldest month at or below 0 °C. */
  coldMonthAboveC: 0,
  coldMonthBelowC: 18,
  /** Dry summer: driest summer month below 40 mm and below one third of the wettest winter month. */
  drySummerMm: 40,
  drySummerWinterRatio: 3,
  /** Dry winter: driest winter month below one tenth of the wettest summer month. */
  dryWinterSummerRatio: 10,
  /** Third letter a: hottest month at or above 22 °C. */
  hotSummerC: 22,
  /** Third letter b: at least four months above 10 °C, and not already a. */
  warmSummerMonths: 4,
  /** A month counts toward Tmon10 when it is above 10 °C. A month at exactly 10 °C does not. */
  monthAboveC: 10,
  /** Third letter d, cold climates only: coldest month below −38 °C, and not a or b. */
  veryColdBelowC: -38,
} as const;

/** The 30 classes in Peel et al. 2007 Table 1. No other symbol is produced. */
export const KOPPEN_IDS = [
  'Af', 'Am', 'Aw',
  'BWh', 'BWk', 'BSh', 'BSk',
  'Csa', 'Csb', 'Csc', 'Cwa', 'Cwb', 'Cwc', 'Cfa', 'Cfb', 'Cfc',
  'Dsa', 'Dsb', 'Dsc', 'Dsd', 'Dwa', 'Dwb', 'Dwc', 'Dwd', 'Dfa', 'Dfb', 'Dfc', 'Dfd',
  'ET', 'EF',
] as const;
export type KoppenId = typeof KOPPEN_IDS[number];

/** Peel's description of each symbol. Not issue #100's four example names. */
export const KOPPEN_NAME: Record<KoppenId, string> = {
  Af: 'Tropical rainforest', Am: 'Tropical monsoon', Aw: 'Tropical savannah',
  BWh: 'Arid hot desert', BWk: 'Arid cold desert', BSh: 'Arid hot steppe', BSk: 'Arid cold steppe',
  Csa: 'Temperate, dry summer, hot summer', Csb: 'Temperate, dry summer, warm summer', Csc: 'Temperate, dry summer, cold summer',
  Cwa: 'Temperate, dry winter, hot summer', Cwb: 'Temperate, dry winter, warm summer', Cwc: 'Temperate, dry winter, cold summer',
  Cfa: 'Temperate, no dry season, hot summer', Cfb: 'Temperate, no dry season, warm summer', Cfc: 'Temperate, no dry season, cold summer',
  Dsa: 'Cold, dry summer, hot summer', Dsb: 'Cold, dry summer, warm summer', Dsc: 'Cold, dry summer, cold summer', Dsd: 'Cold, dry summer, very cold winter',
  Dwa: 'Cold, dry winter, hot summer', Dwb: 'Cold, dry winter, warm summer', Dwc: 'Cold, dry winter, cold summer', Dwd: 'Cold, dry winter, very cold winter',
  Dfa: 'Cold, no dry season, hot summer', Dfb: 'Cold, no dry season, warm summer', Dfc: 'Cold, no dry season, cold summer', Dfd: 'Cold, no dry season, very cold winter',
  ET: 'Polar tundra', EF: 'Polar frost',
};

export interface ClimateClass {
  /** The symbol. Behaviour does not read this. */
  id: KoppenId;
  /** The published description of that symbol. */
  name: string;
  /** Mean of the twelve monthly temperatures, °C. */
  matC: number;
  /** Sum of the twelve monthly totals, mm. */
  mapMm: number;
  /** Hottest month minus coldest month, °C. How strong the temperature seasons are. */
  seasonRangeC: number;
}

/** April–September and October–March, January = 0. Peel: summer is whichever of these two is warmer. */
const APR_SEP = [3, 4, 5, 6, 7, 8] as const;
const OCT_MAR = [9, 10, 11, 0, 1, 2] as const;

/**
 * Mid-month sample days already used by `climate_seed.rs` (`15 + 30.4 k`).
 * The 30.4 is that file's spacing, not a new month length.
 */
export const CLIMATE_SAMPLE_DAY = Array.from({ length: 12 }, (_, k) => 15 + 30.4 * k);
/**
 * The grid year is 365 days. Each monthly total is the mid-month daily rate times an equal share of that year,
 * so twelve months add up to one year of those rates.
 */
export const CLIMATE_MONTH_DAYS = 365 / 12;

function meanOf(values: readonly number[], idx?: readonly number[]) {
  const pick = idx ?? values.map((_, i) => i);
  let s = 0;
  for (const i of pick) s += values[i];
  return s / pick.length;
}
function sumAt(values: readonly number[], idx: readonly number[]) {
  let s = 0;
  for (const i of idx) s += values[i];
  return s;
}
function extreme(values: readonly number[], idx: readonly number[], pick: 'min' | 'max') {
  let v = values[idx[0]];
  for (const i of idx) v = pick === 'min' ? Math.min(v, values[i]) : Math.max(v, values[i]);
  return v;
}
/** At least 70%, as part × 10 ≥ total × 7. A total of 0 is not a concentration. */
function atLeastSeventy(part: number, total: number) {
  return total > 0 && part * 10 >= total * PEEL.concentrationTenths;
}

function requireYear(tempC: readonly number[], precipMm: readonly number[]) {
  if (tempC.length !== 12 || precipMm.length !== 12) throw new Error('Köppen–Geiger uses twelve monthly values');
  for (const v of tempC) if (!Number.isFinite(v)) throw new Error('monthly temperature must be finite');
  for (const v of precipMm) if (!Number.isFinite(v)) throw new Error('monthly precipitation must be finite');
}

/**
 * Second letter for temperate and cold. When a place meets both dry-summer and dry-winter,
 * Peel assigns dry-winter if the summer half's rain is greater, and dry-summer otherwise
 * (Herberton Post Office, in the paper's text).
 */
function seasonLetter(psdry: number, pwwet: number, pwdry: number, pswet: number, summerMm: number, winterMm: number) {
  const drySummer = psdry < PEEL.drySummerMm && psdry < pwwet / PEEL.drySummerWinterRatio;
  const dryWinter = pwdry < pswet / PEEL.dryWinterSummerRatio;
  if (drySummer && dryWinter) return summerMm > winterMm ? 'w' : 's';
  if (drySummer) return 's';
  if (dryWinter) return 'w';
  return 'f';
}

/** Third letter. Hot summer and warm summer outrank a very cold winter, as Table 1 states "not (a or b)". */
function heatLetter(thot: number, tmon10: number, tcold: number, coldGroup: boolean) {
  if (thot >= PEEL.hotSummerC) return 'a';
  if (tmon10 >= PEEL.warmSummerMonths) return 'b';
  if (coldGroup && tcold < PEEL.veryColdBelowC) return 'd';
  return 'c';
}

function done(id: KoppenId, matC: number, mapMm: number, thot: number, tcold: number): ClimateClass {
  return { id, name: KOPPEN_NAME[id], matC, mapMm, seasonRangeC: thot - tcold };
}

/**
 * Class from twelve monthly temperatures (°C, January first) and twelve monthly rain totals (mm).
 * Summer is the warmer of April–September and October–March. When those two means are equal,
 * neither block is the summer the paper defines, so the 70% adjustment is not applied and the
 * rain-season letter is "no dry season". That tie is not a published threshold.
 */
export function climateClass(tempC: readonly number[], precipMm: readonly number[]): ClimateClass {
  requireYear(tempC, precipMm);
  const matC = meanOf(tempC);
  const mapMm = precipMm.reduce((a, b) => a + b, 0);
  const thot = Math.max(...tempC);
  const tcold = Math.min(...tempC);
  const tmon10 = tempC.filter(t => t > PEEL.monthAboveC).length;
  const apr = meanOf(tempC, APR_SEP);
  const oct = meanOf(tempC, OCT_MAR);
  const summer = apr > oct ? APR_SEP : oct > apr ? OCT_MAR : null;
  const winter = summer === APR_SEP ? OCT_MAR : summer === OCT_MAR ? APR_SEP : null;
  const summerMm = summer ? sumAt(precipMm, summer) : 0;
  const winterMm = winter ? sumAt(precipMm, winter) : 0;
  let pth = PEEL.pthPerDegree * matC + PEEL.pthEvenAddMm;
  if (summer && atLeastSeventy(winterMm, mapMm)) pth = PEEL.pthPerDegree * matC;
  else if (summer && atLeastSeventy(summerMm, mapMm)) pth = PEEL.pthPerDegree * matC + PEEL.pthSummerAddMm;

  if (mapMm < PEEL.aridFactor * pth) {
    const desert = mapMm < PEEL.desertFactor * pth;
    const hot = matC >= PEEL.hotMeanC;
    return done(`${desert ? 'BW' : 'BS'}${hot ? 'h' : 'k'}` as KoppenId, matC, mapMm, thot, tcold);
  }
  if (tcold >= PEEL.tropicalColdC) {
    const pdry = Math.min(...precipMm);
    const id: KoppenId = pdry >= PEEL.rainforestDryMm ? 'Af'
      : pdry >= PEEL.monsoonOffsetMm - mapMm / PEEL.monsoonMapDivisor ? 'Am' : 'Aw';
    return done(id, matC, mapMm, thot, tcold);
  }
  const temperate = thot > PEEL.temperateHotAboveC && tcold > PEEL.coldMonthAboveC && tcold < PEEL.coldMonthBelowC;
  const cold = thot > PEEL.temperateHotAboveC && tcold <= PEEL.coldMonthAboveC;
  if ((temperate || cold) && summer && winter) {
    const letter = seasonLetter(
      extreme(precipMm, summer, 'min'), extreme(precipMm, winter, 'max'),
      extreme(precipMm, winter, 'min'), extreme(precipMm, summer, 'max'),
      summerMm, winterMm);
    const heat = heatLetter(thot, tmon10, tcold, cold);
    return done(`${temperate ? 'C' : 'D'}${letter}${heat}` as KoppenId, matC, mapMm, thot, tcold);
  }
  if (temperate || cold) {
    const heat = heatLetter(thot, tmon10, tcold, cold);
    return done(`${temperate ? 'C' : 'D'}f${heat}` as KoppenId, matC, mapMm, thot, tcold);
  }
  return done(thot > 0 ? 'ET' : 'EF', matC, mapMm, thot, tcold);
}

export interface ClimateYear {
  tempC: number[];
  precipMm: number[];
  climate: ClimateClass;
}

/**
 * One year at a point on the planet grid (step 2), which already carries the sea and the rain shadow (step 5).
 * Each month is `weatherAtLatLon` after the climate seed and one existing 6 h step. A zero-length moisture
 * step leaves rain at 0, so the step is what lets the rain shadow into the yearly total. Temperature is that
 * same read: the climatological air, including the sea's reach. Nothing here is a second climate formula.
 */
export function climateYearAt(sim: PlanetSim, latDeg: number, lonDeg: number): ClimateYear {
  const tempC: number[] = [];
  const precipMm: number[] = [];
  for (const day of CLIMATE_SAMPLE_DAY) {
    sim.seed(day, 12);
    sim.step(FOREST_SPIN.dtS);
    const w = weatherAtLatLon(latDeg, lonDeg, sim);
    if (!w) throw new Error('climate year needs a booted planet grid');
    tempC.push(w.tC);
    precipMm.push(w.precipMmDay * CLIMATE_MONTH_DAYS);
  }
  return { tempC, precipMm, climate: climateClass(tempC, precipMm) };
}
