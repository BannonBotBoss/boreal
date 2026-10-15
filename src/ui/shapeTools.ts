/**
 * Direct-manipulation inputs for the appearance editor (Grok Bot). They are only other ways to write the SAME bounded,
 * logged genome edits: 3D drag handles (mouse/touch/pen; pen pressure < .5 = fine), sketch-to-shape on the side
 * silhouette (least-squares fit), colour wheel + eyedropper, gradient stops, and region paint (marks). One gesture =
 * one record group in the edit log, so undo/redo/history/presets cover all of it.
 */
import * as THREE from 'three';
import { handleWall, fitProfile, limits, type GenomeEditor, type Genome } from '../core/genome';
import { parseCoat, normalizeCoat, COAT_LIMITS, type Coat } from '../core/coat';
import { baseProfile } from '../render/appearance';
import { wallFeedback, wallifyRanges } from './haptics';

export interface ToolHost { ed: GenomeEditor; key: string; preview(g: Genome): void; done(): void; root(): THREE.Object3D | undefined; alive(): boolean }

// ---- 3D handles ---------------------------------------------------------------------------------------------
/** Handles on the rig's bounding profile: nose -> length, back -> height, flank -> width, rump-foot -> overall size. */
const HANDLES = [
  { param: 'length', at: [0, .5, -.5], axis: [0, 0, -1], ext: 'z', label: 'snout tip: body length' },
  { param: 'height', at: [0, 1, 0], axis: [0, 1, 0], ext: 'y', label: 'shoulder/back: height' },
  { param: 'width', at: [.5, .5, 0], axis: [1, 0, 0], ext: 'x', label: 'flank: width' },
  { param: 'size', at: [0, 0, .5], axis: [0, -.5, .5], ext: 'z', label: 'rump: overall size' },
] as const;
export function createHandles(camera: THREE.Camera, canvas: HTMLCanvasElement, scene: THREE.Scene) {
  const group = new THREE.Group(); scene.add(group); let host: ToolHost | undefined;
  const dots = HANDLES.map(h => { const d = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0x4ad0ff, depthTest: false })); d.renderOrder = 1000; d.userData.h = h; group.add(d); return d; });
  const wall = new THREE.Mesh(new THREE.RingGeometry(.14, .32, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide }));
  wall.renderOrder = 1001; group.add(wall); let wallUntil = 0; // invisible until a handle hits its limit
  let drag: { h: typeof HANDLES[number]; dot: THREE.Mesh; start: number; x: number; y: number; px: number; dir: THREE.Vector2; ext: number; v: number } | undefined;
  const local = (h: typeof HANDLES[number], root: THREE.Object3D) => { const { min, size } = baseProfile(root);
    return new THREE.Vector3(min.x + size.x * (h.at[0] + .5), min.y + size.y * h.at[1], min.z + size.z * (h.at[2] + .5)).applyMatrix4(root.matrixWorld); };
  const screen = (p: THREE.Vector3) => { const v = p.clone().project(camera), r = canvas.getBoundingClientRect(); return new THREE.Vector2((v.x + 1) / 2 * r.width + r.left, (1 - v.y) / 2 * r.height + r.top); };
  canvas.addEventListener('pointerdown', e => {
    const root = host?.root(); if (!host || !root) return;
    for (const dot of dots) { const h = dot.userData.h as typeof HANDLES[number], p = local(h, root), s = screen(p);
      if (s.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > (e.pointerType === 'touch' ? 26 : 14)) continue;
      const tip = screen(p.clone().add(new THREE.Vector3(...h.axis).transformDirection(root.matrixWorld))), dir = tip.clone().sub(s);
      const { size } = baseProfile(root);
      drag = { h, dot, start: host.ed.genome[h.param] as number, x: e.clientX, y: e.clientY, px: Math.max(1, dir.length()), dir: dir.normalize(), ext: size[h.ext] * (h.param === 'size' ? 1 : .5), v: host.ed.genome[h.param] as number };
      canvas.setPointerCapture(e.pointerId); e.stopImmediatePropagation(); e.preventDefault(); return;
    }
  }, { capture: true });
  canvas.addEventListener('pointermove', e => {
    if (!drag || !host) return; e.stopImmediatePropagation();
    const along = new THREE.Vector2(e.clientX - drag.x, e.clientY - drag.y).dot(drag.dir) / drag.px; // world units along the axis
    const w = handleWall(host.ed.genome, drag.h.param, drag.start, along, drag.ext, e.pointerType === 'pen' ? e.pressure : 1); drag.v = w.value;
    if (wallFeedback.update(`handle:${drag.h.param}`, w.wall, w.push) || w.wall) { wallUntil = performance.now() + 350; wall.position.copy(drag.dot.position); wall.lookAt(camera.position); }
    host.preview({ ...host.ed.genome, [drag.h.param]: drag.v });
  }, { capture: true });
  canvas.addEventListener('pointerup', e => {
    if (!drag || !host) return; e.stopImmediatePropagation();
    wallFeedback.release(`handle:${drag.h.param}`);
    if (drag.v !== drag.start) { host.ed.setMany({ [drag.h.param]: drag.v }, 'drag'); host.done(); } drag = undefined;
  }, { capture: true });
  return {
    attach(h?: ToolHost) { host = h; },
    update() { if (host && !host.alive()) host = undefined; const root = host?.root(); group.visible = !!root; if (root) { root.updateMatrixWorld(true); dots.forEach(d => d.position.copy(local(d.userData.h, root))); }
      (wall.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (wallUntil - performance.now()) / 350) * .45; },
    get dragging() { return !!drag; },
  };
}

