import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScorecard, calibrate, ciede2000, PASS_MARK, readOcean, scoreColorDistance, type RgbaImage, type Rgb } from './ocean-scorecard/metric.ts';

function paint(width: number, height: number, fill: (x: number, y: number) => Rgb): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = fill(x, y);
    const i = (y * width + x) * 4;
    rgba[i] = p.r; rgba[i + 1] = p.g; rgba[i + 2] = p.b; rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

const blue = (x: number, y: number): Rgb => (x < 3 || y < 3 || x > 36 || y > 36) ? { r: 0, g: 0, b: 0 } : { r: 24, g: 78, b: 150 };
const brown = (x: number, y: number): Rgb => (x < 3 || y < 3 || x > 36 || y > 36) ? { r: 0, g: 0, b: 0 } : { r: 150, g: 96, b: 42 };

test('CIEDE2000 matches the Sharma 2005 sample pair', () => {
  const d = ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485]);
  assert.ok(Math.abs(d - 2.0425) < 0.002, `got ${d}`);
  assert.equal(ciede2000([40, 10, -5], [40, 10, -5]), 0);
});

test('the same ocean picture scores 100, and a brown disc does not pass colour', () => {
  const ocean = paint(40, 40, blue);
  const land = paint(40, 40, brown);
  const card = buildScorecard({ orbit: ocean, apollo: ocean, pacific: ocean, glintView: ocean, sunglint: ocean, close: ocean, caribbean: ocean });
  assert.equal(card.elements.find(e => e.id === 'ocean-color-orbit')!.score, 100);
  assert.equal(card.elements.find(e => e.id === 'ocean-fraction')!.score, 100);
  const bad = buildScorecard({ orbit: land, apollo: ocean, pacific: ocean, glintView: ocean, sunglint: ocean, close: ocean, caribbean: ocean });
  const colour = bad.elements.find(e => e.id === 'ocean-color-orbit')!;
  assert.ok(colour.score != null && colour.score < PASS_MARK, `brown vs blue scored ${colour.score}`);
  assert.equal(colour.pass, false);
});

test('a high average cannot pass when one element is under 75', () => {
  const ocean = paint(40, 40, blue);
  const flat = paint(48, 48, () => ({ r: 30, g: 70, b: 130 }));
  // A few white streaks on the reference, none on the flat game view: glint should disagree.
  const streaky = paint(48, 48, (x, y) => (y > 20 && y < 24) ? { r: 230, g: 230, b: 235 } : { r: 20, g: 50, b: 90 });
  const card = buildScorecard({ orbit: ocean, apollo: ocean, pacific: ocean, glintView: flat, sunglint: streaky, close: ocean, caribbean: ocean });
  const glint = card.elements.find(e => e.id === 'sunglint')!;
  assert.equal(glint.pass, false);
  assert.ok(card.composite != null && card.composite > glint.score!);
  assert.equal(card.passed, false);
  assert.match(card.compositeNote, /never passes|cannot pass/i);
});

test('ocean share is the ocean pixels over the whole disc, clouds included', () => {
  const img = paint(20, 20, (x, y) => {
    if (x < 2 || y < 2 || x > 17 || y > 17) return { r: 0, g: 0, b: 0 };
    if (x < 8) return { r: 230, g: 230, b: 230 };
    return { r: 20, g: 60, b: 140 };
  });
  const read = readOcean(img);
  assert.equal(read.disc, true);
  assert.ok(read.oceanShare > 0.4 && read.oceanShare < 0.85, `share ${read.oceanShare}`);
  assert.ok(scoreColorDistance(0) === 100);
});

test('calibration: a matching colour scores 100 and a brown mismatch stays under 75', () => {
  const c = calibrate();
  assert.equal(c.knownMatch, 100);
  assert.ok(c.knownMismatch < PASS_MARK, `mismatch ${c.knownMismatch}`);
});

test('a missing picture does not pass that element', () => {
  const card = buildScorecard({});
  assert.equal(card.passed, false);
  assert.ok(card.elements.every(e => e.score === null && e.pass === false));
  assert.equal(card.visionModel, 'TODO');
});
