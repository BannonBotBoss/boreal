/**
 * Wall feedback (Grok Bot): ONE module for every editor input. `softWall` (pure) gives the soft-resistance + hard-stop
 * value; `createWallFeedback` fires haptics + an optional audio thunk ONCE when an input reaches a wall (debounced per
 * input until it leaves the wall), never per frame. Haptics: Gamepad dual-rumble / hapticActuators, WebXR controller
 * pulse, navigator.vibrate (phones); a silent no-op elsewhere. Desktop mouse/pen have no web haptics API: the audio
 * thunk and the visual wall are the cue there.
 */
/** Map a raw (unbounded) value into [min, max] with soft resistance over the last `zone` share of the range:
 * inside the zone the response eases (half speed at the edge of the zone), and it hits the bound exactly when the raw
 * value is one zone-width PAST the bound; anything further is a hard stop. `push` = how hard past the wall (0..1+). */
export function softWall(raw: number, min: number, max: number, zone = .1) {
  const d = (max - min) * zone; if (!(d > 0)) return { value: Math.min(max, Math.max(min, raw)), wall: raw >= max || raw <= min, push: 0 };
  const ease = (over: number) => over >= 2 * d ? d : d * (1 - (1 - over / (2 * d)) ** 2); // C1 at the zone start
  if (raw > max - d) { const over = raw - (max - d), v = max - d + ease(over); return { value: Math.min(max, v), wall: over >= 2 * d - 1e-9, push: Math.max(0, (over - 2 * d) / d) }; }
  if (raw < min + d) { const over = min + d - raw, v = min + d - ease(over); return { value: Math.max(min, v), wall: over >= 2 * d - 1e-9, push: Math.max(0, (over - 2 * d) / d) }; }
  return { value: raw, wall: false, push: 0 };
}
export interface HapticTargets { gamepads?(): (Gamepad | null)[]; vibrate?(ms: number): unknown; xr?(): { inputSources?: Iterable<XRInputSource> } | undefined; thunk?(strength: number): void }
export const FEEL = { haptics: true, intensity: .6, sound: true };
/** Editor wall hit: the 'wall' table entry through the shared dispatcher, scaled by how hard you push, + audio thunk. */
export function pulse(strength: number, t: HapticTargets) {
  const s = Math.min(1, Math.max(.1, strength)); haptic('wall', 0, s); if (FEEL.sound) t.thunk?.(s * FEEL.intensity);
}
/** Per-input debounce: `update(id, atWall, push)` pulses only on the frame an input ARRIVES at a wall. */
export function createWallFeedback(targets: HapticTargets, fire: (s: number, t: HapticTargets) => void = pulse) {
  const at = new Set<string>();
  return {
    update(id: string, wall: boolean, push = 0) { if (wall && !at.has(id)) { at.add(id); fire(.4 + push, targets); return true; } if (!wall) at.delete(id); return false; },
    release(id: string) { at.delete(id); },
  };
}
export type WallFeedback = ReturnType<typeof createWallFeedback>;
/** Browser defaults: real gamepads, phone vibration (touch devices only), a WebXR session if the app set one. */
let xrSession: { inputSources?: Iterable<XRInputSource> } | undefined;
export const setXRSession = (s?: { inputSources?: Iterable<XRInputSource> }) => { xrSession = s; };
export const browserTargets = (thunk?: (s: number) => void): HapticTargets => ({
  gamepads: () => typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : [],
  vibrate: ms => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && navigator.vibrate?.(ms),
  xr: () => xrSession, thunk,
});
/** Visual wall for any range input in `root`: flashes the track when it sits at its min/max, and reports the hit. */
export function wallifyRanges(root: HTMLElement, fb: WallFeedback) {
  root.addEventListener('input', e => {
    const i = e.target as HTMLInputElement; if (i.type !== 'range') return;
    const v = Number(i.value), wall = v <= Number(i.min) || v >= Number(i.max) || i.dataset.wall === '1';
    i.classList.toggle('at-wall', wall); if (fb.update(`range:${i.dataset.key ?? i.name ?? ''}:${Array.from(root.querySelectorAll('input')).indexOf(i)}`, wall)) { i.classList.remove('flash'); void i.offsetWidth; i.classList.add('flash'); }
  });
}

let thunk: ((s: number) => void) | undefined;
export const setThunk = (fn: (s: number) => void) => { thunk = fn; };
/** The shared feedback instance every editor input uses. */
export const wallFeedback = createWallFeedback(browserTargets(s => thunk?.(s)));

