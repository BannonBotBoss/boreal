/**
 * Pad router (Grok Bot): one per page. Each frame it reads the pad through the ONE action registry (core/bindings) and
 * sends it where it belongs: an open overlay (pad menu, help, filter wheel, gamepad settings, an open dialog such as the
 * photo gallery), camera-adjust mode (LB/RB pick a setting, LT/RT change it), or the globe (orbit, zoom, turn, home,
 * land). Returns true while it owns the pad, so the game ignores it that frame. main.ts forwards padMenu / padHelp /
 * shutter / cameraMode presses (keyboard or pad) to act(). Y: tap = camera-adjust mode, hold = filter wheel.
 */
import { ACTIONS, ACTIVE, atomValues, atomsOf, bindingLabel, loadBindings, resolveContext, BINDINGS_KEY, BUTTONS, type Bindings, type PadState } from '../core/bindings';
import { canUse } from '../core/badges';
import { contextPresses, createPadReader, HOLD_MS, standardPad } from './gamepad';
import { padTarget } from './padTargets';
import { createPadMenu, domItems, cameraControl, ensureCss } from '../ui/padMenu';
import { radialSlice, type Item, type MenuEvent } from '../ui/padNav';
import { glyph, mountGamepadSettings } from '../ui/gamepadSettings';
import { photoFlyStick } from '../photo/fly';

const PAD_IDS = new Set(['padMenu', 'padHelp', 'shutter', 'cameraMode']);
const readBindings = () => { try { return loadBindings(localStorage.getItem(BINDINGS_KEY)); } catch { return loadBindings(null); } };
export interface RouterHost { act(id: string): void; notice(t: string): void; reloadBindings?(): void; globe(): boolean; flight?(): boolean }

/** The live button map (for the help overlay and reports): pad input → actions per context. */
export function buttonMap(b: Bindings) {
  const ctxs = ['play', 'globe', 'drone', 'camera', 'menu', 'any'] as const, rows: { atom: string; by: Record<string, string[]> }[] = [];
  for (const atom of [...BUTTONS.filter(x => x !== 'xbox'), 'ls', 'rs']) {
    const by: Record<string, string[]> = {};
    for (const c of ctxs) by[c] = ACTIONS.filter(a => a.context === c && b[a.id].pad.some(p => atomsOf(p).some(x => x === atom || x.startsWith(atom + '.') && atom.length === 2))).map(a => a.label.replace(/^(Globe|Camera|Menu|Drone): /, ''));
    if (Object.values(by).some(l => l.length)) rows.push({ atom, by });
  }
  return rows;
}

