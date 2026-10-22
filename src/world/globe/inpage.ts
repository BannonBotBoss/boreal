/**
 * In-page globe <-> game transition (Grok Bot), the runtime behind ?transition=inpage. The reload path (handoff.ts) stays the
 * default and the fallback (transition.ts transitionPath). Pure maths and rules live in transition.ts; this file is the one
 * stateful controller that main.ts (11 single calls) and render/buildScene.ts (4 single calls) talk to.
 *  - ONE renderer: the globe (globeView createGlobe, shared mode) borrows the game's renderer. Globe mode draws the globe to
 *    the screen; in the band the globe renders into the far layer (farLayer.ts) that the game scene shows as its background,
 *    with its own depth (per-material log depth), then the game pass draws the patch on top with its own cleared depth.
 *  - The patch dithers in under the globe (render/fade.ts, uniform only) once the chunks under the camera are ready, between
 *    TRANSITION.bandTop (2 km) and fadeFull (600 m); undithered scene parts (sky dome, animals, grass, flora, props, rocks)
 *    stay hidden until the patch is fully in. Sky + clouds stay hidden for the whole band (the far layer is the sky).
 *  - Down: the landing spot is ahead along the heading; the camera flies a 45-degree glide path toward it (log-height rate),
 *    turning from the globe pose to look at it, holds at the handover height until the chunks are ready, then blends onto
 *    the rig in TRANSITION.blendSec. Up: the same glide path backwards, turning to the globe's own pose near the top.
 *  - The governor is held from the ascent to the end of the descent (world knobs frozen); input is mode-scoped; the world
 *    clock keeps running, the sim (player, animals) is frozen outside game mode. Tile workers (2) run only while ascending,
 *    on the globe and descending; they are terminated during gameplay.
 */
import * as THREE from 'three';
import type { Globe } from './globeView'; // loaded on demand (only with the in-page path on), so the reload path's game bundle is unchanged
import { createFarLayer } from './farLayer';
import { TRANSITION, transitionPath, planetToGame, gameBasis, globeCameraFrom, patchFade, inputOwner, createGovernorHold, type TransitionMode } from './transition';
import { GLOBE_ENTRY_ALT, HANDOFF, landSpawn } from './handoff';
import { PLANET, GLOBE_COLOURS } from './planet';
import { setPatchFade, setPatchFar } from '../../render/fade';
import { AO_BLEND } from '../../render/post';
import { LOG_DEPTH } from './logDepth';
import { GOVERNOR, resetGovernor } from '../../core/quality';
import { INTEREST, JOB_FIRST, pending, queued, STATS as JOBS } from '../../core/interest';
import { CHUNK_SIZE, heightAt } from '../../core/world';
import { STAGES, lakeAt } from '../../core/stages/elevation';
import { LEVEL } from '../../core/tuning';
import { EXPOSURE } from '../../core/light';
import { clamp01, smoothstep } from '../../proc/math';

/** [game calibration] gain: globe radiance scale in the game's exposure (1 = the standalone globe's look); kDown/kUp: log-height
 *  rates (1/s) of the descent (2 km -> 60 m in ~5 s) and the ascent; nearK: band camera near plane = height x nearK;
 *  waitK: descent rate factor until the patch chunks are ready; fadeSec: the patch fades in over at least this long once ready;
 *  bandGain, lakeShallow/lakeDeep: the globe's radiance scale and lake colours eased to by fadeFull (from 1 / the globe's own
 *  lakes at the band top), matched to the game patch seen from 600 m at Ultra; ring: the patch = the chunks within ring of
 *  the player's chunk (readiness and the fade disc, ring x CHUNK_SIZE); jobFrame/jobMin: chunk job budget per frame
 *  while the descent waits for them = max(jobMin, jobFrame - last frame's globe + draw ms) (the sim is frozen in the band,
 *  so the frame's spare time goes to the patch); prepAlt: descending over home below this
 *  (globe mode), the landing spot is chosen and its chunks start building (terrain in the chunk worker pool, 506d0aa). */
