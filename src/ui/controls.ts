/**
 * Controls screen (Matthew): a drawn Xbox controller that lights up live (triggers fill with pressure, sticks move and
 * light on click), and every action rebindable by pressing the input or combination (core/bindings createCapture).
 * Reached from the pause / start menu "Controls" and the footer "Library / controls" button. Navigable with the pad
 * (d-pad / stick + A, B back) and the mouse. Display approach after KW-M/virtual-gamepad-lib (MIT): one element per
 * standard-mapping input, toggled from Gamepad state each frame; the picture itself is drawn here, no image assets.
 */
import { ACTION, ACTIONS, ACTIVE, GROUPS, assign, assignGroup, atomLabel, atomValues, atomsOf, bindingLabel, comboLabel, conflicts, createCapture, defaults, groupLabel, tidyCombo, unbind, type Bindings } from '../core/bindings';

const NS = 'http://www.w3.org/2000/svg';
type Part = ['c', number, number, number] | ['r', number, number, number, number, number];
/** The controller drawing: atom → shape (circle cx cy r, or rect x y w h rx), in a 400 × 270 view. */
const PARTS: [string, Part, string?][] = [
  ['lt', ['r', 66, 6, 68, 22, 8], 'LT'], ['rt', ['r', 266, 6, 68, 22, 8], 'RT'],
  ['lb', ['r', 60, 36, 80, 16, 8], 'LB'], ['rb', ['r', 260, 36, 80, 16, 8], 'RB'],
  ['ls', ['c', 112, 112, 30]], ['rs', ['c', 248, 178, 30]],
  ['ls.up', ['r', 106, 74, 12, 6, 2]], ['ls.down', ['r', 106, 144, 12, 6, 2]], ['ls.left', ['r', 74, 106, 6, 12, 2]], ['ls.right', ['r', 144, 106, 6, 12, 2]],
  ['rs.up', ['r', 242, 140, 12, 6, 2]], ['rs.down', ['r', 242, 210, 12, 6, 2]], ['rs.left', ['r', 210, 172, 6, 12, 2]], ['rs.right', ['r', 280, 172, 6, 12, 2]],
  ['dup', ['r', 144, 150, 18, 20, 3]], ['ddown', ['r', 144, 186, 18, 20, 3]], ['dleft', ['r', 124, 169, 20, 18, 3]], ['dright', ['r', 162, 169, 20, 18, 3]],
  ['y', ['c', 290, 88, 12], 'Y'], ['a', ['c', 290, 136, 12], 'A'], ['x', ['c', 266, 112, 12], 'X'], ['b', ['c', 314, 112, 12], 'B'],
  ['view', ['c', 176, 112, 8], '⧉'], ['menu', ['c', 224, 112, 8], '≡'], ['xbox', ['c', 200, 74, 13]],
];
const BODY = 'M70 58C120 40 280 40 330 58C372 74 396 170 382 226C372 258 330 258 310 232C290 206 268 196 200 196C132 196 110 206 90 232C70 258 28 258 18 226C4 170 28 74 70 58Z';

