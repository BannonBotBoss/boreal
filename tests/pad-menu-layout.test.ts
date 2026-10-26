import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPEAT } from '../src/input/gamepad';
import {
  FIXED_LAYERS, createHoldRepeat, focusAfterScroll, holdStepCount, menuFrame, rowFullyVisible, scrollArrows, scrollToReveal,
} from '../src/ui/padMenuLayout';

const fully = (scroll: number, view: number, top: number, height: number) =>
  top >= scroll - 0.01 && top + height <= scroll + view + 0.01;

test('menu frame: one centered height for camera, time, badges, gallery and settings', () => {
  assert.deepEqual([...FIXED_LAYERS], ['camera', 'time', 'badges', 'gallery', 'settings']);
  const heights = [280, 343, 808, 339, 460];
  const roomy = menuFrame(heights, 1100);
  assert.equal(roomy.height, 808, 'sized to the tallest layer');
  assert.equal(roomy.top, (1100 - 808) / 2);
  const tops = FIXED_LAYERS.map(() => menuFrame(heights, 1100).top);
  const boxes = FIXED_LAYERS.map(() => menuFrame(heights, 1100).height);
  assert.equal(new Set(tops).size, 1);
  assert.equal(new Set(boxes).size, 1);
  assert.deepEqual(tops, [roomy.top, roomy.top, roomy.top, roomy.top, roomy.top]);
  const capped = menuFrame(heights, 720);
  assert.equal(capped.height, 720, 'capped at the screen');
  assert.equal(capped.top, 0, 'a full-screen box stays on screen');
  assert.equal(menuFrame([100, 40], 0).height, 0);
});

test('scroll arrows show only the direction that still has content', () => {
  assert.deepEqual(scrollArrows(0, 100, 80), { up: false, down: false });
  assert.deepEqual(scrollArrows(0, 100, 250), { up: false, down: true });
  assert.deepEqual(scrollArrows(40, 100, 250), { up: true, down: true });
  assert.deepEqual(scrollArrows(150, 100, 250), { up: true, down: false });
  assert.deepEqual(scrollArrows(0.2, 100, 250), { up: false, down: true }, 'subpixel noise does not show the up arrow');
});

test('revealing a row scrolls just enough to keep it fully visible', () => {
  assert.equal(scrollToReveal(0, 100, 0, 40), 0);
  assert.equal(scrollToReveal(0, 100, 80, 40), 20);
  assert.equal(scrollToReveal(50, 100, 10, 40), 10);
  assert.equal(scrollToReveal(0, 100, 40, 180), 40, 'a row taller than the view pins to its top');
  assert.ok(fully(scrollToReveal(0, 100, 80, 40), 100, 80, 40));
  assert.ok(fully(scrollToReveal(50, 100, 10, 40), 100, 10, 40));
});

test('wheel scroll keeps a selectable row on screen', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ top: i * 40, height: 40, selectable: i !== 1 }));
  assert.equal(focusAfterScroll(rows, 0, 100, 0), 0);
  assert.equal(focusAfterScroll(rows, 200, 100, 0), 5, 'nearest fully visible row');
  assert.equal(rowFullyVisible(200, 100, rows[5].top, rows[5].height), true);
  assert.equal(rowFullyVisible(200, 100, rows[7].top, rows[7].height), false);
});

test('hold repeats after a delay, then at a steady rate, and stops per source', () => {
  assert.equal(REPEAT.delayMs, 380);
  assert.equal(REPEAT.rateMs, 110);
  assert.equal(holdStepCount(0), 1);
  assert.equal(holdStepCount(REPEAT.delayMs - 1), 1);
  assert.equal(holdStepCount(REPEAT.delayMs), 2);
  assert.equal(holdStepCount(REPEAT.delayMs + REPEAT.rateMs - 1), 2);
  assert.equal(holdStepCount(REPEAT.delayMs + REPEAT.rateMs), 3);
  const steps: number[] = [];
  const hold = createHoldRepeat(d => steps.push(d));
  hold.start('key', 1, 0);
  assert.deepEqual(steps, [1]);
  assert.equal(hold.tick(REPEAT.delayMs - 1), false);
  assert.equal(hold.tick(REPEAT.delayMs), true);
  assert.equal(hold.tick(REPEAT.delayMs + REPEAT.rateMs - 1), false);
  assert.equal(hold.tick(REPEAT.delayMs + REPEAT.rateMs), true);
  assert.deepEqual(steps, [1, 1, 1]);
  hold.stop('key');
  assert.equal(hold.tick(5000), false);
  hold.start('pointer-down', 1, 0);
  hold.start('key', -1, 10);
  assert.equal(steps.at(-1), -1, 'the newer hold wins');
  hold.stop('key', 20);
  assert.equal(hold.dir, 1, 'the pointer hold is still down');
  hold.clear();
  assert.equal(hold.dir, 0);
});

