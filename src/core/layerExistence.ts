/** Which globe layers EXIST at a deep-time offset, from their causes (Matt: "weather layers should vanish before they formed").
 *  Each layer is a function of physical state derived here (surface cooled below boiling, oxygen level, ozone column, dynamo,
 *  water not yet lost by the brightening Sun via core/deepTime). Onset evidence is used to set and VALIDATE the state
 *  histories (tests/layer-existence.test.ts), and is cited. Where the cause is not simulated over Gyr (biology, plate onset),
 *  the onset is an evidence date and is flagged `evidenceDate`.
 *  Sources: Moon-forming impact ~4.51 Ga (Barboni et al. 2017, Sci. Adv. 3:e1602365); magma ocean / steam atmosphere cooling
 *  within ~100 Myr (Zahnle et al. 2007, Space Sci. Rev. 129:35); liquid water by 4.4 Ga (Wilde et al. 2001, Nature 409:175);
 *  O2 history (Lyons, Reinhard & Planavsky 2014, Nature 506:307): <1e-5 PAL before the GOE 2.4-2.3 Ga, ~1e-3..1e-1 PAL in the
 *  Proterozoic, near-modern after ~0.55 Ga; ozone shield ~ substantial above ~10 % PAL O2 (Segura et al. 2003, Astrobiology 3:689);
 *  dynamo 3.5 Ga (Tarduno 2010), Snowball Earth 717-635 Ma (Hoffman et al. 2017, Sci. Adv. 3:e1600983); land plants ~470 Ma
 *  (Wellman et al. 2003, Nature 425:282), forests ~385 Ma (Stein et al. 2007, Nature 446:904); plate-tectonics onset ~3.0-3.2 Ga
 *  DISPUTED (Cawood et al. 2018, Phil. Trans. A 376); oceans lost from the flux threshold in deepTime (~+1.8-2 Gyr). */
import { DEEP, luminosityRatio, stageAt, yearsAtLuminosity } from './deepTime';

/** Hook for the seeded formation model (docs/deep-time-causes.md, separate work): a world seed and the Moon's existence/orbit.
 *  Defaults = our Earth. Consumers: earthState (tides, day length, obliquity stabilisation are passed through for the globe). */
export interface WorldHooks { seed: number; impactYr?: number; moon?: { exists: boolean; formedYr: number; aKmAt?(offsetYr: number): number; dayLengthHAt?(offsetYr: number): number; stabilisesObliquity: boolean } }
export const OUR_WORLD: WorldHooks = { seed: 1, impactYr: -4.51e9, moon: { exists: true, formedYr: -4.51e9, stabilisesObliquity: true } };
export type Existence = 'not-yet-formed' | 'present' | 'gone';
export const ONSET = { impactYr: -4.51e9, coolMyr: 110, goeYr: -2.35e9, neoOxYr: -0.6e9, dynamoYr: -3.5e9, snowball: [[-717e6, -660e6], [-650e6, -635e6]] as [number, number][],
  landPlantsYr: -470e6, forestsYr: -385e6, platesYr: -3.1e9 };
/** O2 in present atmospheric level (PAL), piecewise log-linear through Lyons 2014 */
export function o2PAL(offsetYr: number) {
  if (offsetYr < ONSET.goeYr) return 1e-6; if (offsetYr < -0.8e9) return 1e-2; if (offsetYr < -0.4e9) return 10 ** (-2 + 2 * (offsetYr + 0.8e9) / 0.4e9); return 1;
}
/** state at an offset (yr, negative = past) */
export function earthState(offsetYr: number, world: WorldHooks = OUR_WORLD) {
  const impact = world.impactYr ?? ONSET.impactYr, moon = world.moon;
  const formed = offsetYr >= -DEEP.earthAgeYr, cooled = offsetYr >= impact + ONSET.coolMyr * 1e6;
  const waterLost = offsetYr >= yearsAtLuminosity(DEEP.flux.waterLoss), o2 = o2PAL(offsetYr);
  const snowball = ONSET.snowball.some(([a, b]) => offsetYr >= a && offsetYr <= b);
  return { formed, moltenSurface: formed && !cooled, liquidWater: formed && cooled && !waterLost, waterLost, o2PAL: o2, ozoneShield: o2 >= 0.1,
    dynamo: offsetYr >= ONSET.dynamoYr && stageAt(offsetYr) !== 'engulfed', snowball, sunRatio: luminosityRatio(offsetYr).ratio, seed: world.seed,
    moon: moon && moon.exists && offsetYr >= moon.formedYr ? { aKm: moon.aKmAt?.(offsetYr) ?? null, dayLengthH: moon.dayLengthHAt?.(offsetYr) ?? null, stabilisesObliquity: moon.stabilisesObliquity } : null,
    composition: o2 < 1e-3 ? 'N2-CO2 (anoxic)' : o2 < 0.5 ? 'N2-CO2 with trace O2' : 'N2-O2 (modern)' };
}
const ex = (cause: boolean, past: boolean): Existence => cause ? 'present' : past ? 'not-yet-formed' : 'gone';
/** per-layer existence; `why` names the cause */
export function layerExistence(offsetYr: number, world: WorldHooks = OUR_WORLD) {
  const s = earthState(offsetYr, world), past = offsetYr < 0;
  return {
    atmosphere: { e: ex(s.formed && stageAt(offsetYr) !== 'engulfed', past), why: `composition ${s.composition}` },
    ocean: { e: ex(s.liquidWater, past && !s.waterLost), why: s.moltenSurface ? 'magma ocean: surface above boiling' : s.waterLost ? 'water lost (Sun flux > waterLoss)' : 'liquid water' },
    clouds: { e: ex(s.liquidWater, past && !s.waterLost), why: 'hydrological cycle needs liquid water' },
    snowIce: { e: ex(s.liquidWater, past && !s.waterLost), why: s.snowball ? 'snowball episode: global ice' : 'where the energy budget allows' },
    ozone: { e: ex(s.ozoneShield, past), why: `O2 ${s.o2PAL.toExponential(1)} PAL (shield >= 0.1 PAL)` },
    aurora: { e: ex(s.dynamo, past), why: 'needs the geodynamo field' },
    vegetation: { e: ex(offsetYr >= ONSET.landPlantsYr && s.liquidWater, past), why: 'land plants ~470 Ma [evidenceDate]', evidenceDate: true },
    forests: { e: ex(offsetYr >= ONSET.forestsYr && s.liquidWater, past), why: 'forests ~385 Ma [evidenceDate]', evidenceDate: true },
    plates: { e: ex(offsetYr >= ONSET.platesYr && s.formed, past), why: 'modern plate tectonics ~3.0-3.2 Ga [DISPUTED, evidenceDate]', evidenceDate: true },
    state: s,
  };
}
