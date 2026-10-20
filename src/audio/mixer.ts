/**
 * Sound mixer policy (Grok Bot): ONE bus layout, per-clip loudness trims, voice limits and the volume settings.
 * Native Web Audio only (see audio/music.ts for why not Tone.js). Howler.js was considered: it plays files reliably but
 * has no buses, voice caps or stealing, which is what this game was missing. Design follows the usual middleware
 * (Wwise/FMOD) pattern, as in zvuk's concurrency model (per-bus caps + steal strategy) and Web Engine's spatial culling:
 *   sources → bus (music | ambience | sfx | ui | voice) → master gain → limiter → speakers
 * Music sits behind its own duck gain, so loud one-shots and the wolf's voice dip it.
 */
import { createSettingsStore, type SettingDef } from '../core/renderSettings';

export type Bus = 'music' | 'ambience' | 'sfx' | 'ui' | 'voice';
export const BUSES: readonly Bus[] = ['music', 'ambience', 'sfx', 'ui', 'voice'];
/** Linear bus levels (0..1), set from the Sound volume panel and the M / [ ] / N / - = keys. */
export const BUS_LEVEL: Record<Bus | 'master', number> = { master: .8, music: .7, ambience: 1, sfx: 1, ui: 1, voice: 1 };
export const BUS_STATE = { muted: false, musicOn: false };

/** Loudness trims (dB) so every clip starts near −20 LUFS before MIX applies its intent. Measured with ffmpeg ebur128 on
 * public/sounds (2026-10-18): the raw ElevenLabs clips spanned −5 LUFS (howl, owl) to −56 LUFS (ui-click), a 51 dB
 * spread, and seven of them peaked at or above 0 dBFS. Trim = −20 − I, clamped to [−15, +18] dB and ≤ −1 dBFS peak. */
export const CLIP_TRIM_DB: Record<string, number> = {
  'amb-day': 8.0, 'amb-night': 11.4, 'chew': -5.3, 'dawn-chorus': -4.6, 'deer-hooves': 5.8, 'deer-snort': -6.8, 'friend-chime': -13.2,
  'hare-hop': 16.8, 'hare-squeak': -10.3, 'herb-pluck': 18.0, 'land': 13.1, 'loon': -6.3, 'music-day': -5.6, 'music-night': -3.9,
  'owl': -13.7, 'paw-run': 14.1, 'paw-walk': 18.0, 'pounce': -1.2, 'raven': -11.1, 'sprint-burst': -5.8, 'stealth-rustle': 18.0,
  'stone-roll': -1.6, 'ui-click': 18.0, 'ui-pause': -5.8, 'visitor-steps': 16.2, 'water': 3.9, 'wind-pines': 2.4, 'wolf-growl': -4.4,
  'wolf-howl': -14.7, 'wolf-pant': -2.9, 'wolf-whine': -6.4, 'woodpecker': -6.9,
};
export const VOICE_TRIM_DB = -3; // public/sounds/voice/* measure ≈ −17 LUFS
export const trim = (id: string) => 10 ** ((CLIP_TRIM_DB[id] ?? 0) / 20);

/** Which bus a clip plays on. Everything not listed is a gameplay effect. */
export const CLIP_BUS: Record<string, Bus> = {
  'amb-day': 'ambience', 'amb-night': 'ambience', 'wind-pines': 'ambience', 'water': 'ambience', 'loon': 'ambience', 'owl': 'ambience',
  'raven': 'ambience', 'woodpecker': 'ambience', 'dawn-chorus': 'ambience', 'music-day': 'music', 'music-night': 'music', 'ui-click': 'ui', 'ui-pause': 'ui',
};
export const busOf = (id: string): Bus => CLIP_BUS[id] ?? 'sfx';

/** Voice limits. Higher priority survives; footsteps and ambient calls are expendable. */
export const VOICES = {
  max: 24,          // one-shots sounding at once (loops not counted); Web Audio has no cap of its own (MDN)
  perClip: 3,       // same clip at once; a retrigger beyond this steals that clip's oldest voice
  perClipOverride: { 'paw-walk': 2, 'paw-run': 2, 'deer-hooves': 2, 'hare-hop': 2, 'chew': 2, 'ui-click': 1, 'ui-pause': 1, 'wolf-pant': 1 } as Record<string, number>,
  priority: { 'wolf-howl': 9, 'wolf-growl': 9, 'pounce': 8, 'land': 7, 'deer-snort': 7, 'hare-squeak': 7, 'friend-chime': 8, 'ui-pause': 8, 'ui-click': 6,
    'paw-walk': 1, 'paw-run': 2, 'hare-hop': 1, 'chew': 2, 'raven': 2, 'woodpecker': 2, 'owl': 3, 'loon': 3, 'stealth-rustle': 3 } as Record<string, number>,
  stealFadeSeconds: .03,
};
export const priorityOf = (id: string) => VOICES.priority[id] ?? 5;

