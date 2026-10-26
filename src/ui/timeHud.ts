/**
 * The one time control (Matthew): a compact in-game readout of the clock's time and date, with pause, play and rate.
 * It writes only core/worldClock. The chronometer dial (T / d-pad up) is the hour scrub of this same clock, opened
 * from here; it is not a second clock. Mouse and touch use the buttons. Keyboard and the Xbox pad use core/bindings
 * (comma / d-pad left slower, period / d-pad right faster, semicolon / left-stick click pause or play).
 */
import { clockRate, isPaused, timeCommand, toggleHudPause, worldSec } from '../core/worldClock';
import { dayAt, formatDate, formatHour, hourAt } from '../core/timeOfDay';

const CSS = `.time-hud{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:26;display:flex;align-items:center;gap:6px;max-width:min(560px,94vw);padding:4px 6px 4px 12px;background:#10231ee6;color:#f5f4df;border:1px solid #abbc9644;border-radius:999px;font:12px/1.2 system-ui;pointer-events:auto;touch-action:manipulation}
.time-hud[hidden],body.photo-mode .time-hud{display:none}
.time-hud .read{display:flex;flex-direction:column;min-width:7.5em;pointer-events:none}
.time-hud .read b{font:600 14px/1.1 ui-monospace,monospace;letter-spacing:.02em}
.time-hud .read small{opacity:.8}
.time-hud button{font:12px system-ui;padding:6px 10px;min-width:2.2em;min-height:32px;border-radius:999px}
.time-hud .rate{min-width:3.2em;text-align:center;font:600 12px ui-monospace,monospace}
.time-hud.paused{outline:1px solid #f3d79a88}`;

export function createTimeHud(onHour: () => void) {
  if (!document.getElementById('time-hud-css')) { const s = document.createElement('style'); s.id = 'time-hud-css'; s.textContent = CSS; document.head.append(s); }
  const root = document.createElement('div');
  root.className = 'time-hud'; root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Time. Comma or d-pad left slower, period or d-pad right faster, semicolon or left-stick click pauses or plays. T or d-pad up sets the hour.');
  root.innerHTML = `<span class="read"><b></b><small></small></span><button type="button" data-c="pause" aria-label="Pause time">Pause</button><button type="button" data-c="play" aria-label="Play time">Play</button><button type="button" data-c="slower" aria-label="Slower">−</button><span class="rate"></span><button type="button" data-c="faster" aria-label="Faster">+</button><button type="button" data-c="hour" aria-label="Set the hour">Hour</button>`;
  document.body.append(root);
  const time = root.querySelector('b')!, date = root.querySelector('small')!, rate = root.querySelector('.rate')!;
  const stop = (e: Event) => e.stopPropagation();
  root.addEventListener('pointerdown', stop);
  root.addEventListener('click', e => {
    const c = (e.target as HTMLElement).dataset?.c; if (!c) return;
    if (c === 'hour') onHour();
    else timeCommand(c as 'pause' | 'play' | 'slower' | 'faster');
    draw();
  });
  function draw() {
    const t = worldSec(), day = dayAt(t);
    time.textContent = formatHour(hourAt(t));
    date.textContent = `${formatDate(day).text} · day ${((Math.floor(day) - 1) % 365 + 365) % 365 + 1}`;
    const r = clockRate(); rate.textContent = `×${Number(r.toFixed(3))}`;
    root.classList.toggle('paused', isPaused());
  }
  const loop = () => { if (!root.hidden) draw(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return { root, draw, setHidden(h: boolean) { root.hidden = h; if (!h) draw(); } };
}

/**
 * Standalone planet page (no main.ts bindings): the same keys drive the same clock.
 * `padRate` is off there: d-pad right toggles the through-planet axis and d-pad left cycles layers in axis mode.
 * Left-stick click still pauses. The on-screen buttons cover rate.
 */
export function bindTimeInputs(opts?: { padRate?: boolean }) {
  const padRate = opts?.padRate !== false;
  const menuUp = () => !!document.querySelector('.padm:not([hidden]), .padh:not([hidden]), dialog[open]');
  addEventListener('keydown', e => {
    if (e.repeat || menuUp()) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input,textarea,select'))) return;
    if (e.key === ',') timeCommand('slower');
    else if (e.key === '.') timeCommand('faster');
    else if (e.key === ';') toggleHudPause();
  });
  let prev = { left: false, right: false, click: false };
  const poll = () => {
    const p = [...navigator.getGamepads?.() ?? []].find(g => g?.connected && g.mapping === 'standard');
    if (p && !menuUp()) {
      const left = !!p.buttons[14]?.pressed, right = !!p.buttons[15]?.pressed, click = !!p.buttons[10]?.pressed;
      if (padRate && left && !prev.left) timeCommand('slower');
      if (padRate && right && !prev.right) timeCommand('faster');
      if (click && !prev.click) toggleHudPause();
      prev = { left, right, click };
    } else prev = { left: false, right: false, click: false };
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
