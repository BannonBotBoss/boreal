/**
 * Startup sequence (Grok Bot): first chunks → renderer.compileAsync → sky/PMREM bake → resource probe → fade out.
 * The frame loop keeps running behind the loading screen, so every first-use stall (shader compile, uploads, PMREM)
 * is paid while it is covered. Probe (core/probe): detect-gpu tier, WebGL limits + renderer string, deviceMemory,
 * hardwareConcurrency, and a short benchmark of the real start scene (loaded chunks + CSM shadows) at Ultra measured as
 * max(CPU work, GPU timer) per frame, the governor's own metric. Cached per renderer string (?reprobe forces a new probe).
 *
 * T-0168: a return load in the same tab, on the same build, with that cache, does not wait for grass and flora to drain
 * and does not block on the next tier. The standing chunk, the live-tier compile, and the sky bake still run. A first
 * visit, a build change, a new tab, ?reprobe, or a missing probe keeps the full path.
 */
import { getGPUTier } from '../../vendor/detect-gpu/index.js';
import { GOVERNOR, LADDER, applied, resetGovernor } from '../core/quality';
import { STATS, queued } from '../core/interest';
import { CHUNK_SIZE } from '../core/world';
import { cachedProbe, median, saveProbe, type ProbeInput, type ProbeResult } from '../core/probe';
import type { buildScene } from './buildScene';
import { asset } from '../core/asset';
/** Reject after `ms` so a hung fetch can never hold the loading screen. */
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
type View = ReturnType<typeof buildScene>;
export const raf = () => new Promise<number>(r => requestAnimationFrame(r)), wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const wall = () => performance.now();
/** Wait until the interest job queue stays empty for `quietFrames` frames (or `maxMs`). Shared with ?bench. */
export async function settle(quietFrames = 60, maxMs = 40000, onFrame?: (elapsed: number) => void, pump: () => Promise<unknown> = raf, now = wall, busy: () => unknown = queued) {
  const t = now(); let quiet = 0;
  while (now() - t < maxMs && quiet < quietFrames) { await pump(); quiet = busy() ? 0 : quiet + 1; onFrame?.(now() - t); }
}
/**
 * Warm land wait (T-0168). The standing chunk is in the scene for `quietFrames` frames, or `maxMs` elapses.
 * Grass and flora may keep the interest queue full; they are not the ground under the player.
 */
export async function settleWhenLandReady(quietFrames: number, maxMs: number, landReady: () => boolean, onFrame?: (elapsed: number) => void, pump: () => Promise<unknown> = raf, now = wall) {
  const t = now(); let quiet = 0;
  while (now() - t < maxMs && quiet < quietFrames) {
    await pump();
    let ready = false; try { ready = landReady(); } catch { ready = false; }
    quiet = ready ? quiet + 1 : 0; onFrame?.(now() - t);
  }
}
/** Median frame cost over frames that ran no interest job (a chunk/tile step is streaming, not the steady cost the cap is
 * for: 2026-10-18 omen staged start benched mid-stream and capped an RTX 5060 at Low). Falls back to all frames. */
export async function benchFrames(view: View, frames = 40, warm = 10, pump: () => Promise<unknown> = raf, now = wall) {
  const xs: number[] = [], all: number[] = [];
  const t0 = now();
  for (let i = 0; i < (frames + warm) * 3 && xs.length < frames && now() - t0 < 15000; i++) { const j = STATS.jobsRun; await pump(); if (i < warm) continue;
    const ms = Math.max(view.photoreal.INFO.workMs, view.photoreal.gpuMs ?? 0); all.push(ms); if (STATS.jobsRun === j) xs.push(ms); }
  return median(xs.length >= frames / 2 ? xs : all);
}