function drawPad() {
  const svg = document.createElementNS(NS, 'svg'), el = (t: string, a: Record<string, string | number>, parent: Element = svg) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); parent.append(e); return e; };
  svg.setAttribute('viewBox', '0 0 400 270'); svg.setAttribute('class', 'ctl-pad'); svg.setAttribute('aria-label', 'Controller');
  el('path', { d: BODY, class: 'ctl-body' });
  const parts = new Map<string, SVGElement>(), fills = new Map<string, SVGElement>(), caps: Record<string, SVGElement> = {};
  for (const [atom, p, label] of PARTS) {
    const g = el('g', { 'data-atom': atom, class: 'ctl-part' + (atom.includes('.') ? ' ctl-dir' : atom === 'ls' || atom === 'rs' ? ' ctl-well' : '') }) as SVGElement;
    if (p[0] === 'c') el('circle', { cx: p[1], cy: p[2], r: p[3] }, g); else el('rect', { x: p[1], y: p[2], width: p[3], height: p[4], rx: p[5] }, g);
    if (atom === 'lt' || atom === 'rt') fills.set(atom, el('rect', { x: p[1], y: p[2] + 2, width: 0, height: (p[4] ?? 22) - 4, rx: 6, class: 'ctl-fill' }, g) as SVGElement);
    if (atom === 'ls' || atom === 'rs') { const cap = el('g', { 'data-atom': atom + '.click', class: 'ctl-part ctl-cap' }, svg) as SVGElement; el('circle', { cx: p[1], cy: p[2], r: 18 }, cap); caps[atom] = cap; parts.set(atom + '.click', cap); }
    if (label) el('text', p[0] === 'c' ? { x: p[1], y: p[2] + 4 } : { x: p[1] + p[3] / 2, y: p[2] + p[4] / 2 + 4 }, g).textContent = label;
    parts.set(atom, g);
  }
  { const g = parts.get('xbox')!; // Guide button: the Xbox sphere logo (ring + curved X), captioned so it never reads as the X face button
    el('path', { d: 'M200 66a8 8 0 1 0 .01 0M195 68.5Q199 74 205 79.5M205 68.5Q201 74 195 79.5', class: 'ctl-logo' }, g);
    el('text', { x: 200, y: 98, class: 'ctl-caption' }).textContent = 'Guide'; }
  return { svg, update(v: Map<string, number>, axes: readonly number[], bound: Set<string>) {
    for (const [a, g] of parts) { g.classList.toggle('on', (v.get(a) ?? 0) > ACTIVE); g.classList.toggle('bound', bound.has(a)); }
    for (const [a, f] of fills) f.setAttribute('width', String(66 * (v.get(a) ?? 0)));
    (['ls', 'rs'] as const).forEach((s, i) => caps[s].setAttribute('transform', `translate(${12 * (axes[2 * i] ?? 0)} ${12 * (axes[2 * i + 1] ?? 0)})`));
  } };
}

