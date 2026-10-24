import { SYSTEM_PROPERTIES } from '../config/systemProperties';
/**
 * ONE input-bindings table (Grok Bot): every game action, its default keys and gamepad inputs, combos, conflicts and the
 * saved overrides. main.ts reads actions through resolveInput(); ui/controls draws the controller and rebinds.
 * Atoms: keyboard 'k:<key>' (KeyboardEvent.key lower-cased; ' ' = space, '+' = plus); gamepad W3C standard mapping
 * (Xbox names, after Adam Jones' CC0 table: buttons 0-16, axes 0-3 = LS x/y, RS x/y), stick directions 'ls.up' ...
 * and a whole stick 'ls' / 'rs' (any direction). A combo is atoms joined by '+': every atom but the last must be held
 * (the modifiers); its value is the last atom's (so 'rs+rt' runs with the trigger's analog pressure).
 */
export const BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'menu', 'ls.click', 'rs.click', 'dup', 'ddown', 'dleft', 'dright', 'xbox'] as const;
export const DIRS = ['up', 'down', 'left', 'right'] as const;
export type Dir = typeof DIRS[number];
/** Atom sets that behave like a stick for "whole stick" bindings (a captured atom picks its set). */
export const STICKS: Record<string, Record<Dir, string>> = {
  ls: { up: 'ls.up', down: 'ls.down', left: 'ls.left', right: 'ls.right' }, rs: { up: 'rs.up', down: 'rs.down', left: 'rs.left', right: 'rs.right' },
  dpad: { up: 'dup', down: 'ddown', left: 'dleft', right: 'dright' },
  arrows: { up: 'k:arrowup', down: 'k:arrowdown', left: 'k:arrowleft', right: 'k:arrowright' }, wasd: { up: 'k:w', down: 'k:s', left: 'k:a', right: 'k:d' },
};
export const DEADZONE = .18, ACTIVE = .25;
export const deadzone = (v: number) => Math.abs(v) < DEADZONE ? 0 : Math.sign(v) * (Math.abs(v) - DEADZONE) / (1 - DEADZONE);

/** play: normal game · chrono: while the chronometer is open · globe: the planet view · camera: camera-adjust mode ·
 *  menu: any pad overlay (pad menu, settings, quiz) · any: always (except menus, which own the pad). hold = value each frame, press = fires once. */
