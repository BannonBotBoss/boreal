/** Camera panel (T-0067): auto (eye/camera adaptation) or manual aperture/shutter/ISO, exposure compensation, ND stops,
 *  focal length, wavelength filter. Toggle with the "Camera" button or the C key. Pure DOM, sits left of the layer panel. */
import { defaultCamera, type CameraSettings } from '../render/exposure';
import { BANDS, type BandId } from '../world/sun/bands';

export interface CameraPanelState { cam: CameraSettings; band: BandId }
export function stateFromSearch(search: string): CameraPanelState {
  const q = new URLSearchParams(search), cam = defaultCamera(), num = (k: string, d: number) => q.has(k) ? Number(q.get(k)) : d;
  cam.auto = q.get('auto') !== '0'; cam.comp = num('comp', 0); cam.N = num('N', cam.N); cam.t = num('t', cam.t); cam.S = num('iso', cam.S); cam.nd = num('nd', 0); cam.focalMm = num('focal', cam.focalMm); cam.adaptSpeed = num('speed', 1);
  const b = q.get('band') as BandId; return { cam, band: BANDS.some(x => x.id === b) ? b : 'visible' };
}
export function mountCameraPanel(st: CameraPanelState, onChange: () => void, readout: () => string) {
  const wrap = document.createElement('div'); wrap.id = 'camera-panel';
  wrap.style.cssText = 'position:fixed;top:8px;right:200px;z-index:21;background:#000a;color:#ddd;font:12px system-ui;padding:6px 8px;border-radius:6px;line-height:1.7;min-width:210px';
  const btn = document.createElement('button'); btn.textContent = 'Camera'; btn.style.cssText = 'background:#333;color:#ddd;border:0;border-radius:4px;padding:2px 8px;cursor:pointer';
  const body = document.createElement('div'), out = document.createElement('pre'); out.style.cssText = 'margin:4px 0 0;font:11px ui-monospace;color:#fc6;white-space:pre-wrap';
  btn.onclick = () => { body.hidden = !body.hidden; }; addEventListener('keydown', e => { if (e.key === 'c' && !(e.target instanceof HTMLInputElement)) btn.click(); });
  const row = (label: string, el: HTMLElement) => { const l = document.createElement('label'); l.style.display = 'flex'; l.style.justifyContent = 'space-between'; l.style.gap = '6px'; l.append(label, el); body.append(l); };
  const range = (min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt = (v: number) => v.toFixed(1)) => {
    const s = document.createElement('input'), v = document.createElement('span'); s.type = 'range'; s.min = `${min}`; s.max = `${max}`; s.step = `${step}`; s.value = `${get()}`; v.textContent = fmt(get());
    s.oninput = () => { set(Number(s.value)); v.textContent = fmt(get()); onChange(); }; const c = document.createElement('span'); c.append(s, v); return c; };
  const auto = document.createElement('input'); auto.type = 'checkbox'; auto.checked = st.cam.auto; auto.onchange = () => { st.cam.auto = auto.checked; onChange(); };
  const sel = document.createElement('select'); for (const b of BANDS) sel.add(new Option(b.label, b.id, false, b.id === st.band)); sel.onchange = () => { st.band = sel.value as BandId; onChange(); };
  row('Auto exposure (eye)', auto);
  row('Comp EV', range(-5, 5, .5, () => st.cam.comp, v => st.cam.comp = v));
  row('Aperture f/', range(1.4, 32, .1, () => st.cam.N, v => st.cam.N = v));
  row('Shutter log2 s', range(-13, 0, 1, () => Math.log2(st.cam.t), v => st.cam.t = 2 ** v, v => `1/${Math.round(1 / 2 ** v)}`));
  row('ISO', range(50, 6400, 50, () => st.cam.S, v => st.cam.S = v, v => `${v}`));
  row('ND stops', range(0, 20, .5, () => st.cam.nd, v => st.cam.nd = v));
  row('Focal mm', range(14, 4000, 1, () => st.cam.focalMm, v => st.cam.focalMm = v, v => `${v}`));
  row('Adapt speed x', range(1, 100, 1, () => st.cam.adaptSpeed, v => st.cam.adaptSpeed = v, v => `${v}`));
  row('Filter', sel);
  body.append(out); wrap.append(btn, body); document.body.append(wrap);
  return { update() { out.textContent = readout(); }, el: wrap };
}
