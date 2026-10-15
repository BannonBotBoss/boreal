import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenomeEditor, defaultGenome, replay, clampParam, limits } from '../src/core/genome.ts';

const clock = () => { let t = 0; return () => ++t; };
test('genome: bounds and ratio constraints clamp', () => {
  const e = createGenomeEditor([], clock());
  assert.equal(e.set('size', 9), 1.6); assert.equal(e.set('size', -1), .6);
  e.set('length', .75); assert.equal(e.set('height', 1.35), 1.05); // height <= 1.4 x length
  assert.deepEqual(limits(e.genome, 'height'), [.75, 1.05]);
  assert.equal(clampParam(defaultGenome(), 'fur', 0 as unknown as boolean), false);
  assert.throws(() => e.set('nope', 1));
});
test('genome: undo/redo round-trips to identical genomes; log is append-only', () => {
  const e = createGenomeEditor([], clock()), states = [e.genome];
  e.set('hue', 20); states.push(e.genome); e.set('width', 1.2); states.push(e.genome); e.reset(); states.push(e.genome);
  const before = e.log.length;
  assert.ok(e.undo()); assert.deepEqual(e.genome, states[2]); assert.ok(e.undo()); assert.deepEqual(e.genome, states[1]);
  assert.ok(e.undo()); assert.deepEqual(e.genome, states[0]); assert.equal(e.undo(), false);
  assert.ok(e.redo()); assert.ok(e.redo()); assert.ok(e.redo()); assert.deepEqual(e.genome, states[3]);
  assert.ok(e.log.length > before);
  e.jump(1); assert.deepEqual(e.genome, states[1]);
});
test('genome: replay of the serialized log is deterministic', () => {
  const e = createGenomeEditor([], clock()); e.set('size', 1.3); e.set('fur', false); e.undo(); e.set('brightness', .7);
  const json = e.toJSON(), again = createGenomeEditor(JSON.parse(json));
  assert.deepEqual(again.genome, e.genome); assert.deepEqual(replay(JSON.parse(json)), e.genome);
  assert.deepEqual(replay([]), defaultGenome());
});
import { solveHandle, fitProfile, GENOME_SCHEMA } from '../src/core/genome.ts';
import { normalizeCoat, parseCoat, sampleCoat, DEFAULT_COAT } from '../src/core/coat.ts';

test('handle drag: solves, clamps to bounds, one record, undo round-trips', () => {
  const e = createGenomeEditor([], clock()), g0 = e.genome;
  assert.equal(solveHandle(g0, 'length', 1, .5, 1), 1.35);           // huge drag clamps to max
  assert.equal(solveHandle(g0, 'length', 1, .1, 1), 1.1);            // linear: +10% of the half-extent
  assert.equal(solveHandle(g0, 'length', 1, .1, 1, .3), 1.025);      // pen, light pressure: fine x0.25
  const n = e.log.length; e.setMany({ length: solveHandle(g0, 'length', 1, .2, 1) }, 'drag');
  assert.equal(e.log.length, n + 1); assert.equal(e.genome.length, 1.2);
  e.undo(); assert.deepEqual(e.genome, g0); e.redo(); assert.equal(e.genome.length, 1.2);
});
test('sketch fit returns in-bounds params near the drawn proportions', () => {
  const sil: [number, number][] = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; sil.push([Math.cos(a) * .5, Math.sin(a) * .5]); }
  const stroke = sil.map(([x, y]) => [x * 1.2, y * .9] as [number, number]), fit = fitProfile(defaultGenome(), stroke, sil);
  assert.ok(Math.abs(fit.length - 1.2) < .03 && Math.abs(fit.height - .9) < .03, JSON.stringify(fit));
  const wild = fitProfile(defaultGenome(), sil.map(([x, y]) => [x * 5, y * .1] as [number, number]), sil);
  const b = (id: string) => GENOME_SCHEMA.find(d => d.id === id)!;
  assert.ok(wild.length <= b('length').max! && wild.height >= b('height').min!); assert.ok(wild.height / wild.length >= .7 - 1e-9);
});
test('coat: gradient + marks serialization round-trips and clamps', () => {
  const raw = { mode: 'radial', stops: [{ t: 1.5, color: '#FF0000', a: .5 }, { t: 0, color: 'bad', a: 2 }], marks: [{ u: .3, v: .8, r: 9, color: '#00ff00', a: .7 }] };
  const s = normalizeCoat(raw as never), c = parseCoat(s);
  assert.deepEqual(c.stops.map(x => x.t), [0, 1]); assert.equal(c.stops[0].color, '#808080'); assert.equal(c.stops[1].color, '#ff0000'); assert.equal(c.marks[0].r, .4);
  assert.equal(normalizeCoat(s), s); assert.equal(normalizeCoat('nonsense'), DEFAULT_COAT);
  assert.deepEqual(sampleCoat(c, .5).map(x => +x.toFixed(3)), [.751, .251, .251, .75]);
  const e = createGenomeEditor([], clock()); e.setMany({ coat: s }, 'paint'); assert.equal(createGenomeEditor(JSON.parse(e.toJSON())).genome.coat, s);
});
