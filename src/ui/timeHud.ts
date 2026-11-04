/**
 * Time inputs for the one clock (Matthew, #109). The on-screen time bar was removed
 * (Matthew, 2026-11-03: "get rid of the time thing"); the clock keeps running and the
 * keys and pad still drive the same dial. The chronometer (T / d-pad up) is the hour scrub.
 */
import { DIAL_HOLD_PER_SEC, DIAL_NOTCH, nudgeDial, toggleHudPause } from '../core/worldClock';

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
