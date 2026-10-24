/** Camera panel (T-0067/T-0068): the viewfinder controls shared by globe, game and sun viewer. Auto exposure and the shutter
 *  are free; manual exposure (aperture/shutter/ISO/ND/comp) and filters are badge-gated per control (camera/badges.ts).
 *  Collapsed by default (clean viewfinder); the "Camera" button or C opens it. */
import { defaultCamera, ev100FromSettings, type CameraSettings } from '../render/exposure';
import { hasBadge } from '../camera/badges';

export interface FilterOption { id: string; label: string; disabled?: boolean; note?: string }
export interface CameraPanelState { cam: CameraSettings; band: string }
export function stateFromSearch(search: string, filters: FilterOption[] = []): CameraPanelState {
  const q = new URLSearchParams(search), cam = defaultCamera(), num = (k: string, d: number) => q.has(k) ? Number(q.get(k)) : d;
  cam.auto = q.get('auto') !== '0'; cam.comp = num('comp', 0); cam.N = num('N', cam.N); cam.t = num('t', cam.t); cam.S = num('iso', cam.S); cam.nd = num('nd', 0); cam.focalMm = num('focal', cam.focalMm); cam.adaptSpeed = num('speed', 1);
  const b = q.get('band') ?? q.get('filter') ?? ''; return { cam, band: filters.some(x => x.id === b) ? b : filters[0]?.id ?? 'visible' };
}
export interface PanelOpts { filters: FilterOption[]; focal?: boolean; onPhoto?: () => void; onGallery?: () => void; open?: boolean }
export function mountCameraPanel(st: CameraPanelState, onChange: () => void, readout: () => string, opts: PanelOpts) {
  const okExp = hasBadge('camera.exposure'), okFil = hasBadge('camera.filters');
  if (!okExp) st.cam.auto = true; if (!okFil) st.band = opts.filters[0].id;
  const wrap = document.createElement('div'); wrap.id = 'camera-panel'; wrap.dataset.ui = 'camera';
  wrap.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:30;background:#000a;color:#ddd;font:12px system-ui;padding:6px 8px;border-radius:6px;line-height:1.7;min-width:220px';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px';
  const b = (t: string, f: () => void, title = '') => { const e = document.createElement('button'); e.textContent = t; e.title = title; e.style.cssText = 'background:#333;color:#ddd;border:0;border-radius:4px;padding:2px 8px;cursor:pointer'; e.onclick = f; bar.append(e); return e; };
  const body = document.createElement('div'); body.hidden = !opts.open;
  b('Camera', () => { body.hidden = !body.hidden; }, 'C'); if (opts.onPhoto) b('◉ Photo', opts.onPhoto, 'P'); if (opts.onGallery) b('Gallery', opts.onGallery, 'G');
  const out = document.createElement('pre'); out.style.cssText = 'margin:4px 0 0;font:11px ui-monospace;color:#fc6;white-space:pre-wrap';
  addEventListener('keydown', e => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey) return; if (e.key === 'c') body.hidden = !body.hidden; });
  const row = (label: string, el: HTMLElement, locked = false) => { const l = document.createElement('label'); l.style.cssText = `display:flex;justify-content:space-between;gap:6px;${locked ? 'opacity:.4' : ''}`; l.title = locked ? 'needs badge' : ''; l.append(label + (locked ? ' 🔒' : ''), el); body.append(l); };
  const range = (min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt = (v: number) => v.toFixed(1), locked = false) => {
    const s = document.createElement('input'), v = document.createElement('span'); s.type = 'range'; s.min = `${min}`; s.max = `${max}`; s.step = `${step}`; s.value = `${get()}`; s.disabled = locked; v.textContent = fmt(get());
    s.oninput = () => { set(Number(s.value)); v.textContent = fmt(get()); onChange(); }; const c = document.createElement('span'); c.append(s, v); return c; };
  const auto = document.createElement('input'); auto.type = 'checkbox'; auto.checked = st.cam.auto; auto.disabled = !okExp; auto.onchange = () => { st.cam.auto = auto.checked; onChange(); };
  const sel = document.createElement('select'); sel.disabled = !okFil; for (const f of opts.filters) { const o = new Option(f.label + (f.disabled ? ` (${f.note ?? 'n/a'})` : ''), f.id, false, f.id === st.band); o.disabled = !!f.disabled; sel.add(o); }
  sel.onchange = () => { st.band = sel.value; onChange(); };
  row('Auto exposure', auto, !okExp);
  row('Comp EV', range(-5, 5, .5, () => st.cam.comp, v => st.cam.comp = v, undefined, !okExp), !okExp);
  row('Aperture f/', range(1.4, 32, .1, () => st.cam.N, v => st.cam.N = v, undefined, !okExp), !okExp);
  row('Shutter', range(-13, 3, 1, () => Math.log2(st.cam.t), v => st.cam.t = 2 ** v, v => v < 0 ? `1/${Math.round(2 ** -v)}` : `${2 ** v}s`, !okExp), !okExp);
  row('ISO', range(50, 6400, 50, () => st.cam.S, v => st.cam.S = v, v => `${v}`, !okExp), !okExp);
  row('ND stops', range(0, 20, .5, () => st.cam.nd, v => st.cam.nd = v, undefined, !okExp), !okExp);
  if (opts.focal !== false) row('Focal mm', range(14, 4000, 1, () => st.cam.focalMm, v => st.cam.focalMm = v, v => `${v}`));
  row('Adapt speed x', range(1, 100, 1, () => st.cam.adaptSpeed, v => st.cam.adaptSpeed = v, v => `${v}`));
  row('Filter', sel, !okFil);
  body.append(out); wrap.append(bar, body); document.body.append(wrap);
  return { update() { if (!body.hidden) out.textContent = readout(); }, el: wrap, manualEV: () => ev100FromSettings(st.cam.N, st.cam.t, st.cam.S) };
}
