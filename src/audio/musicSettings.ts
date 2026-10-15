/** Music settings schema (same SettingDef/store/panel as Render settings). */
import type { SettingDef } from '../core/renderSettings';
import { MUSIC, PULSE_PRESETS } from './music';

const presetOf = (hz: number) => Object.keys(PULSE_PRESETS).find(k => PULSE_PRESETS[k] === hz) ?? 'Custom';
export const MUSIC_SAFETY = 'Safety: rhythmic pulsing tones (isochronic tones, binaural beats) can trigger photosensitive or audio-sensitive conditions, such as some forms of epilepsy. Stop if you feel unwell, and keep the volume moderate. Binaural beats need headphones.';
export const MUSIC_SETTINGS: SettingDef[] = [
  { id: 'music.source', label: 'Source', group: 'Music', type: 'select', options: ['Built-in ambient', 'Isochronic tones', 'Binaural beats', 'Playlist', 'Off'], default: 'Built-in ambient', apply: v => { MUSIC.source = v as typeof MUSIC.source; } },
  { id: 'music.level', label: 'Music source level', group: 'Music', type: 'slider', min: 0, max: 1, step: .05, default: .35, apply: v => { MUSIC.level = Number(v); } },
  { id: 'music.follow', label: 'Music follows weather / time of day', group: 'Music', type: 'toggle', default: false, apply: v => { MUSIC.followWorld = !!v; } },
  { id: 'music.preset', label: 'Pulse rate preset', group: 'Tones', type: 'select', options: Object.keys(PULSE_PRESETS), default: 'Gamma 40 Hz', apply: v => { MUSIC.pulse = PULSE_PRESETS[v as string] ?? MUSIC.pulse; } },
  { id: 'music.pulse', label: 'Pulse rate (Hz)', group: 'Tones', type: 'slider', min: 1, max: 45, step: .5, default: 40, apply: v => { MUSIC.pulse = Number(v); } },
  { id: 'music.carrier', label: 'Carrier tone (Hz)', group: 'Tones', type: 'slider', min: 100, max: 500, step: 5, default: 300, apply: v => { MUSIC.carrier = Number(v); } },
  { id: 'music.shape', label: 'Pulse shape', group: 'Tones', type: 'select', options: ['Smooth', 'Sharp'], default: 'Smooth', apply: v => { MUSIC.shape = v as typeof MUSIC.shape; } },
  { id: 'music.bed', label: 'Background bed', group: 'Tones', type: 'select', options: ['None', 'Brown noise', 'Pink noise', 'Drone'], default: 'None', apply: v => { MUSIC.bed = v as typeof MUSIC.bed; } },
  { id: 'music.bedLevel', label: 'Bed level', group: 'Tones', type: 'slider', min: 0, max: 1, step: .05, default: .25, apply: v => { MUSIC.bedLevel = Number(v); } },
  { id: 'music.shuffle', label: 'Shuffle', group: 'Playlist', type: 'toggle', default: true, apply: v => { MUSIC.shuffle = !!v; } },
  { id: 'music.crossfade', label: 'Crossfade (s)', group: 'Playlist', type: 'slider', min: 0, max: 12, step: .5, default: 4, apply: v => { MUSIC.crossfade = Number(v); } },
];
export { presetOf };
