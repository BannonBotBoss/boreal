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
import { GOVERNOR, applied, governFrame, tierForGpu, type Tier } from '../core/quality';
import { capRender } from '../core/renderSettings';
import { WEATHER, initWeather } from '../core/weather';
import { CLOUD, SUN_UNIFORMS, setCloudField } from './pbr';
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js';
import { DY, NX, NY, getGrid } from '../core/weather';

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
type SkyRig = { sky: Sky; sunLight: THREE.DirectionalLight; hemi: THREE.HemisphereLight };
export function createPhotoreal(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, rig: SkyRig, baseRatio: number) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  { // starting tier from the GPU (discrete GeForce/Radeon → Ultra); the governor then steps down only on missed frames
    const g = renderer.getContext(), dbg = g.getExtension('WEBGL_debug_renderer_info');
    GOVERNOR.gpu = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    if (GOVERNOR.auto) GOVERNOR.tier = Math.max(GOVERNOR.capTier, tierForGpu(GOVERNOR.gpu)); }
  let tier: Tier = applied(), csm: CSM | undefined;
  const chained = new Map<THREE.Material, THREE.Material['onBeforeCompile']>();
  const COST = { csmMs: 0, iblMs: 0, giMs: 0, cloudMs: 0 }, INFO = { calls: 0, tris: 0 };
  // ---- bounce light: an SH light probe captured around the viewer (three LightProbeGenerator, MIT; Ramamoorthi & Hanrahan 2001)
  const probe = new THREE.LightProbe(); probe.intensity = 0; scene.add(probe);
  let cubeRT = new THREE.WebGLCubeRenderTarget(32, { type: THREE.HalfFloatType }), cubeCam = new THREE.CubeCamera(.5, 200, cubeRT);
  let lastProbe = -1e9;
  function captureGI(time: number) {
    const size = tier.gi >= 2 ? 64 : 32; if (cubeRT.width !== size) { cubeRT.dispose(); cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType }); scene.remove(cubeCam); cubeCam = new THREE.CubeCamera(.5, 200, cubeRT); }
    if (time - lastProbe < (tier.gi >= 2 ? 1 : 4)) return; lastProbe = time; const t0 = performance.now();
    // bench (RTX 5060 Laptop): a full-scene 6-face capture cost 100–1600 ms CPU (thousands of draws ×6). Capture only
    // layer 1 = sky + terrain (the dominant bounce sources); trees/animals are left out.
    cubeCam.layers.set(1); for (const c of cubeCam.children) c.layers.set(1);
    cubeCam.position.copy(camera.position); const env = scene.environment; scene.environment = null; probe.visible = false;
    cubeCam.update(renderer, scene); scene.environment = env; probe.visible = true;
    void LightProbeGenerator.fromCubeRenderTarget(renderer, cubeRT).then(p => { probe.sh.copy(p.sh); probe.intensity = .6; }); // async GPU readback (r180); .6 = bounce only [game calibration]
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
    chained.clear(); csm?.remove(); csm?.dispose(); csm = undefined;
    if (!tier.shadows) { rig.sunLight.castShadow = false; return; }
    csm = new CSM({ camera, parent: scene, cascades: tier.shadows, maxFar: 160, shadowMapSize: tier.shadows >= 3 ? 2048 : 1024, // ≤ 2048 (Quest budget)
      lightDirection: new THREE.Vector3(0, -1, 0), lightIntensity: 0, mode: 'practical', shadowBias: -.0004 });
    csm.fade = true;
  }
  function setupMaterials() {
    if (!csm) return;
    scene.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      if (!mesh.userData.shadowSet) { mesh.userData.shadowSet = true; mesh.receiveShadow = true; mesh.castShadow = !/terrain/.test(mesh.userData.inspect?.type ?? '') && !(mesh.geometry?.type === 'PlaneGeometry'); }
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (chained.has(m) || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        const prev = m.onBeforeCompile; chained.set(m, prev); csm!.setupMaterial(m); if (tier.pcss) ((m as unknown as { defines: Record<string, unknown> }).defines ??= {}).PCSS = ''; const theirs = m.onBeforeCompile;
        m.onBeforeCompile = (s, r) => { prev.call(m, s, r); theirs.call(m, s, r); }; m.needsUpdate = true; // chain, don't replace
      }
    });
  }

  // ---- image-based lighting from the sky ----------------------------------------------------------------------------
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky();
  envSky.material = rig.sky.material; envSky.scale.setScalar(100); envScene.add(envSky); // same uniforms as the visible sky
  let envRT: THREE.WebGLRenderTarget | undefined; const lastSun = new THREE.Vector3(); let lastTurb = 0;
  function bakeIBL(sunDir: THREE.Vector3) {
    const turb = (rig.sky.material as THREE.ShaderMaterial).uniforms.turbidity.value as number;
    if (envRT && sunDir.angleTo(lastSun) < .035 && Math.abs(turb - lastTurb) < .5) return; // re-bake when the sun moves 2° or haze changes
    const t0 = performance.now(); lastSun.copy(sunDir); lastTurb = turb;
    const next = pmrem.fromScene(envScene, 0, .1, 1000); envRT?.dispose(); envRT = next; scene.environment = next.texture;
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
  let lastTraverse = 0, lastFrame = performance.now(), appliedKey = '';
  return {
    COST, INFO, renderer, get tier() { return tier; }, get gpuMs() { return gpuMs; },
    /** Before rendering: sun/IBL/shadows follow the sky; returns the render scale to use. */
    before(sunDir: THREE.Vector3, time: number) {
      const key = JSON.stringify(applied()); if (key !== appliedKey) { appliedKey = key; applyTier(); }
      if (!renderer.info.autoReset) renderer.info.reset();
      gpuBegin();
      const sl = rig.sunLight;
      SUN_UNIFORMS.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse); SUN_UNIFORMS.uSunCol.value.copy(sl.color).multiplyScalar(sl.intensity / 3);
      if (tier.ibl) { bakeIBL(sunDir); rig.hemi.intensity *= .35; } else if (scene.environment) { scene.environment = null; }
      if (tier.gi) captureGI(time); else probe.intensity = 0;
      CLOUD.uSunWorld.value.copy(sunDir); updateClouds(time);
      if (csm) {
        const t0 = performance.now();
        if (time - lastTraverse > 1) { lastTraverse = time; setupMaterials(); }
        csm.lightDirection.copy(sunDir).negate();
        for (const l of csm.lights) { l.color.copy(sl.color); l.intensity = sl.intensity; }
        sl.intensity = 0; // CSM's lights replace the sky's sun light
        camera.updateMatrixWorld(); csm.update(); COST.csmMs = performance.now() - t0;
      }
    },
    /** After rendering: GPU query + governor. `workMs` = CPU time of this frame's update+render. */
    after(workMs: number) {
      INFO.calls = renderer.info.render.calls; INFO.tris = renderer.info.render.triangles;
      gpuEnd(); const now = performance.now(), frameMs = now - lastFrame; lastFrame = now;
      if (governFrame(workMs, gpuMs, frameMs)) applyTier();
    },
    get governor() { return GOVERNOR; },
  };
}
export type Photoreal = ReturnType<typeof createPhotoreal>;
