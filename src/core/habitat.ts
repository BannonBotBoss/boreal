/**
 * Habitat cell (roadmap step 9, issues #100 and #101, conflict 11).
 * Quality is #101's sum: food + water + shelter − competition − predator pressure.
 * #100 also subtracts environmental stress. That term loses. #106 puts temperature
 * and oxygen stress on the body (step 18). It is not subtracted here.
 * The 0–100 scale and the vegetation sketch `temperature / 25` are example
 * coefficients (conflict 9). They are not game numbers. Each term below is a
 * share of a full cell, so the sum sits on −2..+3. The weights are 1.
 *
 * Food and vegetation are one standing crop: the browse cell already in
 * `fields.ts` (T-0015). A bite lowers both. Regrowth is that field's closed form,
 * not a second integrator. Shelter is the stand canopy already in `stand.ts`.
 * Water is open water, or the Manabe bucket fill `weatherAt` already returns.
 * Snow depth and the climate-class name are not terms.
 */
import { clamp01 } from '../proc/math';
import { BROWSE_CELL_M, browseCellKey, settledGrams } from './fields';
import { siteAt } from './flora/site';
import { standAt } from './stand';
import { weatherAt } from './weather';

/** Peak fall density, snowshoe hares per hectare. High end of the 5–10 already cited on
 *  HARE_NEEDS.social.spacingM (Keith 1990 via Hodges, UBC thesis). */
export const HARE_PEAK_PER_HA = 10;
/** Mainland midwinter wolf densities rarely exceeded this. Fuller, Mech & Cochrane 2003,
 *  Wolf population dynamics, ch. 6 of Mech & Boitani (eds), Wolves, Univ. Chicago Press:
 *  "maximum midwinter wolf densities … rarely exceeded 40/1,000 km²". */
export const WOLF_CEILING_PER_1000_KM2 = 40;

const CELL_M2 = BROWSE_CELL_M * BROWSE_CELL_M;

/** Hares on one browse cell when the landscape is at the cited peak. */
export const harePeakOnCell = () => HARE_PEAK_PER_HA * (CELL_M2 / 10000);
/** Wolves on one browse cell when the landscape is at the cited ceiling. */
export const wolfCeilingOnCell = () => WOLF_CEILING_PER_1000_KM2 * (CELL_M2 / 1e6) / 1000;

export interface HabitatTerms {
  /** edible standing crop / the cell's ungrazed crop, 0..1 */
  food: number;
  /** 1 on open water, otherwise soil water / field capacity, 0..1 */
  water: number;
  /** stand canopy closure, 0..1 */
  shelter: number;
  /** the same standing crop as food. Carried, not added into the score. */
  vegetation: number;
  /** herbivores on the cell / the cited hare peak, 0..1 */
  competition: number;
  /** wolves on the cell / the cited ceiling, 0..1 */
  predatorPressure: number;
}
export interface HabitatCell extends HabitatTerms {
  /** food + water + shelter − competition − predator pressure */
  quality: number;
}
export interface HabitatCounts { herbivores: number; wolves: number }

/** #101 `evaluate`. No stress argument. */
export function habitatQuality(t: HabitatTerms) {
  return t.food + t.water + t.shelter - t.competition - t.predatorPressure;
}
export function habitatCell(t: HabitatTerms): HabitatCell {
  return { ...t, quality: habitatQuality(t) };
}
export function competitionShare(herbivores: number) {
  const peak = harePeakOnCell();
  return peak > 0 ? clamp01(Math.max(0, herbivores) / peak) : 0;
}
export function predatorShare(wolves: number) {
  const peak = wolfCeilingOnCell();
  return peak > 0 ? clamp01(Math.max(0, wolves) / peak) : 0;
}

/**
 * The cell under a point. `counts` default to 0: the forest has no density field yet
 * (step 14). A caller that knows who is standing here passes the counts.
 * `now` is the world second the browse crop is read at (the forage field's clock).
 */
export function habitatAt(x: number, z: number, counts: HabitatCounts = { herbivores: 0, wolves: 0 }, now?: number): HabitatCell {
  const stock = settledGrams({ key: browseCellKey(x, z), x, z, kind: 'browse', grams: 0, by: '' }, now);
  const food = stock.max > 0 ? clamp01(stock.grams / stock.max) : 0;
  const site = siteAt(x, z, true, false);
  const water = site.water ? 1 : clamp01(weatherAt(x, z).soil);
  const shelter = clamp01(standAt(x, z, site.wet).canopy);
  return habitatCell({
    food, water, shelter, vegetation: food,
    competition: competitionShare(counts.herbivores),
    predatorPressure: predatorShare(counts.wolves),
  });
}
