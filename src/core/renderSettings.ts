/**
 * Render/world settings (Grok Bot). ONE schema: each entry is data (id, label, type, range, default) plus an `apply`
 * that writes the live config below. The pause-menu panel, persistence and reset are generic over the schema.
 * To add a setting, add one entry here.
 */
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { HARE } from '../animals/hare';
import { FEEL, HAPTIC_CATS } from '../ui/haptics';
import { GROUND } from './ground';
import { WEATHER, initWeather } from './weather';
import { INTEREST } from './interest';
import { STAGES } from './stages/elevation';
import { GOVERNOR, LADDER, MANUAL, applied, resetGovernor } from './quality';

/** Live config read by the world/render layers (buildScene, world scatter, hares, sound). Defaults = original game. */
export const RENDER = {
  terrainSegments: 80,
  lod: { trees: 1, rocks: 1, props: 1 } as Record<'trees' | 'rocks' | 'props', number>,
  animalDistance: Infinity,
  treeDensity: 1,
  /** Pre-settlement fire-regime stand map (core/stand) drives density, logs and understory. */
  standMap: true,
  deer: { on: true, count: 1 },
  birdRate: 1,
};
/** What the player chose. The governor can only LOWER it: radii = min(choice, tier); density/LOD = choice × tier factor (≤ 1). */
export const USER = { lod: { trees: 1, rocks: 1, props: 1 } as Record<'trees' | 'rocks' | 'props', number>, treeDensity: 1, near: 60, mid: 100 };
export function capRender() {
  const t = applied();
  for (const k of ['trees', 'rocks', 'props'] as const) RENDER.lod[k] = USER.lod[k] * t.lod * (k === 'props' ? t.foliage : 1);
  RENDER.treeDensity = USER.treeDensity * t.trees;
  INTEREST.near = Math.min(USER.near, t.near); INTEREST.mid = Math.max(INTEREST.near, Math.min(USER.mid, t.mid));
}
const QUALITY_CAP_OPTIONS = LADDER.map(t => t.name);
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
  { id: 'lod.trees', label: 'Trees: detail distance', group: 'Level of detail', type: 'select', options: LOD_OPTIONS, default: 'Normal', regen: true, apply: v => { USER.lod.trees = LOD_SCALE[v as string] ?? 1; capRender(); } },
  { id: 'lod.rocks', label: 'Rocks: detail distance', group: 'Level of detail', type: 'select', options: LOD_OPTIONS, default: 'Normal', regen: true, apply: v => { USER.lod.rocks = LOD_SCALE[v as string] ?? 1; capRender(); } },
  { id: 'lod.props', label: 'Plants, logs & props: detail distance', group: 'Level of detail', type: 'select', options: LOD_OPTIONS, default: 'Normal', regen: true, apply: v => { USER.lod.props = LOD_SCALE[v as string] ?? 1; capRender(); } },
  { id: 'lod.animals', label: 'Animals: draw distance', group: 'Level of detail', type: 'select', options: ['60 m', '120 m', '240 m', 'Unlimited'], default: 'Unlimited',
    apply: v => { RENDER.animalDistance = parseFloat(v as string) || Infinity; } },
  { id: 'world.stagedTerrain.v2', label: 'Staged terrain (stage 1: eroded elevation)', group: 'World', type: 'toggle', default: true, regen: true, apply: v => { STAGES.on = !!v; } },
  { id: 'world.standMap', label: 'Pre-settlement stand map (fire history)', group: 'World', type: 'toggle', default: true, regen: true, apply: v => { RENDER.standMap = !!v; } },
  { id: 'world.treeDensity', label: 'Tree density', group: 'World', type: 'slider', min: .25, max: 2, step: .05, default: 1, regen: true, apply: v => { USER.treeDensity = Number(v); capRender(); } },
  { id: 'animals.deer', label: 'Deer', group: 'Animals', type: 'toggle', default: true, regen: true, apply: v => { RENDER.deer.on = !!v; } },
  { id: 'animals.deerCount', label: 'Deer population ×', group: 'Animals', type: 'slider', min: .25, max: 4, step: .25, default: 1, regen: true, apply: v => { RENDER.deer.count = Number(v); } },
  { id: 'animals.hares', label: 'Snowshoe hares', group: 'Animals', type: 'toggle', default: true, apply: v => { hareOn = !!v; HARE.count = hareOn ? hareCount : 0; } },
  { id: 'animals.hareCount', label: 'Hares around you', group: 'Animals', type: 'slider', min: 1, max: 15, step: 1, default: HARES_DEFAULT, apply: v => { hareCount = Number(v); HARE.count = hareOn ? hareCount : 0; } },
  { id: 'animals.birds', label: 'Birds (calls)', group: 'Animals', type: 'toggle', default: true, apply: v => { birdsOn = !!v; RENDER.birdRate = birdsOn ? birdRate : 0; } },
  { id: 'feel.haptics', label: 'Haptics (gamepad, Quest controllers, phone; not mouse/pen)', group: 'Feel', type: 'toggle', default: SYSTEM_PROPERTIES.haptics.on, apply: v => { FEEL.haptics = !!v; } },
  { id: 'feel.intensity', label: 'Haptic strength', group: 'Feel', type: 'slider', min: 0, max: 1, step: .05, default: SYSTEM_PROPERTIES.haptics.intensity, apply: v => { FEEL.intensity = Number(v); } },
  { id: 'feel.gameplay', label: 'Haptics: gameplay', group: 'Feel', type: 'toggle', default: true, apply: v => { HAPTIC_CATS.gameplay = !!v; } },
  { id: 'feel.ui', label: 'Haptics: UI and photo mode', group: 'Feel', type: 'toggle', default: true, apply: v => { HAPTIC_CATS.ui = !!v; } },
  { id: 'feel.editor', label: 'Haptics: editor limits', group: 'Feel', type: 'toggle', default: true, apply: v => { HAPTIC_CATS.editor = !!v; } },
  { id: 'feel.sound', label: 'Sound at editor limits', group: 'Feel', type: 'toggle', default: SYSTEM_PROPERTIES.haptics.editorSound, apply: v => { FEEL.sound = !!v; } },
  { id: 'world.groundSpeed', label: 'Ground flow / decay speed ×', group: 'World', type: 'slider', min: 1, max: 100000, step: 1, default: 1, apply: v => { GROUND.speed = Number(v); } },
  { id: 'interest.near', label: 'Full-detail radius (m)', group: 'Interest radius', type: 'slider', min: 40, max: 120, step: 10, default: 60, apply: v => { USER.near = Number(v); capRender(); } },
  { id: 'interest.mid', label: 'LOD radius (m; beyond = math only)', group: 'Interest radius', type: 'slider', min: 60, max: 240, step: 20, default: 100, apply: v => { USER.mid = Number(v); capRender(); } },
  { id: 'quality.auto', label: 'Adaptive quality (Auto keeps the target frame rate)', group: 'Quality', type: 'toggle', default: true, apply: v => { GOVERNOR.auto = !!v; resetGovernor(); } },
  { id: 'quality.target', label: 'Target frame rate', group: 'Quality', type: 'select', options: ['30', '60', '72 (Quest)', '90 (Quest)', '120'], default: '60', apply: v => { GOVERNOR.targetFps = parseInt(String(v)) || 60; resetGovernor(); } },
  { id: 'quality.tier', label: 'Quality tier (Manual; in Auto: highest allowed)', group: 'Quality', type: 'select', options: QUALITY_CAP_OPTIONS, default: 'Ultra',
    apply: v => { const i = Math.max(0, QUALITY_CAP_OPTIONS.indexOf(String(v))); GOVERNOR.capTier = i; GOVERNOR.tier = GOVERNOR.auto ? Math.max(GOVERNOR.tier, i) : i; resetGovernor(); capRender(); } },
  { id: 'quality.resScale', label: 'Max resolution scale (2 = supersampled)', group: 'Quality', type: 'slider', min: .5, max: 2, step: .05, default: 2, apply: v => { MANUAL.resScale = Number(v); capRender(); } },
  { id: 'quality.shadows', label: 'Max shadows', group: 'Quality', type: 'select', options: ['Off', '1 map', '2 cascades', '3 cascades'], default: '3 cascades',
    apply: v => { MANUAL.shadows = ['Off', '1 map', '2 cascades', '3 cascades'].indexOf(String(v)); } },
  { id: 'quality.ssao', label: 'Max ambient occlusion', group: 'Quality', type: 'select', options: ['Off', 'Half', 'Full'], default: 'Full', apply: v => { MANUAL.ssao = ['Off', 'Half', 'Full'].indexOf(String(v)); } },
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