export type Context = 'play' | 'chrono' | 'globe' | 'axis' | 'camera' | 'menu' | 'any';
export const CONTEXTS: { id: Context; label: string }[] = [{ id: 'play', label: 'Game' }, { id: 'chrono', label: 'Chronometer' }, { id: 'globe', label: 'Globe' }, { id: 'camera', label: 'Camera' }, { id: 'menu', label: 'Menus' }, { id: 'any', label: 'Everywhere' }];
export interface ActionDef { id: string; label: string; kind: 'hold' | 'press'; context: Context; keys: string[]; pad: string[]; sum?: boolean; keepInChrono?: boolean }
const A = (id: string, label: string, kind: 'hold' | 'press', context: Context, keys: string[], pad: string[], o: Partial<ActionDef> = {}): ActionDef => ({ id, label, kind, context, keys: keys.map(k => 'k:' + k), pad, ...o });
/** Defaults = the game's controls before rebinding existed (2026-10-21). */
export const ACTIONS: ActionDef[] = [
  A('moveForward', 'Move forward', 'hold', 'play', ['w'], ['ls.up'], { sum: true }),
  A('moveBack', 'Move back', 'hold', 'play', ['s'], ['ls.down'], { sum: true }),
  A('steerLeft', 'Steer left', 'hold', 'play', ['a'], ['ls.left'], { sum: true }),
  A('steerRight', 'Steer right', 'hold', 'play', ['d'], ['ls.right'], { sum: true }),
  A('lookLeft', 'Look left', 'hold', 'play', ['arrowleft'], ['rs.left'], { sum: true, keepInChrono: true }),
  A('lookRight', 'Look right', 'hold', 'play', ['arrowright'], ['rs.right'], { sum: true, keepInChrono: true }),
  A('lookUp', 'Look up', 'hold', 'play', ['arrowup'], ['rs.up'], { sum: true, keepInChrono: true }),
  A('lookDown', 'Look down', 'hold', 'play', ['arrowdown'], ['rs.down'], { sum: true, keepInChrono: true }),
  A('run', 'Run (then stealth: sprint)', 'hold', 'play', ['shift'], ['rt']),
  A('stealth', 'Stealth (then run: super stealth)', 'hold', 'play', ['c'], ['lt']),
  A('focus', 'Focus (hold): lock the nearest object ahead; moving steers toward it', 'hold', 'play', [...SYSTEM_PROPERTIES.autoFocus.binding.keys], [...SYSTEM_PROPERTIES.autoFocus.binding.pad]),
  A('jump', 'Jump / pounce', 'hold', 'play', ['space'], ['x']),
  A('interact', 'Interact', 'press', 'play', ['e'], ['a']),
  A('howl', 'Howl', 'press', 'play', ['h'], []),
  A('growl', 'Growl', 'press', 'play', ['g'], []),
  A('chrono', 'Chronometer (time of day)', 'press', 'any', ['t'], ['dup']),
  A('scrubEarlier', 'Chronometer: earlier', 'hold', 'chrono', ['arrowleft'], ['dleft', 'ls.left'], { sum: true }),
  A('scrubLater', 'Chronometer: later', 'hold', 'chrono', ['arrowright'], ['dright', 'ls.right'], { sum: true }),
  A('back', 'Close (chronometer / panel)', 'press', 'any', [], ['b']),
  A('pause', 'Pause menu', 'press', 'any', ['escape'], []),
  A('padMenu', 'Pad menu (Layers, Camera, Time, Badges, Gallery, Settings)', 'press', 'any', ['tab'], ['menu']),
  A('padHelp', 'Controls help overlay', 'press', 'any', ['f1'], ['view']),
  A('photo', 'Photo mode', 'press', 'play', ['p'], []),
  A('shutter', 'Take a photo (shutter)', 'press', 'any', ['enter'], ['rs.click']),
  A('cameraMode', 'Camera adjust mode (tap) / filter wheel (hold)', 'press', 'any', ['v'], ['y']),
  A('inspector', 'Debug HUD / generation inspector', 'press', 'any', ['i'], ['ddown']),
  A('planet', 'Planet view', 'press', 'play', ['shift+k:g'], []),
  // globe (planet view): orbit, zoom, turn, home, land
  A('globeOrbitLeft', 'Globe: orbit left', 'hold', 'globe', ['a'], ['ls.left'], { sum: true }),
  A('globeOrbitRight', 'Globe: orbit right', 'hold', 'globe', ['d'], ['ls.right'], { sum: true }),
  A('globeOrbitUp', 'Globe: orbit up', 'hold', 'globe', ['w'], ['ls.up'], { sum: true }),
  A('globeOrbitDown', 'Globe: orbit down', 'hold', 'globe', ['s'], ['ls.down'], { sum: true }),
  A('globeZoomIn', 'Globe: zoom in', 'hold', 'globe', ['='], ['rt', 'rs.up'], { sum: true }),
  A('globeZoomOut', 'Globe: zoom out', 'hold', 'globe', ['-'], ['lt', 'rs.down'], { sum: true }),
  A('globeTurnLeft', 'Globe: turn heading left', 'hold', 'globe', ['q'], ['lb', 'rs.left'], { sum: true }),
  A('globeTurnRight', 'Globe: turn heading right', 'hold', 'globe', ['e'], ['rb', 'rs.right'], { sum: true }),
  A('globeHome', 'Globe: fly home', 'press', 'globe', ['h'], ['x']),
  A('globeLand', 'Globe: land (back to the game)', 'press', 'globe', ['g'], ['a']),
  A('globeAxis', 'Globe: through-planet axis on/off', 'press', 'globe', ['r'], ['dright']),
  // axis mode (radial frame): left stick aims the vector û, triggers move r along it
  A('axisAimLeft', 'Axis: aim west', 'hold', 'axis', ['a'], ['ls.left'], { sum: true }),
  A('axisAimRight', 'Axis: aim east', 'hold', 'axis', ['d'], ['ls.right'], { sum: true }),
  A('axisAimUp', 'Axis: aim north', 'hold', 'axis', ['w'], ['ls.up'], { sum: true }),
  A('axisAimDown', 'Axis: aim south', 'hold', 'axis', ['s'], ['ls.down'], { sum: true }),
  A('axisOut', 'Axis: move out along û', 'hold', 'axis', ['='], ['rt'], { sum: true }),
  A('axisIn', 'Axis: move in along û', 'hold', 'axis', ['-'], ['lt'], { sum: true }),
  A('axisGas', 'Axis: gas readout on/off (stage 3)', 'press', 'axis', ['h'], ['lb']),
  A('axisLayers', 'Axis: gas layers in the cut on/off', 'press', 'axis', ['l'], ['dleft']),
  A('axisRT', 'Axis: shortwave column readout on/off (stage 4)', 'press', 'axis', ['j'], ['a']),
  A('axisBodies', 'Axis: emergent-object demo, next mode (stage 5)', 'press', 'axis', ['n'], ['rb']),
  A('axisExit', 'Axis: leave axis mode', 'press', 'axis', ['r'], ['dright']),
  // camera adjust mode: pick a setting, triggers change it
  A('camPrev', 'Camera: previous setting', 'press', 'camera', ['arrowleft'], ['dleft', 'lb']),
  A('camNext', 'Camera: next setting', 'press', 'camera', ['arrowright'], ['dright', 'rb']),
  A('camDown', 'Camera: decrease setting', 'hold', 'camera', ['arrowdown'], ['lt'], { sum: true }),
  A('camUp', 'Camera: increase setting', 'hold', 'camera', ['arrowup'], ['rt'], { sum: true }),
  A('camAuto', 'Camera: auto / manual exposure', 'press', 'camera', ['a'], ['x']),
  // menus (pad menu, settings page, quiz)
  A('menuUp', 'Menu: up', 'press', 'menu', ['arrowup'], ['dup', 'ls.up']),
  A('menuDown', 'Menu: down', 'press', 'menu', ['arrowdown'], ['ddown', 'ls.down']),
  A('menuLeft', 'Menu: left / decrease', 'press', 'menu', ['arrowleft'], ['dleft', 'ls.left']),
  A('menuRight', 'Menu: right / increase', 'press', 'menu', ['arrowright'], ['dright', 'ls.right']),
  A('menuSelect', 'Menu: select', 'press', 'menu', ['enter'], ['a']),
  A('menuBack', 'Menu: back / close', 'press', 'menu', ['escape'], ['b']),
  A('menuTabPrev', 'Menu: previous tab', 'press', 'menu', ['['], ['lb']),
  A('menuTabNext', 'Menu: next tab', 'press', 'menu', [']'], ['rb']),
  A('menuAlt', 'Menu: hint / secondary', 'press', 'menu', ['h'], ['x']),
  A('menuAlt2', 'Menu: retry / tertiary', 'press', 'menu', ['r'], ['y']),
];
/** Actions per context, for the settings page tabs. */
export const actionsIn = (c: Context) => ACTIONS.filter(a => a.context === c);
export const ACTION = Object.fromEntries(ACTIONS.map(a => [a.id, a])) as Record<string, ActionDef>;
/** "Whole stick" rows: one capture fills every direction (a stick, the d-pad, the arrows or WASD; modifiers kept). */
export const GROUPS: { id: string; label: string; members: Partial<Record<Dir, string>> }[] = [
  { id: 'walk', label: 'Walk + steer (whole stick)', members: { up: 'moveForward', down: 'moveBack', left: 'steerLeft', right: 'steerRight' } },
  { id: 'look', label: 'Look (whole stick)', members: { up: 'lookUp', down: 'lookDown', left: 'lookLeft', right: 'lookRight' } },
  { id: 'scrub', label: 'Chronometer scrub (whole stick)', members: { left: 'scrubEarlier', right: 'scrubLater' } },
];

