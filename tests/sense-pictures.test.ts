// T-0100. The wolf senses panel draws generic pictures. Strength is opacity.
// A sound's category and a scent's source species are not drawn. Issue #106 wins the bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERCEPTION, readPerception } from '../src/core/perceptionBuffer';
import { THOUGHT_RULES } from '../src/core/needs/thoughts';
import { cueSoundEntry, createSoundCues } from '../src/core/senses';
import {
  SENSE_ARIA, SENSE_GLYPH, SENSE_PICTURES, bubbleLook, createSenseStream, demoSenseSignals,
  signalFromScent, signalFromSight, signalFromSound, signalOpacity, signalsFromFrame,
} from '../src/core/sensePictures';

const known = new Uint8Array(readFileSync(new URL('./fixtures/perception-known.bin', import.meta.url)));
const SPECIES = /\b(wolf|deer|hare|rabbit|loon|owl|raven|woodpecker|moose|bear|fox|lynx|person)\b/i;
const DISTANCE = /\d+\s*m\b|\bmetres?\b|\bmeters?\b/;

test('T-0100: opacity scales with strength, and a faint picture stays just visible', () => {
  assert.equal(SENSE_PICTURES.life, THOUGHT_RULES.fade);
  assert.equal(SENSE_PICTURES.cap, PERCEPTION.caps.sound);
  assert.equal(signalOpacity(0), SENSE_PICTURES.opacityFloor);
  assert.ok(signalOpacity(0) >= 0.15);
  assert.ok(signalOpacity(1) > 0.9);
  assert.ok(signalOpacity(1) < 1);
  assert.ok(signalOpacity(0.2) < signalOpacity(0.55));
  assert.ok(signalOpacity(0.55) < signalOpacity(1));
  const faint = bubbleLook({ id: 1, strength: 0.2, bearing: 0.4, age: 0.4 });
  const strong = bubbleLook({ id: 1, strength: 0.95, bearing: 0.4, age: 0.4 });
  assert.ok(faint && strong);
  assert.ok(strong.opacity > faint.opacity);
  const ratio = signalOpacity(0.95) / signalOpacity(0.2);
  assert.ok(Math.abs(strong.opacity / faint.opacity - ratio) < 1e-9);
  assert.equal(bubbleLook({ id: 1, strength: 1, bearing: 0, age: SENSE_PICTURES.life }), undefined);
});

test('T-0100: live pictures stay at the cap, and a steady signal re-emits gently', () => {
  const stream = createSenseStream();
  let spawned = 0;
  for (let i = 0; i < 30; i++) {
    if (stream.offer({ key: `k${i}`, kind: 'sound', strength: 0.4 + (i % 5) * 0.1, bearing: i * 0.2 })) spawned++;
  }
  assert.equal(stream.list().length, SENSE_PICTURES.cap);
  assert.equal(spawned, SENSE_PICTURES.cap);
  assert.equal(stream.offer({ key: 'overflow', kind: 'scent', strength: 1, bearing: 0 }), false);
  assert.equal(stream.list().length, SENSE_PICTURES.cap);
  const steady = createSenseStream();
  const signal = { key: 'wood', kind: 'sound' as const, strength: 0.7, bearing: 0.2 };
  assert.equal(steady.offer(signal), true);
  assert.equal(steady.offer(signal), false);
  steady.step(SENSE_PICTURES.reemit - 0.01);
  assert.equal(steady.offer(signal), false);
  steady.step(0.02);
  assert.equal(steady.offer(signal), true);
  assert.equal(steady.list().length, 2);
  steady.step(SENSE_PICTURES.life - 0.05);
  assert.equal(steady.list().length, 1);
  steady.step(0.1);
  assert.equal(steady.list().length, 0);
});