export interface ControlsHooks { get(): Bindings; set(b: Bindings): void; library?(): void }
/** Builds the screen (menu page body); it runs its own frame loop while attached. */
export function controlsScreen(o: ControlsHooks) {
  return () => {
    const h = (tag: string, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
    const root = h('div', 'ctl-screen'), left = h('div', 'ctl-left'), list = h('div', 'ctl-list'), pad = drawPad();
    const live = h('p', 'ctl-live', 'Press anything on the controller or keyboard.'), cap = h('div', 'ctl-capture'), clash = h('div', 'ctl-conflicts');
    cap.hidden = true;
    const btn = (label: string, on: () => void, cls = '') => { const b = h('button', cls, label) as HTMLButtonElement; b.type = 'button'; b.onclick = on; return b; };
    const tools = h('div', 'ctl-tools'); tools.append(btn('Reset to defaults', () => { o.set(defaults()); render(); }), ...(o.library ? [btn('Library (about the game)', () => o.library!())] : []));
    left.append(pad.svg, live, cap, clash, tools, h('p', 'note', 'Pick an action, then press the button, stick direction or combination you want (hold them together, then let go). Esc or 8 s idle cancels. Fixed keys: menus (d-pad / stick, A, B · arrows, Enter, Esc), photo mode keys, M mute, [ ] volume, N / - = music, V flora view, O senses halo. The in-game clock (comma slower, period faster, semicolon pause or play; d-pad left/right and left-stick click) is under Game and can be rebound.'));
    root.append(left, list);
    let target: { kind: 'action' | 'group'; id: string } | undefined, capture = createCapture(), started = 0, focused: string[] = [];
    const held = new Set<string>();
    const onKey = (e: KeyboardEvent) => { if (!root.isConnected) return;
      if (e.type === 'keyup') { held.delete(e.key.toLowerCase()); return; }
      if (target) { e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape') { stop(); return; } }
      held.add(e.key.toLowerCase()); }; // held keys show live too (and a capture waits for Enter to be let go)
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
    const labelOf = (id: string) => ACTION[id]?.label ?? GROUPS.find(g => g.id === id)!.label;
    function start(kind: 'action' | 'group', id: string) { target = { kind, id }; capture = createCapture(); started = performance.now(); held.clear(); root.classList.add('capturing'); cap.hidden = false; }
    function stop(msg = '') { const t = target; target = undefined; root.classList.remove('capturing'); cap.hidden = true; render(msg); if (t) (list.querySelector(`[data-id="${t.id}"]`) as HTMLElement | null)?.focus(); }
    function finish(atoms: string[]) { const t = target!, b = o.get();
      if (t.kind === 'group') { const nb = assignGroup(b, t.id, atoms); if (!nb) { stop('Whole-stick rows need a stick, the d-pad, the arrow keys or WASD.'); return; } o.set(nb); }
      else o.set(assign(b, t.id, atoms));
      stop(`${labelOf(t.id)} ← ${t.kind === 'group' ? atoms.map(atomLabel).join(' + ') : comboLabel(tidyCombo(atoms))}`); }
    function render(msg = '') {
      const b = o.get(), cs = conflicts(b), bad = new Set(cs.flatMap(c => c.ids)), scroll = list.scrollTop, row = (id: string, label: string, keys: string, padL: string, kind: 'action' | 'group', atoms: string[]) => {
        const r = btn('', () => start(kind, id), 'ctl-row' + (bad.has(id) ? ' clash' : '')); r.dataset.id = id;
        r.append(h('span', '', (bad.has(id) ? '⚠ ' : '') + label), h('span', 'k', keys), h('span', 'p', padL));
        const show = () => { focused = atoms; }; r.onfocus = show; r.onmouseenter = show; return r; };
      list.replaceChildren(h('div', 'ctl-head'), ...GROUPS.map(g => row(g.id, g.label, groupLabel(b, g.id, 'keys'), groupLabel(b, g.id, 'pad'), 'group', Object.values(g.members).flatMap(id => b[id!].pad.flatMap(atomsOf)))),
        ...ACTIONS.map(a => row(a.id, a.label, bindingLabel(b[a.id].keys), bindingLabel(b[a.id].pad), 'action', b[a.id].pad.flatMap(atomsOf))));
      list.firstElementChild!.append(h('span', '', 'Action'), h('span', 'k', 'Keyboard'), h('span', 'p', 'Gamepad'));
      list.scrollTop = scroll;
      clash.replaceChildren(...(msg ? [h('p', 'ctl-msg', msg)] : []), ...cs.map(c => { const p = h('div', 'ctl-clash'); p.append(h('span', '', `⚠ ${comboLabel(c.combo)} is on ${c.ids.map(labelOf).join(' and ')}. Keep it on:`),
        ...c.ids.map(id => btn(labelOf(id), () => { let nb = o.get(); for (const j of c.ids) if (j !== id) nb = unbind(nb, j, c.combo); o.set(nb); render(); }))); return p; }));
    }
    render();
    let shown = false;
    const loop = () => { if (root.isConnected) shown = true; else if (shown) { removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); return; } // page left: stop
      requestAnimationFrame(loop);
      const gp = [...navigator.getGamepads()].find(p => p?.connected && p.mapping === 'standard'), v = atomValues(held, gp ?? undefined);
      if (target) { const done = capture.feed(v), so = capture.atoms;
        cap.textContent = `Now press the input for “${labelOf(target.id)}”${so.length ? ': ' + so.map(atomLabel).join(' + ') : ' …'}  (let go to confirm · Esc cancels)`;
        if (so.length) started = performance.now(); if (done) finish(done); else if (performance.now() - started > 8000) stop('Cancelled (nothing pressed).'); }
      const on = [...v].filter(([, x]) => x > ACTIVE).map(([a]) => a), b = o.get();
      const uses = (a: string) => ACTIONS.filter(x => [...b[x.id].keys, ...b[x.id].pad].some(c => atomsOf(c).includes(a))).map(x => x.label);
      if (!target) live.textContent = on.filter(a => (a !== 'ls' && a !== 'rs') || uses(a).length).length ? on.filter(a => (a !== 'ls' && a !== 'rs') || uses(a).length).map(a => `${atomLabel(a)}${v.get(a)! < .99 ? ` (${v.get(a)!.toFixed(2)})` : ''}: ${uses(a).join(', ') || 'unused'}`).join(' · ') : gp ? 'Controller connected. Press anything to see what it does.' : 'No controller seen yet: press a button on it. Keys show here too.';
      pad.update(v, gp?.axes ?? [], new Set(focused));
    };
    requestAnimationFrame(loop);
    return root;
  };
}