export type Bindings = Record<string, { keys: string[]; pad: string[] }>;
export const defaults = (): Bindings => Object.fromEntries(ACTIONS.map(a => [a.id, { keys: [...a.keys], pad: [...a.pad] }]));
export const BINDINGS_KEY = 'boreal.bindings.v1';
/** Saved = only the actions that differ from the defaults, so new defaults still reach old saves. */
export function saveBindings(b: Bindings) {
  const d = defaults(), out: Partial<Bindings> = {};
  for (const id of Object.keys(d)) if (JSON.stringify(b[id]) !== JSON.stringify(d[id])) out[id] = b[id];
  return JSON.stringify(out);
}
export function loadBindings(raw: string | null | undefined): Bindings {
  const b = defaults(); let s: unknown; try { s = JSON.parse(raw ?? '{}'); } catch { return b; }
  if (s && typeof s === 'object') for (const [id, v] of Object.entries(s as Record<string, { keys?: unknown; pad?: unknown }>)) {
    if (!b[id] || !v) continue; const list = (x: unknown) => Array.isArray(x) ? x.filter((c): c is string => typeof c === 'string' && c.length > 0) : undefined;
    b[id] = { keys: list(v.keys) ?? b[id].keys, pad: list(v.pad) ?? b[id].pad }; }
  return b;
}

