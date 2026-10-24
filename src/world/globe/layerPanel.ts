/** Globe layer toggles (T-layers): which physical layers draw. A layer draws when the user leaves it on AND it exists at the
 *  deep-time offset (layerExistence.ts, causal: "not yet formed" before its onset, "gone" after it is lost). Off layers skip their
 *  work (cloud octaves 0, atmosphere steps 0, no aurora/field/plate pass). State: ?hide=a,b (this visit, like ?atmos=0) else
 *  localStorage 'boreal.globe.hide.v1' (persists); ?deep=<years, negative = past> picks the epoch. */
import { layerExistence, type Existence } from '../../core/layerExistence';

export const LAYERS = ['clouds', 'sunlight', 'atmosphere', 'aurora', 'snowIce', 'vegetation', 'ocean', 'fieldLines', 'plates', 'venus'] as const;
export type LayerId = typeof LAYERS[number];
const EXISTS_AS: Partial<Record<LayerId, keyof ReturnType<typeof layerExistence>>> = { venus: 'atmosphere', clouds: 'clouds', atmosphere: 'atmosphere', aurora: 'aurora', snowIce: 'snowIce', vegetation: 'vegetation', ocean: 'ocean', fieldLines: 'aurora', plates: 'plates' };
/** off unless asked: the overlays (field lines, plate boundaries) are diagnostics, not what an eye in orbit sees */
export const DEFAULT_HIDDEN: LayerId[] = ['fieldLines', 'plates'];
export const STORE_KEY = 'boreal.globe.hide.v1';

export interface LayerState { id: LayerId; user: boolean; exists: Existence; why: string; on: boolean }
export function parseHidden(search: string, stored: string | null): Set<LayerId> {
  const q = new URLSearchParams(search).get('hide'); const src = q ?? stored;
  const ids = src === null ? DEFAULT_HIDDEN : src.split(',').filter(Boolean);
  return new Set(ids.filter((x): x is LayerId => (LAYERS as readonly string[]).includes(x)));
}
export function deepOffset(search: string) { const d = Number(new URLSearchParams(search).get('deep') ?? 0); return Number.isFinite(d) ? d : 0; }
export function layerStates(hidden: Set<LayerId>, offsetYr = 0): Record<LayerId, LayerState> {
  const ex = layerExistence(offsetYr), out = {} as Record<LayerId, LayerState>;
  for (const id of LAYERS) {
    const k = EXISTS_AS[id], e = k ? (ex[k] as { e: Existence; why: string }) : { e: 'present' as Existence, why: id === 'sunlight' ? `Sun at ${(ex.state.sunRatio).toFixed(2)} L_now` : '' };
    out[id] = { id, user: !hidden.has(id), exists: e.e, why: e.why, on: !hidden.has(id) && e.e === 'present' };
  }
  return out;
}
const LABEL: Record<LayerId, string> = { clouds: 'Clouds', sunlight: 'Sunlight', atmosphere: 'Atmosphere', aurora: 'Aurora', snowIce: 'Snow / ice', vegetation: 'Vegetation', ocean: 'Ocean', fieldLines: 'Field lines', plates: 'Plates', venus: 'Venus' };
export function stateText(s: LayerState) { return s.exists === 'present' ? '' : s.exists === 'not-yet-formed' ? 'not yet formed' : 'gone'; }

/** DOM panel (top-right). onChange gets the new states; persists to localStorage unless ?hide= fixed them for this visit. */
export function mountLayerPanel(search: string, onChange: (s: Record<LayerId, LayerState>) => void, note?: () => string) {
  let stored: string | null = null; try { stored = localStorage.getItem(STORE_KEY); } catch { /* private mode */ }
  const hidden = parseHidden(search, stored), offset = deepOffset(search), fromUrl = new URLSearchParams(search).has('hide');
  const box = document.createElement('div'); box.id = 'globe-layers';
  box.style.cssText = 'position:fixed;top:8px;right:8px;z-index:20;background:#0009;color:#ddd;font:12px system-ui;padding:6px 8px;border-radius:6px;line-height:1.6';
  const msg = document.createElement('div'); msg.style.cssText = 'color:#fc6;max-width:180px';
  const render = () => { const st = layerStates(hidden, offset); box.replaceChildren();
    for (const id of LAYERS) { const s = st[id], l = document.createElement('label'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = s.user; c.disabled = s.exists !== 'present'; c.dataset.layer = id;
      c.onchange = () => { if (c.checked) hidden.delete(id); else hidden.add(id); if (!fromUrl) try { localStorage.setItem(STORE_KEY, [...hidden].join(',')); } catch { /* ignore */ } render(); };
      l.title = s.why; l.append(c, ` ${LABEL[id]}`); if (stateText(s)) { const i = document.createElement('i'); i.style.color = '#999'; i.textContent = ` (${stateText(s)})`; l.append(i); } box.append(l, document.createElement('br')); }
    msg.textContent = note?.() ?? ''; box.append(msg); onChange(st); };
  document.body.append(box); render();
  return { refreshNote() { msg.textContent = note?.() ?? ''; }, states: () => layerStates(hidden, offset), dispose() { box.remove(); } };
}
