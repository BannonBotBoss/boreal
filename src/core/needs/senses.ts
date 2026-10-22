/**
 * Shared perception (T-0036): one function reads any species' template senses (sight in its field of view, hearing of
 * footfalls, smell through core/senses scentLevel) and says how strongly it perceives another body. Drives the NPC
 * notice/flight (animals/hare) and the embodied player's predator-awareness cue. Pure: no world records.
 */
import { bearingTo, scentLevel, type SensePoint } from '../senses';
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';
import type { SpeciesTemplate } from './template';
export const SENSE_RULES = SYSTEM_PROPERTIES.perception;
export interface Observer extends SensePoint { heading: number }
export interface Body extends SensePoint { kind?: string; speed: number; crouched?: boolean; potency?: number }
export interface SenseEnv { daylight: number; wind: SensePoint }
export interface Percept { sight: number; hearing: number; scent: number; level: number; bearing: number; distance: number }
const ramp = (a: number, b: number, v: number) => Math.max(0, Math.min(1, (v - a) / Math.max(1e-6, b - a)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** True when `b` is inside the observer's visual field (fovDeg total, centred on its heading). */
export const inView = (sp: SpeciesTemplate, o: Observer, b: SensePoint) => Math.abs(bearingTo(o, b, o.heading)) <= sp.senses.sight.fovDeg.v * Math.PI / 360;
export function perceive(sp: SpeciesTemplate, o: Observer, b: Body, env: SenseEnv): Percept {
  const { sight: si, hearing: he, smell: sm } = sp.senses, distance = Math.hypot(b.x - o.x, b.z - o.z), bearing = bearingTo(o, b, o.heading);
  const vis = si.night.v + (1 - si.night.v) * clamp01(env.daylight);
  const presence = clamp01(1 - distance / (si.presenceM.v * (b.crouched ? si.crouched.v : 1)));
  const moving = ramp(si.motion.v[0], si.motion.v[1], b.speed) * clamp01(1 - distance / si.rangeM.v);
  const sight = inView(sp, o, b) ? vis * Math.max(moving, presence) : 0;
  const hearing = ramp(he.loud.v[0], he.loud.v[1], b.speed) * clamp01(1 - distance / he.rangeM.v);
  const scent = scentLevel(o, { key: b.kind ?? 'body', kind: b.kind ?? 'body', potency: sm.potency.v * (b.potency ?? 1), x: b.x, z: b.z }, env.wind);
  return { sight, hearing, scent, level: Math.max(sight, hearing, scent), bearing, distance };
}
/** The strongest perceived feared animal (behaviour.flight.fears), for the embodied player's predator cue and NPC flight. */
export function strongestThreat(sp: SpeciesTemplate, o: Observer, bodies: readonly Body[], env: SenseEnv) {
  let best: (Percept & { body: Body }) | undefined;
  for (const b of bodies) {
    if (!b.kind || !sp.behaviour.flight.fears.includes(b.kind)) continue;
    const p = perceive(sp, o, b, env); if (p.level >= SENSE_RULES.cueAt && (!best || p.level > best.level)) best = { ...p, body: b };
  }
  return best;
}
/** HUD text for the predator cue: kind, clock bearing and how sure. */
export function threatCue(t: { body: Body; bearing: number; distance: number; level: number } | undefined) {
  if (!t) return '';
  const deg = t.bearing * 180 / Math.PI, side = Math.abs(deg) < 45 ? 'ahead' : Math.abs(deg) > 135 ? 'behind' : deg > 0 ? 'right' : 'left';
  return `${t.level > .6 ? '⚠' : '?'} ${t.body.kind} ${side} ${t.distance.toFixed(0)} m`;
}
