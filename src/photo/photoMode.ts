/**
 * Photo mode (Grok Bot): frozen world, free-fly camera, rewind timeline, photographic post settings, and one capture path
 * for stills, sequences and video. The world's state comes and goes only through the shared snapshot hub (core/snapshot.ts).
 */
import { haptic } from '../ui/haptics';
import { heightAt } from '../core/world';
import { clamp } from '../proc/math';
import type { SnapshotHub, Snapshot } from '../core/snapshot';
import type { buildScene, PhotoView } from '../render/buildScene';
import { PHOTO_PARAMS, PRESETS, defaultSettings, type PhotoSettings } from '../render/post';
import { ASPECTS, RESOLUTIONS, clampVideo, cropRect, fitOutput } from './frame';
import { createGallery, type Capture, type ExportOptions, type Frame } from './gallery';

type View = ReturnType<typeof buildScene>;
const STORE = 'boreal.photo.v1';
const mmToFov = (mm: number) => 2 * Math.atan(12 / mm) * 180 / Math.PI; // 36×24 mm frame, vertical FOV
const fovToMm = (fov: number) => 12 / Math.tan(fov * Math.PI / 360);

export interface PhotoHost { view: View; hub: SnapshotHub; simTime(): number; onExit(): void; notice(text: string): void; /** redraw the world for a given frozen view */ draw(v: PhotoView): void }