test('holding down auto-scrolls at the bottom edge, and holding up does the same at the top', () => {
  const rowH = 48, view = 100, n = 8;
  const rows = Array.from({ length: n }, (_, i) => ({ top: i * rowH, height: rowH }));
  const content = n * rowH;
  let focus = 0, scroll = 0;
  const move = (dir: -1 | 1) => {
    focus = (focus + dir + n) % n;
    scroll = scrollToReveal(scroll, view, rows[focus].top, rows[focus].height);
  };
  const down = createHoldRepeat(move);
  down.start('key', 1, 0);
  assert.equal(focus, 1);
  assert.equal(scroll, 0, 'the second row still fits');
  assert.deepEqual(scrollArrows(scroll, view, content), { up: false, down: true });
  assert.equal(down.tick(REPEAT.delayMs), true);
  assert.equal(focus, 2);
  assert.equal(scroll, rows[2].top + rowH - view);
  assert.ok(fully(scroll, view, rows[2].top, rowH));
  assert.equal(scrollArrows(scroll, view, content).down, true);
  let t = REPEAT.delayMs, guard = 0;
  while (focus !== n - 1 && guard++ < 20) { t += REPEAT.rateMs; down.tick(t); }
  assert.equal(focus, n - 1);
  assert.ok(fully(scroll, view, rows[focus].top, rowH));
  assert.deepEqual(scrollArrows(scroll, view, content), { up: true, down: false });
  down.clear();
  const up = createHoldRepeat(move);
  const before = scroll;
  up.start('pointer-up', -1, 0);
  assert.equal(focus, n - 2);
  assert.ok(fully(scroll, view, rows[focus].top, rowH), 'the row still inside the view does not jump');
  assert.equal(up.tick(REPEAT.delayMs), true);
  assert.equal(focus, n - 3);
  assert.ok(scroll < before, 'up scrolls back once the row would leave the top');
  assert.ok(fully(scroll, view, rows[focus].top, rowH));
  t = REPEAT.delayMs; guard = 0;
  while (focus !== 0 && guard++ < 20) { t += REPEAT.rateMs; up.tick(t); }
  assert.equal(focus, 0);
  assert.equal(scroll, 0);
  assert.deepEqual(scrollArrows(scroll, view, content), { up: false, down: true });
  assert.ok(fully(scroll, view, rows[0].top, rowH));
});

test('an arrow that appears after the first reveal shrinks the view, so the row is measured again', () => {
  const arrow = 52, full = 550, content = 645, rowH = 56;
  const oneArrow = full - arrow;
  const rowTop = oneArrow - 10;
  let scroll = scrollToReveal(0, oneArrow, rowTop, rowH);
  assert.equal(scrollArrows(scroll, oneArrow, content).up, true, 'leaving the top shows the up arrow');
  const both = full - arrow - arrow;
  assert.equal(rowFullyVisible(scroll, both, rowTop, rowH), false, 'the taller view left the row past the new bottom');
  scroll = scrollToReveal(scroll, both, rowTop, rowH);
  assert.equal(rowFullyVisible(scroll, both, rowTop, rowH), true);
  assert.deepEqual(scrollArrows(scroll, both, content), { up: true, down: true });
});

test('the panel css keeps vertical centering and hides the scrollbar', () => {
  const src = readFileSync(new URL('../src/ui/padMenu.ts', import.meta.url), 'utf8');
  assert.match(src, /top:50%/);
  assert.match(src, /translate\(-50%,-50%\)/);
  assert.match(src, /scrollbar-width:none/);
  assert.match(src, /aria-label', 'Scroll up'/);
  assert.match(src, /aria-label', 'Scroll down'/);
  assert.equal(/max-height:86vh/.test(src), false);
  assert.match(src, /FIXED_LAYERS/);
  assert.match(src, /menuFrame\(/);
  assert.match(src, /scrollToReveal\(/);
  assert.match(src, /createHoldRepeat\(/);
  assert.match(src, /addEventListener\('pointerup', end\)/);
  assert.match(src, /upWas = upBtn\.hidden/);
});