test('T-0100: pictures sit toward the signal side, and no species or distance is shown', () => {
  const right = bubbleLook({ id: 3, strength: 0.8, bearing: Math.PI / 2, age: 0.5 });
  const left = bubbleLook({ id: 3, strength: 0.8, bearing: -Math.PI / 2, age: 0.5 });
  const ahead = bubbleLook({ id: 3, strength: 0.8, bearing: 0, age: 0.5 });
  assert.ok(right && left && ahead);
  assert.ok(right.side > 0.3 && right.tilt > 0);
  assert.ok(left.side < -0.3 && left.tilt < 0);
  assert.ok(Math.abs(ahead.side) < 0.15);
  assert.ok(ahead.ahead > 0.9);
  const frame = readPerception(known);
  const signals = signalsFromFrame(frame);
  assert.deepEqual(signals.map(s => s.kind), ['sound', 'sound', 'scent']);
  assert.equal(signals[0].strength, 0.5);
  assert.equal(signals[1].strength, 1);
  assert.equal(signals[2].strength, 0.5);
  assert.ok(signals[0].bearing > 1);
  assert.ok(Math.abs(signals[1].bearing) < 1e-6);
  for (const signal of signals) {
    assert.deepEqual(Object.keys(signal).sort(), ['bearing', 'key', 'kind', 'strength']);
    assert.equal(SPECIES.test(signal.kind), false);
    assert.equal(DISTANCE.test(signal.kind), false);
    assert.equal(signal.key.includes('deer') || signal.key.includes('hare'), false);
  }
  const cues = createSoundCues();
  cues.add('deer-snort', { x: 12, z: 4 }, 0.8);
  const fromCue = signalFromSound(cueSoundEntry(cues.list()[0], Math.PI / 2), 'hearing:0');
  assert.equal(fromCue?.kind, 'sound');
  assert.ok(fromCue && fromCue.strength > 0.7);
  assert.equal(JSON.stringify(fromCue).includes('deer'), false);
  const scent = signalFromScent({ level: 0.66, bearing: -1 }, 'scent:0');
  assert.equal(scent?.kind, 'scent');
  assert.equal(JSON.stringify(scent).includes('hare'), false);
  assert.equal(signalFromSight('sight:0', 0.3, 0.2)?.kind, 'sight');
  for (const glyph of Object.values(SENSE_GLYPH)) {
    assert.equal(SPECIES.test(glyph), false, glyph);
    assert.equal(DISTANCE.test(glyph), false);
  }
  for (const label of Object.values(SENSE_ARIA)) {
    assert.equal(SPECIES.test(label), false);
    assert.equal(DISTANCE.test(label), false);
    assert.equal(/\d/.test(label), false);
  }
  const hud = readFileSync(new URL('../src/ui/senses.ts', import.meta.url), 'utf8');
  assert.match(hud, /signalFromSound\(cueSoundEntry\(/);
  assert.match(hud, /createSenseStream\(/);
  assert.match(hud, /sense-stream/);
  assert.doesNotMatch(hud, /Quiet nearby|Listening|strong scent|No scent picked up|Known friend|sense-heard|sense-percent|sense-direction|textContent/);
  assert.doesNotMatch(hud, /\b(Deer|Hare|Person|Berries|Herbs|Remains|woodpecker)\b/);
  assert.doesNotMatch(hud, DISTANCE);
  const shown = hud.slice(hud.indexOf('root.innerHTML'), hud.indexOf('document.body.append')).replace('Wolf senses', '');
  assert.equal(SPECIES.test(shown), false, shown);
  assert.doesNotMatch(shown, /\d+\s*%|\d+\s*m/);
});

test('T-0100: the screenshot query is not a species list', () => {
  const demo = demoSenseSignals('0.18,0.55,0.94');
  assert.equal(demo.replace, true);
  assert.deepEqual(demo.signals.map(s => s.kind), ['sound', 'scent', 'sight']);
  assert.deepEqual(demo.signals.map(s => s.strength), [0.18, 0.55, 0.94]);
  assert.ok(demo.signals[0].bearing < 0 && demo.signals[2].bearing > 0);
  const once = demoSenseSignals('once:0.9');
  assert.equal(once.once, true);
  assert.equal(once.signals.length, 1);
  assert.equal(once.signals[0].kind, 'sound');
  assert.equal(SPECIES.test(JSON.stringify(demo.signals.map(s => s.kind))), false);
  assert.equal(demoSenseSignals(null).replace, false);
});
