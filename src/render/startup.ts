/**
 * Startup sequence (Grok Bot): first chunks → renderer.compileAsync → sky/PMREM bake → resource probe → fade out.
 * The frame loop keeps running behind the loading screen, so every first-use stall (shader compile, uploads, PMREM)
 * is paid while it is covered. Probe (core/probe): detect-gpu tier, WebGL limits + renderer string, deviceMemory,
 * hardwareConcurrency, and a short benchmark of the real start scene (loaded chunks + CSM shadows) at Ultra measured as
 * max(CPU work, GPU timer) per frame, the governor's own metric. Cached per renderer string (?reprobe forces a new probe).
 */
import { getGPUTier } from '../../vendor/detect-gpu/index.js';
import { GOVERNOR, LADDER, resetGovernor } from '../core/quality';
import { queued } from '../core/interest';
import { cachedProbe, median, saveProbe, type ProbeResult } from '../core/probe';
import type { buildScene } from './buildScene';
type View = ReturnType<typeof buildScene>;
export const raf = () => new Promise<number>(r => requestAnimationFrame(r)), wait = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Wait until the interest job queue stays empty for `quietFrames` frames (or `maxMs`). Shared with ?bench. */
export async function settle(quietFrames = 60, maxMs = 40000, onFrame?: (elapsed: number) => void) {
  const t = performance.now(); let quiet = 0;
  while (performance.now() - t < maxMs && quiet < quietFrames) { await raf(); quiet = queued() ? 0 : quiet + 1; onFrame?.(performance.now() - t); }
}
export async function benchFrames(view: View, frames = 40, warm = 10) {
  const xs: number[] = [];
  for (let i = 0; i < frames + warm; i++) { await raf(); if (i >= warm) xs.push(Math.max(view.photoreal.INFO.workMs, view.photoreal.gpuMs ?? 0)); }
  return median(xs);
}
export async function startup(view: View, ui: { step(label: string, f: number): void }, opts: { reprobe?: boolean; skipProbe?: boolean } = {}): Promise<ProbeResult | undefined> {
  const auto = GOVERNOR.auto; GOVERNOR.auto = false; // loading stalls must not walk the governor down the ladder
  ui.step('Generating the land around you…', .1); await settle(15, 20000, ms => ui.step('Generating the land around you…', .1 + .3 * Math.min(1, ms / 8000)));
  ui.step('Compiling shaders…', .45); const r = view.photoreal.renderer;
  try { await r.compileAsync(view.scene, view.camera); } catch (e) { console.warn('compileAsync', e); }
  ui.step('Lighting the sky…', .6); const t0 = performance.now();
  while (performance.now() - t0 < 3000 && view.photoreal.tier.ibl && !view.scene.environment) await raf();
  let probe: ProbeResult | undefined;
  if (!opts.skipProbe) {
    probe = opts.reprobe ? undefined : cachedProbe(localStorage, GOVERNOR.gpu);
    if (!probe) {
      ui.step('Measuring your graphics hardware…', .7);
      const gl = r.getContext(), nav = navigator as Navigator & { deviceMemory?: number };
      let gpuTier: number | undefined;
      try { gpuTier = (await getGPUTier({ glContext: gl, benchmarksURL: '/detect-gpu' })).tier; } catch { /* offline or blocked: bench decides */ }
      const tier = GOVERNOR.tier; GOVERNOR.tier = 0; await settle(10, 5000); // let any Ultra-only chunk work finish
      const benchMs = await benchFrames(view); GOVERNOR.tier = tier;
      probe = saveProbe(localStorage, { renderer: GOVERNOR.gpu, gpuTier, maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), deviceMemory: nav.deviceMemory, cores: nav.hardwareConcurrency, benchMs });
    }
    const input = probe; GOVERNOR.onProbeRaise = cap => { saveProbe(localStorage, input, Date.now(), cap); console.log(`PROBE raised cap=${LADDER[cap].name}`); };
    if (probe.igpu) console.warn(`PROBE integrated GPU in use: ${probe.renderer}`);
    GOVERNOR.probeCap = probe.cap; GOVERNOR.tier = Math.max(GOVERNOR.tier, probe.cap);
    console.log(`PROBE cap=${LADDER[probe.cap].name} ${JSON.stringify(probe)}`);
  }
  ui.step('Ready', 1); await raf(); await raf(); // one more frame at the final tier before the reveal
  GOVERNOR.auto = auto; resetGovernor();
  return probe;
}