/** Keyboard atom for a KeyboardEvent.key. */
export const keyAtom = (key: string) => 'k:' + (key === ' ' ? 'space' : key === '+' ? 'plus' : key.toLowerCase());
export const atomsOf = (combo: string) => combo.split('+');
export const isKeyAtom = (a: string) => a.startsWith('k:');
export interface PadState { buttons: readonly { value: number; pressed: boolean }[]; axes: readonly number[] }
/** Every atom's value 0-1 now: held keys are 1, buttons their (analog) value, stick directions the dead-zoned deflection. */
export function atomValues(keys: Iterable<string>, pad?: PadState | null) {
  const v = new Map<string, number>();
  for (const k of keys) v.set(keyAtom(k), 1);
  if (pad) {
    pad.buttons.forEach((b, i) => { const x = b.value || (b.pressed ? 1 : 0); if (BUTTONS[i] && x > 0) v.set(BUTTONS[i], x); });
    (['ls', 'rs'] as const).forEach((s, i) => { const x = pad.axes[2 * i] ?? 0, y = pad.axes[2 * i + 1] ?? 0, dx = deadzone(x), dy = deadzone(y), m = Math.hypot(x, y);
      const set = (a: string, n: number) => { if (n > 0) v.set(a, Math.min(1, n)); };
      set(`${s}.left`, -dx); set(`${s}.right`, dx); set(`${s}.up`, -dy); set(`${s}.down`, dy); set(s, m < DEADZONE ? 0 : (m - DEADZONE) / (1 - DEADZONE)); });
  }
  return v;
}
/** A combo's value: 0 unless every modifier is held; then the last atom's value. */
export function comboValue(combo: string, v: Map<string, number>) {
  const at = atomsOf(combo); for (let i = 0; i < at.length - 1; i++) if ((v.get(at[i]) ?? 0) <= ACTIVE) return 0; return v.get(at[at.length - 1]) ?? 0;
}
const combos = (b: Bindings, id: string) => [...(b[id]?.keys ?? []), ...(b[id]?.pad ?? [])];
const LOCK_MODS = ['k:control', 'k:alt', 'k:meta']; // Ctrl/Alt/Meta held: only combos that name them fire (browser shortcuts stay theirs)

/** Which actions are live: chronometer open → chrono + any, plus look actions on gamepad inputs the chronometer does not use. */
export function liveActions(b: Bindings, chronoOpen: boolean) {
  const chronoAtoms = new Set(ACTIONS.filter(a => a.context === 'chrono').flatMap(a => combos(b, a.id).flatMap(atomsOf)));
  return (a: ActionDef, combo: string) => a.context === 'any' || (chronoOpen ? a.context === 'chrono' || (!!a.keepInChrono && !atomsOf(combo).some(x => isKeyAtom(x) || chronoAtoms.has(x))) : a.context === 'play');
}
export interface Resolved { value: Record<string, number>; fired: Set<string>; active: Set<string> }
/**
 * Hold values and press edges for this frame. `prev` = last frame's active press combos (pass resolved.active back).
 * A press combo that is a strict subset of another active press combo is held back (Shift+G does not also growl).
 */