export interface ActiveVoice { id: string; priority: number; start: number }
/** Admission (pure, tested): returns `{ ok: false }` to drop the new voice, or `{ ok: true, steal }` with the index of the
 * voice to stop first (−1 = none). Per-clip cap steals that clip's oldest; the global cap steals the lowest priority (oldest
 * among equals) only if it is not more important than the newcomer. */
export function admitVoice(active: readonly ActiveVoice[], id: string, priority: number, cfg = VOICES): { ok: boolean; steal: number } {
  const cap = cfg.perClipOverride[id] ?? cfg.perClip;
  let same = -1, sameCount = 0;
  active.forEach((v, i) => { if (v.id === id) { sameCount++; if (same < 0 || v.start < active[same].start) same = i; } });
  if (sameCount >= cap) return { ok: true, steal: same };
  if (active.length < cfg.max) return { ok: true, steal: -1 };
  let victim = -1;
  active.forEach((v, i) => { if (victim < 0 || v.priority < active[victim].priority || (v.priority === active[victim].priority && v.start < active[victim].start)) victim = i; });
  return victim >= 0 && active[victim].priority <= priority ? { ok: true, steal: victim } : { ok: false, steal: -1 };
}

/** Positional one-shots farther than this are not started at all (the inverse model never reaches zero). */
export const CULL_DISTANCE = 45;

let onChange: (() => void) | undefined;
/** BorealSound registers here so slider / key changes reach the live gain nodes. */
export function onBusChange(f: () => void) { onChange = f; }
const setLevel = (k: keyof typeof BUS_LEVEL) => (v: unknown) => { BUS_LEVEL[k] = Math.min(1, Math.max(0, Number(v))); onChange?.(); };
const slider = (id: keyof typeof BUS_LEVEL, label: string): SettingDef =>
  ({ id: `volume.${id}`, label, group: 'Volume', type: 'slider', min: 0, max: 1, step: .05, default: BUS_LEVEL[id], apply: setLevel(id) });
export const VOLUME_SETTINGS: SettingDef[] = [
  slider('master', 'Master'), slider('music', 'Music'), slider('ambience', 'Ambience (wind, water, birds)'),
  slider('sfx', 'Effects (animals, footsteps, actions)'), slider('voice', 'Wolf voice'), slider('ui', 'Interface'),
  { id: 'volume.muted', label: 'Mute everything (M)', group: 'Volume', type: 'toggle', default: false, apply: v => { BUS_STATE.muted = !!v; onChange?.(); } },
  { id: 'volume.musicOn', label: 'Music on (N)', group: 'Volume', type: 'toggle', default: false, apply: v => { BUS_STATE.musicOn = !!v; onChange?.(); } },
];
const VOLUME_KEY = 'boreal.volume.v1', OLD_KEY = 'boreal.audio.v1';
/** One-time carry-over of the old master/music levels (keys saved them under boreal.audio.v1). */
function migrate(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  try { if (!storage || storage.getItem(VOLUME_KEY)) return; const o = JSON.parse(storage.getItem(OLD_KEY) ?? '{}');
    const v: Record<string, unknown> = {}; if (typeof o.volume === 'number') v['volume.master'] = o.volume; if (typeof o.musicVolume === 'number') v['volume.music'] = o.musicVolume;
    if (typeof o.muted === 'boolean') v['volume.muted'] = o.muted; if (typeof o.musicOn === 'boolean') v['volume.musicOn'] = o.musicOn;
    if (Object.keys(v).length) storage.setItem(VOLUME_KEY, JSON.stringify(v)); } catch { /* defaults */ }
}
export function createVolumeStore(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
  migrate(storage); return createSettingsStore(VOLUME_SETTINGS, VOLUME_KEY, storage);
}
