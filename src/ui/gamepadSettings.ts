/**
 * Gamepad Settings page (Grok Bot, Matt: "a 3D gamepad that shows the buttons and highlights when I press a button in real
 * time, in order to set the controls for the entire game"). Left: the procedural 3D controller (ui/pad3d), lit live from the
 * Gamepad API, orbited with the right stick. Right: every action in the ONE registry (core/bindings ACTIONS), per context
 * tab (Game, Chronometer, Globe, Camera, Menus, Everywhere). Pick an action, press a button or combination: it binds; a
 * clash opens a swap prompt (Swap / Keep both / Cancel). Reset to defaults, saved in localStorage (bindings.saveBindings).
 * Keyboard shown and rebindable too. Fully pad-driven: d-pad / LS move, A rebind, X clear pad binding, Y reset, LB/RB tabs, B back.
 * Reached from the pad menu (Settings tab) and tools/gamepad.html.
 */
import { ACTION, CONTEXTS, actionsIn, assign, atomLabel, atomValues, bindingLabel, clashesWith, comboLabel, createCapture, defaults, loadBindings, saveBindings, swapAssign, tidyCombo, BINDINGS_KEY, type Bindings } from '../core/bindings';
import { contextPresses, createPadReader, keyAction, standardPad } from '../input/gamepad';
import { createPad3D } from './pad3d';

export type SettingsEvent = 'menuUp' | 'menuDown' | 'menuLeft' | 'menuRight' | 'menuSelect' | 'menuBack' | 'menuTabPrev' | 'menuTabNext' | 'menuAlt' | 'menuAlt2';
export interface BindingStore { get(): Bindings; set(b: Bindings): void }
export function localStore(kv: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): BindingStore {
  let b = loadBindings((() => { try { return kv?.getItem(BINDINGS_KEY); } catch { return null; } })());
  return { get: () => b, set(n) { b = n; try { kv?.setItem(BINDINGS_KEY, saveBindings(n)); } catch { /* storage blocked */ } } };
}
/** Pure page model (tests drive it with menu events and captured atoms). */
export function createSettingsModel(store: BindingStore) {
  const st = { tab: 0, row: 0, mode: 'list' as 'list' | 'capture' | 'prompt' | 'reset', pending: undefined as undefined | { id: string; atoms: string[]; clashes: string[] }, msg: '', closed: false };
  const rows = () => actionsIn(CONTEXTS[st.tab].id), cur = () => rows()[st.row]?.id;
  const m = {
    st, rows, cur, tabs: CONTEXTS,
    input(e: SettingsEvent) {
      const n = rows().length;
      if (st.mode === 'capture') { if (e === 'menuBack') { st.mode = 'list'; st.msg = 'Cancelled.'; } return; }
      if (st.mode === 'prompt') {
        const p = st.pending!; if (e === 'menuSelect') { store.set(swapAssign(store.get(), p.id, p.atoms)); st.msg = `Swapped: ${ACTION[p.id].label} ← ${comboLabel(tidyCombo(p.atoms))}`; }
        else if (e === 'menuAlt') { store.set(assign(store.get(), p.id, p.atoms)); st.msg = `Kept both (⚠ clash with ${p.clashes.map(i => ACTION[i].label).join(', ')})`; }
        else if (e === 'menuBack') st.msg = 'Cancelled.'; else return;
        st.mode = 'list'; st.pending = undefined; return; }
      if (st.mode === 'reset') { if (e === 'menuSelect') { store.set(defaults()); st.msg = 'Every control is back to its default.'; } if (e === 'menuSelect' || e === 'menuBack') st.mode = 'list'; return; }
      if (e === 'menuUp') st.row = n ? (st.row - 1 + n) % n : 0; else if (e === 'menuDown') st.row = n ? (st.row + 1) % n : 0;
      else if (e === 'menuTabPrev' || e === 'menuLeft') { st.tab = (st.tab - 1 + CONTEXTS.length) % CONTEXTS.length; st.row = 0; }
      else if (e === 'menuTabNext' || e === 'menuRight') { st.tab = (st.tab + 1) % CONTEXTS.length; st.row = 0; }
      else if (e === 'menuSelect' && cur()) { st.mode = 'capture'; st.msg = ''; }
      else if (e === 'menuAlt' && cur()) { const b = store.get(), id = cur()!; store.set({ ...b, [id]: { ...b[id], pad: [] } }); st.msg = `${ACTION[id].label}: pad binding cleared.`; }
      else if (e === 'menuAlt2') st.mode = 'reset';
      else if (e === 'menuBack') st.closed = true;
    },
    /** A finished capture (atoms in press order). Clashes open the swap prompt. */
    captured(atoms: string[]) {
      if (st.mode !== 'capture' || !cur()) return; const id = cur()!, clashes = clashesWith(store.get(), id, tidyCombo(atoms));
      if (!clashes.length) { store.set(assign(store.get(), id, atoms)); st.mode = 'list'; st.msg = `${ACTION[id].label} ← ${comboLabel(tidyCombo(atoms))}`; return; }
      st.pending = { id, atoms, clashes }; st.mode = 'prompt';
    },
  };
  return m;
}

