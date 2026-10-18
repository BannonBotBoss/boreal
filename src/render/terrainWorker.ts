/** Chunk terrain worker: runs render/terrainCore (pure world functions, no scene) off the main thread and returns the arrays
 *  as transferables. Loaded with Vite's `new Worker(new URL('./terrainWorker.ts', import.meta.url), { type: 'module' })`
 *  (as the globe's tileWorker). The stage grids are built once per worker on its first request (or `warm`). */
import { terrainCore, transferables, type TerrainRequest } from './terrainCore';
import { finish } from '../core/interest';
import { STAGES, elevationGrid, lakeAt } from '../core/stages/elevation';
import { riverAt } from '../core/stages/rivers';
import { soilAt } from '../core/stages/soils';

export type TerrainMessage = ({ warm: true } | { warm?: false } & TerrainRequest) & { id: number; stagesOn: boolean; stagesSeed: number };
const post = self as unknown as { postMessage(m: unknown, transfer: Transferable[]): void };
self.onmessage = (e: MessageEvent<TerrainMessage>) => {
  const m = e.data;
  try {
    if (m.warm) { STAGES.on = m.stagesOn; STAGES.seed = m.stagesSeed; if (m.stagesOn) { elevationGrid(m.stagesSeed); lakeAt(m.stagesSeed, 0, 0); riverAt(m.stagesSeed, 0, 0); soilAt(m.stagesSeed, 0, 0); } post.postMessage({ id: m.id, warm: true }, []); return; }
    const t = finish(terrainCore(m)); post.postMessage({ id: m.id, data: t }, transferables(t));
  } catch (err) { post.postMessage({ id: m.id, error: String(err) }, []); }
};
