/** Globe tile worker (Grok Bot): builds tiles off the main thread with the SAME seeded planet + home sampler (home.ts:
 *  core/stages/surfaceAt or core/world heightAt, all DOM-free pure functions), so worker tiles are bit-identical to
 *  main-thread ones. Loaded with Vite's `new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' })`.
 *  Builds are time-sliced: every few rows the worker yields to its event loop, so a `cancel` for a tile the camera has
 *  moved past lands mid-build and frees the worker for the closest tiles. */
import { STAGES } from '../../core/stages/elevation';
import { node } from './cube';
import { globePlanet, warmHome } from './home';
import { buildTile } from './tile';

/** `warm` builds the planet and the staged grids up front (parallel on every worker); `cancel` drops build `id`. */
export interface TileRequest { warm?: boolean; cancel?: boolean; id: number; seed: number; staged: boolean; stagesSeed: number; face: number; level: number; i: number; j: number; segments: number }
const post = self as unknown as { postMessage(m: unknown, transfer: Transferable[]): void };
const cancelled = new Set<number>(), ch = new MessageChannel();
let wake: (() => void) | null = null; ch.port1.onmessage = () => { const w = wake; wake = null; w?.(); };
const yieldNow = () => new Promise<void>(res => { wake = res; ch.port2.postMessage(0); });
const ROWS_PER_SLICE = 6; // ≈ 1-3 ms of work between yields [game calibration]

async function build(r: TileRequest) {
  const gen = buildTile(node(r.face, r.level, r.i, r.j), globePlanet(r.seed, r.staged, r.stagesSeed), r.segments);
  let x = gen.next(), rows = 0;
  while (!x.done) {
    if (++rows % ROWS_PER_SLICE === 0) { await yieldNow(); if (cancelled.delete(r.id)) { post.postMessage({ id: r.id, cancelled: true }, []); return; } }
    x = gen.next();
  }
  const t = x.value; cancelled.delete(r.id);
  post.postMessage({ id: r.id, tile: t }, [t.position.buffer, t.color.buffer, t.height.buffer, t.lake.buffer, t.normal.buffer, t.index.buffer]);
}
self.onmessage = (e: MessageEvent<TileRequest>) => {
  const r = e.data; if (r.cancel) { cancelled.add(r.id); return; }
  STAGES.on = r.staged; STAGES.seed = r.stagesSeed;
  if (r.warm) { post.postMessage({ id: r.id, warm: warmHome(r.seed, r.staged, r.stagesSeed) }, []); return; }
  void build(r);
};