export function createPhotoMode(host: PhotoHost) {
  const { view, hub } = host, canvas = view.canvas;
  let active = false, live: Snapshot | undefined, index = -1, playing = false, playAcc = 0, hour: number | undefined;
  let liveRun = false, reviewing = false; // a live sequence lets the world run (no player input) while frames are captured
  const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 48 };
  const keys = new Set<string>();
  let settings: PhotoSettings = defaultSettings();
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') }; } catch { /* keep defaults */ }
  const save = () => { if (editing) { view.post.set(settings); return; } // edits stay on the capture, not the saved defaults
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* storage blocked */ } view.post.set(settings); };
  view.post.set(settings);
  const capture = { aspect: 'Screen', count: 24, intervalMs: 100, source: 'rewind' as 'rewind' | 'live' };

  // ---------- DOM (all of it is outside the canvas, so it never appears in captures) ----------
  const root = document.createElement('div'); root.id = 'photo'; root.hidden = true;
  root.innerHTML = `<div id="photo-crop"><div id="photo-grid"></div></div>
  <div id="photo-hints">PHOTO MODE · WASD fly · drag look · Q/E or Space/Ctrl down/up · Shift fast · wheel zoom · click focus · , . step · K play · L live · F photo · R video · B sequence · H panel · P/Esc exit</div>
  <div id="photo-bar"><button data-a="back">◀</button><button data-a="play">▶</button><button data-a="fwd">▶|</button>
    <input id="photo-time" type="range" min="0" max="0" value="0"><span id="photo-when">live</span><button data-a="live">Live</button>
    <button data-a="shot">Photo</button><button data-a="rec">Record</button><button data-a="seq">Sequence</button></div>
  <div id="photo-edit"><button data-a="save">Save edit</button><button data-a="cancel">Cancel</button></div>
  <form id="photo-panel"></form>`;
  document.body.append(root);
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const panel = $<HTMLFormElement>('#photo-panel'), time = $<HTMLInputElement>('#photo-time'), when = $('#photo-when');
  const select = (label: string, options: string[], value: string, on: (v: string) => void) => {
    const l = document.createElement('label'); l.textContent = label; const s = document.createElement('select');
    for (const o of options) s.add(new Option(o, o, false, o === value)); s.onchange = () => on(s.value); l.append(s); return l;
  };
  const input = (label: string, value: string, on: (v: string) => void, type = 'text') => {
    const l = document.createElement('label'); l.textContent = label; const i = document.createElement('input'); i.type = type; i.value = value;
    i.onchange = () => on(i.value); l.append(i); return l;
  };
  function buildPanel() {
    panel.replaceChildren();
    const section = (title: string) => { const h = document.createElement('h3'); h.textContent = title; panel.append(h); };
    section('Look');
    panel.append(select('Preset', Object.keys(PRESETS), 'None', v => { settings = { ...defaultSettings(), focalLength: settings.focalLength, ...PRESETS[v] }; save(); buildPanel(); }));
    let group = '';
    for (const p of PHOTO_PARAMS) {
      if (p.group !== group) section(group = p.group);
      const l = document.createElement('label'); l.textContent = p.label; const i = document.createElement('input');
      Object.assign(i, { type: 'range', min: String(p.min), max: String(p.max), step: String(p.step), value: String(settings[p.key]) }); i.dataset.key = p.key;
      i.oninput = () => { settings[p.key] = Number(i.value); if (p.key === 'focus') settings.autofocus = 0; save(); syncPanel(); };
      l.append(i); panel.append(l);
    }
    section('Sun');
    const sun = document.createElement('label'); sun.textContent = 'Sun hour (frozen view only)'; const si = document.createElement('input');
    Object.assign(si, { type: 'range', min: '0', max: '24', step: '0.05', value: String(hour ?? 12) }); si.oninput = () => { hour = Number(si.value); };
    sun.append(si); panel.append(sun);
    const follow = document.createElement('button'); follow.type = 'button'; follow.textContent = 'Sun follows clock'; follow.onclick = () => { hour = undefined; }; panel.append(follow);
    section('Framing');
    panel.append(select('Aspect / crop', Object.keys(ASPECTS), capture.aspect, v => { capture.aspect = v; layoutCrop(); }));
    const note = document.createElement('p'); note.textContent = 'Resolution and format are chosen when the session ends. Video records the crop at screen size, capped at 1080p for smooth recording.'; panel.append(note);
    section('Sequence');
    panel.append(input('Shots', String(capture.count), v => { capture.count = clamp(Math.round(Number(v)) || 1, 1, 600); }, 'number'));
    panel.append(input('Interval (ms of sim time)', String(capture.intervalMs), v => { capture.intervalMs = Math.max(100, Number(v) || 100); }, 'number'));
    panel.append(select('Source', ['rewind', 'live'], capture.source, v => { capture.source = v as 'rewind' | 'live'; }));
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset all settings';
    reset.onclick = () => { settings = defaultSettings(); hour = undefined; save(); buildPanel(); }; panel.append(reset);
    syncPanel();
  }
  function syncPanel() {
    panel.querySelectorAll<HTMLInputElement>('input[data-key]').forEach(i => { if (document.activeElement !== i) i.value = String(settings[i.dataset.key!]); });
    $('#photo-grid').hidden = !settings.grid;
  }
  const crop = () => cropFor(capture.aspect);
  function layoutCrop() {
    const c = crop(), el = $('#photo-crop');
    Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' });
    el.classList.toggle('framed', !!ASPECTS[capture.aspect]);
  }
  const cropFor = (aspect: string) => cropRect(canvas.clientWidth, canvas.clientHeight, ASPECTS[aspect] ?? null);
  addEventListener('resize', () => active && layoutCrop());

  // ---------- timeline ----------
  function show(i: number) {
    index = i; haptic('scrub');
    if (i < 0 || !hub.ring.size) { index = -1; if (live) hub.restore(live); }
    else hub.restore(hub.ring.at(clamp(i, 0, hub.ring.size - 1))!);
    time.max = String(hub.ring.size); time.value = String(index < 0 ? hub.ring.size : index);
    const back = index < 0 ? 0 : (live!.time - hub.ring.at(index)!.time);
    when.textContent = index < 0 ? 'live' : `−${back.toFixed(1)} s`;
  }
  time.oninput = () => { const v = Number(time.value); playing = false; show(v >= hub.ring.size ? -1 : v); };
  const step = (d: number) => { playing = false; const cur = index < 0 ? hub.ring.size : index; const n = cur + d; show(n >= hub.ring.size ? -1 : Math.max(0, n)); };

  // ---------- capture: everything is stored as a recipe in the session gallery; pixels are made at export ----------
  const viewNow = (): PhotoView => ({ cam: { ...cam, fov: settings.focalLength ? mmToFov(settings.focalLength) : cam.fov }, hour, focalMm: settings.focalLength || fovToMm(cam.fov), frozen: !liveRun });
  /** The one render path: restore a frame's world + camera + post settings, draw it, read it back at the requested size. */
  async function renderFrame(c: Capture, f: Frame, o: ExportOptions) {
    const aspect = o.aspect === 'As shot' ? c.aspect : o.aspect, cr = cropFor(aspect);
    const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(o.custom.trim());
    const { w, h } = fitOutput(cr, RESOLUTIONS[o.resolution] ?? null, Math.min(devicePixelRatio, 1.5), m ? [Number(m[1]), Number(m[2])] : undefined);
    view.post.set(c.settings); hub.restore(f.snap); host.draw(f.view);
    const blob = await view.capture(cr, w, h, f.view, o.format === 'jpeg' ? 'image/jpeg' : 'image/png', o.quality);
    view.post.set(settings); return blob;
  }
  const frameNow = (): Frame => ({ snap: hub.capture(host.simTime()), view: viewNow() });
  /** Thumbnails come from the same render path (a 240 px wide re-render of the first frame). */
  async function thumbFor(c: Pick<Capture, 'frames' | 'settings' | 'aspect'>) {
    const cr = cropFor(c.aspect), b = await renderFrame(c as Capture, c.frames[0], { resolution: 'Native', aspect: 'As shot', custom: `240x${Math.round(240 * cr.h / cr.w)}`, format: 'jpeg', quality: .7, zip: false });
    if (live && index < 0) hub.restore(live); else if (index >= 0) show(index); // put the viewed moment back
    return b ? URL.createObjectURL(b) : '';
  }
  async function add(kind: Capture['kind'], frames: Frame[], video?: Capture['video'], thumb?: string) {
    const rec = { kind, frames, settings: { ...settings }, aspect: capture.aspect, video };
    haptic('shutter'); const n = gallery.add({ ...rec, thumb: thumb ?? await thumbFor(rec) });
    host.notice(`${kind === 'photo' ? 'Photo' : kind === 'video' ? 'Video' : 'Sequence'} kept (${n} this session). Choose size and export when you leave photo mode.`);
  }
  /** Edit = the same camera panel + post stack on a stored capture; Save writes back (original kept for Revert). */
  let editing: { c: Capture; done: () => void; keep: { settings: PhotoSettings; aspect: string; hour: number | undefined } } | undefined;
  function edit(c: Capture) {
    return new Promise<void>(done => {
      editing = { c, done, keep: { settings, aspect: capture.aspect, hour } };
      const v = c.frames[0].view; hub.restore(c.frames[0].snap);
      Object.assign(cam, v.cam); hour = v.hour; settings = { ...c.settings }; capture.aspect = c.aspect; view.post.set(settings);
      root.classList.add('editing'); root.hidden = false; reviewing = false; buildPanel(); layoutCrop();
      host.notice('Editing: fly/zoom, change any setting, roll = straighten, aspect = crop. Save or Cancel below.');
    });
  }
  function endEdit(save: boolean) {
    const e = editing!; editing = undefined;
    if (save) {
      e.c.original ??= { settings: e.c.settings, aspect: e.c.aspect, views: e.c.frames.map(f => f.view) };
      const v = viewNow(); e.c.settings = { ...settings }; e.c.aspect = capture.aspect; e.c.frames.forEach(f => { f.view = { ...v, cam: { ...v.cam } }; });
    }
    settings = e.keep.settings; capture.aspect = e.keep.aspect; hour = e.keep.hour; view.post.set(settings);
    root.classList.remove('editing'); root.hidden = true; reviewing = true; e.done();
  }
  const gallery = createGallery({ render: renderFrame, edit, thumb: c => thumbFor(c) }, host.notice);
  let recorder: MediaRecorder | undefined;
  async function record() {
    if (recorder) { recorder.stop(); return; }
    if (!('MediaRecorder' in window) || !canvas.captureStream) { host.notice('Video capture is not supported in this browser.'); return; }
    const c = crop(), o = clampVideo(c.w * Math.min(devicePixelRatio, 1.5), c.h * Math.min(devicePixelRatio, 1.5)), thumb = await thumbFor({ frames: [frameNow()], settings: { ...settings }, aspect: capture.aspect });
    view.setOutput({ crop: c, w: o.w, h: o.h }); canvas.style.objectFit = 'contain';
    const chunks: Blob[] = [], type = ['video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(canvas.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 16e6 } : undefined);
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => { recorder = undefined; view.setOutput(undefined); canvas.style.objectFit = ''; root.classList.remove('recording');
      void add('video', [], { blob: new Blob(chunks, { type: 'video/webm' }), w: o.w, h: o.h }, thumb); };
    recorder.start(); root.classList.add('recording');
    host.notice(`Recording ${o.w}×${o.h}${o.clamped ? ' (capped at 1080p for smooth video)' : ''}. Press R to stop.`);
  }
  let seq: { frames: Frame[]; next: number } | undefined;
  function sequence() {
    if (seq) { host.notice('Sequence already running.'); return; }
    if (capture.source === 'rewind' && !hub.ring.size) { host.notice('Nothing recorded yet to play back.'); return; }
    seq = { frames: [], next: host.simTime() }; playing = false;
    if (capture.source === 'live') { show(-1); liveRun = true; } else if (index < 0) show(0);
  }
  function sequenceStep() {
    const s = seq!; s.frames.push(frameNow());
    let done = s.frames.length >= capture.count;
    if (capture.source === 'rewind') { const n = index + Math.max(1, Math.round(capture.intervalMs / 100)); if (n >= hub.ring.size) done = true; else show(n); }
    else s.next += capture.intervalMs / 1000;
    if (done) {
      seq = undefined;
      if (liveRun) { liveRun = false; live = hub.capture(host.simTime()); index = -1; } // the world really moved on
      void add('sequence', s.frames);
    }
  }
  const shot = () => void add('photo', [frameNow()]);

  // ---------- input ----------
  root.addEventListener('click', e => {
    const a = (e.target as HTMLElement).dataset?.a; if (!a) return;
    ({ back: () => step(-1), fwd: () => step(1), play: () => { playing = !playing; if (index < 0 && playing) show(0); }, live: () => { playing = false; show(-1); },
      shot, rec: () => void record(), save: () => endEdit(true), cancel: () => endEdit(false), seq: sequence } as Record<string, () => void>)[a]?.();
    (e.target as HTMLElement).blur();
  });
  const typing = (t: EventTarget | null) => t instanceof HTMLElement && t.matches('input:not([type=range]),select,textarea');
  addEventListener('keydown', e => {
    if (!active || reviewing || typing(e.target)) return;
    const k = e.key.toLowerCase(); keys.add(k);
    if ([' ', 'control'].includes(k)) e.preventDefault();
    if (e.repeat || editing) return; // while editing only the camera keys apply
    if (k === ',') step(-1); else if (k === '.') step(1); else if (k === 'k') { playing = !playing; if (index < 0 && playing) show(0); }
    else if (k === 'l') { playing = false; show(-1); } else if (k === 'f') shot(); else if (k === 'r') void record(); else if (k === 'b') sequence();
    else if (k === 'h') panel.hidden = !panel.hidden;
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  let drag: { x: number; y: number; moved: number } | undefined;
  canvas.addEventListener('pointerdown', e => { if (active) { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', e => {
    if (!active || !drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    const s = cam.fov / 48 * .004; cam.yaw -= dx * s; cam.pitch = clamp(cam.pitch - dy * s, -1.55, 1.55);
  });
  canvas.addEventListener('pointerup', e => {
    if (!active || !drag) return;
    if (drag.moved < 4 && settings.dof) { // click to focus
      const r = canvas.getBoundingClientRect(), d = view.distanceAt((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      if (d) { settings.focus = d; settings.autofocus = 0; save(); syncPanel(); }
    }
    drag = undefined;
  });
  canvas.addEventListener('wheel', e => {
    if (!active) return; e.preventDefault();
    const mm = clamp((settings.focalLength || fovToMm(cam.fov)) * Math.exp(-e.deltaY * .001), 12, 200);
    settings.focalLength = Math.round(mm); save(); syncPanel();
  }, { passive: false });

  return {
    get active() { return active; },
    get reviewing() { return reviewing; },
    /** True while a live sequence runs: main keeps simulating (no player input) and still renders through photo mode. */
    get simulating() { return liveRun; },
    enter() {
      if (active) return; active = true; root.hidden = false; buildPanel(); layoutCrop();
      live = hub.capture(host.simTime()); index = -1; show(-1); hour = undefined;
      const c = view.camera; cam.x = c.position.x; cam.y = c.position.y; cam.z = c.position.z;
      cam.yaw = Math.atan2(-c.getWorldDirection(c.position.clone()).x, -c.getWorldDirection(c.position.clone()).z);
      cam.pitch = Math.asin(clamp(c.getWorldDirection(c.position.clone()).y, -1, 1)); cam.roll = 0; cam.fov = c.fov;
    },
    async exit() {
      if (!active || reviewing || editing) return; if (recorder) recorder.stop(); if (seq) { seq = undefined; liveRun = false; }
      playing = false; keys.clear();
      if (gallery.count) { reviewing = true; root.hidden = true; await new Promise(r => setTimeout(r, 50)); await gallery.review(); reviewing = false; }
      active = false; playing = false; root.hidden = true; keys.clear();
      if (live) hub.restore(live); live = undefined; index = -1; host.onExit();
    },
    /** Per frame: fly the camera, advance playback/sequence; returns the frozen view to draw. */
    update(dt: number): PhotoView {
      const speed = (keys.has('shift') ? 25 : 6) * dt, f = Number(keys.has('w')) - Number(keys.has('s')), r = Number(keys.has('d')) - Number(keys.has('a'));
      const u = Number(keys.has('e') || keys.has(' ')) - Number(keys.has('q') || keys.has('control'));
      const cp = Math.cos(cam.pitch);
      cam.x += (-Math.sin(cam.yaw) * cp * f + Math.cos(cam.yaw) * r) * speed;
      cam.z += (-Math.cos(cam.yaw) * cp * f - Math.sin(cam.yaw) * r) * speed;
      cam.y += (Math.sin(cam.pitch) * f + u) * speed;
      cam.y = Math.max(cam.y, Math.max(heightAt(cam.x, cam.z), -.25) + .3);
      cam.roll = settings.roll * Math.PI / 180;
      if (playing && !seq) { playAcc += dt; while (playAcc >= .1) { playAcc -= .1; if (index >= 0 && index < hub.ring.size - 1) show(index + 1); else { playing = false; break; } } } else playAcc = 0;
      if (seq && (capture.source === 'rewind' || host.simTime() >= seq.next)) sequenceStep();
      if (settings.dof && settings.autofocus) { const d = view.distanceAt(0, 0); if (d) settings.focus += (d - settings.focus) * Math.min(1, dt * 6); }
      return viewNow();
    },
  };
}
