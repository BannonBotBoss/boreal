/**
 * Social / group module (T-0036): generic for any group animal (hares, deer, rabbits fill in template.social).
 * Shared vigilance (the many-eyes effect), Matthew 01:47: each animal has its own awareness from its senses; mates within
 * the species' link distance (social.linkM) are linked and share detections, so the group's awareness is the UNION of the
 * linked members' ranges (chains count: A-B-C share). Each link adds the species' relay delay (a thump heard, a mate seen
 * bolting). Out of link distance, no relay. Scatter on alarm (the confusion effect): fleeing mates bend away from the group
 * centre so the predator must commit to one target (auto focus lock-on picks one). Pure TS: NPCs and an embodied hare.
 */
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';
import type { SpeciesTemplate } from './template';
import type { SensePoint } from '../senses';
export const SOCIAL = SYSTEM_PROPERTIES.social;
/** Hop count from every mate to every other through links of length <= linkM (Infinity = not linked). */
export function linkHops(sp: SpeciesTemplate, mates: readonly SensePoint[]) {
  const n = mates.length, L = sp.social.linkM.v, hops = mates.map(() => mates.map(() => Infinity));
  for (let s = 0; s < n; s++) {
    hops[s][s] = 0; const q = [s];
    while (q.length) { const a = q.shift()!; if (hops[s][a] >= SOCIAL.maxHops) continue;
      for (let b = 0; b < n; b++) if (hops[s][b] === Infinity && Math.hypot(mates[a].x - mates[b].x, mates[a].z - mates[b].z) <= L) { hops[s][b] = hops[s][a] + 1; q.push(b); } }
  }
  return hops;
}
/**
 * Shared detections: `seenAt[i]` = time mate i itself last perceived the predator (undefined = never). Returns, per mate,
 * the time it KNOWS of the predator through its links (own detection, or a linked mate's + relaySeconds x hops), or
 * undefined. Detections older than memorySeconds are dropped.
 */
export function sharedDetections(sp: SpeciesTemplate, mates: readonly SensePoint[], seenAt: readonly (number | undefined)[], now: number) {
  const hops = linkHops(sp, mates), relay = sp.social.relaySeconds.v;
  return mates.map((_, i) => {
    let best: number | undefined;
    for (let j = 0; j < mates.length; j++) {
      const t = seenAt[j]; if (t === undefined || hops[j][i] === Infinity || now - t > SOCIAL.memorySeconds + relay * hops[j][i]) continue;
      const known = t + relay * hops[j][i]; if (known <= now && (best === undefined || known < best)) best = known;
    }
    return best;
  });
}
/** True when mate i knows only through a link (for the embodied cue "relayed from a neighbour"). */
export const relayedOnly = (own: number | undefined, shared: number | undefined) => shared !== undefined && own === undefined;
/** Scatter bend (rad, signed) for mate `i`: away from the linked group centre, relative to fleeing straight from the threat. */
export function scatterBend(sp: SpeciesTemplate, mates: readonly SensePoint[], i: number, threat: SensePoint) {
  const me = mates[i]; let cx = 0, cz = 0, n = 0;
  for (let j = 0; j < mates.length; j++) if (j !== i && Math.hypot(mates[j].x - me.x, mates[j].z - me.z) <= sp.social.linkM.v) { cx += mates[j].x; cz += mates[j].z; n++; }
  if (!n || !sp.social.scatter.v) return 0;
  cx /= n; cz /= n;
  const ax = me.x - threat.x, az = me.z - threat.z, gx = me.x - cx, gz = me.z - cz;
  return (ax * gz - az * gx >= 0 ? -1 : 1) * sp.social.scatter.v;
}
/**
 * Group-size effect on vigilance (Matthew 01:49: "the hare being able to avoid predators easier, allowing it to graze
 * longer"). `linked` = mates linked to this one (linkHops finite). Returns the individual scan share, the graze share,
 * the corporate vigilance of the linked group and the multipliers for the host's scan/graze bout timers: T-0009's
 * core/agent pipeline multiplies scanChance by `chance` and the scan length by `duration` (chance x duration = share
 * ratio); main's animals/hare.ts lengthens its graze (nibble) bout by `graze`.
 */
export function vigilance(sp: SpeciesTemplate, linked: number) {
  const V = sp.social.vigilance, n = 1 + Math.max(0, linked), share = V.loneShare.v * n ** -V.exponent.v, ratio = share / V.loneShare.v;
  return { share, grazeShare: 1 - share, corporate: 1 - (1 - share) ** n, chance: Math.sqrt(ratio), duration: Math.sqrt(ratio), graze: (1 - share) / (1 - V.loneShare.v) };
}
/** Linked mates of each animal (count). */
export const linkedCounts = (sp: SpeciesTemplate, mates: readonly SensePoint[]) => linkHops(sp, mates).map((row, i) => row.filter((h, j) => j !== i && h !== Infinity).length);
/** Time-averaged intake (kg/s) of a grazer: bite rate while feeding x the graze share (vigilance) - more mates, more food. */
export const grazeRate = (sp: SpeciesTemplate, food: string, linked: number) => {
  const f = sp.diet.foods[food]; return f ? f.biteKg.v / f.eatSeconds.v * vigilance(sp, linked).grazeShare : 0;
};
