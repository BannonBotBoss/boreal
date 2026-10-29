/**
 * The one time control (Matthew, #109): a compact in-game readout of the clock.
 * Pause, play and the hour button are taps. Holding slower or faster moves the dial;
 * the rate eases toward it and the label reads in world time per real second
 * ("1 sec / sec", "1 hour / sec", "1,000 years / sec").
 * The chronometer (T / d-pad up) is the hour scrub of this same clock, not a second clock.
 */
import { deepTimeAt } from '../core/deepTime';
import { dayAt, formatDate, formatHour, hourAt } from '../core/timeOfDay';
import { DIAL_HOLD_PER_SEC, DIAL_NOTCH, clockRate, dialPosition, epochOffsetYr, formatRate, isPaused, nudgeDial, observation, timeCommand, toggleHudPause, worldSec } from '../core/worldClock';

const CSS = `.time-hud{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:26;display:flex;align-items:center;gap:6px;max-width:min(640px,96vw);padding:4px 6px 4px 12px;background:#10231ee6;color:#f5f4df;border:1px solid #abbc9644;border-radius:999px;font:12px/1.2 system-ui;pointer-events:auto;touch-action:manipulation;white-space:nowrap}
.time-hud[hidden],body.photo-mode .time-hud{display:none}
.time-hud .read{display:flex;flex-direction:column;min-width:7.5em;pointer-events:none}
.time-hud .read b{font:600 14px/1.1 ui-monospace,monospace;letter-spacing:.02em}
.time-hud .read small{opacity:.8;font-size:11px}
.time-hud button{font:12px system-ui;padding:6px 10px;min-width:2.2em;min-height:32px;border-radius:999px}
.time-hud .rate{min-width:6.5em;text-align:center;font:600 12px ui-monospace,monospace}
.time-hud.paused{outline:1px solid #f3d79a88}`;

export function createTimeHud(onHour: () => void) {
  if (!document.getElementById('time-hud-css')) { const s = document.createElement('style'); s.id = 'time-hud-css'; s.textContent = CSS; document.head.append(s); }
  const root = document.createElement('div');
  root.className = 'time-hud'; root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Time dial. Hold comma or d-pad left to rewind, hold period or d-pad right to go forward, semicolon or left-stick click pauses or plays. T or d-pad up sets the hour.');
  root.innerHTML = `<span class="read"><b></b><small></small></span><button type="button" data-c="pause" aria-label="Pause time">Pause</button><button type="button" data-c="play" aria-label="Play time">Play</button><button type="button" data-c="slower" aria-label="Slower">−</button><span class="rate"></span><button type="button" data-c="faster" aria-label="Faster">+</button><button type="button" data-c="hour" aria-label="Set the hour">Hour</button>`;
  document.body.append(root);
  const time = root.querySelector('b')!, date = root.querySelector('small')!, rate = root.querySelector('.rate')!;
  let holdDir = 0, heldMoved = 0;
  root.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const c = (e.target as HTMLElement).dataset?.c;
    if (c === 'slower' || c === 'faster') { holdDir = c === 'faster' ? 1 : -1; heldMoved = 0; }
  });
  const release = () => {
    if (holdDir !== 0 && heldMoved < DIAL_NOTCH) nudgeDial(holdDir * (DIAL_NOTCH - heldMoved));
    holdDir = 0;
    nudgeDial(0);
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) release(); });
  root.addEventListener('click', e => {
    const c = (e.target as HTMLElement).dataset?.c; if (!c || c === 'slower' || c === 'faster') return;
    if (c === 'hour') onHour();
    else timeCommand(c as 'pause' | 'play');
    draw();
  });
  function draw() {
    const t = worldSec(), yr = epochOffsetYr(t), obs = observation();
    if (Math.abs(yr) >= 1) {
      const deep = deepTimeAt(yr);
      time.textContent = deep.label;
      date.textContent = `${deep.title} · ${obs.scale}`;
    } else {
      time.textContent = formatHour(hourAt(t));
      const day = dayAt(t);
      date.textContent = `${formatDate(day).text} · day ${((Math.floor(day) - 1) % 365 + 365) % 365 + 1}${obs.scale === 'immediate' ? '' : ' · ' + obs.scale}`;
    }
    const label = formatRate(clockRate());
    rate.textContent = label;
    rate.setAttribute('title', `${label}. Dial ${dialPosition().toFixed(2)}. Scale ${obs.scale}, blend ${obs.blend.toFixed(2)} toward ${obs.higher}.`);
    root.classList.toggle('paused', isPaused());
  }
  let last = 0;
  const loop = (now: number) => {
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    if (holdDir !== 0 && dt > 0) { const d = holdDir * DIAL_HOLD_PER_SEC * dt; nudgeDial(d); heldMoved += Math.abs(d); }
    if (!root.hidden) draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return { root, draw, setHidden(h: boolean) { root.hidden = h; if (!h) draw(); } };
}

/**
 * Standalone planet page (no main.ts bindings): the same keys drive the same dial.
 * `padRate` is off there: d-pad right toggles the through-planet axis and d-pad left cycles layers in axis mode.
 * Left-stick click still pauses. Holding the buttons moves the dial; a tap is one notch.
 */
export function bindTimeInputs(opts?: { padRate?: boolean }) {
  const padRate = opts?.padRate !== false;
  const menuUp = () => !!document.querySelector('.padm:not([hidden]), .padh:not([hidden]), dialog[open]');
  const down = new Set<string>();
  addEventListener('keydown', e => {
    if (menuUp()) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input,textarea,select'))) return;
    if (e.key === ';') { if (!e.repeat) toggleHudPause(); return; }
    if (e.key === ',' || e.key === '.') down.add(e.key);
  });
  addEventListener('keyup', e => down.delete(e.key));
  addEventListener('blur', () => down.clear());
  let prev = { left: false, right: false, click: false, dir: 0 }, last = 0;
  const poll = (now: number) => {
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    const p = [...navigator.getGamepads?.() ?? []].find(g => g?.connected && g.mapping === 'standard');
    const blocked = menuUp();
    const left = !blocked && padRate && !!p?.buttons[14]?.pressed;
    const right = !blocked && padRate && !!p?.buttons[15]?.pressed;
    const click = !blocked && !!p?.buttons[10]?.pressed;
    if (click && !prev.click) toggleHudPause();
    const slower = !blocked && (down.has(',') || left);
    const faster = !blocked && (down.has('.') || right);
    const dir = slower && faster ? 0 : faster ? 1 : slower ? -1 : 0;
    if (dir !== 0 && dt > 0) nudgeDial(dir * DIAL_HOLD_PER_SEC * dt);
    if (dir !== 0 && prev.dir === 0) nudgeDial(dir * DIAL_NOTCH);
    if (dir === 0 && prev.dir !== 0) nudgeDial(0);
    prev = { left, right, click, dir };
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
