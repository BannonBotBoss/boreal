/**
 * Photoreal pipeline + adaptive quality (Grok Bot). Adopted, unmodified dependencies (three r180 examples/jsm, MIT,
 * already in the bundle via the `three` package):
 *  - CSM (cascaded shadow maps, examples/jsm/csm/CSM.js; Zhang et al. 2006 parallel-split shadow maps). Tailored: its
 *    `setupMaterial` replaces onBeforeCompile, so we CHAIN it onto Boreal's own shader hooks; cascades/map size come
 *    from the quality ladder; light colour/intensity/direction from the NOAA sun (render/sky).
 *  - GTAOPass (ground-truth AO, Jiménez et al. 2016) inside the existing EffectComposer (render/post).
 *  - PMREMGenerator over the existing Preetham Sky for image-based lighting (scene.environment).
 * Governor: core/quality (algorithm adapted from drei PerformanceMonitor, MIT). GPU time from EXT_disjoint_timer_query_webgl2.
 */
import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GOVERNOR, applied, ceiling, governFrame, pendingWorld, tierForGpu, type Tier } from '../core/quality';
import { capRender } from '../core/renderSettings';
import { WEATHER, initWeather } from '../core/weather';
import { CLOUD, SUN_UNIFORMS, setCloudField } from './pbr';
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js';
import { DY, NX, NY, getGrid } from '../core/weather';
import { AMBIENT } from '../core/light';
import { ROCK_MATERIAL } from './batch';
import { LOG_MATERIAL } from './geometry';

/** Casters drawn into the NEAR cascade only: fallen logs and rocks (low, so their far-cascade shadows are a few texels; the
 *  far cascade draws trees). For a farther cascade's shadow camera their BatchedMesh draws nothing (multi-draw count 0
 *  after three's own per-camera culling): no material, define or program change. */
const NEAR_ONLY = new Set<THREE.Material>([LOG_MATERIAL, ROCK_MATERIAL]); let nearShadowCam: THREE.Camera | undefined;
{ const proto = THREE.BatchedMesh.prototype as unknown as { onBeforeShadow: (...a: unknown[]) => void }, base = proto.onBeforeShadow;
  proto.onBeforeShadow = function (this: THREE.BatchedMesh & { _multiDrawCount: number }, ...a: unknown[]) { base.apply(this, a);
    if (nearShadowCam && a[3] !== nearShadowCam && NEAR_ONLY.has(this.material as THREE.Material)) this._multiDrawCount = 0; }; }

// PCSS (Fernando 2005, 'Percentage-Closer Soft Shadows'), adapted from three r180 examples/webgl_shadowmap_pcss.html (MIT,
// spidersharma03): blocker search + Poisson PCF, injected into the shared shadow chunk behind `#ifdef PCSS` so only
// materials of tiers with pcss compile it. Tailored for a DIRECTIONAL sun (ortho cascades): penumbra width =
// (receiver − blocker depth) × tan(0.53°/2) in light-space, with PCSS_K folding in the cascade's depth/width ratio [game calibration].
const PCSS_GLSL = `
#ifdef PCSS
#define PCSS_N 16
#define PCSS_K 0.012
vec2 pcssDisk(int i, float a0) { float r = pow((float(i) + .5) / float(PCSS_N), .75), a = a0 + float(i) * 2.39996; return r * vec2(cos(a), sin(a)); }
float pcssShadow(sampler2D map, vec2 texel, vec3 c) {
  float a0 = rand(c.xy) * PI2, search = 12. * texel.x, sum = 0., n = 0.;
  for (int i = 0; i < PCSS_N; i++) { float d = unpackRGBAToDepth(texture2D(map, c.xy + pcssDisk(i, a0) * search)); if (d < c.z) { sum += d; n += 1.; } }
  if (n < .5) return 1.;
  float radius = clamp((c.z - sum / n) * PCSS_K * 40., texel.x, 24. * texel.x), lit = 0.;
  for (int i = 0; i < PCSS_N; i++) lit += texture2DCompare(map, c.xy + pcssDisk(i, a0 + 1.) * radius, c.z);
  return lit / float(PCSS_N);
}
#endif
`;
{ let c = THREE.ShaderChunk.shadowmap_pars_fragment;
  c = c.replace('float getShadow(', PCSS_GLSL + '\nfloat getShadow(');
  c = c.replace('#if defined( SHADOWMAP_TYPE_PCF )', '#if defined( PCSS )\n\t\t\tshadow = pcssShadow(shadowMap, 1. / shadowMapSize, shadowCoord.xyz);\n\t\t#elif defined( SHADOWMAP_TYPE_PCF )');
  THREE.ShaderChunk.shadowmap_pars_fragment = c; }