export function createPadRouter(host: RouterHost) {
  ensureCss();
  let b = readBindings(), settingsOpen = false, helpOpen = false, camMode = false, camSel = 0, camAcc = 0, prevCam = new Set<string>(), prevGlobe = new Set<string>(), prevAxis = new Set<string>(), prevDrone = new Set<string>();
  let yDownAt = -1, radial: { items: Item[]; sel: number } | undefined, hintEl: HTMLDivElement | undefined, camEl: HTMLDivElement | undefined;
  const reader = createPadReader();
  const menu = createPadMenu({ act: id => host.act(id), shutter: () => shutter(), settings: () => openSettings(), help: () => toggleHelp(true), close: () => {}, notice: host.notice });
  const helpEl = document.createElement('div'); helpEl.className = 'padh'; helpEl.hidden = true; document.body.append(helpEl);
  const radialEl = document.createElement('div'); radialEl.className = 'padr'; radialEl.hidden = true; document.body.append(radialEl);
  function shutter() { const shot = document.querySelector('[data-a="shot"]') as HTMLElement | null;
    if (shot && shot.offsetParent) shot.click(); else host.act('photo'); }
  function openSettings() { settingsOpen = true; mountGamepadSettings(document.body, { onClose: () => { settingsOpen = false; b = readBindings(); host.reloadBindings?.(); } }); }
  function toggleHelp(on = !helpOpen) {
    helpOpen = on; helpEl.hidden = !on; if (!on) return;
    const L = (l: string[]) => l.join(', ') || '—';
    helpEl.innerHTML = `<h2 style="margin:0 0 8px">Controller map ${glyph('B')} or ${glyph('View')} closes</h2><table><tr><th>Input</th><th>Game</th><th>Globe</th><th>Drone</th><th>Camera mode</th><th>Menus</th><th>Everywhere</th></tr>` +
      buttonMap(b).map(r => `<tr><td>${glyph(bindingLabel([r.atom]).replace('D-pad ', ''))}</td><td>${L(r.by.play)}</td><td>${L(r.by.globe)}</td><td>${L(r.by.drone)}</td><td>${L(r.by.camera)}</td><td>${L(r.by.menu)}</td><td>${L(r.by.any)}</td></tr>`).join('') +
      `</table><p>Hold ${glyph('Y')} for the filter wheel (stick to pick, let go to apply). Locked controls show 🔒: ${glyph('A')} opens their test, credits or purchase. Rebind everything under Menu → Settings → Gamepad settings.</p>`;
  }
  const camItems = () => domItems(document.querySelector('#camera-panel'), cameraControl);
  function toggleCam(on = !camMode) {
    if (on && !camItems().length) { host.notice('No camera panel on this screen yet.'); return; }
    if (on && !canUse('camera.exposure')) { host.notice('Manual camera settings are locked: earn the exposure badge (Badges tab).'); menu.open('badges'); return; }
    camMode = on; drawCam();
  }
  function drawCam() {
    if (!camMode) { camEl?.remove(); camEl = undefined; return; }
    if (!camEl) { camEl = document.createElement('div'); camEl.className = 'padx'; camEl.style.cssText += ';left:50%;transform:translateX(-50%);bottom:24px;font-size:20px'; document.body.append(camEl); }
    const it = camItems(), cur = it[camSel % Math.max(1, it.length)];
    camEl.innerHTML = cur ? `📷 <b>${cur.label}</b>: ${cur.value?.() ?? ''}${cur.control && !canUse(cur.control) ? ' 🔒' : ''} · ${glyph('LB')}${glyph('RB')} setting · ${glyph('LT')}${glyph('RT')} adjust · ${glyph('X')} auto · ${glyph('RS')} shutter · ${glyph('B')} done` : '';
  }
  function openRadial() {
    const sel = document.querySelector('#camera-panel select') as HTMLSelectElement | null;
    if (!sel) { host.notice('No camera filters on this screen yet.'); return; }
    if (!canUse('camera.filters')) { menu.open('badges'); host.notice('Filters need the wavelength-filters badge.'); return; }
    radial = { items: Array.from(sel.options).map((o, i) => ({ label: o.text, kind: o.disabled ? 'info' : 'action', act: () => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); } }) as Item), sel: sel.selectedIndex };
    drawRadial();
  }
  function drawRadial() {
    radialEl.hidden = !radial; if (!radial) return; const n = radial.items.length;
    radialEl.innerHTML = radial.items.map((it, i) => { const a = i / n * 2 * Math.PI, x = 260 + 190 * Math.sin(a), y = 260 - 190 * Math.cos(a);
      return `<div class="s${i === radial!.sel ? ' focus' : ''}${it.kind === 'info' ? ' lock' : ''}" style="left:${x}px;top:${y - 20}px">${it.label}</div>`; }).join('') + `<div class="c">Filter<br><small>stick to pick · let go of ${glyph('Y')}</small></div>`;
  }
  function domNav(dlg: HTMLElement, e: MenuEvent) { // any open dialog (gallery): spatial focus, A clicks, ←/→ adjust ranges, B closes
    const els = Array.from(dlg.querySelectorAll<HTMLElement>('button,input,select,a[href],[tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent && !(x as HTMLButtonElement).disabled);
    const cur = (document.activeElement && els.includes(document.activeElement as HTMLElement) ? document.activeElement : els[0]) as HTMLElement | undefined; if (!cur) { if (e === 'menuBack') (dlg as HTMLDialogElement).close?.(); return; }
    if (e === 'menuSelect') { cur.click(); return; } if (e === 'menuBack') { (dlg as HTMLDialogElement).close?.(); return; }
    if ((e === 'menuLeft' || e === 'menuRight') && cur instanceof HTMLInputElement && cur.type === 'range') { cur.stepUp(e === 'menuRight' ? 1 : -1); cur.dispatchEvent(new Event('input', { bubbles: true })); return; }
    const d = { menuUp: [0, -1], menuDown: [0, 1], menuLeft: [-1, 0], menuRight: [1, 0] }[e as 'menuUp']; if (!d) return;
    const r0 = cur.getBoundingClientRect(), c0 = [r0.x + r0.width / 2, r0.y + r0.height / 2];
    let best: HTMLElement | undefined, bs = Infinity;
    for (const x of els) { if (x === cur) continue; const r = x.getBoundingClientRect(), v = [r.x + r.width / 2 - c0[0], r.y + r.height / 2 - c0[1]], along = v[0] * d[0] + v[1] * d[1];
      if (along <= 1) continue; const s = along + 2 * Math.abs(v[0] * d[1] - v[1] * d[0]); if (s < bs) { bs = s; best = x; } }
    if (best) { cur.classList.remove('pad-focus'); best.focus(); best.classList.add('pad-focus'); best.scrollIntoView({ block: 'nearest' }); }
  }
  function chip(pad: PadState | undefined) {
    if (!pad) { hintEl?.remove(); hintEl = undefined; return; }
    if (!hintEl) { hintEl = document.createElement('div'); hintEl.className = 'padx'; document.body.append(hintEl); }
    const busy = menu.isOpen || helpOpen || settingsOpen || !!radial; hintEl.hidden = busy;
    hintEl.innerHTML = `${glyph('≡')} Menu · ${glyph('⧉')} Help · ${glyph('Y')} Camera (hold: filters) · ${glyph('RS')} Photo`;
  }
  const api = {
    menu, buttonMap: () => buttonMap(b), get state() { return { settingsOpen, helpOpen, camMode, radial: !!radial, menu: menu.isOpen }; },
    setBindings(nb: Bindings) { b = nb; },
    /** A fired press (keyboard or pad) from the game; true when it is one of the router's. */
    act(id: string) {
      if (!PAD_IDS.has(id)) return false;
      if (id === 'padMenu') { if (menu.isOpen) menu.close(); else { toggleHelp(false); menu.open(); } }
      else if (id === 'padHelp') toggleHelp();
      else if (id === 'shutter') shutter();
      else if (id === 'cameraMode') { yDownAt = performance.now(); toggleCam(); }
      return true;
    },
    /** One frame. Returns true while the router owns the pad (the game should ignore it). */
    frame(pad: PadState | undefined, now = performance.now(), dt = 1 / 60, standalone = false): boolean {
      const v = atomValues([], pad), e = reader.update(v, now); chip(pad);
      if (settingsOpen) return true;
      const menuP = contextPresses(b, e, 'menu');
      if (radial) { const yAtoms = b.cameraMode.pad.flatMap(atomsOf); const x = (v.get('rs.right') ?? 0) - (v.get('rs.left') ?? 0) || (v.get('ls.right') ?? 0) - (v.get('ls.left') ?? 0), y = (v.get('rs.down') ?? 0) - (v.get('rs.up') ?? 0) || (v.get('ls.down') ?? 0) - (v.get('ls.up') ?? 0);
        const s = radialSlice(x, y, radial.items.length, .4); if (s >= 0) radial.sel = s; drawRadial();
        if (yAtoms.every(a => (v.get(a) ?? 0) <= ACTIVE)) { const it = radial.items[radial.sel]; if (it?.kind !== 'info') it?.act?.(); radial = undefined; drawRadial(); }
        return true; }
      if (menu.isOpen) { for (const p of menuP) menu.input(p as MenuEvent); return true; }
      if (helpOpen) { if (menuP.has('menuBack') || e.down.has('view')) toggleHelp(false); return true; }
      const dlg = document.querySelector('dialog[open]') as HTMLElement | null;
      if (dlg) { for (const p of menuP) domNav(dlg, p as MenuEvent); return true; }
      if (standalone) for (const p of contextPresses(b, e, 'globe')) if (PAD_IDS.has(p)) api.act(p);
      // Y held past HOLD_MS: undo the tap's camera-mode toggle and open the filter wheel
      if (yDownAt >= 0) { const yAtoms = b.cameraMode.pad.flatMap(atomsOf);
        if (yAtoms.length && yAtoms.every(a => (v.get(a) ?? 0) > ACTIVE)) { if (now - yDownAt >= HOLD_MS) { yDownAt = -1; if (camMode) toggleCam(false); openRadial(); return true; } }
        else yDownAt = -1; }
      if (camMode) { const r = resolveContext(b, v, prevCam, 'camera'); prevCam = r.active; const it = camItems(), n = it.length;
        if (!n) { camMode = false; drawCam(); return false; }
        if (r.fired.has('camNext')) camSel = (camSel + 1) % n; if (r.fired.has('camPrev')) camSel = (camSel - 1 + n) % n;
        const cur = it[camSel % n], locked = !!cur.control && !canUse(cur.control);
        if (r.fired.has('camAuto')) it.find(i => i.kind === 'toggle')?.act?.();
        if (r.fired.has('back')) toggleCam(false);
        if (r.fired.has('shutter')) shutter();
        const d = (r.value.camUp ?? 0) - (r.value.camDown ?? 0);
        if (Math.abs(d) > .05 && !locked) { camAcc += dt * (2 + 10 * Math.abs(d)); if (camAcc >= 1 || r.fired.size === 0 && camAcc === dt * (2 + 10 * Math.abs(d))) { cur.adjust?.(Math.sign(d)); camAcc = Math.max(0, camAcc - 1); } } else camAcc = .99;
        drawCam(); return true; }
      const d = padTarget('drone');
      if (d?.active() && host.flight?.()) { const r = resolveContext(b, v, prevDrone, 'drone'); prevDrone = r.active; const V = r.value;
        const s = photoFlyStick(V);
        d.move(s.f, s.r); d.look(s.yaw, s.pitch); d.climb(s.u);
        if (r.fired.has('droneEmbody')) d.embody(); if (r.fired.has('droneCancel')) d.cancel();
        return true; }
      const g = padTarget('globe');
      const ax = g?.active() && (standalone || host.globe()) ? g.axis?.() : undefined;
      if (ax?.on) { const r = resolveContext(b, v, prevAxis, 'axis'); prevAxis = r.active; const V = r.value;
        ax.aim(((V.axisAimUp ?? 0) - (V.axisAimDown ?? 0)) * .8 * dt, ((V.axisAimRight ?? 0) - (V.axisAimLeft ?? 0)) * 1.2 * dt);
        const m = (V.axisOut ?? 0) - (V.axisIn ?? 0); if (Math.abs(m) > .02) ax.move(m * .25 * dt);
        if (r.fired.has('axisGas')) ax.gas(); if (r.fired.has('axisLayers')) ax.layers(); if (r.fired.has('axisRT')) ax.rt(); if (r.fired.has('axisBodies')) ax.bodies(); if (r.fired.has('axisParcels')) ax.parcels?.();
        if (r.fired.has('axisExit') || r.fired.has('back')) ax.toggle(false); return false; }
      if (g?.active() && (standalone || host.globe())) { const r = resolveContext(b, v, prevGlobe, 'globe'); prevGlobe = r.active; const V = r.value;
        g.orbit(((V.globeOrbitRight ?? 0) - (V.globeOrbitLeft ?? 0)) * 1.6 * dt, ((V.globeOrbitDown ?? 0) - (V.globeOrbitUp ?? 0)) * 1.2 * dt);
        const z = (V.globeZoomIn ?? 0) - (V.globeZoomOut ?? 0); if (Math.abs(z) > .02) g.zoom(Math.exp(-z * 1.6 * dt));
        const t = (V.globeTurnRight ?? 0) - (V.globeTurnLeft ?? 0); if (Math.abs(t) > .02) g.turn(t * 1.2 * dt);
        if (r.fired.has('globeAxis')) g.axis?.().toggle(true); if (r.fired.has('globeHome')) g.home(); if (r.fired.has('globeLand')) g.land();
        if (r.fired.has('inspector')) host.act('inspector');
        return false; }
      return false;
    },
  };
  return api;
}
/** Standalone pages (?view=globe): run the router on its own frame loop. */
export function startStandaloneRouter(host: Partial<RouterHost> = {}) {
  const r = createPadRouter({ act: host.act ?? (() => {}), notice: host.notice ?? (t => console.log(t)), globe: () => true });
  let last = performance.now(); const loop = (t: number) => { requestAnimationFrame(loop); r.frame(standardPad(), t, Math.min(.05, (t - last) / 1000), true); last = t; };
  requestAnimationFrame(loop); return r;
}
