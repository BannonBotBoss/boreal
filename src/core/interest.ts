/**
 * Interest radius (Grok Bot), PROJECT-RULES rule 8. ONE shared notion of "near the viewer" for every system:
 *   near = full simulation + full render; mid = cheap LOD + low-rate simulation; far = math only (no meshes, no stored
 *   per-entity objects, no stepping). Far state is the pure function of (seed, position, elapsed time) that each system
 *   already has (noise terrain, deterministic placement, closed-form ground, climatological weather, density fields),
 *   and it is instantiated from that function when it comes back into range.
 * The centre is the player, or the free camera in photo mode. Plus a frame-budgeted job runner so instantiating
 * (chunk builds, etc.) is spread across frames instead of stalling one.
 */
export const INTEREST = {
  near: 60,  // m: full detail (game calibration: covers the 3×3 chunks around the viewer at 40 m chunks)
  mid: 100,  // m: LOD / low-rate tier; beyond this nothing is instantiated
  budgetMs: 4, // per-frame time for instantiation jobs (game calibration: a quarter of a 60 fps frame)
  x: 0, z: 0,
};
export type Tier = 'near' | 'mid' | 'far';
export function setInterestCentre(x: number, z: number) { INTEREST.x = x; INTEREST.z = z; }
export const distance = (x: number, z: number) => Math.hypot(x - INTEREST.x, z - INTEREST.z);
export function tierAt(x: number, z: number, d = distance(x, z)): Tier { return d <= INTEREST.near ? 'near' : d <= INTEREST.mid ? 'mid' : 'far'; }
/** Distance from the centre to the nearest point of an axis-aligned square (chunk) of side `size` at (x0, z0). */
export function squareDistance(x0: number, z0: number, size: number) {
  const dx = Math.max(x0 - INTEREST.x, 0, INTEREST.x - x0 - size), dz = Math.max(z0 - INTEREST.z, 0, INTEREST.z - z0 - size);
  return Math.hypot(dx, dz);
}

/** Budgeted jobs: generators that yield between slices. Nearest-first by `priority` (lower first). A finished generator's
 * `done` (the finishing step: meshes, batches, scene adds) is its own budgeted step, never glued onto the last slice. */
interface Job { key: string; priority: number; it: Iterator<unknown, unknown>; done?: (v: unknown) => void; result?: { v: unknown } }
const jobs = new Map<string, Job>();
/** Per job kind (key prefix before ':'): slice/finish counts, worst ms, and a decaying estimate (est*) of the next one. */
export interface KindStats { slices: number; maxSlice: number; estSlice: number; dones: number; maxDone: number; estDone: number; over: number }
export const STATS = { jobsRun: 0, lastFrameMs: 0, maxFrameMs: 0, deferred: 0, kinds: {} as Record<string, KindStats> };
const kindStats = (key: string) => STATS.kinds[key.split(':')[0]] ??= { slices: 0, maxSlice: 0, estSlice: 0, dones: 0, maxDone: 0, estDone: 0, over: 0 };
export function enqueue<T>(key: string, priority: number, gen: Generator<unknown, T>, done: (v: T) => void) {
  jobs.set(key, { key, priority, it: gen, done: done as (v: unknown) => void });
}
export const cancel = (key: string) => jobs.delete(key);
export const pending = (key: string) => jobs.has(key);
export const queued = () => jobs.size;
/** Runs queued jobs for at most `budgetMs`. Always runs at least one step; after that a step only starts if its kind's
 * estimated cost (decaying max of recent steps) still fits, so one slow step is not stacked on top of others. A single
 * step slower than the budget cannot be split here: STATS.kinds names the kind so its owner can slice it finer. */
export function runJobs(budgetMs = INTEREST.budgetMs, now = () => performance.now()) {
  const t0 = now(); let ran = 0;
  while (jobs.size) {
    let job: Job | undefined; for (const j of jobs.values()) if (!job || j.priority < job.priority) job = j;
    const st = kindStats(job!.key), finishing = !!job!.result;
    if (ran && now() - t0 + (finishing ? st.estDone : st.estSlice) > budgetMs) { STATS.deferred++; break; } // would overrun: next frame
    const s = now();
    if (finishing) { jobs.delete(job!.key); job!.done?.(job!.result!.v); }
    else { const r = job!.it.next(); if (r.done) job!.result = { v: r.value }; }
    const ms = now() - s; ran++; STATS.jobsRun++; if (ms > budgetMs) st.over++;
    if (finishing) { st.dones++; st.maxDone = Math.max(st.maxDone, ms); st.estDone = Math.max(ms, st.estDone * .9); }
    else { st.slices++; st.maxSlice = Math.max(st.maxSlice, ms); st.estSlice = Math.max(ms, st.estSlice * .9); }
    if (now() - t0 >= budgetMs) break;
  }
  const ms = now() - t0; STATS.lastFrameMs = ms; STATS.maxFrameMs = Math.max(STATS.maxFrameMs, ms); return ms;
}
/** Run a generator to completion synchronously (tests, or when something is needed this frame). */
export function finish<T>(gen: Generator<unknown, T>): T { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; }