/** Time-sliced cube capture (shared by IBL and the GI probe): ONE face per frame through a CubeCamera's own face cameras,
 *  so no frame pays for six scene renders. `done` fires after the 6th face. */
function slicedCube(size: number, layer: number, near = .5, far = 1000) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType }), cam = new THREE.CubeCamera(near, far, rt);
  for (const c of cam.children) c.layers.set(layer);
  let face = -1;
  return { rt, cam, get busy() { return face >= 0; }, start(pos: THREE.Vector3) { if (face < 0) { cam.position.copy(pos); cam.updateMatrixWorld(true); face = 0; } },
    /** Renders the next face; returns true when the cube is complete. */
    step(renderer: THREE.WebGLRenderer, scene: THREE.Object3D) {
      if (face < 0) return false;
      if (cam.coordinateSystem !== renderer.coordinateSystem) { cam.coordinateSystem = renderer.coordinateSystem; cam.updateCoordinateSystem(); }
      const prev = renderer.getRenderTarget(), xr = renderer.xr.enabled; renderer.xr.enabled = false;
      renderer.setRenderTarget(rt, face); renderer.render(scene, cam.children[face] as THREE.Camera); renderer.setRenderTarget(prev); renderer.xr.enabled = xr;
      if (++face < 6) return false; face = -1; return true; } };
}
type SkyRig = { sky: Sky; sunLight: THREE.DirectionalLight; hemi: THREE.HemisphereLight };
export function createPhotoreal(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, rig: SkyRig, baseRatio: number) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  { // starting tier from the GPU (discrete GeForce/Radeon → Ultra); the governor then steps down only on missed frames
    const g = renderer.getContext(), dbg = g.getExtension('WEBGL_debug_renderer_info');
    GOVERNOR.gpu = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    if (GOVERNOR.auto) GOVERNOR.tier = Math.max(ceiling(), tierForGpu(GOVERNOR.gpu)); }
  let tier: Tier = applied(), csm: CSM | undefined;
  const chained = new Map<THREE.Material, THREE.Material['onBeforeCompile']>();
  const COST = { csmMs: 0, iblMs: 0, giMs: 0, cloudMs: 0, warmMs: 0 }, INFO = { calls: 0, tris: 0, workMs: 0, drawMs: 0 };
  // ---- bounce light: an SH light probe captured around the viewer (three LightProbeGenerator, MIT; Ramamoorthi & Hanrahan 2001)
  const probe = new THREE.LightProbe(); probe.intensity = 0; scene.add(probe);
  rig.sunLight.layers.enable(1); rig.hemi.layers.enable(1); // the GI capture (layer 1) must still be lit
  // bench (RTX 5060 Laptop): a full 6-face capture cost 58–1600 ms in one frame. Now: sky + terrain only (layer 1), one face per frame.
  let giCube = slicedCube(32, 1, .5, 200), lastProbe = -1e9, giReading = false;
  function captureGI(time: number) {
    const size = tier.gi >= 2 ? 64 : 32; // The TypeError seen in the first bench ("reading '2'", in a promise) was this: a tier switch disposed the cube
    // while LightProbeGenerator's async readback was still in flight. Resize only when no capture or readback is pending.
    if (giCube.rt.width !== size && !giCube.busy && !giReading) { giCube.rt.dispose(); giCube = slicedCube(size, 1, .5, 200); }
    const t0 = performance.now();
    if (!giCube.busy && time - lastProbe >= (tier.gi >= 2 ? 1 : 4)) { lastProbe = time; giCube.start(camera.position); }
    if (giCube.step(renderer, scene)) { giReading = true; LightProbeGenerator.fromCubeRenderTarget(renderer, giCube.rt).then(p => { probe.sh.copy(p.sh); probe.intensity = AMBIENT.probe; }).catch(e => console.warn('GI probe readback', e)).finally(() => { giReading = false; }); } // async readback (r180); AMBIENT.probe = bounce only (core/light)
    COST.giMs = performance.now() - t0;
  }
  let lastCloud = -1e9;
  function updateClouds(time: number) {
    if (time - lastCloud < .5) return; lastCloud = time; const t0 = performance.now(), g = getGrid(); if (!g) return;
    const cover = new Float32Array(NX * NX);
    for (let c = 0; c < NX * NX; c++) { let lwp = 0; for (let k = 0; k < NY; k++) lwp += g.qc[k * NX * NX + c] * DY; cover[c] = Math.min(1, lwp / .2); }
    setCloudField(cover, NX, WEATHER.ox, WEATHER.oz, NX * (384 / NX), WEATHER.on && !!tier.clouds); COST.cloudMs = performance.now() - t0;
  }

  // ---- cascaded shadows ----------------------------------------------------------------------------------------------
  function buildShadows() {
    for (const [m, prev] of chained) { m.onBeforeCompile = prev; const d = (m as unknown as { defines?: Record<string, unknown> }).defines; delete d?.USE_CSM; delete d?.CSM_CASCADES; delete d?.PCSS; m.needsUpdate = true; }
    chained.clear(); csm?.remove(); csm?.dispose(); csm = undefined; nearShadowCam = undefined;
    if (!tier.shadows) { rig.sunLight.castShadow = false; return; }
    csm = new CSM({ camera, parent: scene, cascades: tier.shadows, maxFar: 110, // ≈ the LOD-1 range: distant LOD-2 trees cast no shadow (outside the cascades) shadowMapSize: tier.resScale >= 1 ? 2048 : 1024, // ≤ 2048 (Quest budget)
      lightDirection: new THREE.Vector3(0, -1, 0), lightIntensity: 0, mode: 'practical', shadowBias: -.0004 });
    csm.fade = true; for (const l of csm.lights) l.layers.enable(1);
    for (let i = 1; i < csm.lights.length; i++) { csm.lights[i].shadow.autoUpdate = false; csm.lights[i].shadow.needsUpdate = true; } nearShadowCam = csm.lights.length > 1 ? csm.lights[0].shadow.camera : undefined; // far cascades: refreshed every FAR_CASCADE_EVERY frames (before())
  }
  /** The far cascade's shadow map is re-rendered every Nth frame (staggered per cascade); the near one every frame. The sun moves
   *  ~0.004 deg/frame and the far cascade's texels are ~5 cm+, so a 3-frame-old far map is invisible, and its casters (most of the
   *  ~400 shadow draws at Ultra) cost a third. three uses a light's shadow.matrix from its last render, so lookups stay consistent. */
  const FAR_CASCADE_EVERY = 3; let shadowFrame = 0;
  function setupMaterials() {
    if (!csm) return;
    scene.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      if (!mesh.userData.shadowSet) { mesh.userData.shadowSet = true; mesh.receiveShadow = true; mesh.castShadow = !/terrain/.test(mesh.userData.inspect?.type ?? '') && !(mesh.geometry?.type === 'PlaneGeometry'); }
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (chained.has(m) || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        const prev = m.onBeforeCompile; chained.set(m, prev); csm!.setupMaterial(m); if (tier.pcss) ((m as unknown as { defines: Record<string, unknown> }).defines ??= {}).PCSS = ''; const theirs = m.onBeforeCompile;
        m.onBeforeCompile = chain(m, prev, theirs); m.needsUpdate = true; // chain, don't replace
      }
    });
  }

  // ---- shader variants ahead of a world-tier change ------------------------------------------------------------------
  // A world-tier switch (shadows, PCSS, IBL, and the post route: GTAO/contact/rays draw the scene into a half-float target,
  // which changes tone mapping + output colour space) gives every material a new program key, and three compiled each one
  // synchronously at its first draw: the 2.3-3.4 s freezes at the 20 s world catch-up. While core/quality reports a pending
  // world tier, its variants are compiled a few per frame on CLONES (target defines, the program key the live material will
  // have), drawn by proxies of the real meshes (Object.create: same geometry/batching/instancing) and lit by stand-ins for
  // the target's lights. The live materials and CSM are untouched; three's program cache is shared by key, so at the switch
  // each material finds its program already linked (in the background with KHR_parallel_shader_compile). Not covered:
  // point-light shadow programs, materials first seen after the late pass, a target with IBL before any sky bake.
  type OBC = THREE.Material['onBeforeCompile'];
  type Prog = THREE.WebGLProgram & { isReady(): boolean }; // three r180 WebGLProgram.isReady (KHR_parallel_shader_compile), missing from the typings
  function chain(m: THREE.Material, prev: OBC, theirs: OBC): OBC { return (s, r) => { prev.call(m, s, r); theirs.call(m, s, r); }; }
  const CHAIN_KEY = chain(new THREE.Material(), () => {}, () => {}).toString(); // = customProgramCacheKey() of every chained material
  // Both post routes are compiled for a world variant: ssao/contact/rays are not world knobs, so a step across Medium/Low
  // flips the route at once (the 4.7 s freeze at the drop to Very low in the second omen bench, once startup compiled one route).
  const viaTarget = (t: Tier) => !!(t.ssao || t.contact || t.rays); // render/post renders into the composer's target
  const variantOf = (t: Tier) => `${t.shadows}:${t.pcss}:${t.ibl}`;
  const offscreen = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  function compileVia<T>(via: boolean, fn: () => T): T { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(via ? offscreen : null); try { return fn(); } finally { renderer.setRenderTarget(prev); } }
  type Defines = Record<string, unknown>;
  interface Warm { key: string; target: Tier; lit: THREE.Scene; litDepth: THREE.Scene; clones: Map<THREE.Material, THREE.Material>; depths: THREE.Material[]; seen: Set<string>; queue: { p: THREE.Object3D; via: boolean; depth?: boolean }[]; busy: Prog[]; late: boolean }
  let warm: Warm | undefined;
  // Clones are disposed (their programs released) only 120 frames later: a switch and a new target can land in the same
  // frame (the world catches up as the governor steps again), and the live materials must acquire the programs first.
  let retired: { mats: THREE.Material[]; frames: number }[] = [];
  function release() { if (warm) retired.push({ mats: [...warm.clones.values(), ...warm.depths], frames: 0 }); warm = undefined; }
  function reap() { retired = retired.filter(r => ++r.frames < 120 || (r.mats.forEach(m => m.dispose()), false)); }
  const SHADOW_SIDE = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
  /** The state three's WebGLShadowMap.getDepthMaterial gives its built-in depth material for `m` (PCF shadow maps). */
  function shadowDepth(w: Warm, m: THREE.Material) {
    const s = m as THREE.MeshStandardMaterial, d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    d.visible = s.visible; d.wireframe = !!s.wireframe; d.side = s.shadowSide ?? SHADOW_SIDE[s.side]; d.alphaMap = s.alphaMap ?? null; d.alphaTest = s.alphaToCoverage ? .5 : s.alphaTest; d.map = s.map ?? null;
    d.clipShadows = s.clipShadows; d.clippingPlanes = s.clippingPlanes; d.clipIntersection = s.clipIntersection;
    d.displacementMap = s.displacementMap ?? null; d.displacementScale = s.displacementScale ?? 1; d.displacementBias = s.displacementBias ?? 0;
    w.depths.push(d); return d;
  }
  function variant(w: Warm, m: THREE.Material) {
    let c = w.clones.get(m); if (c) return c;
    const t = w.target, std = !!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial, base = chained.get(m) ?? m.onBeforeCompile, live = chained.has(m);
    const key = m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey() : std && t.shadows ? CHAIN_KEY : base.toString();
    const d: Defines = { ...(m as unknown as { defines?: Defines }).defines }; // replay buildShadows + setupMaterial in order: the key lists defines in insertion order
    if (std && (live || t.shadows) && (!live || !csm !== !t.shadows || t.shadows !== tier.shadows || t.pcss !== tier.pcss)) {
      if (live) { delete d.USE_CSM; delete d.CSM_CASCADES; delete d.CSM_FADE; delete d.PCSS; } // CSM.dispose drops CSM_FADE too
      if (t.shadows) { d.USE_CSM = 1; d.CSM_CASCADES = t.shadows; d.CSM_FADE = ''; if (t.pcss) d.PCSS = ''; }
    }
    const k = m.clone(); (k as unknown as { defines: Defines }).defines = d; k.onBeforeCompile = (s, r) => base.call(k, s, r); k.customProgramCacheKey = () => key;
    w.clones.set(m, k); return k;
  }
  /** Stand-ins for the lights tier `t` renders with (program keys carry light and shadow counts), plus fog and env. */
  function litFor(t: Tier, depth = false) {
    const s = new THREE.Scene(), csmLights = new Set<THREE.Object3D>(csm?.lights ?? []);
    if (!depth) { s.fog = scene.fog; s.environment = t.ibl ? scene.environment ?? envRT?.texture ?? null : null; }
    scene.traverseVisible(o => { if (!(o as THREE.Light).isLight || csmLights.has(o)) return; const l = o.clone(false); if (o === rig.sunLight && !t.shadows) l.castShadow = false; s.add(l); });
    for (let i = 0; i < t.shadows; i++) { const l = new THREE.DirectionalLight(); l.castShadow = true; s.add(l); } // CSM's cascade lights
    return s;
  }
  /** Queue every mesh/material pairing not yet seen for target `t` (a new target starts over). */
  function precompile(t: Tier) {
    const key = variantOf(t);
    if (warm?.key !== key) {
      release(); const lit = litFor(t), litDepth = litFor(t, true); // litDepth: the shadow pass draws with no scene (no env, no fog)
      warm = { key, target: t, lit, litDepth, clones: new Map(), depths: [], seen: new Set(), queue: [], busy: [], late: false };
    }
    const w = warm!;
    scene.traverse(o => {
      const mesh = o as THREE.Mesh, mat = mesh.material, g = mesh.geometry; if (!mesh.isMesh || !mat || !g) return;
      const mats = Array.isArray(mat) ? mat : [mat], x = o as unknown as Record<string, unknown>, recv = mesh.receiveShadow || (!!t.shadows && !mesh.userData.shadowSet);
      const sig = mats.map(m => m.uuid).join() + '|' + Object.keys(g.attributes).join() + '|' + Object.keys(g.morphAttributes).length + [x.isBatchedMesh, x.isInstancedMesh, x.isSkinnedMesh, x.instanceColor, x._colorsTexture, recv].map(v => +!!v).join('');
      if (w.seen.has(sig)) return; w.seen.add(sig);
      const p = Object.create(o) as THREE.Mesh; p.material = Array.isArray(mat) ? mats.map(m => variant(w, m)) : variant(w, mat); p.receiveShadow = recv; w.queue.push({ p, via: !viaTarget(t) }, { p, via: viaTarget(t) }); // popped from the end: the target's own route first
      const cdm = mesh.customDepthMaterial; // the shadow pass's program keys carry the light counts too
      if (t.shadows && mesh.castShadow && !w.seen.has(sig + 'd')) { w.seen.add(sig + 'd'); const q = Object.create(o) as THREE.Mesh;
        q.material = cdm ? variant(w, cdm) : Array.isArray(mat) ? mats.map(m => shadowDepth(w, m)) : shadowDepth(w, mat); w.queue.unshift({ p: q, via: true, depth: true }); }
    });
  }
  /** Compile queued proxies: at most `maxNew` new programs, and only once the previous ones have linked. gl.compile
   * returns at once, but the GPU process works through every queued compile before it answers the frame's next
   * synchronous call: compiling the whole queue in one go froze the first omen bench for 4.9 s. Readiness is the
   * non-blocking KHR_parallel_shader_compile status (three's isReady, as in compileAsync); without it, isReady is true. */
  function stepWarm(budgetMs: number, maxNew = 2) {
    const w = warm; if (!w) return;
    w.busy = settle(w.busy); if (w.busy.length || !w.queue.length) return;
    const t0 = performance.now(), programs = () => renderer.info.programs?.length ?? 0, n0 = programs();
    while (w.queue.length && performance.now() - t0 < budgetMs && programs() - n0 < maxNew) { const { p, via, depth } = w.queue.pop()!; compileOne(p, via, depth ? w.litDepth : w.lit, w.busy); }
    COST.warmMs += performance.now() - t0;
  }
  /** Compile `o` through one post route; the programs it got go to `busy` (one per route: the material's currentProgram right after). */
  function compileOne(o: THREE.Object3D, via: boolean, lit: THREE.Scene, busy: Prog[]) {
    for (const m of compileVia(via, () => renderer.compile({ traverse: (f: (o: THREE.Object3D) => void) => f(o), traverseVisible() {} } as unknown as THREE.Object3D, camera, lit))) {
      const p = (renderer.properties.get(m) as { currentProgram?: Prog }).currentProgram; if (p && !busy.includes(p)) busy.push(p); }
  }
  /** Programs still linking stay in the list. Linked ones get their first use now (three's onFirstUse: info logs, uniform and
   *  attribute locations, 5-30 ms each on ANGLE/D3D11 even when the link is long done), at most 2 per frame, instead of all
   *  at once in the switch frame. Readiness is KHR_parallel_shader_compile's non-blocking status (three's isReady). */
  function settle(busy: Prog[]) {
    let used = 0; return busy.filter(p => { if (!p.program) return false; if (!p.isReady()) return true; if (used >= 2) return true; used++; p.getUniforms(); p.getAttributes(); return false; });
  }

  // ---- both post routes for the LIVE world variant ------------------------------------------------------------------
  // ssao/contact/rays are not world knobs (and the sun setting turns contact/rays off), so the post route flips at once,
  // with no hold: every live material then needs its program for the other route (tone mapping and output colour space
  // are part of the key). Startup compiles both routes, but meshes and materials that appeared later only ever compiled
  // the route in use, and those links landed in the switch frame: the 200-400 ms tier-change hitch (omen bench, 506d0aa).
  // So the live materials are compiled through both routes in the background, a few new programs at a time, which is
  // what three does at the flip anyway, only earlier. three keeps every program of a material until the material is
  // disposed, so nothing needs releasing. A pending world variant goes first.
  const routed = new WeakMap<THREE.Material, Set<string>>(); let routeQ: THREE.Object3D[] = [], routeLit: THREE.Scene | undefined, routeScan = 0;
  let routeBusy: Prog[] = [], routeKey = '';
  function stepRoutes() {
    if (warm && (warm.queue.length || warm.busy.length)) return;
    routeBusy = settle(routeBusy); if (routeBusy.length) return;
    if (routeQ.length && routeKey !== variantOf(tier)) routeQ = []; // the tier changed since the scan: routeLit has the old cascade lights, and a live material compiled against them (its new CSM_CASCADES > the scene's shadow lights) fails ('CSM_cascades' index out of range) and was left on that program
    if (!routeQ.length) {
      if (++routeScan < 60 || (tier.ibl && !scene.environment)) return; routeScan = 0; // a rescan every 60 frames picks up new meshes
      routeLit = litFor(tier); routeKey = variantOf(tier); const seen = new Set<string>();
      scene.traverse(o => { const k = routeSig(o); if (k && !seen.has(k[1]) && k[0].some(m => !routed.get(m)?.has(k[2]))) { seen.add(k[1]); routeQ.push(o); } });
      return;
    }
    const t0 = performance.now(), programs = () => renderer.info.programs?.length ?? 0, n0 = programs();
    while (routeQ.length && performance.now() - t0 < 2 && programs() - n0 < 2) { const o = routeQ.pop()!, k = routeSig(o); if (!o.parent || !k) continue; // gone: the next scan finds another user
      for (const m of k[0]) { let s = routed.get(m); if (!s) routed.set(m, s = new Set()); s.add(k[2]); }
      compileOne(o, false, routeLit!, routeBusy); compileOne(o, true, routeLit!, routeBusy); }
    COST.warmMs += performance.now() - t0;
  }
  /** [materials, key per material set, key per material]: what a program key depends on besides the material and the scene. */
  function routeSig(o: THREE.Object3D): [THREE.Material[], string, string] | undefined {
    const mesh = o as THREE.Mesh, mat = mesh.material, g = mesh.geometry, x = o as unknown as Record<string, unknown>; if (!mesh.isMesh || !mat || !g) return;
    const mats = Array.isArray(mat) ? mat : [mat], sig = variantOf(tier) + '|' + Object.keys(g.attributes).join() + '|' + Object.keys(g.morphAttributes).length + [x.isBatchedMesh, x.isInstancedMesh, x.isSkinnedMesh, x.instanceColor, x._colorsTexture, mesh.receiveShadow].map(b => +!!b).join('');
    return [mats, mats.map(m => m.uuid).join() + sig, sig];
  }

  // ---- image-based lighting from the sky ----------------------------------------------------------------------------
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky();
  envSky.material = rig.sky.material; envSky.scale.setScalar(100); envScene.add(envSky); // same uniforms as the visible sky
  let envRT: THREE.WebGLRenderTarget | undefined; const lastSun = new THREE.Vector3(); let lastTurb = 0, iblPending = false;
  const iblCube = slicedCube(128, 0, .1, 1000);
  // bench: pmrem.fromScene took 87 ms in one frame. Now: the sky cube is rendered one face per frame, then filtered
  // with pmrem.fromCubemap into a REUSED target (GPU-only blur, no allocation).
  function bakeIBL(sunDir: THREE.Vector3) {
    const turb = (rig.sky.material as THREE.ShaderMaterial).uniforms.turbidity.value as number, t0 = performance.now();
    if (!iblCube.busy && !iblPending && (!envRT || sunDir.angleTo(lastSun) >= .035 || Math.abs(turb - lastTurb) >= .5)) { lastSun.copy(sunDir); lastTurb = turb; iblCube.start(new THREE.Vector3()); iblPending = true; }
    if (iblPending && iblCube.step(renderer, envScene)) { iblPending = false; envRT = pmrem.fromCubemap(iblCube.rt.texture, envRT); scene.environment = envRT.texture; }
    COST.iblMs = performance.now() - t0;
  }

  // ---- GPU timing ------------------------------------------------------------------------------------------------------
  const gl = renderer.getContext() as WebGL2RenderingContext, ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2');
  const queries: WebGLQuery[] = []; let inFlight: WebGLQuery | undefined, gpuMs: number | undefined;
  function gpuBegin() { if (!ext || inFlight) return; const q = queries.pop() ?? gl.createQuery()!; gl.beginQuery(ext.TIME_ELAPSED_EXT, q); inFlight = q; }
  let pendingQ: WebGLQuery[] = [];
  function gpuEnd() { if (!ext || !inFlight) return; gl.endQuery(ext.TIME_ELAPSED_EXT); pendingQ.push(inFlight); inFlight = undefined;
    const keep: WebGLQuery[] = [];
    for (const q of pendingQ) {
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { keep.push(q); continue; }
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      queries.push(q);
    }
    pendingQ = keep; }

  // ---- apply a tier --------------------------------------------------------------------------------------------------
  function applyTier() {
    const next = applied(), shadowsChanged = !csm !== !next.shadows || next.shadows !== tier.shadows || next.pcss !== tier.pcss;
    tier = next; capRender();
    if (next.weather !== WEATHER.quality) { WEATHER.quality = next.weather; initWeather(); } // [note] resets the near grid to climatology
    renderer.setPixelRatio(Math.min(baseRatio, 1.5) * next.resScale);
    if (shadowsChanged || !csm && next.shadows) buildShadows();
  }
  buildShadows(); applyTier();
  let lastFrame = performance.now(), appliedKey = '';
  return {
    COST, INFO, renderer, get tier() { return tier; }, get gpuMs() { return gpuMs; },
    /** Background compiles still queued or linking (pending world variant + both post routes): 0 = none (the ?bench waits for it). */
    get compiling() { return (warm ? warm.queue.length + warm.busy.length : 0) + routeQ.length + routeBusy.length; },
    /** Before rendering: sun/IBL/shadows follow the sky; returns the render scale to use. */
    before(sunDir: THREE.Vector3, time: number) {
      const key = JSON.stringify(applied()); if (key !== appliedKey) { appliedKey = key; applyTier(); }
      if (!renderer.info.autoReset) renderer.info.reset();
      gpuBegin();
      const sl = rig.sunLight;
      SUN_UNIFORMS.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse); SUN_UNIFORMS.uSunCol.value.copy(sl.color).multiplyScalar(sl.intensity / 3);
      if (tier.ibl) { if (!scene.environment && envRT) scene.environment = envRT.texture; bakeIBL(sunDir); scene.environmentIntensity = AMBIENT.env; rig.hemi.intensity *= AMBIENT.hemiIbl; } // core/light AMBIENT: sky diffuse fraction
      else if (scene.environment) scene.environment = null; // (this else sat inside the comment above: Very low/Minimum kept the env map)
      const pend = pendingWorld(); // the world tier waiting out its hold: compile its variants now (late pass at 3/4 of the hold for new meshes)
      if (pend && variantOf(pend) !== variantOf(tier)) { if (warm?.key !== variantOf(pend)) precompile(pend); else if (!warm.late && GOVERNOR.heldMs > GOVERNOR.worldHoldMs * .75) { warm.late = true; precompile(pend); } }
      else if (warm && warm.key === variantOf(tier)) release(); // switched: the live materials hold the programs (once drawn)
      stepWarm(3); stepRoutes(); reap();
      if (tier.gi) captureGI(time); else probe.intensity = 0;
      CLOUD.uSunWorld.value.copy(sunDir); updateClouds(time);
      if (csm) {
        const t0 = performance.now();
        setupMaterials(); // every frame (flag checks only): a new mesh gets its CSM defines before its first draw; the old 1 s poll compiled each new material twice
        csm.lightDirection.copy(sunDir).negate();
        for (const l of csm.lights) { l.color.copy(sl.color); l.intensity = sl.intensity; }
        sl.intensity = 0; // CSM's lights replace the sky's sun light
        camera.updateMatrixWorld(); csm.update(); shadowFrame++;
        for (let i = 1; i < csm.lights.length; i++) if ((shadowFrame + i) % FAR_CASCADE_EVERY === 0) csm.lights[i].shadow.needsUpdate = true;
        COST.csmMs = performance.now() - t0;
      }
    },
    /** After rendering: GPU query + governor. `workMs` = CPU time of this frame's update+render. */
    after(workMs: number) {
      INFO.calls = renderer.info.render.calls; INFO.tris = renderer.info.render.triangles; INFO.workMs = workMs;
      gpuEnd(); const now = performance.now(), frameMs = now - lastFrame; lastFrame = now;
      if (governFrame(workMs, gpuMs, frameMs)) applyTier();
    },
    get governor() { return GOVERNOR; },
    /** Startup warm-up: give every material in the scene its CSM/PCSS defines now, so renderer.compileAsync builds final programs. */
    prepare() { setupMaterials(); },
    /** Startup (behind the loading screen): prepare, then compileAsync through the render target the current tier draws into
     * (render/post: the scene renders into the composer's half-float target while GTAO/contact/rays are on, a different
     * tone-mapping/colour-space variant than the canvas a plain compileAsync assumes). */
    async compile() { setupMaterials(); const via = viaTarget(tier);
      try { await Promise.all([via, !via].map(v => compileVia(v, () => renderer.compileAsync(scene, camera)))); } catch (e) { console.warn('compileAsync', e); } },
    /** Compile tier `t`'s world variant now (startup: the governor's likely first step); kept until a world change uses or replaces it. */
    async warmUp(t: Tier, maxMs = 6000) { if (variantOf(t) === variantOf(tier)) return; precompile(t); const t0 = performance.now();
      while ((warm?.queue.length || warm?.busy.length) && performance.now() - t0 < maxMs) { stepWarm(12, 6); await new Promise(r => requestAnimationFrame(r)); } },
  };
}
export type Photoreal = ReturnType<typeof createPhotoreal>;
