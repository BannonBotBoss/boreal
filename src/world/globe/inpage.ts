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
import { setPatchFade } from '../../render/fade';
import { GOVERNOR, resetGovernor } from '../../core/quality';
import { INTEREST, pending } from '../../core/interest';
import { CHUNK_SIZE, heightAt } from '../../core/world';
import { EXPOSURE } from '../../core/light';
import { clamp01, smoothstep } from '../../proc/math';

/** [game calibration] gain: globe radiance scale in the game's exposure (1 = the standalone globe's look); kDown/kUp: log-height
 *  rates (1/s) of the descent (2 km -> 60 m in ~5 s) and the ascent; nearK: band camera near plane = height x nearK;
 *  waitK: descent rate factor until the patch chunks are ready; fadeSec: the patch fades in over at least this long once ready;
 *  bandGain, lakeShallow/lakeDeep: the globe's radiance scale and lake colours eased to by fadeFull (from 1 / the globe's own
 *  lakes at the band top), matched to the game patch seen from 600 m at Ultra; ring: the patch = the chunks within ring of
 *  the player's chunk (readiness and the fade disc, ring x CHUNK_SIZE); jobMs: chunk job budget per frame while the descent
 *  waits for them (the sim is frozen in the band, so its time goes to the patch). */
export const INPAGE = { gain: 1, kDown: .7, kUp: 1.7, nearK: .01, prebuildMs: 5000, waitK: .25, fadeSec: .8, bandGain: 2.6, lakeShallow: [.017, .063, .07] as [number, number, number], lakeDeep: [.012, .047, .056] as [number, number, number], ring: 2, jobMs: 10 };
type View = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; photoreal: { renderer: THREE.WebGLRenderer } };
export interface InPageHost { player(): { x: number; z: number; yaw: number }; place(x: number, z: number, yaw: number): void; save(): void; notice?(m: string): void }
type FxTier = { ssao: number; contact: number; rays: number };
let lakeU: typeof import('./globeView').GLOBE_LAKE | null = null;
let ctl: ReturnType<typeof controller> | null = null, globeModule: Promise<typeof import('./globeView')> | null = null, createGlobe: typeof import('./globeView').createGlobe | null = null;

/** main.ts: the controller when the in-page path is on (?transition=inpage, or the default once flipped), else null (reload). */
export function createInPage(view: View, host: InPageHost) {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (transitionPath(location.search, { deviceMemory: nav.deviceMemory, probeCap: GOVERNOR.probeCap }) !== 'inpage') return null;
  globeModule ??= import('./globeView');
  ctl = controller(view, host); (window as unknown as { __inpage?: unknown }).__inpage = ctl; // dev: the check script reads it
  return ctl;
}
const ground = (x: number, z: number) => Math.max(heightAt(x, z), -.2);

