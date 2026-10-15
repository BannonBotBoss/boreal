/**
 * Deer behaviour layer (Grok Bot). Runs after AnimalBrain.decide() and reshapes its output into more natural
 * white-tailed deer behaviour without touching the brain itself:
 * - idle cycles: graze (head down) -> chew/scan (head up) -> short walk, with per-deer random durations
 * - vigilance: grazing deer lift their head to scan every few seconds; more often when alone
 * - herd cohesion: deer within HERD.radius drift toward their group centre and align heading
 * - staggered alarm: on first sensing the wolf a deer freezes head-up (alert) for a personal 0.3-1.4 s, snorts,
 *   then bounds away (opening bound = a jump, like stotting) and keeps running to a safe distance, not just 24 m
 * - smooth turning: heading turns at a capped rate instead of snapping
 * - return to calm: after flight, an alert stand with head up before grazing again
 * Postures are written to rig.root.userData.posture for the rig ('graze' | 'scan' | 'alert' | 'flee' | 'walk').
 */
import type { AnimalBrain } from './animalBehavior';
import { random, range as lerp } from '../proc/rng';
import { angleTurn as turn } from '../proc/math';

export const HERD = {
  radius: 30, cohesion: .35, align: .25,
  turnRate: { calm: 1.2, flee: 4.5 },               // rad/s
  graze: [5, 14], scan: [1.5, 3.5], walk: [3, 9],  // seconds
  alertDelay: [.3, 1.4], fleeSafeDistance: 45, fleeMinSeconds: 4, fleeSpeed: 4.2, calmDown: [4, 9],
};
export type Posture = 'graze' | 'scan' | 'alert' | 'flee' | 'walk' | 'eat';
export interface DeerState {
  posture: Posture; timer: number; heading: number; alertLeft: number; fleeTime: number;
  threat?: { x: number; z: number }; bounded: boolean; rng: () => number; snorted: boolean; settled: number;
}
export interface DeerView { key: string; x: number; z: number; brain: AnimalBrain }

const states = new Map<string, DeerState>();

export function deerState(key: string, brain: AnimalBrain) {
  let s = states.get(key);
  if (!s) { const rng = random(brain.seed * 9301 + 49297); s = { posture: 'graze', timer: lerp(rng, HERD.graze), heading: brain.heading, alertLeft: 0, fleeTime: 0, bounded: false, rng, snorted: false, settled: 0 }; states.set(key, s); }
  return s;
}
export function forgetDeer(key: string) { states.delete(key); }

