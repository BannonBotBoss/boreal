/** The viewfinder (T-0068): every view IS the camera. One rendering path: this wraps renderer.render once, so exposure and
 *  filter are applied to the frame that goes to the screen, and the shutter grabs exactly that frame (no UI: the panel is
 *  DOM, not canvas). Mount once per view: mountViewfinder(renderer, 'game' | 'globe' | 'sun', opts).
 *  Exposure: auto = the view's own physical adaptation (render/sky gain, globe, sunView meter). Manual = Frostbite EV100
 *  from N/t/ISO relative to the views' calibration point (core/light LUX.ref = 1e5 lux clear-day sun ~ EV100 15), minus ND
 *  stops and the filter's light loss. Filters (camera/filters.ts) are linear 3x3 on scene-linear light before tone mapping
 *  when the view draws straight to the screen; when a post chain already tone-mapped the frame, the same matrix is applied to
 *  the decoded (sRGB -> linear) display image. Photos: PNG with tEXt metadata, optional linear EXR (three EXRExporter, MIT). */
import * as THREE from 'three';
import { EXRExporter } from 'three/examples/jsm/exporters/EXRExporter.js';
import { mountCameraPanel, stateFromSearch, type CameraPanelState, type FilterOption } from '../ui/cameraPanel';
import { FILTERS, filter, filterStops, reaches, type FilterId } from './filters';
import { addTextChunks } from './png';
import { addPhoto, type PhotoMeta } from '../photo/store';
import { sharedGallery } from '../photo/gallery';
import { ev100FromSettings, fovFromFocal } from '../render/exposure';