// ---- gameplay / UI haptics: one data table + one dispatcher -------------------------------------------------
export type HapticCategory = 'gameplay' | 'ui' | 'editor';
export interface HapticPattern { cat: HapticCategory; ms: number; strong: number; weak: number; repeats?: number; gapMs?: number; minIntervalMs: number; falloff?: number /* m: zero at this distance */ }
/** Event id -> pattern. Add an event = add one row (and one `haptic(id)` call at the point the sound already plays). */
export const HAPTIC_EVENTS: Record<string, HapticPattern> = {
  action:   { cat: 'gameplay', ms: 60, strong: .35, weak: .2, minIntervalMs: 250 },
  land:     { cat: 'gameplay', ms: 90, strong: .6, weak: .3, minIntervalMs: 200, falloff: 12 },
  pounce:   { cat: 'gameplay', ms: 120, strong: .8, weak: .4, minIntervalMs: 300 },
  catch:    { cat: 'gameplay', ms: 80, strong: .9, weak: .5, repeats: 2, gapMs: 90, minIntervalMs: 600 },
  stride:   { cat: 'gameplay', ms: 25, strong: 0, weak: .18, minIntervalMs: 180 },
  heartbeat:{ cat: 'gameplay', ms: 70, strong: .45, weak: .1, repeats: 2, gapMs: 160, minIntervalMs: 1500 },
  howl:     { cat: 'gameplay', ms: 400, strong: .15, weak: .35, minIntervalMs: 2000, falloff: 40 },
  growl:    { cat: 'gameplay', ms: 250, strong: .4, weak: .2, minIntervalMs: 800, falloff: 25 },
  deerBolt: { cat: 'gameplay', ms: 110, strong: .4, weak: .3, minIntervalMs: 700, falloff: 30 },
  water:    { cat: 'gameplay', ms: 140, strong: .2, weak: .4, minIntervalMs: 1500 },
  scrub:    { cat: 'ui', ms: 12, strong: 0, weak: .15, minIntervalMs: 60 },
  shutter:  { cat: 'ui', ms: 45, strong: .5, weak: .2, minIntervalMs: 120 },
  click:    { cat: 'ui', ms: 15, strong: 0, weak: .2, minIntervalMs: 80 },
  wall:     { cat: 'editor', ms: 50, strong: .5, weak: .3, minIntervalMs: 120 },
};
/** Sound effects that already exist -> haptic event (borealSound.playAt calls `haptic` with this). */
export const SOUND_HAPTICS: Record<string, string> = { 'stone-roll': 'action', 'herb-pluck': 'action', 'wolf-whine': 'action', land: 'land', pounce: 'catch',
  'sprint-burst': 'pounce', 'paw-run': 'stride', 'wolf-pant': 'heartbeat', 'wolf-howl': 'howl', 'wolf-growl': 'growl', 'deer-hooves': 'deerBolt', 'ui-click': 'click', 'ui-pause': 'click' };
export const HAPTIC_CATS: Record<HapticCategory, boolean> = { gameplay: true, ui: true, editor: true };
/** Shared dispatcher with a per-event rate limit; `distance` applies the event's falloff. Returns whether it fired. */
export function createHaptics(targets: HapticTargets, now: () => number = () => performance.now(), out: (s: number, w: number, ms: number, t: HapticTargets) => void = rumble) {
  const last = new Map<string, number>();
  return (id: string, distance = 0, scale = 1) => {
    const p = HAPTIC_EVENTS[id]; if (!p || !FEEL.haptics || !HAPTIC_CATS[p.cat]) return false;
    const k = p.falloff ? Math.max(0, 1 - distance / p.falloff) : 1, t = now(); if (k <= 0 || t - (last.get(id) ?? -Infinity) < p.minIntervalMs) return false;
    last.set(id, t); const g = k * scale * FEEL.intensity;
    for (let r = 0; r < (p.repeats ?? 1); r++) { const fire = () => out(p.strong * g, p.weak * g, p.ms, targets); if (r === 0) fire(); else setTimeout(fire, r * (p.ms + (p.gapMs ?? 80))); }
    return true;
  };
}
function rumble(strong: number, weak: number, ms: number, t: HapticTargets) {
  for (const g of t.gamepads?.() ?? []) {
    const gp = g as Gamepad & { vibrationActuator?: { playEffect?(type: string, p: object): Promise<unknown> }; hapticActuators?: { pulse?(v: number, ms: number): unknown }[] };
    if (gp?.vibrationActuator?.playEffect) void gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    else gp?.hapticActuators?.[0]?.pulse?.(Math.max(strong, weak), ms);
  }
  for (const src of t.xr?.()?.inputSources ?? []) (src.gamepad as unknown as { hapticActuators?: { pulse?(v: number, ms: number): unknown }[] } | undefined)?.hapticActuators?.[0]?.pulse?.(Math.max(strong, weak), ms);
  if (Math.max(strong, weak) > .12) t.vibrate?.(ms);
}
/** The game-wide dispatcher: `haptic('land')`, `haptic('deerBolt', metres)`. */
export const haptic = createHaptics(browserTargets());
