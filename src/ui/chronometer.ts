/**
 * Chronometer (Matthew): the on-screen dial that sets the time of day. T or the gamepad View button opens it (main.ts);
 * while it is open ←/→, the d-pad or the left stick scrub the hour (eased), and dragging on the dial sets it directly.
 * Sun, moon, sky, fog and light follow live: the dial only moves core/timeOfDay DAY.offset, which every hourAt reads.
 * The face is coloured from the game's own sun (lighting(sunPosition(h))), so day length shows on the dial.
 */
import { DAY, formatHour, hourAt, lighting, setHour, sunPosition } from '../core/timeOfDay';

/** Pure: dial angle (degrees clockwise from the top) for an hour: noon at the top, midnight at the bottom. */
export const dialAngle = (hour: number) => (hour - 12) * 15;
/** Pure: hour (0–24) for a point (dx right, dy down) from the dial centre. */
export const dialHour = (dx: number, dy: number) => ((12 + Math.atan2(dx, -dy) / Math.PI * 12) % 24 + 24) % 24;
/** Scrub: game hours per real second at full input, and how fast the speed eases toward it (1/s). */
export const CHRONO = { rate: 3, ease: 8 };
/** Pure: eased scrub speed (game h per real s) toward input (−1…1) × rate. */
export const scrubVelocity = (v: number, input: number, dt: number) => v + (Math.max(-1, Math.min(1, input)) * CHRONO.rate - v) * (1 - Math.exp(-CHRONO.ease * dt));

export function createChronometer(now: () => number) {
  const el = (tag: string, cls: string, text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
  const root = el('div', 'chronometer'), dial = el('div', 'chrono-dial'), hand = el('div', 'chrono-hand'), glyph = el('span', 'chrono-glyph');
  const face = el('div', 'chrono-face'), time = el('b', ''), sun = el('small', '');
  root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Chronometer');
  const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  dial.style.background = `conic-gradient(from 180deg, ${Array.from({ length: 25 }, (_, h) => { const l = lighting(sunPosition(h).elevation);
    return `rgb(${mix(mix([11, 26, 42], [150, 190, 220], l.day), [232, 160, 96], l.golden * .7).join(',')}) ${h * 15}deg`; }).join(', ')})`;
  for (let h = 0; h < 24; h++) { const t = el('span', 'chrono-tick'); t.style.transform = `rotate(${dialAngle(h)}deg)`;
    if (h % 6 === 0) { const b = el('b', '', String(h).padStart(2, '0')); b.style.transform = `rotate(${-dialAngle(h)}deg)`; t.append(b); } dial.append(t); }
  hand.append(glyph); face.append(time, sun); dial.append(hand, face);
  root.append(el('h3', '', 'Chronometer'), dial, el('p', 'chrono-hint', '← / → or stick: scrub time · drag the dial · T / B / View: close'));
  document.body.append(root);
  let open = false, vel = 0, dragId: number | undefined;
  const save = () => { try { localStorage.setItem(DAY.key, String(DAY.offset)); } catch { /* storage blocked */ } };
  function draw() { const h = hourAt(now()), e = sunPosition(h).elevation, a = dialAngle(h);
    hand.style.transform = `rotate(${a}deg)`; glyph.style.transform = `rotate(${-a}deg)`; glyph.textContent = e > 0 ? '☀' : '☾';
    time.textContent = formatHour(h); sun.textContent = e > 0 ? `sun ${e.toFixed(0)}° up` : `sun ${(-e).toFixed(0)}° down`; }
  const at = (e: PointerEvent) => { const r = dial.getBoundingClientRect(); setHour(dialHour(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2), now()); draw(); };
  dial.addEventListener('pointerdown', e => { e.preventDefault(); dragId = e.pointerId; dial.setPointerCapture(e.pointerId); at(e); });
  dial.addEventListener('pointermove', e => { if (e.pointerId === dragId) at(e); });
  for (const t of ['pointerup', 'pointercancel'] as const) dial.addEventListener(t, () => { dragId = undefined; save(); });
  function close() { if (!open) return; open = false; root.hidden = true; vel = 0; save(); }
  return {
    get open() { return open; }, close,
    /** The key/stick line under the dial (main.ts writes it from the live bindings). */
    setHint(text: string) { (root.querySelector('.chrono-hint') as HTMLElement).textContent = text; },
    toggle() { if (open) close(); else { open = true; root.hidden = false; vel = 0; draw(); } },
    /** Each frame: `input` −1…1 (left/right) scrubs the hour; also keeps the hand on the running clock. */
    update(dt: number, input: number) { if (!open) return;
      vel = scrubVelocity(vel, input, dt); if (Math.abs(input) < .01 && Math.abs(vel) < .01) vel = 0;
      DAY.offset += vel * dt; draw(); },
  };
}