export const EV_CALIB = 15; // EV100 at which the views' auto exposure sits for full daylight (sunny-16 rule, LUX.ref)
export interface ViewfinderOpts { filters?: FilterOption[]; meta?: () => Partial<PhotoMeta>; aboveAir?: () => boolean; focal?: boolean; ownsExposure?: boolean; autoEV?: () => number; search?: string; readout?: () => string }
const FRAG = /* glsl */`uniform sampler2D tSrc; uniform mat3 uM; uniform float uDecode; varying vec2 vUv;
vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 enc(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; if (uDecode > .5) { gl_FragColor = vec4(enc(clamp(uM * dec(c), 0., 1.)), 1.); return; }
  gl_FragColor = vec4(uM * c, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let active: Viewfinder | null = null;
/** the most recently mounted viewfinder (the game routes its rebindable 'photo' action here) */
export const activeViewfinder = () => active;
export interface Viewfinder { state: CameraPanelState; shoot(hdr?: boolean): void; capture(hdr: boolean): Promise<number>; fov(): number }
export function mountViewfinder(renderer: THREE.WebGLRenderer, view: 'game' | 'globe' | 'sun', opts: ViewfinderOpts = {}): Viewfinder {
  const prev = (renderer as unknown as { __viewfinder?: Viewfinder }).__viewfinder; if (prev) return prev; // shared renderer (globe <-> game handoff): one viewfinder
  const search = opts.search ?? location.search;
  const filters: FilterOption[] = opts.filters ?? FILTERS.map(f => ({ id: f.id, label: f.label, disabled: !reaches(f, opts.aboveAir?.() ?? false), note: f.note }));
  const st: CameraPanelState = stateFromSearch(search, filters);
  let pending: { hdr: boolean } | null = null, inner = false, lastScene: THREE.Object3D | null = null, lastCam: THREE.Camera | null = null;
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: rt.texture }, uM: { value: new THREE.Matrix3() }, uDecode: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: FRAG, toneMapped: true });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), quadScene = new THREE.Scene(); quad.frustumCulled = false; quadScene.add(quad);
  const isFilterView = !opts.filters; // the sun viewer does its own band rendering
  const filt = () => filter(st.band as FilterId);
  /** stops by which manual settings differ from the view's auto exposure (positive = brighter) */
  const manualStops = () => st.cam.auto ? st.cam.comp : (opts.autoEV?.() ?? EV_CALIB) - ev100FromSettings(st.cam.N, st.cam.t, st.cam.S) - st.cam.nd - (isFilterView ? Math.min(20, filterStops(filt())) : 0);
  const orig = renderer.render.bind(renderer);
  renderer.render = (scene: THREE.Object3D, camera: THREE.Camera) => {
    if (inner) return orig(scene, camera);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) { lastScene = scene; lastCam = camera; }
    const toScreen = renderer.getRenderTarget() === null, f = isFilterView ? filt() : null, gain = opts.ownsExposure ? 1 : 2 ** manualStops();
    const ex = renderer.toneMappingExposure; renderer.toneMappingExposure = ex * gain;
    try {
      if (toScreen && f && f.id !== 'visible') {
        const size = renderer.getDrawingBufferSize(new THREE.Vector2()); if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
        const post = (camera as THREE.OrthographicCamera).isOrthographicCamera; // a post chain's final pass: already tone-mapped display image
        const m = f.m.slice(), y = m.reduce((s, v) => s + v, 0) / 3 || 1; const k = st.cam.auto ? 1 / y : 1 / y * 1; // normalise: auto exposure brings the light back; manual loss is in gain
        mat.uniforms.uM.value.set(...m.map(v => v * k) as [number, number, number, number, number, number, number, number, number]); mat.uniforms.uDecode.value = post ? 1 : 0; mat.toneMapped = !post;
        inner = true; renderer.setRenderTarget(rt); orig(scene, camera); renderer.setRenderTarget(null); orig(quadScene, quadCam); inner = false;
      } else orig(scene, camera);
    } finally { renderer.toneMappingExposure = ex; inner = false; }
    if (toScreen && pending) { const p = pending; pending = null; void capture(p.hdr); }
  };

  const meta = (): PhotoMeta => ({ takenWall: new Date().toISOString(), gameTime: '', view, location: '', seed: 0, ...opts.meta?.(),
    N: st.cam.N, t: st.cam.t, iso: st.cam.S, nd: st.cam.nd, focalMm: st.cam.focalMm, auto: st.cam.auto, filter: st.band,
    ev100: st.cam.auto ? (opts.autoEV?.() ?? EV_CALIB) - st.cam.comp : ev100FromSettings(st.cam.N, st.cam.t, st.cam.S) + st.cam.nd });
  async function capture(hdr: boolean) {
    const canvas = renderer.domElement, m = meta();
    // thumbnail and PNG are both read synchronously in the frame just drawn (no preserveDrawingBuffer needed)
    const th = document.createElement('canvas'); th.width = 240; th.height = Math.round(240 * canvas.height / canvas.width); th.getContext('2d')!.drawImage(canvas, 0, 0, th.width, th.height);
    const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png')); // snapshot is taken synchronously at call time
    const png = new Blob([addTextChunks(new Uint8Array(await blob.arrayBuffer()), { Software: 'Boreal', Title: `Boreal ${view} photo`, 'Boreal-Camera': JSON.stringify(m) }) as BlobPart], { type: 'image/png' });
    let exr: Blob | undefined;
    if (hdr && lastScene && lastCam) { const size = renderer.getDrawingBufferSize(new THREE.Vector2()), f = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.FloatType }), tm = renderer.toneMapping;
      inner = true; renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(f); orig(lastScene, lastCam); renderer.setRenderTarget(null); renderer.toneMapping = tm; inner = false;
      exr = new Blob([await new EXRExporter().parse(renderer, f) as BlobPart], { type: 'image/x-exr' }); f.dispose(); }
    const photo = { png, exr, thumb: th.toDataURL('image/jpeg', .8), meta: m }, id = await addPhoto(photo); sharedGallery().addShot({ ...photo, id }); flash(); return id;
  }
  const flash = () => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.5;z-index:99;pointer-events:none;transition:opacity .3s'; document.body.append(d); requestAnimationFrame(() => { d.style.opacity = '0'; }); setTimeout(() => d.remove(), 400); };
  const shoot = (hdr = new URLSearchParams(search).get('hdr') === '1') => { pending = { hdr }; };
  const panel = mountCameraPanel(st, () => {}, () => readout(), { filters, focal: opts.focal, onPhoto: () => shoot(), onGallery: () => void showGallery() });
  const readout = () => { const f = isFilterView ? filt() : null; return `${opts.readout ? opts.readout() + '\n' : ''}${view}  EV100 ${meta().ev100.toFixed(1)} ${st.cam.auto ? 'auto' : 'manual'}${f && f.id !== 'visible' ? `\n${f.label}: ${f.note}` : ''}\nP photo  Shift+P photo+EXR  ${view === 'game' ? 'G gallery  ' : ''}\` debug HUD`; };
  /** G drops on the planet (globeView, in-page globe and band): the gallery key is only live in the game proper (#211). */
  const galleryKey = () => view === 'game' && !document.body.classList.contains('on-globe');
  addEventListener('keydown', e => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey) return;
    if ((e.key === 'p' || e.key === 'P') && view !== 'game') shoot( // game: P is the rebindable 'photo' action (main.ts act)
      e.shiftKey || undefined); else if (e.key === 'g' && galleryKey()) void showGallery(); else if (e.key === '`') document.body.classList.toggle('boreal-debug'); });
  installViewfinderCss();
  setInterval(() => panel.update(), 250);
  const api = { state: st, shoot, capture, panel, fov: () => fovFromFocal(st.cam.focalMm) }; (renderer as unknown as { __viewfinder: unknown }).__viewfinder = api; active = api; return api;
}

/** Clean viewfinder: debug/diagnostic overlays are hidden unless body.boreal-debug (toggle with `). Overlays opt in with
 *  data-debug; the known diagnostic panels are listed here so their owners' files need no edit. */
function installViewfinderCss() {
  if (document.getElementById('viewfinder-css')) return; const s = document.createElement('style'); s.id = 'viewfinder-css';
  s.textContent = 'body:not(.boreal-debug) [data-debug], body:not(.boreal-debug) #inspector, body:not(.boreal-debug) #globe-hud, body:not(.boreal-debug) #fps, body:not(.boreal-debug) .debug { display:none !important }';
  document.head.append(s);
}

/** The one gallery (src/photo/gallery.ts): viewfinder shots + photo-mode captures. */
export const showGallery = () => sharedGallery().review();