export function resolveInput(b: Bindings, v: Map<string, number>, prev: ReadonlySet<string>, chronoOpen = false): Resolved {
  const live = liveActions(b, chronoOpen), value: Record<string, number> = {}, fired = new Set<string>(), active = new Set<string>();
  const lockHeld = LOCK_MODS.filter(m => (v.get(m) ?? 0) > 0), presses: { id: string; combo: string; atoms: string[] }[] = [];
  for (const a of ACTIONS) { let total = 0;
    for (const c of combos(b, a.id)) { if (!live(a, c)) continue; const x = comboValue(c, v), at = atomsOf(c);
      if (a.kind === 'hold') total = a.sum ? total + x : Math.max(total, x);
      else if (x > ACTIVE && lockHeld.every(m => at.includes(m))) { active.add(a.id + '|' + c); presses.push({ id: a.id, combo: c, atoms: at }); } }
    value[a.id] = total; }
  for (const p of presses) if (!prev.has(p.id + '|' + p.combo) && !presses.some(q => q.atoms.length > p.atoms.length && p.atoms.every(x => q.atoms.includes(x)))) fired.add(p.id);
  return { value, fired, active };
}
/** Same input set (any order) on two actions that can be live together. */
export function conflicts(b: Bindings) {
  const seen = new Map<string, { combo: string; ids: string[] }>();
  for (const a of ACTIONS) for (const c of new Set(combos(b, a.id))) { const k = [...atomsOf(c)].sort().join('+'), e = seen.get(k) ?? { combo: c, ids: [] }; if (!e.ids.includes(a.id)) e.ids.push(a.id); seen.set(k, e); }
  const out: { combo: string; ids: string[] }[] = [];
  for (const e of seen.values()) { const ids = e.ids.filter(i => e.ids.some(j => j !== i && together(ACTION[i].context, ACTION[j].context))); if (ids.length > 1) out.push({ combo: e.combo, ids }); }
  return out;
}
/** Two contexts can be live at once: same context, or 'any' with anything but a menu (menus own the pad), or chrono over play-look actions. */
export const together = (x: Context, y: Context) => x === y || (x === 'any' && y !== 'menu') || (y === 'any' && x !== 'menu');
/** Actions that would clash with `combo` if it were bound to `id` (same input set, contexts live together). */
export function clashesWith(b: Bindings, id: string, combo: string) {
  const k = [...atomsOf(combo)].sort().join('+');
  return ACTIONS.filter(a => a.id !== id && together(a.context, ACTION[id].context) && combos(b, a.id).some(c => [...atomsOf(c)].sort().join('+') === k)).map(a => a.id);
}
/** Bind `combo` to `id` and give each clashing action `id`'s old binding on that side (the swap prompt's "Swap"). */
export function swapAssign(b: Bindings, id: string, atoms: string[]): Bindings {
  const combo = tidyCombo(atoms), side = atomsOf(combo).every(isKeyAtom) ? 'keys' : 'pad', old = b[id][side], others = clashesWith(b, id, combo);
  let out = assign(b, id, atoms);
  for (const o of others) out = { ...out, [o]: { ...out[o], [side]: [...out[o][side].filter(c => !same(c, combo)), ...old.filter(c => !out[o][side].includes(c))] } };
  return out;
}
/** Hold values and press edges for one non-game context (globe, camera, menu): its own actions plus 'any' (not in menus). */
export function resolveContext(b: Bindings, v: Map<string, number>, prev: ReadonlySet<string>, ctx: Exclude<Context, 'any'>): Resolved {
  const value: Record<string, number> = {}, fired = new Set<string>(), active = new Set<string>();
  for (const a of ACTIONS) { if (!(a.context === ctx || (a.context === 'any' && ctx !== 'menu'))) continue; let total = 0;
    for (const c of combos(b, a.id)) { const x = comboValue(c, v);
      if (a.kind === 'hold') total = a.sum ? total + x : Math.max(total, x);
      else if (x > ACTIVE) { const key = a.id + '|' + c; active.add(key); if (!prev.has(key)) fired.add(a.id); } }
    value[a.id] = total; }
  return { value, fired, active };
}
const same = (c: string, d: string) => [...atomsOf(c)].sort().join('+') === [...atomsOf(d)].sort().join('+');
/** Remove `combo` (any order) from an action (conflict resolution: keep it on the other one). */
export function unbind(b: Bindings, id: string, combo: string): Bindings {
  return { ...b, [id]: { keys: b[id].keys.filter(c => !same(c, combo)), pad: b[id].pad.filter(c => !same(c, combo)) } };
}

/**
 * Capture (rebinding): wait until everything is released, record atoms in the order they come on, finish when all are
 * released again. Clean-up: a stick click drops that stick's own wobble; in a combo a stick direction means the whole
 * stick (Matthew: run = right stick + RT). Returns atoms, or undefined while still listening.
 */
