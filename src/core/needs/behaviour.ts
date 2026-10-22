/**
 * Behaviour model (T-0036): needs + activity pattern + threats -> goal and gait, from the species template only. Pure and
 * deterministic (rule 5: no random actions; every goal has a felt or sensed cause). NPCs act on it; the embodied player
 * gets the same needs and thoughts but chooses for itself.
 */
import type { Gait, Goal, NeedId, SpeciesTemplate } from './template';
import type { NeedLevels } from './engine';
import { declination, LATITUDE } from '../timeOfDay';
/** Local solar sunrise/sunset hours for a day of year (sunrise equation cos h0 = -tan(phi) tan(delta); core/timeOfDay solar). */
export function sunTimes(dayOfYear: number, latitude = LATITUDE) {
  const R = Math.PI / 180, c = -Math.tan(latitude * R) * Math.tan(declination(dayOfYear) * R), h0 = Math.acos(Math.max(-1, Math.min(1, c))) / R / 15;
  return { sunrise: 12 - h0, sunset: 12 + h0 };
}
export interface BehaviourContext { hour: number; sunrise: number; sunset: number; threat?: { kind: string; distance: number } }
export interface Choice { goal: Goal; gait: Gait; urgency: number; need?: NeedId; why: string }
const near = (h: number, at: number, w: number) => Math.abs(((h - at + 36) % 24) - 12) <= w;
/** How strongly the species is inclined to be active at this hour (0..1): 1 in its active window, offPeak outside.
 *  Crepuscular windows are sunrise/sunset +-1.5 h (Theuerkauf et al. 2003 define dawn/dusk as +-1 h; widened a little). */
export function activityAt(sp: SpeciesTemplate, c: Pick<BehaviourContext, 'hour' | 'sunrise' | 'sunset'>) {
  const A = sp.behaviour.activity, day = c.hour > c.sunrise && c.hour < c.sunset;
  const on = A.pattern === 'crepuscular' ? near(c.hour, c.sunrise, 1.5) || near(c.hour, c.sunset, 1.5)
    : A.pattern === 'nocturnal' ? !day : A.pattern === 'diurnal' ? day : true;
  return A.pattern === 'cathemeral' ? A.activeShare.v : on ? 1 : A.offPeak.v;
}
export const gaitFor = (sp: SpeciesTemplate, urgency: number): Gait => {
  const [run, sprint] = sp.behaviour.gaitAt.v; return urgency >= sprint ? 'sprint' : urgency >= run ? 'run' : 'walk';
};
export function chooseGoal(sp: SpeciesTemplate, levels: NeedLevels, c: BehaviourContext): Choice {
  const B = sp.behaviour, t = c.threat;
  if (t && B.flight.fears.includes(t.kind)) {
    if (t.distance <= B.flight.distanceM.v) return { goal: 'flee', gait: 'sprint', urgency: 1, why: `${t.kind} inside ${B.flight.distanceM.v} m` };
    if (t.distance <= 3 * B.flight.distanceM.v) return { goal: 'alert', gait: 'idle', urgency: .5, why: `${t.kind} at ${t.distance.toFixed(0)} m` };
  }
  let best: Choice | undefined, bestRel = Infinity;
  for (const need of Object.keys(B.drives) as NeedId[]) {
    const d = B.drives[need], lv = levels[need], below = d.seekBelow.v;
    if (lv >= below) continue;
    const rel = lv / below; if (rel >= bestRel) continue;
    bestRel = rel; const urgency = lv <= 10 ? Math.max(1 - rel, .95) : 1 - rel; // critical: hurry
    best = { goal: d.goal, gait: d.goal === 'bed-down' ? 'walk' : gaitFor(sp, urgency), urgency, need, why: `${need} ${lv.toFixed(0)} % < ${below} %` };
  }
  if (best) return best;
  const a = activityAt(sp, c);
  // off-peak: an animal that is not fully rested rests (Theuerkauf et al. 2003: inactivity bouts fill the troughs)
  return a >= .5 || levels.rest >= 90 ? { goal: 'explore', gait: 'walk', urgency: 0, why: `${B.activity.pattern}: active hour` } : { goal: 'rest', gait: 'idle', urgency: 0, why: `${B.activity.pattern}: rest hour` };
}