export const INPAGE = { gain: 1, kDown: .7, kUp: 1.7, nearK: .01, prebuildMs: 5000, waitK: .03, fadeSec: .8, bandGain: 2.6, lakeShallow: [.024, .076, .093] as [number, number, number], lakeDeep: [.016, .057, .075] as [number, number, number], ring: 2, maskWaitSec: 8, readyMaxSec: 15, capH: 300, lakeRough: .32, duskLake: [1.29, 1.76, 2.24] as [number, number, number], duskSin: [.08, .4] as [number, number], uploadMB: 24, landTint: [.22, .34, .24] as [number, number, number], landTintDusk: [.55, .76, .55] as [number, number, number], tintLow: 150, fogTop: 300, fogOut: 50, jobFrame: 16, jobMin: 2, prepAlt: 3000, haze: 1, hazeLow: 60, hazeTop: 800, occ: [15, .03] as [number, number], pop: [.55, .95] as [number, number], aoTop: 250, bandContact: 1 };
/** landTint (day) / landTintDusk, blended by the dusk factor (r25 bedrock (-818,-490) and forest at 145 m: day globe land read ~2x the patch, dusk ~1.1x): the globe's land (not water) is tinted toward this from fadeFull down to tintLow (globe GLOBE_LAND, a uniform):
 *  bandGain matches the patch seen from 600 m, but lower down the dark forest floor between the crowns shows and the patch reads
 *  ~2x darker and greener than the globe around it (r20, 13:00, patch mean rgb 63/89/53 vs globe 103/121/87 at 145 m). */
/** aoTop: (unused since r23: GTAO, render/post AO_BLEND, now eases in only over the final blend to the player) was: from 0 at aoTop to full at the handover height, once the
 *  patch is fully in; above it GTAO stays off in the band (over the far layer, cleared depth, it drew a dark square and specks
 *  around the patch at 600 m). Contact shadows stay. uploadMB: first-draw upload budget per band frame (hideForBand). */
/** pop: what cannot dither (animals, the wolf: their materials are not opted in) appears object by object at a fade between
 *  pop[0] and pop[1] (a fixed per-object threshold), so they come in over the last part of the dither, not all at 1. */
/** haze: the patch blends toward the globe pixel behind it (the far layer, per pixel) by haze x smoothstep(hazeLow, hazeTop,
 *  height), so the game patch (tree greens, a dark forest floor, the water) meets the globe at the globe's own colour high up
 *  and keeps its own look by the handover; occ: [metres, fraction of the distance] a globe surface must be in front of a
 *  patch fragment to hide it (globe tiles are coarser than the game terrain). [game calibration] */
type View = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; photoreal: { renderer: THREE.WebGLRenderer } };
export interface InPageHost { player(): { x: number; z: number; yaw: number }; place(x: number, z: number, yaw: number): void; save(): void; notice?(m: string): void }
type FxTier = { ssao: number; contact: number; rays: number };
let lakeU: typeof import('./globeView').GLOBE_LAKE | null = null, landU: typeof import('./globeView').GLOBE_LAND | null = null, shoreU: typeof import('./globeView').GLOBE_SHORE | null = null;
let ctl: ReturnType<typeof controller> | null = null, globeModule: Promise<typeof import('./globeView')> | null = null, createGlobe: typeof import('./globeView').createGlobe | null = null;

/** main.ts: the controller when the in-page path is on (?transition=inpage, or the default once flipped), else null (reload). */
export function createInPage(view: View, host: InPageHost) {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (transitionPath(location.search, { deviceMemory: nav.deviceMemory, probeCap: GOVERNOR.probeCap }) !== 'inpage') return null;
  globeModule ??= import('./globeView');
  ctl = controller(view, host); (window as unknown as { __inpage?: unknown }).__inpage = ctl; // dev: the check script reads it
  return ctl;
}
const LOW_TIER = 3; // core/quality LADDER: Ultra, High, Medium, Low, ...
const ground = (x: number, z: number) => Math.max(heightAt(x, z), -.2);
/** The patch dither's plane (render/fade.ts uPatchY): the water surface of the lake the patch disc reaches into (16 samples
 *  on its rim), so the game water and the lake bed under one pixel get the same dither (no ring of bed dots), else the
 *  ground under the player. Cached per 8 m of player position. */
let planeKey = '', planeY = 0;
function patchPlaneY(x: number, z: number, r: number) {
  const k = `${Math.round(x / 8)},${Math.round(z / 8)},${r}`; if (k === planeKey) return planeY; planeKey = k;
  let y = -Infinity;
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, sx = x + Math.cos(a) * r * .9, sz = z + Math.sin(a) * r * .9, lk = STAGES.on ? lakeAt(STAGES.seed, sx, sz) : undefined;
    if (lk) y = Math.max(y, lk.surface); else if (heightAt(sx, sz) < LEVEL.waterSurface) y = Math.max(y, LEVEL.waterSurface); }
  return planeY = Number.isFinite(y) ? y : ground(x, z);
}

