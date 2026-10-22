/**
 * Held focus (Grok Bot, T-0035, Matthew 2026-10-22 ~01:00 PT): "It should only be engaged by holding down a button on the game
 * pad. When that is engaged, the wolf should automatically steer towards it when I am moving the wolf. The autofocus can only
 * be engaged when an object is within a given radius."
 * Replaces the automatic focus that super stealth used to switch on by itself (deer/person within 30 m). Pure: main.ts feeds it.
 *  - engage: only while `held` (Focus binding: gamepad LB, keyboard F) and an interactable object is within FOCUS.radius;
 *  - pick: the object in front (view cone, cos > FOCUS.cone, the same cone the old focus used) with the lowest distance x
 *    (2 - cos): near and centred wins; the pick is kept while held and in range, dropped when it leaves the radius;
 *  - steer: only while moving forward and not steering by hand, the heading turns toward the target at the player's own
 *    turn rate (main.ts: 2.2 rad/s at full stick), clamped per step, so it never snaps; speed and gait stay with the player.
 * Radius 12 m: twice the 6 m interaction reach (core/events availableActions), so a target can be locked while still a few
 * strides away and walked into reach; a game-feel distance, not a natural quantity.
 */
export const FOCUS = { radius: 12, cone: .4, turnRate: 2.2 };
/** Kinds the focus can lock: everything with a player interaction except pebbles (move only at nose contact, dozens per patch). */
export const FOCUS_KINDS = ['plant', 'deer', 'person', 'forage'];
export interface FocusItem { key: string; kind: string; x: number; z: number }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Forward unit vector for a heading (core: forward = (-sin h, -cos h)). */
const cosTo = (px: number, pz: number, view: number, e: FocusItem) => { const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz); return d < 1e-6 ? 1 : (-Math.sin(view) * dx - Math.cos(view) * dz) / d; };

/** The focused item this frame (undefined = no focus). `view` = body heading + camera look offset. */
export function pickFocus<T extends FocusItem>(held: boolean, current: T | undefined, p: { x: number; z: number; view: number }, items: readonly T[], kinds: readonly string[] = FOCUS_KINDS): T | undefined {
  if (!held) return undefined;
  const inRange = items.filter(e => kinds.includes(e.kind) && Math.hypot(e.x - p.x, e.z - p.z) <= FOCUS.radius);
  if (current) { const still = inRange.find(e => e.key === current.key); if (still) return still; }
  let best: T | undefined, score = Infinity;
  for (const e of inRange) { const c = cosTo(p.x, p.z, p.view, e); if (c <= FOCUS.cone) continue; const s = Math.hypot(e.x - p.x, e.z - p.z) * (2 - c); if (s < score) { score = s; best = e; } }
  return best;
}

/** Heading change for one step of `dt` s: toward the target while moving forward with no hand steering, else undefined
 *  (the caller keeps its manual steering). Never more than FOCUS.turnRate * dt. */
export function focusSteer(heading: number, p: { x: number; z: number }, target: FocusItem | undefined, forward: number, steer: number, dt: number) {
  if (!target || forward <= .01 || Math.abs(steer) > .01) return undefined;
  const want = Math.atan2(-(target.x - p.x), -(target.z - p.z)), err = wrap(want - heading), max = FOCUS.turnRate * dt;
  return Math.max(-max, Math.min(max, err));
}