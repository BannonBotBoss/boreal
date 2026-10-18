/** Globe tile worker (Grok Bot): builds tiles off the main thread with the SAME seeded planet + core/world heightAt
 *  (both are DOM-free pure functions), so worker tiles are bit-identical to main-thread ones. Loaded with Vite's
 *  `new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' })`. */
import { STAGES } from '../../core/stages/elevation';
import { heightAt } from '../../core/world';
import { finish } from '../../core/interest';
import { node } from './cube';
import { planetFor } from './planet';
import { buildTile } from './tile';

/** `warm` requests build the seed's planet (hypsometry) and the staged world grids (elevation, flow, rivers) up front,
 *  in parallel on every worker, so the first home-region tile mid-zoom doesn't pay seconds of cold start. */
export interface TileRequest { warm?: boolean; id: number; seed: number; staged: boolean; stagesSeed: number; face: number; level: number; i: number; j: number; segments: number }
const post = self as unknown as { postMessage(m: unknown, transfer: Transferable[]): void };
self.onmessage = (e: MessageEvent<TileRequest>) => {
  const r = e.data; STAGES.on = r.staged; STAGES.seed = r.stagesSeed;
  if (r.warm) { const t0 = performance.now(); planetFor(r.seed, heightAt, r.staged ? 'staged' : 'layered'); heightAt(0, 0); post.postMessage({ id: r.id, warm: performance.now() - t0 }, []); return; }
  const t = finish(buildTile(node(r.face, r.level, r.i, r.j), planetFor(r.seed, heightAt, r.staged ? 'staged' : 'layered'), r.segments));
  post.postMessage({ id: r.id, tile: t }, [t.position.buffer, t.color.buffer, t.height.buffer, t.normal.buffer, t.index.buffer]);
};