function controller(view: View, host: InPageHost) {
  const renderer = view.photoreal.renderer, far = createFarLayer(), hold = createGovernorHold(GOVERNOR, resetGovernor);
  let globe: Globe | null = null, mode: TransitionMode = 'game', down = true, phase: 'fly' | 'blend' = 'fly';
  let next: 'globe' | 'game' | null = null; // mode switches decided in the band take effect at the start of the next frame
  let prep: { x: number; z: number } | null = null; // landing chosen (and chunks building) while still in globe mode
  let renderMs = 0; // last frame's globe + game draw CPU (ms): the descent's chunk job budget fills the rest of jobFrame
  let bandT = 0; /* s since the descent started (the ready safety cap) */ const chunkFirst = (k: string) => k.startsWith('chunk:');
  let maskWait = 0, maskWarned = false, readyAt = 0, dusk = 0; // s waited on the mask with the chunks ready (capped at INPAGE.maskWaitSec); h at first ready (STATS.readyAt)
  let h = 0, h0 = 1, blend = 0, fade = 0, fadeT = 0, ready = false, readySeen = false, needStart = false, placedFrame = 0, frameNo = 0, lastT = 0, cameraTouched = false;
  const start = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, end = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const cam = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, gcam = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), size = new THREE.Vector2(), UP = new THREE.Vector3(0, 1, 0);
  const land = new THREE.Vector3(), off = new THREE.Vector3(), fwd = new THREE.Vector2(); // landing point, start offset from the glide path, heading
  /** camera on the 45-degree glide path h metres above the landing ground (behind it along the heading), looking at it */
  const glide = (hh: number, k: number) => { cam.p.set(land.x - fwd.x * hh + off.x * k, land.y + hh + off.y * k, land.z - fwd.y * hh + off.z * k); tmpM.lookAt(cam.p, land, UP); tmpQ.setFromRotationMatrix(tmpM); };
  const hidden = new Map<THREE.Object3D, boolean>(); let savedBg: THREE.Scene['background'] | undefined;
  const NO_GLOBE = new THREE.Color(1, 0, 1);
