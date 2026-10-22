/**
 * Thought bubbles (T-0036; Matthew): below 30 % a semi-transparent icon of that need floats up from the head every 10 s and
 * fades to 0 over ~1.75 s; at/below 10 % it becomes a pulsing alert that repeats every 3 s. Several low needs are staggered
 * in time (first bubble offset by STAGGER s per lane) and stacked in lanes (most urgent lowest), so they stay readable.
 * Pure: the renderer (render/thoughtBubbles) draws what this schedules. Times are REAL seconds (what the player sees).
 */
import type { NeedId, SpeciesTemplate } from './template';
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';
/** The thought-bubble system properties (src/config/systemProperties.ts). */
export const THOUGHT_RULES = SYSTEM_PROPERTIES.needsThoughts;
import type { NeedLevels } from './engine';
export type ThoughtStyle = 'low' | 'alert';
export interface Thought { need: NeedId; style: ThoughtStyle; born: number; lane: number }
export interface ThoughtClock { next: Partial<Record<NeedId, number>>; style: Partial<Record<NeedId, ThoughtStyle>> }
export const createThoughtClock = (): ThoughtClock => ({ next: {}, style: {} });
export const STAGGER = THOUGHT_RULES.stagger;
export const ICON: Record<NeedId, { glyph: string; color: string; label: string }> = {
  water: { glyph: 'drop', color: '#5ab8ff', label: 'thirsty' },
  energy: { glyph: 'meat', color: '#ffb05a', label: 'hungry' },
  rest: { glyph: 'moon', color: '#c9b6ff', label: 'tired' },
};
export function styleOf(level: number, sp?: SpeciesTemplate, need?: NeedId): ThoughtStyle | undefined {
  const o = need ? sp?.thoughts?.[need] : undefined, crit = o?.critical ?? THOUGHT_RULES.critical, low = o?.low ?? THOUGHT_RULES.low;
  return level <= crit ? 'alert' : level < low ? 'low' : undefined;
}
/** Advance the clock to time t; returns the thoughts born now. */
export function thoughtTick(clock: ThoughtClock, levels: NeedLevels, t: number, sp?: SpeciesTemplate): Thought[] {
  const low = (Object.keys(levels) as NeedId[]).map(n => ({ n, s: styleOf(levels[n], sp, n) })).filter(x => x.s).sort((a, b) => levels[a.n] - levels[b.n]);
  for (const n of Object.keys(clock.next) as NeedId[]) if (!low.some(x => x.n === n)) { delete clock.next[n]; delete clock.style[n]; }
  const born: Thought[] = [];
  low.forEach(({ n, s }, lane) => {
    if (clock.style[n] !== s) { clock.style[n] = s; clock.next[n] = t + lane * STAGGER; } // new or changed style: soon, staggered
    if (t >= clock.next[n]!) {
      born.push({ need: n, style: s!, born: t, lane });
      clock.next[n] = t + (s === 'alert' ? THOUGHT_RULES.criticalEvery : THOUGHT_RULES.lowEvery);
    }
  });
  return born;
}
/** How a thought looks at time t (undefined when gone): alpha (semi-transparent, to 0), rise (m), scale (alert pulses ~3 Hz). */
export function thoughtLook(th: Thought, t: number) {
  const fade = th.style === 'alert' ? THOUGHT_RULES.alertFade : THOUGHT_RULES.fade, age = t - th.born;
  if (age < 0 || age >= fade) return undefined;
  const R = THOUGHT_RULES, k = age / fade, base = th.style === 'alert' ? R.alertOpacity : R.lowOpacity, fadeIn = Math.min(1, age / R.fadeIn);
  return { alpha: base * fadeIn * (1 - k) ** 1.5, rise: R.rise * Math.sqrt(k) + th.lane * R.laneSpacing, scale: th.style === 'alert' ? 1 + R.pulseDepth / 2 + R.pulseDepth * Math.sin(age * Math.PI * 2 * R.pulseHz) : 1 };
}