export function createCapture(threshold = .5) {
  let armed = false; const got: string[] = [];
  return { get atoms() { return [...got]; }, feed(v: Map<string, number>) {
    const on = [...v].filter(([a, x]) => x > threshold && a !== 'ls' && a !== 'rs').map(([a]) => a);
    if (!armed) { if (!on.length) armed = true; return undefined; }
    for (const a of on) if (!got.includes(a)) got.push(a);
    return got.length && !on.length ? [...got] : undefined; } };
}
const stickOf = (a: string) => /^(ls|rs)\.(up|down|left|right)$/.exec(a)?.[1];
export function tidyCombo(atoms: string[]) {
  let at = atoms.filter(a => !(stickOf(a) && atoms.includes(stickOf(a) + '.click')));
  at = at.filter((a, i) => !stickOf(a) || at.findIndex(b => stickOf(b) === stickOf(a)) === i); // diagonal: first direction only
  if (at.length > 1) at = [...new Set(at.map(a => stickOf(a) ?? a))];
  return at.join('+');
}
/** Assign a captured combo to one action: it replaces that action's keyboard (all-key combo) or gamepad bindings. */
export function assign(b: Bindings, id: string, atoms: string[]): Bindings {
  const combo = tidyCombo(atoms), kb = atomsOf(combo).every(isKeyAtom);
  return { ...b, [id]: kb ? { ...b[id], keys: [combo] } : { ...b[id], pad: [combo] } };
}
/** Assign a whole stick to a group: the captured direction picks the stick set; other atoms stay as modifiers. */
export function assignGroup(b: Bindings, groupId: string, atoms: string[]): Bindings | undefined {
  const g = GROUPS.find(x => x.id === groupId)!, dirAtom = atoms.find(a => Object.values(STICKS).some(s => Object.values(s).includes(a)));
  if (!dirAtom) return undefined; const set = Object.values(STICKS).find(s => Object.values(s).includes(dirAtom))!, mods = atoms.filter(a => a !== dirAtom && !Object.values(set).includes(a));
  let out = b; for (const [d, id] of Object.entries(g.members)) out = { ...out, [id!]: assignRaw(out, id!, [...mods, set[d as Dir]].join('+')) };
  return out;
}
const assignRaw = (b: Bindings, id: string, combo: string) => atomsOf(combo).every(isKeyAtom) ? { ...b[id], keys: [combo] } : { ...b[id], pad: [combo] };

const NAMES: Record<string, string> = { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', view: 'View', menu: 'Menu', 'ls.click': 'LS click', 'rs.click': 'RS click',
  dup: 'D-pad ↑', ddown: 'D-pad ↓', dleft: 'D-pad ←', dright: 'D-pad →', xbox: 'Xbox', ls: 'LS (any way)', rs: 'RS (any way)',
  'k:space': 'Space', 'k:tab': 'Tab', 'k:enter': 'Enter', 'k:f1': 'F1', 'k:arrowup': '↑', 'k:arrowdown': '↓', 'k:arrowleft': '←', 'k:arrowright': '→', 'k:escape': 'Esc', 'k:plus': '+', 'k:control': 'Ctrl' };
const ARROW: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→' };
export function atomLabel(a: string) {
  if (NAMES[a]) return NAMES[a]; const s = /^(ls|rs)\.(\w+)$/.exec(a); if (s) return `${s[1].toUpperCase()} ${ARROW[s[2]]}`;
  const k = a.slice(2); return k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1);
}
export const comboLabel = (c: string) => atomsOf(c).map(atomLabel).join(' + ');
export const bindingLabel = (list: string[]) => list.length ? list.map(comboLabel).join(' · ') : '—';
const SET_NAMES: Record<string, string> = { ls: 'LS', rs: 'RS', dpad: 'D-pad', arrows: 'Arrows', wasd: 'WASD' };
/** A group's bindings on one side, named as a whole stick ("LS", "WASD", "RT + RS") when every member uses the same set and modifiers. */
export function groupLabel(b: Bindings, groupId: string, side: 'keys' | 'pad') {
  const m = Object.entries(GROUPS.find(g => g.id === groupId)!.members) as [Dir, string][], n = Math.max(...m.map(([, id]) => b[id][side].length)), out: string[] = [];
  for (let i = 0; i < n; i++) {
    const parts = m.map(([d, id]) => ({ d, at: b[id][side][i] ? atomsOf(b[id][side][i]) : [] })), mods = parts[0].at.slice(0, -1).join('+');
    const set = Object.entries(STICKS).find(([, s]) => parts.every(p => p.at.length && p.at.at(-1) === s[p.d] && p.at.slice(0, -1).join('+') === mods));
    out.push(set ? [...(mods ? atomsOf(mods).map(atomLabel) : []), SET_NAMES[set[0]]].join(' + ') : parts.map(p => `${ARROW[p.d]} ${p.at.length ? p.at.map(atomLabel).join(' + ') : '—'}`).join(' '));
  }
  return out.join(' · ') || '—';
}
