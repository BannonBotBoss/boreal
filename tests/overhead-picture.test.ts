/**
 * Picture check for overhead crowns (T-0214).
 * A crown pixel is bright and yellow-green (g > 120 and g > r + 15).
 * The tiled canopy has almost none of those, including at the frame edge.
 * The billboard frame has them through the middle and through the top band,
 * so a fade that follows the screen rectangle fails.
 * A near-black floor fails the black share.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

function read(file: string) {
  return PNG.sync.read(readFileSync(file));
}

function share(file: string, box: { x0: number; x1: number; y0: number; y1: number }, pred: (r: number, g: number, b: number) => boolean) {
  const { width, height, data } = read(file);
  const x0 = Math.floor(width * box.x0), x1 = Math.floor(width * box.x1);
  const y0 = Math.floor(height * box.y0), y1 = Math.floor(height * box.y1);
  let n = 0, c = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * width + x) * 4;
    n++;
    if (pred(data[i], data[i + 1], data[i + 2])) c++;
  }
  return c / n;
}

const crown = (r: number, g: number, b: number) => g > 120 && g > r + 15;
const black = (r: number, g: number, b: number) => Math.max(r, g, b) < 28;
const center = { x0: 0.35, x1: 0.65, y0: 0.35, y1: 0.65 };
const top = { x0: 0.15, x1: 0.85, y0: 0.02, y1: 0.1 };

test('crowns reach the frame edge and the floor is not black', () => {
  for (const alt of [400, 800]) {
    const before = `tasks/evidence/T-0214/before-${alt}.png`;
    const after = `tasks/evidence/T-0214/after-${alt}.png`;
    const beforeTop = share(before, top, crown);
    const afterTop = share(after, top, crown);
    const afterCenter = share(after, center, crown);
    const afterBlack = share(after, center, black);
    assert.ok(beforeTop < 0.08, `before ${alt} top crown share ${beforeTop.toFixed(3)}`);
    assert.ok(afterTop > 0.45 && afterCenter > 0.45, `after ${alt} top ${afterTop.toFixed(3)} center ${afterCenter.toFixed(3)}`);
    assert.ok(afterTop / afterCenter > 0.75, `after ${alt} edge/center ${ (afterTop / afterCenter).toFixed(2) }`);
    assert.ok(afterBlack < 0.05, `after ${alt} black share ${afterBlack.toFixed(3)}`);
  }
});