const CSS = `.gps{position:fixed;inset:0;z-index:60;display:grid;grid-template-columns:minmax(420px,1fr) minmax(520px,1.1fr);gap:18px;padding:28px;background:#0b0f16f2;color:#e8edf5;font:18px/1.4 system-ui}
.gps h2{margin:0 0 8px;font-size:26px}.gps canvas{width:100%;height:56vh;display:block}.gps .live{min-height:2.6em;color:#9fe;font-size:16px}
.gps .tabs{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}.gps .tab{padding:6px 12px;border-radius:8px;background:#1b2230;color:#aab}.gps .tab.on{background:#2d6cdf;color:#fff}
.gps .rows{max-height:60vh;overflow:auto;border-radius:10px;background:#111724}.gps .row{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:8px;padding:9px 12px;border:3px solid transparent;border-radius:10px}
.gps .row.focus{border-color:#ffd54a;background:#1f2a3d;box-shadow:0 0 0 3px #ffd54a55}.gps .row .k{color:#bbc}.gps .row .p{color:#9fe}.gps .row.clash .p{color:#f96}
.gps .bar{margin-top:10px;font-size:16px;color:#ccd}.gps .msg{color:#fc6;min-height:1.4em}.gps .modal{margin-top:10px;padding:12px;border-radius:10px;background:#2a1f10;border:2px solid #fc6}
.gps .g{display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;padding:0 .3em;border-radius:1em;font-weight:700;font-size:.85em;color:#000;margin:0 .2em}
.gps .gA{background:#3c3}.gps .gB{background:#e44}.gps .gX{background:#47f;color:#fff}.gps .gY{background:#eb2}.gps .gS{background:#ccd;border-radius:.4em}`;
export const glyph = (b: string) => `<span class="g g${'ABXY'.includes(b) ? b : 'S'}">${b}</span>`;

