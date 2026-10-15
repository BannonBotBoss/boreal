/**
 * Animal appearance editor (Grok Bot): the generic settings renderer over GENOME_SCHEMA, plus the edit log controls
 * (undo/redo, history jump, reset, named presets). One editor per look key ('player:wolf', 'species:deer', entity key);
 * logs persist in localStorage, and the genome is always default + log replayed.
 */
import { GENOME_SCHEMA, createGenomeEditor, limits, sliderWall, type Edit, type GenomeEditor, type Genome } from '../core/genome';
import { settingsPanel } from './settingsPanel';
import { wallFeedback, wallifyRanges } from './haptics';
import { shapeTools, type createHandles } from './shapeTools';
import type * as THREE from 'three';
export interface DirectTools { root(): THREE.Object3D | undefined; handles: ReturnType<typeof createHandles> }

const LOGS = 'boreal.genome.v1', PRESETS = 'boreal.genome-presets.v1';
const read = <T>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const editors = new Map<string, GenomeEditor>();
export function editorFor(key: string) {
  let e = editors.get(key); if (!e) editors.set(key, e = createGenomeEditor(read<Record<string, Edit[]>>(LOGS, {})[key] ?? [])); return e;
}
/** Re-applies every saved look at startup. */
export function restoreLooks(apply: (key: string, g: Genome) => void) { for (const key of Object.keys(read<Record<string, Edit[]>>(LOGS, {}))) apply(key, editorFor(key).genome); }

/** `key()` can change (e.g. "apply to all deer"), so it is read on every build. */
export function appearancePanel(key: () => string, apply: (key: string, g: Genome) => void, extra?: () => HTMLElement, direct?: DirectTools) {
  const build = (): HTMLElement => {
    const k = key(), ed = editorFor(k), root = document.createElement('div'); root.className = 'appearance';
    const commit = () => { apply(k, ed.genome); write(LOGS, { ...read(LOGS, {}), [k]: JSON.parse(ed.toJSON()) }); };
    const rebuild = () => { commit(); root.replaceWith(build()); };
    // Dragging previews (soft wall, nothing logged); releasing commits ONE record with the bounded value.
    const pending: Genome = {}, walls: Record<string, boolean> = {};
    const store = { get: (id: string) => ed.genome[id], reset: () => { ed.reset(); rebuild(); return false; },
      set: (id: string, v: unknown) => { const d = GENOME_SCHEMA.find(x => x.id === id)!;
        if (d.type === 'slider') { const w = sliderWall({ ...ed.genome, ...pending }, id, v as number); pending[id] = w.value; walls[id] = w.wall; } else pending[id] = v as boolean;
        apply(k, { ...ed.genome, ...pending }); return false; } };
    const form = settingsPanel(GENOME_SCHEMA, store as never, () => {})();
    const sliders = GENOME_SCHEMA.filter(d => d.type === 'slider');
    form.addEventListener('input', e => { const i = e.target as HTMLInputElement, d = sliders[Array.from(form.querySelectorAll('input[type=range]')).indexOf(i)];
      if (!d) return; i.dataset.wall = walls[d.id] ? '1' : ''; (i.nextElementSibling as HTMLOutputElement).textContent = String(pending[d.id]); }, true);
    wallifyRanges(form, wallFeedback);
    form.addEventListener('change', () => { if (Object.keys(pending).length) ed.setMany(pending); rebuild(); }); // on release: one record
    const btn = (t: string, fn: () => unknown, off = false) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.disabled = off; b.onclick = () => { fn(); rebuild(); }; return b; };
    const bar = document.createElement('div'); bar.className = 'bar';
    bar.append(btn('Undo (Ctrl+Z)', ed.undo, !ed.canUndo()), btn('Redo (Ctrl+Y)', ed.redo, !ed.canRedo()));
    const presets = read<Record<string, Genome>>(PRESETS, {}), pick = document.createElement('select');
    pick.add(new Option('Load preset…', '')); for (const n of Object.keys(presets)) pick.add(new Option(n, n));
    pick.onchange = () => { if (presets[pick.value]) { ed.load(presets[pick.value]); rebuild(); } };
    const name = document.createElement('input'); name.placeholder = 'preset name';
    bar.append(pick, name, btn('Save preset', () => { if (name.value.trim()) write(PRESETS, { ...presets, [name.value.trim()]: ed.genome }); }));
    const lim = document.createElement('p'); lim.className = 'note';
    lim.textContent = 'Allowed now: ' + GENOME_SCHEMA.filter(d => d.type === 'slider').map(d => `${d.id} ${limits(ed.genome, d.id).map(v => +v.toFixed(2)).join('–')}`).join(' · ');
    const hist = document.createElement('ol'); hist.className = 'history'; hist.start = 0;
    const li0 = document.createElement('li'); li0.append(btn('species default', () => ed.jump(0))); hist.append(li0);
    ed.log.forEach((e, i) => { const li = document.createElement('li'); li.append(btn(`${e.op} ${e.param}: ${String(e.old).slice(0, 24)} → ${String(e.new).slice(0, 24)}  ${new Date(e.time).toLocaleTimeString()}`, () => ed.jump(i + 1))); hist.append(li); });
    const h = document.createElement('h3'); h.textContent = `Appearance: ${k}`;
    const tools: HTMLElement[] = [];
    if (direct) { const host = { ed, key: k, preview: (g: Genome) => apply(k, g), done: rebuild, root: direct.root, alive: () => document.contains(root) };
      tools.push(shapeTools(host)); queueMicrotask(() => direct.handles.attach(host)); }
    root.append(h, ...(extra ? [extra()] : []), ...tools, form, lim, bar, hist);
    const keys = (ev: KeyboardEvent) => {
      if (!document.contains(root)) { removeEventListener('keydown', keys); return; }
      if (!(ev.ctrlKey || ev.metaKey)) return; const z = ev.key.toLowerCase();
      if (z === 'z' || z === 'y') { ev.preventDefault(); ev.stopPropagation(); (z === 'y' || ev.shiftKey ? ed.redo : ed.undo)(); rebuild(); removeEventListener('keydown', keys, true); }
    };
    addEventListener('keydown', keys, true);
    return root;
  };
  return build;
}