/** Session stamp (T-0168). Survives a reload of this tab. A new tab has an empty session, so it is not a return reload. */
export const WARM_START = {
  key: 'boreal.startup.warm.v1',
  /** Frames the standing chunk must already be in the scene before the land step ends. Not a biological rate. */
  settleQuiet: 4,
  /** Same ceiling as the cold land wait, so a chunk that is still building is not revealed early. */
  settleMaxMs: 20000,
  /** Same sky cap as the cold path. The loop returns as soon as the environment map exists. */
  skyMaxMs: 3000,
};
export const COLD_START = { settleQuiet: 15, settleMaxMs: 20000, skyMaxMs: 3000, warmUpMs: 6000 };
export interface WarmStamp { build: string; renderer: string }
export type StartupRoute = 'cold' | 'warm';
export interface StartupBudget {
  route: StartupRoute;
  settleQuiet: number;
  settleMaxMs: number;
  /** Warm ends the land wait once the standing chunk is in the scene. Cold waits until the interest queue is quiet. */
  leaveWhenChunkBuilt: boolean;
  skyMaxMs: number;
  /** Cold compiles before the Ultra bench, then again if the probe moved the tier. Warm compiles once, after the cached tier is applied. */
  compileBeforeProbe: boolean;
  /** 0 queues the next cheaper tier and does not block the reveal. The cold path blocks up to warmUp's own default. */
  warmUpMs: number;
}
export function parseWarmStamp(raw: string | null | undefined): WarmStamp | undefined {
  try {
    const v = JSON.parse(raw ?? 'null') as WarmStamp | null;
    if (v && typeof v.build === 'string' && v.build.length > 0 && typeof v.renderer === 'string' && v.renderer.length > 0) return { build: v.build, renderer: v.renderer };
  } catch { /* damaged stamp: treat as a first visit */ }
  return undefined;
}
export function readWarmStamp(storage: Pick<Storage, 'getItem'> | undefined): WarmStamp | undefined {
  try { return parseWarmStamp(storage?.getItem(WARM_START.key)); } catch { return undefined; }
}
export function saveWarmStamp(storage: Pick<Storage, 'setItem'> | undefined, stamp: WarmStamp) {
  try { storage?.setItem(WARM_START.key, JSON.stringify(stamp)); } catch { /* storage blocked: the next load stays cold */ }
}
/** The module URL. A production bundle's content hash changes it; a dev server keeps it across reloads of the same session. */
export const startupBuildId = () => import.meta.url;
/** Chunk cell the land wait asks for. `?at=` wins; otherwise the store point the frame loop stands on. */
export function standPoint(search: string, here?: { x: number; z: number }): { x: number; z: number } | undefined {
  const at = new URLSearchParams(search.startsWith('?') || search === '' ? search : `?${search}`).get('at')?.split(',').map(Number);
  if (at && at.length >= 2 && at.every(n => Number.isFinite(n))) return { x: at[0]!, z: at[1]! };
  if (here && Number.isFinite(here.x) && Number.isFinite(here.z)) return here;
  return undefined;
}
export const standChunkIndex = (x: number, z: number, chunk = CHUNK_SIZE) => ({ a: Math.floor(x / chunk), b: Math.floor(z / chunk) });
/**
 * Cold: first visit, another build, another tab, ?reprobe, ?bench / ?noprobe, or no cached probe.
 * Warm: this tab already finished startup for this build, and the probe cache still matches the renderer.
 */