export interface SettingsHooks { store?: BindingStore; onClose?(): void }
export function mountGamepadSettings(parent: HTMLElement = document.body, hooks: SettingsHooks = {}) {
  const store = hooks.store ?? localStore(), model = createSettingsModel(store), st = model.st;
  if (!document.getElementById('gps-css')) { const s = document.createElement('style'); s.id = 'gps-css'; s.textContent = CSS; document.head.append(s); }
  const root = document.createElement('div'); root.className = 'gps'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Gamepad settings');
  root.innerHTML = `<div><h2>Gamepad settings</h2><canvas></canvas><div class="live"></div><div class="bar">${glyph('RS')} turn the controller</div></div>
  <div><div class="tabs"></div><div class="rows"></div><div class="msg"></div><div class="modalbox"></div>
  <div class="bar">${glyph('↕')} move · ${glyph('LB')}${glyph('RB')} context · ${glyph('A')} rebind · ${glyph('X')} clear pad · ${glyph('Y')} reset all · ${glyph('B')} back</div></div>`;
  parent.append(root);
  const $ = (s: string) => root.querySelector(s) as HTMLElement, pad3 = createPad3D($('canvas') as HTMLCanvasElement), reader = createPadReader();
  let capture = createCapture(), capStart = 0, prevRows = '', prevTab = -1; const keys = new Set<string>();
  const render = () => {
    const b = store.get(), rows = model.rows();
    if (prevTab !== st.tab) { prevTab = st.tab; $('.tabs').innerHTML = model.tabs.map((t, i) => `<span class="tab${i === st.tab ? ' on' : ''}">${t.label}</span>`).join(''); }
    const html = rows.map((a, i) => { const cl = clashesWith(b, a.id, b[a.id].pad[0] ?? '__').length > 0 && b[a.id].pad.length > 0;
      return `<div class="row${i === st.row ? ' focus' : ''}${cl ? ' clash' : ''}" data-id="${a.id}"><span>${cl ? '⚠ ' : ''}${a.label}</span><span class="k">${bindingLabel(b[a.id].keys)}</span><span class="p">${bindingLabel(b[a.id].pad)}</span></div>`; }).join('') || '<div class="row">No actions in this context.</div>';
    if (html !== prevRows) { prevRows = html; $('.rows').innerHTML = `<div class="row"><b>Action</b><b>Keyboard</b><b>Gamepad</b></div>` + html; ($('.rows').querySelector('.focus') as HTMLElement | null)?.scrollIntoView({ block: 'nearest' }); }
    $('.msg').textContent = st.msg;
    const p = st.pending; $('.modalbox').innerHTML = st.mode === 'capture' ? `<div class="modal">Press the button or combination for <b>${ACTION[model.cur()!].label}</b> (hold together, let go to confirm). ${capture.atoms.map(atomLabel).join(' + ')} · Esc / 8 s cancels</div>`
      : st.mode === 'prompt' && p ? `<div class="modal"><b>${comboLabel(tidyCombo(p.atoms))}</b> is already on ${p.clashes.map(i => `<b>${ACTION[i].label}</b>`).join(', ')}.<br>${glyph('A')} Swap (they get ${bindingLabel(store.get()[p.id].pad)}) · ${glyph('X')} Keep both · ${glyph('B')} Cancel</div>`
      : st.mode === 'reset' ? `<div class="modal">Reset every control to its default? ${glyph('A')} Yes · ${glyph('B')} No</div>` : '';
  };
  const onKey = (e: KeyboardEvent) => { if (e.type === 'keyup') { keys.delete(e.key.toLowerCase()); return; }
    if (st.mode === 'capture') { e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape') model.input('menuBack'); else keys.add(e.key.toLowerCase()); return; }
    const a = keyAction(store.get(), e.key, 'menu'); if (a) { e.preventDefault(); e.stopPropagation(); go(a as SettingsEvent); } };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  const go = (e: SettingsEvent) => { const was = st.mode; model.input(e); if (st.mode === 'capture' && was !== 'capture') { capture = createCapture(); capStart = performance.now(); keys.clear(); } if (st.closed) close(); render(); };
  let raf = 0, closed = false;
  const close = () => { if (closed) return; closed = true; cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); pad3.dispose(); root.remove(); hooks.onClose?.(); };
  const loop = () => { if (closed) return; raf = requestAnimationFrame(loop);
    const gp = standardPad(), v = atomValues(st.mode === 'capture' ? keys : [], gp), e = reader.update(v, performance.now());
    if (st.mode === 'capture') { const done = capture.feed(v); if (capture.atoms.length) capStart = performance.now(); if (done) { model.captured(done); render(); } else if (performance.now() - capStart > 8000) { model.input('menuBack'); render(); } else render(); }
    else for (const a of contextPresses(store.get(), e, 'menu')) go(a as SettingsEvent);
    pad3.orbit(-(v.get('rs.left') ?? 0) * .03 + (v.get('rs.right') ?? 0) * .03, (v.get('rs.down') ?? 0) * .03 - (v.get('rs.up') ?? 0) * .03);
    pad3.update(v, gp?.axes ?? []); pad3.render();
    const on = [...v].filter(([a, x]) => x > .25 && a !== 'ls' && a !== 'rs').map(([a, x]) => `${atomLabel(a)}${x < .99 ? ` ${x.toFixed(2)}` : ''}`);
    $('.live').textContent = gp ? (on.length ? 'Pressed: ' + on.join(' · ') : 'Controller connected. Press anything.') : 'No controller yet: press any button on it (browsers hide pads until then). Keyboard: arrows, Enter, Esc, [ ], H, R.';
  };
  render(); raf = requestAnimationFrame(loop);
  return { root, model, close, pad3 };
}
