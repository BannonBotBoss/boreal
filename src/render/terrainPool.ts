/**
 * Main-thread side of the chunk terrain workers (render/terrainWorker). `requestTerrain` returns a handle whose `data` fills
 * in when a worker answers; chunk jobs yield core/interest WAIT until then, so a waiting chunk costs nothing per frame.
 * Requests are dispatched nearest-first (core/interest distance at dispatch time) and dropped if no longer `wanted()`.
 * Without Worker support (node, tests) or after a worker error, the same generator runs on the main thread, sliced.
 */
import { STAGES } from '../core/stages/elevation';
import { CHUNK_SIZE } from '../core/world';
import { squareDistance } from '../core/interest';
import type { TerrainData, TerrainRequest } from './terrainCore';

export interface TerrainHandle { data?: TerrainData; failed?: boolean; readonly request: TerrainRequest }
interface Pending { id: number; req: TerrainRequest; handle: TerrainHandle; wanted: () => boolean }
interface Slot { w: Worker; busy: Pending | null }
const slots: Slot[] = [], queue: Pending[] = [];
let nextId = 1, broken = false, warmKey = '';

function spawn() {
  if (broken || slots.length || typeof Worker === 'undefined') return;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4, count = Math.max(1, Math.min(3, Math.floor(cores / 4)));
  try {
    for (let k = 0; k < count; k++) {
      const s: Slot = { w: new Worker(new URL('./terrainWorker.ts', import.meta.url), { type: 'module' }), busy: null };
      s.w.onmessage = (e: MessageEvent<{ id: number; data?: TerrainData; error?: string; warm?: boolean }>) => {
        if (e.data.warm) return; // warm-ups are not tracked as busy
        const p = s.busy; if (!p || p.id !== e.data.id) return; s.busy = null;
        if (p) { if (e.data.data) p.handle.data = e.data.data; else { p.handle.failed = true; console.warn('terrain worker', e.data.error); } }
        pump();
      };
      s.w.onerror = ev => { ev.preventDefault?.(); const p = s.busy; s.busy = null; if (p) p.handle.failed = true; broken = true; console.warn('terrain worker failed; building on the main thread', ev.message); };
      slots.push(s);
    }
  } catch { broken = true; }
}
function pump() {
  for (const s of slots) {
    if (s.busy) continue;
    for (let i = queue.length - 1; i >= 0; i--) if (!queue[i].wanted()) queue.splice(i, 1);
    if (!queue.length) return;
    let best = 0, bd = Infinity; for (let i = 0; i < queue.length; i++) { const r = queue[i].req, d = squareDistance(r.cx * CHUNK_SIZE, r.cz * CHUNK_SIZE, CHUNK_SIZE); if (d < bd) { bd = d; best = i; } }
    const p = queue.splice(best, 1)[0]; s.busy = p; s.w.postMessage({ ...p.req, id: p.id });
  }
}
/** Build each worker's stage grids now (behind the loading screen), for the current STAGES. */
export function warmTerrainWorkers() {
  spawn(); const key = `${STAGES.on}:${STAGES.seed}`; if (broken || !slots.length || warmKey === key) return; warmKey = key;
  for (const s of slots) if (!s.busy) s.w.postMessage({ warm: true, id: 0, stagesOn: STAGES.on, stagesSeed: STAGES.seed });
}
/** Workers available? (false: callers run terrainCore on the main thread) */
export const terrainWorkers = () => { spawn(); return !broken && slots.length > 0; };
export function requestTerrain(req: TerrainRequest, wanted: () => boolean = () => true): TerrainHandle {
  const handle: TerrainHandle = { request: req }; queue.push({ id: nextId++, req, handle, wanted }); pump(); return handle;
}
/** Close the workers (tests / teardown). */
export function closeTerrainWorkers() { for (const s of slots) s.w.terminate(); slots.length = 0; queue.length = 0; }