export function startupRoute(o: { reprobe?: boolean; skipProbe?: boolean; cached: boolean; buildId: string; renderer: string; stamp?: WarmStamp }): StartupRoute {
  if (o.reprobe || o.skipProbe || !o.cached) return 'cold';
  if (!o.buildId || !o.renderer || !o.stamp) return 'cold';
  if (o.stamp.build !== o.buildId || o.stamp.renderer !== o.renderer) return 'cold';
  return 'warm';
}
export function startupBudget(route: StartupRoute): StartupBudget {
  if (route === 'warm') return {
    route, settleQuiet: WARM_START.settleQuiet, settleMaxMs: WARM_START.settleMaxMs, leaveWhenChunkBuilt: true,
    skyMaxMs: WARM_START.skyMaxMs, compileBeforeProbe: false, warmUpMs: 0,
  };
  return {
    route: 'cold', settleQuiet: COLD_START.settleQuiet, settleMaxMs: COLD_START.settleMaxMs, leaveWhenChunkBuilt: false,
    skyMaxMs: COLD_START.skyMaxMs, compileBeforeProbe: true, warmUpMs: COLD_START.warmUpMs,
  };
}
function browserStore(name: 'localStorage' | 'sessionStorage'): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    const s = (globalThis as Record<string, unknown>)[name];
    if (!s || typeof s !== 'object') return undefined;
    const store = s as Pick<Storage, 'getItem' | 'setItem'>;
    if (typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return undefined;
    return store;
  } catch { return undefined; }
}
function pageSearch() {
  try { return typeof location === 'undefined' ? '' : location.search; } catch { return ''; }
}
function standingChunkReady(view: View) {
  const built = view.chunkBuilt;
  if (typeof built !== 'function') return false;
  const here = view.livingHere?.();
  const at = standPoint(pageSearch(), here);
  if (!at) return false;
  const cell = standChunkIndex(at.x, at.z);
  return built(cell.a, cell.b);
}
/** The Ultra bench that used to sit inline in startup. Tests replace it; the browser runs this. */
async function measureHardware(view: View, pump: () => Promise<unknown>, now: () => number): Promise<ProbeInput> {
  const r = view.photoreal.renderer, gl = r.getContext(), nav = navigator as Navigator & { deviceMemory?: number };
  let gpuTier: number | undefined;
  try { gpuTier = (await within(getGPUTier({ glContext: gl, benchmarksURL: asset('detect-gpu') }), 6000)).tier; } catch { /* offline or blocked: bench decides */ }
  const tier = GOVERNOR.tier; GOVERNOR.tier = 0; await settle(30, 10000, undefined, pump, now); // let any Ultra-only chunk work finish
  const benchMs = await benchFrames(view, 40, 10, pump, now); GOVERNOR.tier = tier;
  return { renderer: GOVERNOR.gpu, gpuTier, maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), deviceMemory: nav.deviceMemory, cores: nav.hardwareConcurrency, benchMs };
}
export interface StartupOptions {
  reprobe?: boolean;
  skipProbe?: boolean;
  /** Defaults to the module URL. Tests pin it. */
  buildId?: string;
  /** Defaults to sessionStorage. A missing store keeps every load cold. */
  warmStorage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** Defaults to localStorage, the probe cache (boreal.probe.v1). */
  probeStorage?: Pick<Storage, 'getItem' | 'setItem'>;
  pump?: () => Promise<unknown>;
  now?: () => number;
  /** Overrides the standing-chunk check. A throw is "not ready", not a failed boot. */
  landReady?: () => boolean;
  /** Overrides the interest-queue check inside the cold land wait. Any truthy value counts as busy. */
  busy?: () => unknown;
  /** Test seam for the Ultra bench. The default is measureHardware. */
  measureProbe?: () => Promise<ProbeInput>;
}
export async function startup(view: View, ui: { step(label: string, f: number): void }, opts: StartupOptions = {}): Promise<ProbeResult | undefined> {
  const pump = opts.pump ?? raf, now = opts.now ?? wall;
  const buildId = opts.buildId ?? startupBuildId();
  const warmStorage = opts.warmStorage ?? browserStore('sessionStorage');
  const probeStorage = opts.probeStorage ?? browserStore('localStorage');
  const cached = opts.skipProbe || opts.reprobe ? undefined : cachedProbe(probeStorage, GOVERNOR.gpu);
  const route = startupRoute({ reprobe: opts.reprobe, skipProbe: opts.skipProbe, cached: !!cached, buildId, renderer: GOVERNOR.gpu, stamp: readWarmStamp(warmStorage) });
  const budget = startupBudget(route);
  const auto = GOVERNOR.auto; GOVERNOR.auto = false; // loading stalls must not walk the governor down the ladder
  if (route === 'warm' && cached) { GOVERNOR.probeCap = cached.cap; GOVERNOR.tier = Math.max(GOVERNOR.tier, cached.cap); }
  const land = () => { try { return (opts.landReady ?? (() => standingChunkReady(view)))(); } catch { return false; } };
  ui.step('Generating the land around you…', .1);
  const onLand = (ms: number) => ui.step('Generating the land around you…', .1 + .3 * Math.min(1, ms / 8000));
  if (budget.leaveWhenChunkBuilt) await settleWhenLandReady(budget.settleQuiet, budget.settleMaxMs, land, onLand, pump, now);
  else {
    await settle(budget.settleQuiet, budget.settleMaxMs, onLand, pump, now, opts.busy ?? queued);
    // Grass and flora keep the interest queue full, so the ceiling above can fire while the
    // standing chunk is still queued. Revealing then is a pale void (no ground, no trees).
    // Wait for that chunk on its own, still behind the splash. Same ceiling, not a new one.
    if (!land()) await settleWhenLandReady(budget.settleQuiet, budget.settleMaxMs, land, onLand, pump, now);
  }
  if (budget.compileBeforeProbe) { ui.step('Compiling shaders…', .45); await view.photoreal.compile(); }
  const compiled = JSON.stringify(applied());
  ui.step('Lighting the sky…', .6); const t0 = now();
  while (now() - t0 < budget.skyMaxMs && view.photoreal.tier.ibl && !view.scene.environment) await pump();
  let probe: ProbeResult | undefined = cached;
  if (!opts.skipProbe) {
    if (!probe) {
      ui.step('Measuring your graphics hardware…', .7);
      probe = saveProbe(probeStorage, await (opts.measureProbe ?? (() => measureHardware(view, pump, now)))());
    }
    const input = probe; GOVERNOR.onProbeRaise = cap => { saveProbe(probeStorage, input, Date.now(), cap); console.log(`PROBE raised cap=${LADDER[cap].name}`); };
    if (probe.igpu) console.warn(`PROBE integrated GPU in use: ${probe.renderer}`);
    GOVERNOR.probeCap = probe.cap; GOVERNOR.tier = Math.max(GOVERNOR.tier, probe.cap);
    console.log(`PROBE cap=${LADDER[probe.cap].name} ${JSON.stringify(probe)}`);
  }
  if (!budget.compileBeforeProbe) { ui.step('Compiling shaders…', .45); await view.photoreal.compile(); }
  else if (JSON.stringify(applied()) !== compiled) { ui.step('Compiling shaders…', .9); await pump(); await view.photoreal.compile(); } // the probe moved the tier: its variants too, still covered
  await view.photoreal.warmUp(applied(GOVERNOR.tier + 1), budget.warmUpMs); // cold blocks; warm queues the next cheaper tier and returns
  ui.step('Ready', 1); await pump(); await pump(); // one more frame at the final tier before the reveal
  GOVERNOR.auto = auto; resetGovernor(); GOVERNOR.cool = GOVERNOR.cooldownMs; // grace: streaming right after the reveal is not the steady cost
  if (probe && buildId) saveWarmStamp(warmStorage, { build: buildId, renderer: probe.renderer });
  console.log(`STARTUP ${route}`);
  return probe;
}