/** Call after brain.decide(dt). `herd` = every simulated deer this frame (positions before movement). */
export function shapeDeer(me: DeerView, herd: DeerView[], dt: number) {
  const b = me.brain, s = deerState(me.key, b);
  if (b.motion === 'jump' || b.problem === 'avoid') { s.heading = b.heading; return s.posture; }
  const threat = b.problem === 'escape' ? b.target ?? b.lastThreat : undefined;
  if (threat) s.threat = { x: threat.x, z: threat.z };
  const away = s.threat ? Math.atan2(me.x - s.threat.x, me.z - s.threat.z) + Math.PI : s.heading;
  const dThreat = s.threat ? Math.hypot(me.x - s.threat.x, me.z - s.threat.z) : Infinity;

  // A herd-mate already running is itself an alarm signal (with a shorter personal delay).
  const mates = herd.filter(o => o.key !== me.key && Math.hypot(o.x - me.x, o.z - me.z) < HERD.radius);
  s.settled = Math.max(0, s.settled - dt);
  const mateFleeing = s.settled <= 0 && mates.some(o => states.get(o.key)?.posture === 'flee');

  if ((threat || mateFleeing) && s.posture !== 'flee' && s.posture !== 'alert') {
    s.posture = 'alert'; s.alertLeft = lerp(s.rng, HERD.alertDelay) * (mateFleeing && !threat ? .5 : 1); s.snorted = false; s.bounded = false;
    if (!s.threat && mateFleeing) { const m = mates.find(o => states.get(o.key)?.threat)!; s.threat = m ? states.get(m.key)!.threat : undefined; }
  }
  if (s.posture === 'alert' && s.alertLeft > 0) {
    s.alertLeft -= dt; b.motion = 'idle'; b.speed = 0;
    if (s.threat) s.heading = turn(s.heading, away + Math.PI, HERD.turnRate.flee * dt); // stare at the wolf
    b.heading = s.heading;
    // Whirl away on the spot (deer pivot on their hind legs) before the first bound.
    if (s.alertLeft <= 0) { s.posture = 'flee'; s.fleeTime = 0; s.heading = away; b.heading = away; }
    return s.posture;
  }
  if (s.posture === 'flee') {
    s.fleeTime += dt;
    // Bounding run with a mild zig-zag; opening bound is a stotting-like leap.
    const zig = Math.sin(s.fleeTime * 2.2 + b.seed) * .35;
    s.heading = turn(s.heading, (s.threat ? Math.atan2(me.x - s.threat.x, me.z - s.threat.z) + Math.PI : s.heading) + zig, HERD.turnRate.flee * dt);
    b.heading = s.heading;
    if (!s.bounded && b.jumpCooldown === 0 && b.energy > 10) { s.bounded = true; b.motion = 'jump'; b.jumpTime = dt; b.speed = HERD.fleeSpeed; b.energy -= 1.5; return s.posture; }
    if ((dThreat > HERD.fleeSafeDistance && s.fleeTime > HERD.fleeMinSeconds && !threat) || b.energy < 8) {
      s.posture = 'scan'; s.timer = lerp(s.rng, HERD.calmDown); s.threat = undefined; s.settled = 15;
    } else { b.motion = 'run'; b.speed = Math.min(HERD.fleeSpeed, 2 + b.energy / 25); b.problem = 'escape'; }
    return s.posture;
  }
  if (b.problem === 'escape') { b.motion = 'idle'; b.speed = 0; } // calming down: brain still remembers, deer just stands
  if (b.problem === 'feed') { s.posture = b.motion === 'idle' ? 'eat' : 'walk'; s.heading = turn(s.heading, b.heading, HERD.turnRate.calm * dt); b.heading = s.heading; return s.posture; }
  if (b.problem === 'recover') { s.posture = 'scan'; return s.posture; }

  // Calm cycle replaces the brain's sine-wave wander.
  s.timer -= dt;
  if (s.timer <= 0) {
    const alone = mates.length === 0;
    s.posture = s.posture === 'graze' ? 'scan' : s.posture === 'scan' ? (s.rng() < .55 ? 'graze' : 'walk') : 'graze';
    s.timer = lerp(s.rng, s.posture === 'graze' ? HERD.graze : s.posture === 'scan' ? HERD.scan : HERD.walk) * (alone && s.posture === 'graze' ? .6 : 1);
  }
  let want = s.heading;
  if (mates.length) {
    const cx = mates.reduce((a, o) => a + o.x, 0) / mates.length, cz = mates.reduce((a, o) => a + o.z, 0) / mates.length;
    const toCentre = Math.atan2(me.x - cx, me.z - cz), far = Math.hypot(cx - me.x, cz - me.z) > 6;
    const avgHeading = Math.atan2(mates.reduce((a, o) => a + Math.sin(o.brain.heading), 0), mates.reduce((a, o) => a + Math.cos(o.brain.heading), 0));
    if (far) want = turn(want, toCentre, HERD.cohesion); else want = turn(want, avgHeading, HERD.align);
  } else want += Math.sin(b.time * .2 + b.seed) * .4;
  s.heading = turn(s.heading, want, HERD.turnRate.calm * dt);
  b.heading = s.heading; b.problem = 'explore';
  if (s.posture === 'walk') { b.motion = 'walk'; b.speed = .6; } else { b.motion = 'idle'; b.speed = 0; }
  return s.posture;
}