// ---- 2D tools: sketch, colour, gradient, paint ---------------------------------------------------------------
const W = 300, H = 150, PAD = 30;
function hsv(h: number, s: number, v: number) { const c = new THREE.Color().setHSL(h, 1, .5), w = new THREE.Color(1, 1, 1); return '#' + w.lerp(c, s).multiplyScalar(v).getHexString(); }
export function shapeTools(host: ToolHost): HTMLElement {
  const box = document.createElement('div'); box.className = 'shape-tools';
  const root = host.root(); if (!root) { box.textContent = 'Animal not loaded.'; return box; }
  const prof = baseProfile(root), g = host.ed.genome, coat: Coat = parseCoat(g.coat as string);
  const scale = Math.min((W - PAD * 2) / 1.4, (H - PAD) / 1.4);
  const toPx = ([x, y]: [number, number]) => [W / 2 - x * scale, H / 2 - y * scale]; // nose (+x) drawn to the left
  const fromPx = (px: number, py: number): [number, number] => [(W / 2 - px) / scale, (H / 2 - py) / scale];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'profile'; cv.style.touchAction = 'none';
  const ctx = cv.getContext('2d')!;
  let tool: 'sketch' | 'paint' = 'sketch', stroke: [number, number][] = [], fit: ReturnType<typeof fitProfile> | undefined;
  let color = '#6b4a2f', alpha = .8, brush = .08, stopSel = -1;
  function draw() {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0006'; ctx.fillRect(0, 0, W, H);
    const L = (fit?.length ?? g.length) as number, Hh = (fit?.height ?? g.height) as number;
    ctx.fillStyle = '#cfe8d8'; for (const [x, y] of prof.side) { const [px, py] = toPx([x * L, y * Hh]); ctx.fillRect(px - 1, py - 1, 2, 2); }
    for (const m of coat.marks) { const [px, py] = toPx([m.u - .5, m.v - .5]); ctx.fillStyle = m.color; ctx.globalAlpha = m.a; ctx.beginPath(); ctx.arc(px, py, m.r * scale, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = '#ffb070'; ctx.lineWidth = 2; ctx.beginPath(); stroke.forEach(p => { const [px, py] = toPx(p); ctx.lineTo(px, py); }); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '10px system-ui'; ctx.fillText(tool === 'sketch' ? 'draw the back / belly / head line' : 'paint markings (region marks)', 6, 12);
    if (fit) ctx.fillText(`fit: length ${fit.length.toFixed(2)} height ${fit.height.toFixed(2)} (rms ${Math.sqrt(fit.error).toFixed(3)})`, 6, H - 6);
  }
  let painting = false; const paintMarks: Coat['marks'] = [];
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); painting = true; stroke = []; fit = undefined; cv.onpointermove!(e); };
  cv.onpointermove = e => { if (!painting) return; const r = cv.getBoundingClientRect(), p = fromPx((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
    if (tool === 'sketch') stroke.push(p);
    else { const pr = e.pointerType === 'pen' ? Math.max(.2, e.pressure) : 1; const m = { u: p[0] + .5, v: p[1] + .5, r: brush * pr, color, a: alpha };
      const last = paintMarks.at(-1); if (!last || Math.hypot(last.u - m.u, last.v - m.v) > m.r * .8) { paintMarks.push(m); coat.marks.push(m); host.preview({ ...host.ed.genome, coat: normalizeCoat(coat) }); } }
    draw(); };
  cv.onpointerup = () => { painting = false;
    if (tool === 'sketch' && stroke.length > 3) { fit = fitProfile(host.ed.genome, stroke, prof.side);
      const atWall = [['length', fit.length], ['height', fit.height]].some(([id, v]) => limits({ ...host.ed.genome, length: fit!.length }, id as string).includes(v as number));
      wallFeedback.update('sketch', atWall); wallFeedback.release('sketch'); cv.classList.toggle('at-wall', atWall); host.preview({ ...host.ed.genome, length: fit.length, height: fit.height }); acceptRow.hidden = false; }
    if (tool === 'paint' && paintMarks.length) { host.ed.setMany({ coat: normalizeCoat(coat) }, 'paint'); host.done(); }
    draw(); };
  const btn = (t: string, fn: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = fn; return b; };
  const acceptRow = document.createElement('div'); acceptRow.hidden = true;
  acceptRow.append(btn('Accept fit', () => { if (fit) host.ed.setMany({ length: fit.length, height: fit.height }, 'sketch'); host.done(); }), btn('Discard', () => { fit = undefined; stroke = []; acceptRow.hidden = true; host.preview(host.ed.genome); draw(); }));
  const modes = document.createElement('div'); modes.className = 'bar';
  modes.append(btn('Sketch shape', () => { tool = 'sketch'; draw(); }), btn('Paint markings', () => { tool = 'paint'; draw(); }),
    btn('Clear markings', () => { host.ed.setMany({ coat: normalizeCoat({ ...coat, marks: [] }) }, 'paint'); host.done(); }));
  // colour wheel (hue x saturation disc) + value + alpha + eyedropper
  const wheel = document.createElement('canvas'); wheel.width = wheel.height = 96; wheel.className = 'wheel'; const wc = wheel.getContext('2d')!;
  let hue = 0, sat = 0, val = 1;
  const img = wc.createImageData(96, 96);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const dx = x - 48, dy = y - 48, r = Math.hypot(dx, dy) / 48; if (r > 1) continue;
    const c = new THREE.Color(hsv((Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1, r, 1)); img.data.set([c.r * 255, c.g * 255, c.b * 255, 255], (y * 96 + x) * 4); }
  wc.putImageData(img, 0, 0);
  const swatch = document.createElement('span'); swatch.className = 'swatch';
  const setColor = (c: string) => { color = c; swatch.style.background = c; if (stopSel >= 0) { coat.stops[stopSel].color = c; coat.stops[stopSel].a = alpha; host.preview({ ...host.ed.genome, coat: normalizeCoat(coat) }); } };
  const pickWheel = (e: PointerEvent) => { const r = wheel.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width * 96 - 48, dy = (e.clientY - r.top) / r.height * 96 - 48;
    hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1; sat = Math.min(1, Math.hypot(dx, dy) / 48); setColor(hsv(hue, sat, val)); };
  wheel.onpointerdown = e => { wheel.setPointerCapture(e.pointerId); pickWheel(e); }; wheel.onpointermove = e => { if (e.buttons) pickWheel(e); };
  wheel.onpointerup = () => commitStops();
  const range = (label: string, v: number, fn: (x: number) => void) => { const l = document.createElement('label'), i = document.createElement('input'); i.type = 'range'; i.min = '0'; i.max = '1'; i.step = '.01'; i.value = String(v);
    i.oninput = () => fn(Number(i.value)); i.onchange = () => commitStops(); l.append(label, i); return l; };
  const commitStops = () => { if (stopSel >= 0) { host.ed.setMany({ coat: normalizeCoat(coat) }, 'set'); host.done(); } };
  const eye = btn('Eyedropper', async () => { const ED = (globalThis as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) { eye.textContent = 'Eyedropper: not supported in this browser'; return; } try { setColor((await new ED().open()).sRGBHex); commitStops(); } catch { /* cancelled */ } });
  // gradient stops
  const grad = document.createElement('div'); grad.className = 'gradient';
  const modeSel = document.createElement('select'); for (const m of ['length', 'height', 'radial']) modeSel.add(new Option(`gradient: ${m}`, m, false, m === coat.mode));
  modeSel.onchange = () => { host.ed.setMany({ coat: normalizeCoat({ ...coat, mode: modeSel.value as Coat['mode'] }) }); host.done(); };
  const strip = document.createElement('div'); strip.className = 'strip';
  strip.style.background = coat.stops.length ? `linear-gradient(90deg, ${coat.stops.map(s => `${s.color} ${s.t * 100}%`).join(',')})` : '#555';
  coat.stops.forEach((s, i) => { const m = btn('', () => { stopSel = i; color = s.color; alpha = s.a; swatch.style.background = s.color; }); m.className = 'stop'; m.style.left = `${s.t * 100}%`; m.style.background = s.color; m.title = `stop ${i}: ${s.color} @ ${s.t}`; strip.append(m); });
  const stopT = range('stop position', coat.stops[0]?.t ?? 0, x => { if (stopSel >= 0) { coat.stops[stopSel].t = x; host.preview({ ...host.ed.genome, coat: normalizeCoat(coat) }); } });
  grad.append(modeSel, strip, stopT, btn('+ stop', () => { if (coat.stops.length < COAT_LIMITS.stops) { coat.stops.push({ t: coat.stops.length ? 1 : 0, color, a: alpha }); host.ed.setMany({ coat: normalizeCoat(coat) }); host.done(); } }),
    btn('− stop', () => { if (stopSel >= 0) { coat.stops.splice(stopSel, 1); host.ed.setMany({ coat: normalizeCoat(coat) }); host.done(); } }));
  const colours = document.createElement('div'); colours.className = 'bar';
  colours.append(wheel, swatch, range('value', val, x => { val = x; setColor(hsv(hue, sat, val)); }), range('alpha / strength', alpha, x => { alpha = x; setColor(color); }), range('brush size', brush / .4, x => { brush = Math.max(.02, x * .4); }), eye);
  setColor(color); draw();
  const hint = document.createElement('p'); hint.className = 'note'; hint.title = 'Haptics: gamepads, Quest controllers and phones vibrate at a limit. Mouse and pen have no web haptics API, so desktop gets the sound + the flashing wall instead.';
  hint.textContent = 'Blue dots on the animal are drag handles (pen: light pressure = fine). Pick a gradient stop, then the wheel colours it.';
  box.append(modes, cv, acceptRow, colours, grad, hint); wallifyRanges(box, wallFeedback);
  return box;
}
