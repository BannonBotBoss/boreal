/**
 * Render/world settings (Grok Bot). ONE schema: each entry is data (id, label, type, range, default) plus an `apply`
 * that writes the live config below. The pause-menu panel, persistence and reset are generic over the schema.
 * To add a setting, add one entry here.
 */
import { HARE } from '../animals/hare';
import { FEEL, HAPTIC_CATS } from '../ui/haptics';
import { GROUND } from './ground';
import { WEATHER, initWeather } from './weather';
import { INTEREST } from './interest';

/** Live config read by the world/render layers (buildScene, world scatter, hares, sound). Defaults = original game. */
export const RENDER = {
  terrainSegments: 80,
  lod: { trees: 1, rocks: 1, props: 1 } as Record<'trees' | 'rocks' | 'props', number>,
  animalDistance: Infinity,
  treeDensity: 1,
  deer: { on: true, count: 1 },
  birdRate: 1,
};
const LOD_SCALE: Record<string, number> = { Near: .6, Normal: 1, Far: 1.6, 'Very far': 2.4 };
const LOD_OPTIONS = Object.keys(LOD_SCALE);
const HARES_DEFAULT = HARE.count;

export type SettingValue = number | boolean | string;
export interface SettingDef {
  id: string; label: string; group: string; type: 'slider' | 'toggle' | 'select';
  min?: number; max?: number; step?: number; options?: string[]; default: SettingValue;
  /** true = takes effect when the world regenerates (on resume) */ regen?: boolean;
  apply(v: SettingValue): void;
}
export const RENDER_SETTINGS: SettingDef[] = [
  { id: 'lod.terrain', label: 'Terrain detail', group: 'Level of detail', type: 'select', options: ['Low', 'Normal', 'High'], default: 'Normal', regen: true,
    apply: v => { RENDER.terrainSegments = ({ Low: 40, Normal: 80, High: 120 } as Record<string, number>)[v as string] ?? 80; } },
  { id: 'lod.trees', label: 'Trees: detail distance', group: 'Level of detail', type: 'select', options: LOD_OPTIONS, default: 'Normal', regen: true, apply: v => { RENDER.lod.trees = LOD_SCALE[v as string] ?? 1; } },
  { id: 'lod.rocks', label: 'Rocks: detail distance', group: 'Level of detail', type: 'select', options: LOD_OPTIONS, default: 'Normal', regen: true, apply: v => { RENDER.lod.rocks = LOD_SCALE[v as string] ?? 1; } },
  { id: 'lod.props', label: 'Plants, logs & props: detail distance', group: 'Level of detail', type: 'select', options: LOD_OPTIONS, default: 'Normal', regen: true, apply: v => { RENDER.lod.props = LOD_SCALE[v as string] ?? 1; } },
  { id: 'lod.animals', label: 'Animals: draw distance', group: 'Level of detail', type: 'select', options: ['60 m', '120 m', '240 m', 'Unlimited'], default: 'Unlimited',
    apply: v => { RENDER.animalDistance = parseFloat(v as string) || Infinity; } },
  { id: 'world.treeDensity', label: 'Tree density', group: 'World', type: 'slider', min: .25, max: 2, step: .05, default: 1, regen: true, apply: v => { RENDER.treeDensity = Number(v); } },
  { id: 'animals.deer', label: 'Deer', group: 'Animals', type: 'toggle', default: true, regen: true, apply: v => { RENDER.deer.on = !!v; } },
  { id: 'animals.deerCount', label: 'Deer population ×', group: 'Animals', type: 'slider', min: .25, max: 4, step: .25, default: 1, regen: true, apply: v => { RENDER.deer.count = Number(v); } },
  { id: 'animals.hares', label: 'Snowshoe hares', group: 'Animals', type: 'toggle', default: true, apply: v => { hareOn = !!v; HARE.count = hareOn ? hareCount : 0; } },
  { id: 'animals.hareCount', label: 'Hares around you', group: 'Animals', type: 'slider', min: 1, max: 15, step: 1, default: HARES_DEFAULT, apply: v => { hareCount = Number(v); HARE.count = hareOn ? hareCount : 0; } },
  { id: 'animals.birds', label: 'Birds (calls)', group: 'Animals', type: 'toggle', default: true, apply: v => { birdsOn = !!v; RENDER.birdRate = birdsOn ? birdRate : 0; } },
  { id: 'feel.haptics', label: 'Haptics (gamepad, Quest controllers, phone; not mouse/pen)', group: 'Feel', type: 'toggle', default: true, apply: v => { FEEL.haptics = !!v; } },
  { id: 'feel.intensity', label: 'Haptic strength', group: 'Feel', type: 'slider', min: 0, max: 1, step: .05, default: .6, apply: v => { FEEL.intensity = Number(v); } },
  { id: 'feel.gameplay', label: 'Haptics: gameplay', group: 'Feel', type: 'toggle', default: true, apply: v => { HAPTIC_CATS.gameplay = !!v; } },
  { id: 'feel.ui', label: 'Haptics: UI and photo mode', group: 'Feel', type: 'toggle', default: true, apply: v => { HAPTIC_CATS.ui = !!v; } },
  { id: 'feel.editor', label: 'Haptics: editor limits', group: 'Feel', type: 'toggle', default: true, apply: v => { HAPTIC_CATS.editor = !!v; } },
  { id: 'feel.sound', label: 'Sound at editor limits', group: 'Feel', type: 'toggle', default: true, apply: v => { FEEL.sound = !!v; } },
  { id: 'world.groundSpeed', label: 'Ground flow / decay speed ×', group: 'World', type: 'slider', min: 1, max: 100000, step: 1, default: 1, apply: v => { GROUND.speed = Number(v); } },
  { id: 'interest.near', label: 'Full-detail radius (m)', group: 'Interest radius', type: 'slider', min: 40, max: 120, step: 10, default: 60, apply: v => { INTEREST.near = Number(v); INTEREST.mid = Math.max(INTEREST.mid, INTEREST.near); } },
  { id: 'interest.mid', label: 'LOD radius (m; beyond = math only)', group: 'Interest radius', type: 'slider', min: 60, max: 240, step: 20, default: 100, apply: v => { INTEREST.mid = Math.max(Number(v), INTEREST.near); } },
  { id: 'weather.on', label: 'Weather simulation', group: 'Weather', type: 'toggle', default: true, apply: v => { WEATHER.on = !!v; } },
  { id: 'weather.quality', label: 'Weather grid', group: 'Weather', type: 'select', options: ['Low (6×6)', 'Normal (8×8)', 'High (12×12)'], default: 'Normal (8×8)',
    apply: v => { const n = parseInt(String(v).split('(')[1]) || 8; if (n !== WEATHER.quality) { WEATHER.quality = n; initWeather(); } } },
  { id: 'weather.timeScale', label: 'Weather time scale ×', group: 'Weather', type: 'slider', min: 0, max: 20, step: 1, default: 1, apply: v => { WEATHER.timeScale = Number(v); } },
  { id: 'animals.birdRate', label: 'Bird activity ×', group: 'Animals', type: 'slider', min: .25, max: 3, step: .25, default: 1, apply: v => { birdRate = Number(v); RENDER.birdRate = birdsOn ? birdRate : 0; } },
];
let hareOn = true, hareCount = HARES_DEFAULT, birdsOn = true, birdRate = 1;

/** Generic store over the schema: persisted values, apply-on-set, reset. Returns whether a regeneration is needed. */
export function createSettingsStore(schema: SettingDef[], key = 'boreal.render.v1', storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
  let saved: Record<string, SettingValue> = {};
  try { saved = JSON.parse(storage?.getItem(key) ?? '{}'); } catch { /* defaults */ }
  const values: Record<string, SettingValue> = Object.fromEntries(schema.map(d => [d.id, saved[d.id] ?? d.default]));
  const persist = () => { try { storage?.setItem(key, JSON.stringify(values)); } catch { /* storage blocked */ } };
  for (const d of schema) d.apply(values[d.id]);
  return {
    get: (id: string) => values[id],
    set(id: string, v: SettingValue) { const d = schema.find(d => d.id === id)!; values[id] = v; d.apply(v); persist(); return !!d.regen; },
    reset() { let regen = false; for (const d of schema) { if (values[d.id] !== d.default && d.regen) regen = true; values[d.id] = d.default; d.apply(d.default); } persist(); return regen; },
  };
}
