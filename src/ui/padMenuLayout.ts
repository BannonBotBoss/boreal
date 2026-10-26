/**
 * Pad menu frame (grokbot-3, T-0077). The panel stays vertically centered (`top: 50%` + `translateY(-50%)`).
 * Each layer used to size the box, so the centered top jumped. One height, the tallest of the five layers
 * capped at the viewport, keeps that top still. Overflow scrolls inside the body; the header does not.
 * Hold-to-repeat uses the same delay and rate as the pad reader (`input/gamepad.ts` REPEAT): one step on
 * the press, the next after `delayMs`, then one every `rateMs`. Those two numbers are game-UI calibration,
 * shared so the keyboard, the on-screen arrows and the controller repeat together.
 */
import { REPEAT } from '../input/gamepad';

/** The five layers whose natural heights set the box. The Layers tab uses the same box and does not resize it. */
export const FIXED_LAYERS = ['camera', 'time', 'badges', 'gallery', 'settings'] as const;

/**
 * One centered box for every layer. `height` is the tallest layer, never taller than `viewport`
 * (the screen). `top` is the centered top edge, `(viewport - height) / 2`, so it is the same value
 * for every layer that shares this box.
 */
export function menuFrame(layerHeights: readonly number[], viewport: number): { height: number; top: number } {
  const tallest = layerHeights.reduce((m, h) => Math.max(m, h), 0);
  const cap = Math.max(0, viewport);
  const height = Math.min(Math.max(0, tallest), cap);
  return { height, top: (cap - height) / 2 };
}

/** Up / down arrows: shown only when more content sits past that edge of the scroller. */
export function scrollArrows(scrollTop: number, viewHeight: number, contentHeight: number, eps = 1): { up: boolean; down: boolean } {
  const overflow = contentHeight > viewHeight + eps;
  return {
    up: overflow && scrollTop > eps,
    down: overflow && scrollTop + viewHeight < contentHeight - eps,
  };
}

/** Smallest scrollTop that puts the whole item inside the view. A item taller than the view pins to its top. */
export function scrollToReveal(scrollTop: number, viewHeight: number, itemTop: number, itemHeight: number): number {
  if (viewHeight <= 0) return Math.max(0, scrollTop);
  if (itemHeight >= viewHeight) return Math.max(0, itemTop);
  if (itemTop < scrollTop) return Math.max(0, itemTop);
  const itemBottom = itemTop + itemHeight;
  if (itemBottom > scrollTop + viewHeight) return Math.max(0, itemBottom - viewHeight);
  return scrollTop;
}

export function rowFullyVisible(scrollTop: number, viewHeight: number, itemTop: number, itemHeight: number, eps = 0.5): boolean {
  return itemTop >= scrollTop - eps && itemTop + itemHeight <= scrollTop + viewHeight + eps;
}

export interface ScrollRow { top: number; height: number; selectable: boolean }

/**
 * After a wheel or touch scroll, keep a selectable row fully on screen. The current row wins when it
 * still fits; otherwise the fully visible selectable row nearest it, else the nearest selectable row.
 */
export function focusAfterScroll(rows: readonly ScrollRow[], scrollTop: number, viewHeight: number, focus: number): number {
  const cur = rows[focus];
  if (cur?.selectable && rowFullyVisible(scrollTop, viewHeight, cur.top, cur.height)) return focus;
  let best = focus, bestScore = Infinity;
  rows.forEach((row, i) => {
    if (!row.selectable) return;
    const visible = rowFullyVisible(scrollTop, viewHeight, row.top, row.height);
    const dist = Math.abs(i - focus);
    const score = visible ? dist : 1e6 + Math.min(Math.abs(row.top - scrollTop), Math.abs(row.top + row.height - (scrollTop + viewHeight)));
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** How many selection steps a hold has produced by `elapsedMs`, including the step at the press (t = 0). */
export function holdStepCount(elapsedMs: number, delay = REPEAT.delayMs, rate = REPEAT.rateMs): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs < delay) return 1;
  return 2 + Math.floor((elapsedMs - delay) / rate);
}

/**
 * Hold-to-repeat for one direction. `start` steps immediately. `tick(now)` steps again once the hold
 * has lasted `delay`, then every `rate`. Sources (keyboard, each arrow) stop on their own.
 */
export function createHoldRepeat(fire: (dir: -1 | 1) => void, delay = REPEAT.delayMs, rate = REPEAT.rateMs) {
  const held = new Map<string, -1 | 1>();
  let order: string[] = [];
  let dir: -1 | 1 | 0 = 0, t0 = 0, last = 0;
  const apply = (next: -1 | 1 | 0, now: number) => {
    if (next === dir) return;
    dir = next;
    if (dir) { t0 = last = now; fire(dir); }
  };
  return {
    get dir() { return dir; },
    start(source: string, d: -1 | 1, now: number) {
      held.set(source, d);
      order = order.filter(s => s !== source).concat(source);
      apply(d, now);
    },
    stop(source: string, now = 0) {
      if (!held.has(source)) return;
      held.delete(source);
      order = order.filter(s => s !== source);
      const next = order.length ? held.get(order[order.length - 1])! : 0;
      apply(next, now);
    },
    clear() { held.clear(); order = []; dir = 0; },
    tick(now: number) {
      if (!dir) return false;
      if (now - t0 >= delay && now - last >= rate) { last = now; fire(dir); return true; }
      return false;
    },
  };
}