function controller(view: View, host: InPageHost) {
  const renderer = view.photoreal.renderer, far = createFarLayer(), hold = createGovernorHold(GOVERNOR, resetGovernor);
  let globe: Globe | null = null, mode: TransitionMode = 'game', down = true, phase: 'fly' | 'blend' = 'fly';
  let next: 'globe' | 'game' | null = null; // mode switches decided in the band take effect at the start of the next frame
  let h = 0, h0 = 1, blend = 0, fade = 0, fadeT = 0, ready = false, readySeen = false, needStart = false, placedFrame = 0, frameNo = 0, lastT = 0, cameraTouched = false;
  const start = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, end = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const cam = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, gcam = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), size = new THREE.Vector2(), UP = new THREE.Vector3(0, 1, 0);
  const land = new THREE.Vector3(), off = new THREE.Vector3(), fwd = new THREE.Vector2(); // landing point, start offset from the glide path, heading
  /** camera on the 45-degree glide path h metres above the landing ground (behind it along the heading), looking at it */
  const glide = (hh: number, k: number) => { cam.p.set(land.x - fwd.x * hh + off.x * k, land.y + hh + off.y * k, land.z - fwd.y * hh + off.z * k); tmpM.lookAt(cam.p, land, UP); tmpQ.setFromRotationMatrix(tmpM); };
  const hidden = new Map<THREE.Object3D, boolean>(); let savedBg: THREE.Scene['background'] | undefined;
  const STATS = { globeMs: 0, mode: 'game' as TransitionMode, h: 0, fade: 0, ready: false, log: [] as { t: number; mode: string; h: number; fade: number; globeMs: number }[] };

  async function loadGlobe() { const mod = await globeModule!; createGlobe ??= mod.createGlobe; lakeU ??= mod.GLOBE_LAKE; return ensureGlobe(); }
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
    const lim = PLANET.home.halfSize - PLANET.home.feather - HANDOFF.margin, clampL = (u: number) => Math.max(-lim, Math.min(lim, u));
    const s = landSpawn({ x: clampL(pg.x + fwd.x * h0), z: clampL(pg.z + fwd.y * h0) }); host.place(s.x, s.z, at.yaw); placedFrame = frameNo;
    land.set(s.x, ground(s.x, s.z), s.z); h0 = Math.max(TRANSITION.handover + 1, pg.y - land.y); h = h0;
    off.set(start.p.x - (land.x - fwd.x * h0), start.p.y - (land.y + h0), start.p.z - (land.z - fwd.y * h0)); // decays to 0 with height
    phase = 'fly'; blend = 0; fadeT = 0; readySeen = false; down = true; lastT = performance.now(); setMode('band');
  }
  function toGlobe() { restoreScene(); globe!.drive(null); setMode('globe'); }
  function toGame() { restoreScene(); globe?.drive(null); setMode('game'); globe?.suspendWorkers(); hold.release(); }
  function restoreScene() {
    for (const [o, v] of hidden) o.visible = v; hidden.clear();
    if (savedBg !== undefined) { view.scene.background = savedBg; savedBg = undefined; } view.scene.backgroundIntensity = 1; setPatchFade(1); bandLook(0);
  }
  const isChunkRoot = (o: THREE.Object3D) => o.type === 'Group' && (o.children[0]?.userData.inspect as { type?: string } | undefined)?.type === 'terrain';
  const hasLight = (o: THREE.Object3D) => (o as THREE.Light).isLight || !!o.getObjectByProperty('isLight', true);
  const faded = (o: THREE.Object3D) => !!((o as THREE.Mesh).material as THREE.Material | undefined)?.userData?.patchFade;
  const dithers = new WeakMap<THREE.Object3D, boolean>(); // grass, flora, far trees: every mesh under it dithers with the patch (render/fade)
  const allFaded = (o: THREE.Object3D) => { let v = dithers.get(o); if (v === undefined) { let n = 0, ok = true; o.traverse(c => { if ((c as THREE.Mesh).isMesh) { n++; ok &&= faded(c); } }); v = ok && n > 0; dithers.set(o, v); } return v; };
  /** Hide what cannot dither while the patch is partly in (and the sky dome for the whole band); restore the rest. */
  function hideForBand(scene: THREE.Scene) {
    const now = new Set<THREE.Object3D>(), partial = fade < 1;
    for (const o of scene.children) {
      if (isChunkRoot(o)) { if (partial) for (const m of o.children) if (!faded(m)) now.add(m); continue; }
      if (hasLight(o) || (!(o as THREE.Mesh).isMesh && (o as THREE.Points).type !== 'Points' && !o.children.length)) continue;
      if (o.renderOrder < 0 || o.type === 'Points' || (partial && !allFaded(o))) now.add(o); // sky (-2), cloud dome (-1), precipitation; everything else that cannot dither while partial
    }
    for (const [o, v] of hidden) if (!now.has(o)) { o.visible = v; hidden.delete(o); }
    for (const o of now) { if (!hidden.has(o)) hidden.set(o, o.visible); o.visible = false; }
  }

  const api = {
    get mode() { return mode; }, get globe() { return globe; }, get fade() { return fade; }, get height() { return h; }, STATS, INPAGE, far,
    /** Shift+G / pause menu: game -> band (up). Returns true when the in-page path took it. */
    ascend(): boolean {
      if (mode !== 'game') return true;
      if (!globe) { void loadGlobe().then(() => api.ascend()); return true; } // first use before the prewarm finished
      const g = globe; host.save(); hold.hold(); g.resumeWorkers(); down = false; needStart = true; lastT = performance.now(); setMode('band');
      return true;
    },
    blocksGame: () => mode !== 'game',
    /** main's runJobs budget: undefined = the default; larger while the descent waits for the patch chunks */
    jobBudgetMs: () => (mode === 'band' && down && !readySeen ? INPAGE.jobMs : undefined),
    ownsInput: () => mode !== 'game',
    /** main's draw slot: globe mode draws the globe to the screen; band and game draw the game (buildScene calls the hooks). */
    frame(drawGame: () => void) {
      frameNo++;
      if (next) { if (next === 'globe') toGlobe(); else toGame(); next = null; }
      if (mode === 'globe' && globe) {
        const o = globe.overHome;
        if (o && globe.descending && globe.altitude < TRANSITION.bandTop) descend({ ...o, yaw: globe.headingYaw });
        else {
          const t0 = performance.now(), w = renderer.domElement.width, hh = renderer.domElement.height;
          if (Math.abs(globe.camera.aspect - w / hh) > 1e-6) { globe.camera.aspect = w / hh; globe.camera.updateProjectionMatrix(); }
          renderer.toneMappingExposure = INPAGE.gain; globe.step(null); STATS.globeMs = performance.now() - t0; record(); return;
        }
      }
      drawGame(); record();
    },
    /** buildScene, after the rig camera is placed: in the band the transition flies the camera (game frame). */
    camera(camera: THREE.PerspectiveCamera) {
      if (mode !== 'band') { if (cameraTouched) { camera.near = .2; camera.far = 700; cameraTouched = false; } return; }
      cameraTouched = true;
      const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
      end.p.copy(camera.position); end.q.copy(camera.quaternion); ready = chunksReady(); readySeen ||= ready;
      if (needStart) { // ascent: from the rig pose onto the glide path behind the player, then up it
        needStart = false; start.p.copy(end.p); start.q.copy(end.q); const p = host.player(); fwd.set(-Math.sin(p.yaw), -Math.cos(p.yaw));
        land.set(p.x, ground(p.x, p.z), p.z); h = h0 = Math.max(1, end.p.y - land.y); off.set(0, 0, 0);
      }
      const top = TRANSITION.bandTop * 1.05;
      if (down) { // the glide path down to the handover height (held there until the chunks are ready), then the rig
        // slower until the chunks are ready (so the patch is in by ~1 km); the fade is time-limited too, so a late ready never pops
        if (readySeen) fadeT = Math.min(1, fadeT + dt / INPAGE.fadeSec);
        fade = Math.min(patchFade(h, readySeen), fadeT);
        if (phase === 'fly') { h = Math.max(TRANSITION.handover, h * Math.exp(-INPAGE.kDown * (readySeen ? 1 : INPAGE.waitK) * dt)); if (h <= TRANSITION.handover + 1e-3 && fade >= 1) phase = 'blend'; }
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
      camera.position.copy(cam.p); camera.quaternion.copy(cam.q);
      const hc = Math.max(1, cam.p.y - ground(cam.p.x, cam.p.z)); camera.near = Math.max(.2, hc * INPAGE.nearK); camera.far = Math.max(700, hc * 2 + 900);
      camera.updateMatrixWorld(true);
      STATS.h = h; STATS.fade = fade; STATS.ready = ready;
      if (down && phase === 'blend' && blend >= 1) next = 'game'; else if (!down && h >= top - 1e-3) next = 'globe'; // next frame (this one still draws the band)
    },
    /** buildScene, after the sky update: the globe into the far layer, as the background; the patch fade; band visibility. */
    background(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      if (mode !== 'band' || !globe) { if (hidden.size || savedBg !== undefined) restoreScene(); return; }
      const t0 = performance.now(); renderer.getDrawingBufferSize(size); far.resize(size.x, size.y);
      globeCameraFrom(globe.planet, camera, gcam); globe.drive({ position: gcam.position, quaternion: gcam.quaternion, fov: camera.fov, aspect: camera.aspect });
      globe.step(far.target); STATS.globeMs = performance.now() - t0;
      if (savedBg === undefined) savedBg = scene.background; scene.background = far.texture;
      const s = bandLook(smoothstep(TRANSITION.bandTop, TRANSITION.fadeFull, h)); scene.backgroundIntensity = (INPAGE.gain + (INPAGE.bandGain - INPAGE.gain) * s) / EXPOSURE.base; // the globe's own look at the band top -> matched to the game by fadeFull
      const p = host.player(); setPatchFade(fade, { x: p.x, z: p.z, r: Math.min(INTEREST.mid, INPAGE.ring * CHUNK_SIZE) }); hideForBand(scene); // disc inside the chunks chunksReady checked
    },
    /** buildScene's screen-space effects in the band: god rays off (the far layer has no depth, so its ground would read as sky
     *  in the ray mask), ambient occlusion only once the patch is fully in (GTAO's normal pass cannot dither). */
    fx(t: FxTier): FxTier { return mode === 'band' ? { ssao: fade >= 1 ? t.ssao : 0, contact: t.contact, rays: 0 } : t; },
    /** Behind the loading screen: create the globe, compile its programs for the far layer AND the screen, build the tiles over
     *  the player at the entry altitude, compile the far-layer background program, then terminate the workers. */
    async prewarm() {
      const g = await loadGlobe(); await g.compiled; await g.precompile(null);
      const t0 = performance.now(); let n = 0;
      while (performance.now() - t0 < INPAGE.prebuildMs) { renderer.getDrawingBufferSize(size); far.resize(size.x, size.y); g.step(far.target); if (++n > 10 && g.stats().queued === 0) break; await new Promise(r => requestAnimationFrame(r)); }
      const bg = new THREE.Scene(), rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }); bg.background = far.texture; // background plane: screen and composer variants
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(bg, view.camera); renderer.setRenderTarget(null); renderer.render(bg, view.camera); renderer.setRenderTarget(prev); rt.dispose();
      g.suspendWorkers();
      return { ms: performance.now() - t0, frames: n, tiles: g.stats().cached };
    },
    dispose() { globe?.dispose(); far.dispose(); ctl = null; },
  };
  return api;
  /** lake colours for the band: s = 0 the globe's calibrated lakes, 1 the game-matched ones */
  function bandLook(s: number) { if (lakeU) { const L = (u: { value: THREE.Color }, a: readonly number[], b: readonly number[]) => u.value.setRGB(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s); L(lakeU.shallow, GLOBE_COLOURS.lakeShallow, INPAGE.lakeShallow); L(lakeU.deep, GLOBE_COLOURS.lakeDeep, INPAGE.lakeDeep); } return s; }
  function record() { const l = STATS.log; l.push({ t: performance.now(), mode, h: Math.round(h), fade: +fade.toFixed(3), globeMs: +STATS.globeMs.toFixed(2) }); if (l.length > 4000) l.splice(0, l.length - 4000); }
}
/** buildScene hooks (no-ops on the reload path). */
export const bandCamera = (camera: THREE.PerspectiveCamera) => ctl?.camera(camera);
export const bandBackground = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => ctl?.background(scene, camera);
export const bandFx = <T extends FxTier>(t: T): FxTier => ctl ? ctl.fx(t) : t;
