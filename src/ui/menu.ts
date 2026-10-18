/**
 * ONE menu screen for start and pause (Grok Bot; replaces ui/pauseMenu). Mode 'start' (after the loading screen):
 * Continue, New world, Music, Graphics, Quit. Mode 'pause' (Esc / gamepad Menu): Resume, Save, Music, Graphics, More
 * (registered panels: player, appearance, inspector, photo), Quit to menu (autosaves first). While either mode is open the
 * world clock is frozen (core/worldClock.pauseClock) and the renderer holds its last frame.
 * Keyboard: ↑/↓ (or Tab) move, Enter/Space choose, Escape back. Gamepad (standard mapping): d-pad / left stick move,
 * A choose, B back. Sub-pages reuse the shared settings panels (ui/settingsPanel) passed in by main.
 */
import { GOVERNOR, LADDER, resetGovernor } from '../core/quality';
export type MenuMode = 'start' | 'pause';
export interface MenuPanel { id: string; title: string; build(): HTMLElement }
export interface MenuHooks {
  hasSave(): boolean;
  newWorld(o: { seed: number; source: 'seed' | 'dem'; staged: boolean }): void;
  music(): HTMLElement; graphics?(): HTMLElement; // shared settings panels from main
  seed(): number; staged(): boolean;
  save(): void;                 // write every save now
  close(mode: MenuMode): void;  // menu dismissed (Continue / Resume)
  quitToMenu?(): void;          // after the autosave, before the start page shows
  warning?(): string;           // pause-screen warning (e.g. the player's animal near its lifespan)
}
/** Pure: what picking tier `i` means under the probe cap (lower index = better tier). */
export function tierChoice(i: number, cap: number) {
  return i >= cap ? { ok: true, warn: '' } : { ok: true, warn: `${LADDER[i].name} is above what this machine measured as safe (${LADDER[cap].name}); expect dropped frames or stutter.` };
}
/** Pure: next focus index for a move of `d` over `n` items (wraps). */
export const moveFocus = (i: number, d: number, n: number) => n ? (i + d + n) % n : 0;