const DEV = new URLSearchParams(location.search).has('inpagedev'); // dev hooks (DEBUG, frame-cost log fields) only with ?inpagedev
  const DEBUG = { noShore: false, noGlobe: false, noAO: false, holdH: 0, far: 0, pose: null as null | { p: [number, number, number]; look: [number, number, number] } };
  const STATS = { globeMs: 0, drawMs: 0, mode: 'game' as TransitionMode, h: 0, fade: 0, ready: false, readyAt: 0, log: [] as { t: number; mode: string; h: number; fade: number; globeMs: number; drawMs?: number; jobsMs?: number; cpuMs?: number }[] };

  async function loadGlobe() { const mod = await globeModule!; createGlobe ??= mod.createGlobe; lakeU ??= mod.GLOBE_LAKE; landU ??= mod.GLOBE_LAND; shoreU ??= mod.GLOBE_SHORE; return ensureGlobe(); }
  function ensureGlobe() {
    if (globe) return globe;
    const q = new URLSearchParams(location.search), p = host.player(), r = (v: number, k: number) => Math.round(v * k) / k;
    for (const k of ['view', 'bench', 'shot', 'handoff', 'look', 'pitch', 'dir', 'tier', 'workers', 'seams']) q.delete(k);
    q.set('at', `${r(p.x, 10)},${r(p.z, 10)},${r(p.yaw, 1000)}`); q.set('alt', String(GLOBE_ENTRY_ALT));
    globe = createGlobe!(renderer, { shared: true, params: q, target: far.target, workers: 2, onLeave: at => { if (mode === 'globe' && at) descend(at); } });
    return globe;
  }
  /** Patch readiness: the 3x3 chunks around the player are built (none pending) a couple of frames after the move. */
  function chunksReady() {
    if (frameNo - placedFrame < 3) return false;
    const p = host.player(), cx = Math.floor(p.x / CHUNK_SIZE), cz = Math.floor(p.z / CHUNK_SIZE);
    const k = INPAGE.ring; for (let a = cx - k; a <= cx + k; a++) for (let b = cz - k; b <= cz + k; b++) if (pending(`chunk:${a}:${b}`)) return false;
    return true;
  }
  function setMode(m: TransitionMode) { mode = m; STATS.mode = m; globe?.attachInput(inputOwner(m, down) === 'globe' && m === 'globe'); }
  /** Globe -> band: the player is placed at the landing spot (dry land) under the camera, keeping the heading. */
  /** Globe -> band. The landing spot is ahead along the heading, one camera height away (the 45-degree glide path the descent
   *  flies, so the patch is in view the whole way down), kept inside the playable region and snapped to dry land. */
  function descend(at: { x: number; z: number; yaw: number }) {
    const g = globe!, v = g.camera.position, pg = planetToGame(g.planet, [v.x, v.y, v.z]);
    start.p.set(pg.x, pg.y, pg.z); start.q.setFromRotationMatrix(gameBasis(g.planet, pg.x, pg.z, tmpM)).invert().multiply(g.camera.quaternion);
    h0 = Math.max(TRANSITION.handover + 1, pg.y - ground(pg.x, pg.z)); fwd.set(-Math.sin(at.yaw), -Math.cos(at.yaw));
    let s = landingFor(pg.x, pg.z, fwd, h0);
    if (prep && Math.hypot(s.x - prep.x, s.z - prep.z) < 2 * CHUNK_SIZE) s = prep; // the spot prepared on the way down (chunks already building)
    else { host.place(s.x, s.z, at.yaw); placedFrame = frameNo; } prep = null;
    land.set(s.x, ground(s.x, s.z), s.z); h0 = Math.max(TRANSITION.handover + 1, pg.y - land.y); h = h0;
    off.set(start.p.x - (land.x - fwd.x * h0), start.p.y - (land.y + h0), start.p.z - (land.z - fwd.y * h0)); // decays to 0 with height
    phase = 'fly'; blend = 0; fadeT = 0; readySeen = false; maskWait = 0; bandT = 0; readyAt = 0; down = true; lastT = performance.now(); setMode('band');
  }
  /** The landing ahead along the heading, one camera height away, inside the playable region, on dry land. */
  function landingFor(x: number, z: number, f: THREE.Vector2, hh: number) {
    const lim = PLANET.home.halfSize - PLANET.home.feather - HANDOFF.margin, clampL = (u: number) => Math.max(-lim, Math.min(lim, u));
    return landSpawn({ x: clampL(x + f.x * hh), z: clampL(z + f.y * hh) });
  }
  /** Globe mode, descending over home below prepAlt: choose the landing the descent will use (from the band top) and place
   *  the player there now, so the patch chunks build during the last of the globe zoom. */
  function prepare(yaw: number) {
    const g = globe!, v = g.camera.position, pg = planetToGame(g.planet, [v.x, v.y, v.z]), f = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
    const s = landingFor(pg.x, pg.z, f, Math.min(TRANSITION.bandTop, Math.max(TRANSITION.handover + 1, pg.y - ground(pg.x, pg.z))));
    host.place(s.x, s.z, yaw); placedFrame = frameNo; prep = { x: s.x, z: s.z };
  }
  function toGlobe() { restoreScene(); globe!.drive(null); setMode('globe'); }
  function toGame() { restoreScene(); globe?.drive(null); setMode('game'); globe?.suspendWorkers(); hold.release(); }
  function restoreScene() {
    for (const [o, v] of hidden) o.visible = v; hidden.clear(); for (const c of unculled) c.frustumCulled = true; unculled.length = 0;
    if (savedBg !== undefined) { view.scene.background = savedBg; savedBg = undefined; } view.scene.backgroundIntensity = 1; setPatchFade(1); setPatchFar(null); bandLook(0); AO_BLEND.value = 1;
  }
  const isChunkRoot = (o: THREE.Object3D) => o.type === 'Group' && (o.children[0]?.userData.inspect as { type?: string } | undefined)?.type === 'terrain';
  const hasLight = (o: THREE.Object3D) => (o as THREE.Light).isLight || !!o.getObjectByProperty('isLight', true);
  const faded = (o: THREE.Object3D) => !!((o as THREE.Mesh).material as THREE.Material | undefined)?.userData?.patchFade;
  const dithers = new WeakMap<THREE.Object3D, boolean>(); // grass, flora, far trees: every mesh under it dithers with the patch (render/fade)
  const allFaded = (o: THREE.Object3D) => { let v = dithers.get(o); if (v === undefined) { let n = 0, ok = true; o.traverse(c => { if ((c as THREE.Mesh).isMesh) { n++; ok &&= faded(c); } }); v = ok && n > 0; dithers.set(o, v); } return v; };
  /** Upload budget (bytes per frame) for new chunk meshes in the band. A chunk's tree/prop batch is ~5-20 MB of vertex data
   *  that three uploads (bufferData) the first time it is not frustum-culled; from the band's height every batch instance is
   *  past its LOD range, so the empty batches are culled until the camera is low enough and then ALL of them uploaded in one
   *  frame as the fade starts (238 MB / 85 ms of bufferData measured, r19). So each new chunk mesh is admitted once, within the
   *  budget, with frustum culling off for that one frame (three uploads it while drawing nothing: the patch is still at
   *  fade 0 most of the time); the ones that do not fit yet stay hidden. */
  const uploaded = new WeakSet<THREE.Object3D>(), sizes = new WeakMap<THREE.Object3D, number>(), unculled: THREE.Object3D[] = [];
  const admit = (m: THREE.Object3D) => { uploaded.add(m); m.traverse(c => { if ((c as THREE.Mesh).isMesh && c.frustumCulled) { c.frustumCulled = false; unculled.push(c); } }); };
  const bytesOf = (o: THREE.Object3D) => { let b = sizes.get(o); if (b === undefined) { b = 0; o.traverse(c => { const g = (c as THREE.Mesh).geometry; if (!g) return; for (const k in g.attributes) b! += (g.attributes[k] as THREE.BufferAttribute).array.byteLength; if (g.index) b! += g.index.array.byteLength; }); sizes.set(o, b); } return b; };
  const popAt = (o: THREE.Object3D) => { const u = (o.id * .6180339887) % 1; return INPAGE.pop[0] + (INPAGE.pop[1] - INPAGE.pop[0]) * u; };
  /** Hide what cannot dither while the patch is partly in (and the sky dome for the whole band); restore the rest. */
  function hideForBand(scene: THREE.Scene) {
    const now = new Set<THREE.Object3D>(), partial = fade < 1; let budget = INPAGE.uploadMB * 1e6;
    for (const c of unculled) c.frustumCulled = true; unculled.length = 0; // admitted last frame: uploaded by now
    for (const o of scene.children) {
      if (isChunkRoot(o)) { for (const m of o.children) { if (partial && !faded(m)) { now.add(m); continue; } if (uploaded.has(m) || !m.visible && !hidden.has(m)) continue; const b = bytesOf(m); if (b <= budget || budget === INPAGE.uploadMB * 1e6) { budget -= b; admit(m); } else now.add(m); } continue; }
      if (hasLight(o) || (!(o as THREE.Mesh).isMesh && (o as THREE.Points).type !== 'Points' && !o.children.length)) continue;
      if (o.renderOrder < 0 || o.type === 'Points' || (partial && !allFaded(o) && fade < popAt(o))) now.add(o); // sky (-2), cloud dome (-1), precipitation; everything else that cannot dither while partial
    }
    for (const [o, v] of hidden) if (!now.has(o)) { o.visible = v; hidden.delete(o); }
    for (const o of now) { if (!hidden.has(o)) hidden.set(o, o.visible); o.visible = false; }
  }

  const api = {
    /** dev (the check script): chunk job scheduler state */
    /** dev (the check script): hold the descent at a height / pin the band camera (occlusion checks); ground height */
    DEBUG, groundAt: ground, get land() { return [land.x, land.y, land.z]; },
    jobs: () => ({ q: queued(), run: JOBS.jobsRun, deferred: JOBS.deferred, lastMs: +JOBS.lastFrameMs.toFixed(1), kinds: JSON.parse(JSON.stringify(JOBS.kinds)) as unknown }),
    get mode() { return mode; }, get globe() { return globe; }, get fade() { return fade; }, get height() { return h; }, STATS, INPAGE, far,
    /** Shift+G / pause menu: game -> band (up). Returns true when the in-page path took it. */
    ascend(): boolean {
      if (mode !== 'game') return true;
      if (GOVERNOR.capTier >= LOW_TIER || GOVERNOR.probeCap >= LOW_TIER) return false; // Low or below now: main takes the reload path
      if (!globe) { void loadGlobe().then(() => api.ascend()); return true; } // first use before the prewarm finished
      for (const o of view.scene.children) if (isChunkRoot(o)) for (const m of o.children) uploaded.add(m); // drawn in the game already
      const g = globe; prep = null; host.save(); hold.hold(); g.resumeWorkers(); down = false; needStart = true; lastT = performance.now(); setMode('band');
      return true;
    },
    /** Page load (world/globe/startView): straight into globe mode over the player at the standalone globe's opening
     *  altitude (globeView startAlt, 2.2 R: the whole disc), no rise; the ascent's hold and workers. False = take the reload path. */
    enter(): boolean {
      if (mode !== 'game') return true;
      if (GOVERNOR.capTier >= LOW_TIER || GOVERNOR.probeCap >= LOW_TIER) return false;
      if (!globe) { void loadGlobe().then(() => api.enter()); return true; }
      prep = null; hold.hold(); globe.resumeWorkers(); globe.jumpTo(PLANET.radius * 2.2); toGlobe(); return true;
    },
    blocksGame: () => mode !== 'game',
    /** main's runJobs budget: undefined = the default; larger while the descent waits for the patch chunks */
    jobBudgetMs: () => { const w = (mode === 'band' && down && !readySeen) || (mode === 'globe' && !!prep && !chunksReady()); JOB_FIRST.test = w ? chunkFirst : null; return w ? Math.max(INPAGE.jobMin, INPAGE.jobFrame - renderMs) : undefined; }, /* + the patch chunks run before grass/flora (core/interest JOB_FIRST) */
    ownsInput: () => mode !== 'game',
    /** main's draw slot: globe mode draws the globe to the screen; band and game draw the game (buildScene calls the hooks). */
    frame(drawGame: () => void) {
      frameNo++;
      if (next) { if (next === 'globe') toGlobe(); else toGame(); next = null; }
      if (mode === 'globe' && globe) {
        const o = globe.overHome;
        if (o && globe.descending && globe.altitude < INPAGE.prepAlt && !prep) prepare(globe.headingYaw);
        else if (prep && globe.altitude > INPAGE.prepAlt * 1.5) prep = null; // climbed away: choose again next time
        if (o && globe.descending && globe.altitude < TRANSITION.bandTop) descend({ ...o, yaw: globe.headingYaw });
        else {
          const t0 = performance.now(), w = renderer.domElement.width, hh = renderer.domElement.height;
          if (Math.abs(globe.camera.aspect - w / hh) > 1e-6) { globe.camera.aspect = w / hh; globe.camera.updateProjectionMatrix(); }
          renderer.toneMappingExposure = INPAGE.gain; globe.step(null); STATS.globeMs = performance.now() - t0; record(); return;
        }
      }
      const td = performance.now(); drawGame(); STATS.drawMs = performance.now() - td; record();
    },
    /** buildScene, after the rig camera is placed: in the band the transition flies the camera (game frame). */
    camera(camera: THREE.PerspectiveCamera) {
      if (mode !== 'band') { if (cameraTouched) { camera.near = .2; camera.far = 700; cameraTouched = false; } return; }
      cameraTouched = true;
      const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
      end.p.copy(camera.position); end.q.copy(camera.quaternion); const cr = chunksReady(), mr = globe?.maskReady ?? true; if (!cr || mr) maskWait = 0; else if ((maskWait += dt) > INPAGE.maskWaitSec && !maskWarned) { maskWarned = true; console.warn(`INPAGE shoreline mask not ready after ${INPAGE.maskWaitSec} s: landing with the per-vertex shoreline`); }
      ready = cr && (mr || maskWait > INPAGE.maskWaitSec); if (ready && !readySeen) readyAt = Math.round(h); readySeen ||= ready;
      if (down) bandT += dt; const late = down && !readySeen && bandT > INPAGE.readyMaxSec; /* safety cap: descend at the normal rate, and hand over at capH even if the patch is still building */
      if (late && h <= INPAGE.capH) { readySeen = true; readyAt = -Math.round(h); console.warn(`INPAGE patch not ready after ${Math.round(bandT)} s: handing over at ${Math.round(h)} m, the game streams the rest`); } // + the globe's shoreline mask (lakeMask.ts)
      if (needStart) { // ascent: from the rig pose onto the glide path behind the player, then up it
        needStart = false; start.p.copy(end.p); start.q.copy(end.q); const p = host.player(); fwd.set(-Math.sin(p.yaw), -Math.cos(p.yaw));
        land.set(p.x, ground(p.x, p.z), p.z); h = h0 = Math.max(1, end.p.y - land.y); off.set(0, 0, 0);
      }
      const top = TRANSITION.bandTop * 1.05;
      if (down) { // the glide path down to the handover height (held there until the chunks are ready), then the rig
        // slower until the chunks are ready (so the patch is in by ~1 km); the fade is time-limited too, so a late ready never pops
        if (readySeen) fadeT = Math.min(1, fadeT + dt / INPAGE.fadeSec);
        fade = Math.min(patchFade(h, readySeen), fadeT);
        if (phase === 'fly') { h = Math.max(TRANSITION.handover, h * Math.exp(-INPAGE.kDown * (readySeen || late ? 1 : INPAGE.waitK) * dt)); if (h <= TRANSITION.handover + 1e-3 && fade >= 1) phase = 'blend'; }
        if (DEV && DEBUG.holdH) h = Math.max(h, DEBUG.holdH);
        glide(h, clamp01((h - TRANSITION.handover) / (h0 - TRANSITION.handover)));
        cam.q.copy(start.q).slerp(tmpQ, smoothstep(0, 1, clamp01(Math.log(h0 / h) / Math.log(1 / .6)))); // globe pose -> looking at the landing by 0.6 h0
        if (phase === 'blend') { blend = Math.min(1, blend + dt / TRANSITION.blendSec); const b = smoothstep(0, 1, blend); cam.p.lerp(end.p, b); cam.q.slerp(end.q, b); }
      } else { // up: rig -> glide path within the first ~30 m, up the glide path, the globe's own pose (heading, 0.08 down) near the top
        h = Math.min(top, h * Math.exp(INPAGE.kUp * dt));
        const a = smoothstep(h0, Math.max(h0 + 1, 30), h); glide(h, 0);
        cam.p.lerp(start.p.clone().setY(start.p.y + h - h0), 1 - a); cam.q.copy(start.q).slerp(tmpQ, a);
        tmpQ.setFromEuler(new THREE.Euler(-Math.atan(.08), Math.atan2(-fwd.x, -fwd.y), 0, 'YXZ')); cam.q.slerp(tmpQ, smoothstep(top * .6, top, h));
        fade = patchFade(h, true);
      }
      if (DEV && DEBUG.pose) { const [x, y, z] = DEBUG.pose.p, [lx, ly, lz] = DEBUG.pose.look; cam.p.set(x, y, z); tmpM.lookAt(cam.p, tmpV.set(lx, ly, lz), UP); cam.q.setFromRotationMatrix(tmpM); }
      camera.position.copy(cam.p); camera.quaternion.copy(cam.q);
      const hc = Math.max(1, cam.p.y - ground(cam.p.x, cam.p.z)); camera.near = Math.max(.2, hc * INPAGE.nearK); camera.far = Math.max(700, hc * 2 + 900, DEV ? DEBUG.far : 0);
      camera.updateMatrixWorld(true);
      STATS.h = h; STATS.fade = fade; STATS.ready = ready; STATS.readyAt = readyAt;
      if (down && phase === 'blend' && blend >= 1) next = 'game'; else if (!down && h >= top - 1e-3) next = 'globe'; // next frame (this one still draws the band)
    },
    /** buildScene, after the sky update: the globe into the far layer, as the background; the patch fade; band visibility. */
    background(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      if (mode !== 'band' || !globe) { if (hidden.size || savedBg !== undefined) restoreScene(); return; }
      const t0 = performance.now(); renderer.getDrawingBufferSize(size); far.resize(size.x, size.y);
      globeCameraFrom(globe.planet, camera, gcam); globe.drive({ position: gcam.position, quaternion: gcam.quaternion, fov: camera.fov, aspect: camera.aspect });
      globe.step(far.target); STATS.globeMs = performance.now() - t0;
      if (savedBg === undefined) savedBg = scene.background; scene.background = DEV && DEBUG.noGlobe ? NO_GLOBE : far.texture;
      if (DEV && shoreU) shoreU.uShore.value.z = DEBUG.noShore ? 0 : +globe.maskReady; // ?inpagedev: noShore = per-vertex shoreline only, noGlobe = magenta instead of the globe (artefact layer checks)
      dusk = duskOf(scene); const s = bandLook(smoothstep(TRANSITION.bandTop, TRANSITION.fadeFull, h), smoothstep(TRANSITION.fadeFull, INPAGE.tintLow, h)); scene.backgroundIntensity = (INPAGE.gain + (INPAGE.bandGain - INPAGE.gain) * s) / EXPOSURE.base; // the globe's own look at the band top -> matched to the game by fadeFull
    // the game's linear fog (render/sky: ~200-480 m + camera height, pale) is pushed out above the handover: up here the haze toward
    // the globe (setPatchFar) is the aerial perspective, and the fog washed distant patch tree tops out to the fog colour (r19 risk)
    if (scene.fog instanceof THREE.Fog) { const k = smoothstep(TRANSITION.handover, INPAGE.fogTop, h), m = 1 + INPAGE.fogOut * k * k; scene.fog.near *= m; scene.fog.far *= m; }
      const p = host.player(); setPatchFade(fade, { x: p.x, z: p.z, r: Math.min(INTEREST.mid, INPAGE.ring * CHUNK_SIZE), y: patchPlaneY(p.x, p.z, Math.min(INTEREST.mid, INPAGE.ring * CHUNK_SIZE)) }); hideForBand(scene); // disc inside the chunks chunksReady checked
      // the patch's aerial blend toward the globe behind it, and globe terrain in front of the patch hides it (render/fade, uniforms)
      setPatchFar({ color: far.texture, depth: far.target.depthTexture, mix: Math.min(1, INPAGE.haze * smoothstep(INPAGE.hazeLow, INPAGE.hazeTop, h)), scale: scene.backgroundIntensity, logFC: LOG_DEPTH.uniform.value, occ: INPAGE.occ });
    },
    /** buildScene's screen-space effects in the band: god rays off (the far layer has no depth, so its ground would read as sky
     *  in the ray mask), ambient occlusion only once the patch is fully in (GTAO's normal pass cannot dither). */
    fx(t: FxTier): FxTier {
      if (mode !== 'band') return t;
      // GTAO only in the final blend to the player: on the dithered disc rim its isolated kept water/ground pixels came out as a ring
      // of dark dots (r23: gone with AO off; the patch rim is on screen for the whole fly phase)
      const a = phase === 'blend' && fade >= 1 ? smoothstep(0, 1, blend) : 0; AO_BLEND.value = DEV && DEBUG.noAO ? 0 : a;
      return { ssao: a > 0 ? t.ssao : 0, contact: t.contact * INPAGE.bandContact, rays: 0 };
    },
    /** Behind the loading screen: create the globe, compile its programs for the far layer AND the screen, build the tiles over
     *  the player at the entry altitude, compile the far-layer background program, then terminate the workers. */
    async prewarm() {
      const g = await loadGlobe(); await g.compiled; await g.precompile(null);
      const t0 = performance.now(); let n = 0;
      while (performance.now() - t0 < INPAGE.prebuildMs) { renderer.getDrawingBufferSize(size); far.resize(size.x, size.y); g.step(far.target); if (++n > 10 && g.stats().queued === 0) break; await new Promise(r => requestAnimationFrame(r)); }
      const bg = new THREE.Scene(), rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }); bg.background = far.texture; // background plane: screen and composer variants
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(bg, view.camera); renderer.setRenderTarget(null); renderer.render(bg, view.camera); renderer.setRenderTarget(prev); rt.dispose();
      if (mode === 'game') g.suspendWorkers(); // not if Shift+G already went up meanwhile (the band would build tiles on the main thread)
      return { ms: performance.now() - t0, frames: n, tiles: g.stats().cached };
    },
    dispose() { globe?.dispose(); far.dispose(); ctl = null; },
  };
  return api;
  /** lake colours for the band: s = 0 the globe's calibrated lakes, 1 the game-matched ones */
  /** 0 by day .. 1 with the sun low: the game water (sky reflection) stays brighter than the globe's sun-lit lakes at dusk (r21: 11/44/53 vs 9/25/24 at 18.4) */
  function duskOf(scene: THREE.Scene) { let y = 1; for (const o of scene.children) { const l = o as THREE.DirectionalLight; if (l.isDirectionalLight && l.intensity > 0) { const d = l.position.clone().sub(l.target.position); y = d.y / Math.max(1e-6, d.length()); break; } } return 1 - smoothstep(INPAGE.duskSin[0], INPAGE.duskSin[1], y); }
  function bandLook(s: number, t = 0) { if (landU) { const D = INPAGE.landTint, N = INPAGE.landTintDusk, L = [0, 1, 2].map(i => D[i] + (N[i] - D[i]) * dusk); landU.uLandTint.value.setRGB(1 + (L[0] - 1) * t, 1 + (L[1] - 1) * t, 1 + (L[2] - 1) * t); /* day -> dusk tint (duskOf) */ } if (lakeU) { const L = (u: { value: THREE.Color }, a: readonly number[], b: readonly number[]) => u.value.setRGB(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s); const D = INPAGE.duskLake, k = (c: readonly number[]) => c.map((v, i) => v * (1 + (D[i] - 1) * dusk)); L(lakeU.shallow, GLOBE_COLOURS.lakeShallow, k(INPAGE.lakeShallow)); L(lakeU.deep, GLOBE_COLOURS.lakeDeep, k(INPAGE.lakeDeep)); lakeU.rough.value = .55 + (INPAGE.lakeRough - .55) * s; } return s; }
  function record() { renderMs = STATS.globeMs + STATS.drawMs; const l = STATS.log; l.push({ t: performance.now(), mode, h: Math.round(h), fade: +fade.toFixed(3), globeMs: +STATS.globeMs.toFixed(2), ...(DEV ? { drawMs: +STATS.drawMs.toFixed(1), jobsMs: +JOBS.lastFrameMs.toFixed(1), cpuMs: +(performance.now() - Number(document.timeline.currentTime ?? 0)).toFixed(1) } : {}) }); STATS.drawMs = 0; if (l.length > 4000) l.splice(0, l.length - 4000); }
}
/** buildScene hooks (no-ops on the reload path). */
export const bandCamera = (camera: THREE.PerspectiveCamera) => ctl?.camera(camera);
export const bandBackground = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => ctl?.background(scene, camera);
export const bandFx = <T extends FxTier>(t: T): FxTier => ctl ? ctl.fx(t) : t;
