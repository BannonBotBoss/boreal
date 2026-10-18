/** Globe tile worker (Grok Bot): builds tiles off the main thread with the SAME seeded planet + core/world heightAt
 *  (both are DOM-free pure functions), so worker tiles are bit-identical to main-thread ones. Loaded with Vite's
 *  `new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' })`. */
import { STAGES } from '../../core/stages/elevation';
import { heightAt } from '../../core/world';
import { finish } from '../../core/interest';
import { node } from './cube';
import { planetFor } from './planet';
import { buildTile } from './tile';

export interface TileRequest { id: number; seed: number; staged: boolean; stagesSeed: number; face: number; level: number; i: number; j: number; segments: number }
const post = self as unknown as { postMessage(m: unknown, transfer: Transferable[]): void };
self.onmessage = (e: MessageEvent<TileRequest>) => {
  const r = e.data; STAGES.on = r.staged; STAGES.seed = r.stagesSeed;
  const t = finish(buildTile(node(r.face, r.level, r.i, r.j), planetFor(r.seed, heightAt, r.staged ? 'staged' : 'layered'), r.segments));
  post.postMessage({ id: r.id, tile: t }, [t.position.buffer, t.color.buffer, t.height.buffer, t.normal.buffer, t.index.buffer]);
};