export function createMenu(hooks: MenuHooks) {
  const root = document.createElement('div'); root.id = 'start-menu'; root.className = 'fade'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Menu'); // starts dismissed: ?nomenu / ?bench never call show(), which used to leave the dark gradient over the left of the view
  const panel = document.createElement('div'); panel.className = 'start-panel'; root.append(panel); document.body.append(root);
  let open = false, mode: MenuMode = 'start', stack: (() => void)[] = [], padPrev: boolean[] = [], raf = 0;
  const btn = (label: string, on: () => void, disabled = false) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = disabled; b.onclick = on; return b; };
  const page = (title: string, ...nodes: Node[]) => { panel.replaceChildren(); const h = document.createElement('h2'); h.textContent = title; panel.append(h, ...nodes);
    (panel.querySelector('button:not(:disabled),input,select') as HTMLElement | null)?.focus(); };
  const sub = (render: () => void) => { stack.push(render); render(); };
  const back = () => { stack.pop(); (stack[stack.length - 1] ?? main)(); };
  const backBtn = () => btn('Back', back);
  const panels: MenuPanel[] = [];
  const music = () => btn('Music', () => sub(() => page('Music', hooks.music(), backBtn())));
  function main() { stack = [];
    if (mode === 'start') {
      page('Boreal', btn('Continue', close, !hooks.hasSave()), btn('New world', () => sub(newWorld)), music(), btn('Graphics', () => sub(graphics)), btn('Quit', quit));
      if (!hooks.hasSave()) (panel.querySelectorAll('button')[1] as HTMLElement).focus();
    } else page('Paused', ...(hooks.warning?.() ? [Object.assign(document.createElement('p'), { className: 'note', textContent: hooks.warning!() })] : []), btn('Resume', close), btn('Save', () => { hooks.save(); saved.textContent = `Saved ${new Date().toLocaleTimeString()}`; }), music(), btn('Graphics', () => sub(graphics)),
      ...(panels.length ? [btn('More', () => sub(more))] : []), btn('Quit to menu', () => { hooks.save(); hooks.quitToMenu?.(); show('start'); }), saved);
  }
  const saved = Object.assign(document.createElement('p'), { className: 'note' });
  function more() { page('More', ...panels.map(p => btn(p.title, () => sub(() => page(p.title, p.build(), backBtn())))), backBtn()); }
  function newWorld() {
    const seed = Object.assign(document.createElement('input'), { type: 'number', value: String(hooks.seed()), min: '0', step: '1' }); seed.setAttribute('aria-label', 'Seed');
    const src = document.createElement('select'); src.setAttribute('aria-label', 'Terrain source');
    src.append(new Option('Seeded terrain', 'seed'), Object.assign(new Option('Real elevation (NRCan / Copernicus DEM, not yet available)', 'dem'), { disabled: true }));
    const staged = Object.assign(document.createElement('input'), { type: 'checkbox', checked: hooks.staged() });
    const lab = (t: string, el: HTMLElement) => { const l = document.createElement('label'); l.append(t + ' ', el); return l; };
    const warn = document.createElement('p'); warn.className = 'note'; if (hooks.hasSave()) warn.textContent = 'Starting a new world replaces your saved world (remembered animals, ground and changes).';
    page('New world', lab('Seed (staged terrain)', seed), lab('Terrain', src), lab('Staged terrain (erosion, lakes)', staged), warn,
      btn('Start', () => { hooks.newWorld({ seed: Math.max(0, Math.floor(Number(seed.value) || 0)), source: src.value as 'seed' | 'dem', staged: staged.checked }); close(); }), backBtn());
  }
  function graphics() {
    const cap = GOVERNOR.probeCap, info = document.createElement('p');
    info.textContent = `Probe: safe maximum ${LADDER[cap].name}. Now: ${GOVERNOR.auto ? 'Auto' : 'Manual'}, ${LADDER[GOVERNOR.tier].name}.`;
    const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Quality'); sel.append(new Option(`Auto (up to ${LADDER[cap].name})`, 'auto'));
    LADDER.forEach((t, i) => sel.append(new Option(i < cap ? `${t.name} (above safe cap)` : t.name, String(i))));
    sel.value = GOVERNOR.auto ? 'auto' : String(GOVERNOR.tier);
    const warn = document.createElement('p'); warn.className = 'note';
    sel.onchange = () => { if (sel.value === 'auto') { GOVERNOR.auto = true; warn.textContent = ''; }
      else { const i = Number(sel.value), c = tierChoice(i, GOVERNOR.probeCap); warn.textContent = c.warn; GOVERNOR.auto = false; if (i < GOVERNOR.probeCap) GOVERNOR.probeCap = i; GOVERNOR.tier = i; }
      resetGovernor(); };
    page('Graphics', info, sel, warn, ...(hooks.graphics ? [hooks.graphics()] : []), backBtn());
  }
  function quit() { window.close(); page('Quit', Object.assign(document.createElement('p'), { textContent: 'Your progress is saved. You can close this tab now.' }), backBtn()); }
  function close() { if (!open) return; open = false; cancelAnimationFrame(raf); root.classList.add('fade'); root.hidden = false; setTimeout(() => { if (!open) root.hidden = true; }, 500); hooks.close(mode); }
  function show(m: MenuMode) { mode = m; open = true; saved.textContent = ''; root.hidden = false; root.classList.remove('fade'); root.classList.toggle('pause', m === 'pause'); cancelAnimationFrame(raf); padPrev = [true, true]; main(); pad(); }
  const items = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input,select'));
  const move = (d: number) => { const it = items(), i = it.indexOf(document.activeElement as HTMLElement); it[moveFocus(Math.max(0, i), i < 0 ? 0 : d, it.length)]?.focus(); };
  function onKey(e: KeyboardEvent) {
    if (!open || (e.target instanceof HTMLElement && !root.contains(e.target) && e.target !== document.body)) return;
    e.stopPropagation(); // the game ignores keys while the menu is open
    const a = document.activeElement;
    if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && !(a instanceof HTMLInputElement || a instanceof HTMLSelectElement))) { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && !(a instanceof HTMLInputElement || a instanceof HTMLSelectElement))) { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); if (stack.length) back(); else if (mode === 'pause') close(); }
  }
  addEventListener('keydown', onKey, true);
  const pad = () => { raf = requestAnimationFrame(pad);
    const p = [...navigator.getGamepads()].find(g => g?.connected && g.mapping === 'standard'); if (!p) return;
    const b = p.buttons.map(x => x.pressed), y = p.axes[1] ?? 0; b[20] = y > .6; b[21] = y < -.6;
    const hit = (i: number) => b[i] && !padPrev[i]; padPrev = b;
    if (hit(13) || hit(20)) move(1); if (hit(12) || hit(21)) move(-1);
    if (hit(0)) (document.activeElement as HTMLElement | null)?.click(); if (hit(1)) { if (stack.length) back(); else if (mode === 'pause') close(); } if (hit(9) && mode === 'pause' && !stack.length) close(); };
  root.hidden = true;
  return { get open() { return open; }, get mode() { return mode; }, show, close, addPanel(p: MenuPanel) { panels.push(p); } };
}
