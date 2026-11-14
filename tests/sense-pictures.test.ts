// T-0100. The wolf senses panel draws generic pictures. Strength is opacity.
// A sound's category and a scent's source species are not drawn. Issue #106 wins the bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERCEPTION, readPerception } from '../src/core/perceptionBuffer';
import { THOUGHT_RULES } from '../src/core/needs/thoughts';
import { WOLF_NEEDS } from '../src/core/needs/species';
import { perceive, see, type SightBody } from '../src/core/needs/senses';
import { cueSoundEntry, createSoundCues, smell, SENSES, type ScentSource } from '../src/core/senses';
import { DELTAS, record } from '../src/core/deltas';
import { GROUND } from '../src/core/ground';
import { deltaSources } from '../src/core/traces';
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

test('T-0171: see() detects upwind moving prey and moving deer/person beyond presenceM while smell() handles non-visual scent deltas', () => {
  const nose = { x: 0, z: 0, heading: 0 };
  // Wind blowing from wolf (0,0) toward target (0,-16): target is upwind of wolf, outside local diffusion radius.
  const upwind = { x: 0, z: -2.5 };
  const env = { daylight: 1, wind: upwind };

  // 1. Upwind moving hare at 16 m: smell() returns 0 hits (scentLevel < 0.025), while see() returns sight = 0.7333.
  const hareSource: ScentSource = { key: 'hare:0', kind: 'hare', x: 0, z: -16, potency: 0.7 };
  const hareBody: SightBody = { key: 'hare:0', kind: 'hare', x: 0, z: -16, speed: 3.0 };
  const hareScentHits = smell(nose, [hareSource], upwind, nose.heading);
  assert.equal(hareScentHits.length, 0);
  const hareSightHits = see(WOLF_NEEDS, nose, [hareBody], env);
  assert.equal(hareSightHits.length, 1);
  assert.equal(hareSightHits[0].key, 'hare:0');
  assert.ok(Math.abs(hareSightHits[0].sight - (1 - 16 / 60)) < 1e-6);
  const hareSightSignal = signalFromSight('sight:0', hareSightHits[0].sight, hareSightHits[0].bearing);
  assert.equal(hareSightSignal?.kind, 'sight');
  assert.ok(hareSightSignal && hareSightSignal.strength > 0.7);

  // 2. Moving deer (2.0 m/s) and moving person (1.2 m/s) at 20 m (> presenceM = 6 m):
  // With speed = 0 (pre-T-0171 bug), sight is 0; with real ground speed, see() detects both.
  const staleDeer = perceive(WOLF_NEEDS, nose, { kind: 'deer', x: 0, z: -20, speed: 0 }, env);
  const stalePerson = perceive(WOLF_NEEDS, nose, { kind: 'person', x: 4, z: -20, speed: 0 }, env);
  assert.equal(staleDeer.sight, 0);
  assert.equal(stalePerson.sight, 0);

  const movingBodies: SightBody[] = [
    { key: 'deer:0', kind: 'deer', x: 0, z: -20, speed: 2.0 },
    { key: 'person:hiker', kind: 'person', x: 0, z: -20, speed: 1.2 },
  ];
  const seenMoving = see(WOLF_NEEDS, nose, movingBodies, env);
  assert.equal(seenMoving.length, 2);
  assert.equal(seenMoving[0].key, 'deer:0');
  assert.ok(Math.abs(seenMoving[0].sight - (1 - 20 / 60)) < 1e-6);
  assert.equal(seenMoving[1].key, 'person:hiker');
  assert.ok(Math.abs(seenMoving[1].sight - 0.75 * (1 - 20 / 60)) < 1e-6);

  // 3. Non-visual olfactory trace deltas (scent mark, droppings) at 2 m ahead produce smell() hits and 0 visual hits.
  DELTAS.log.length = 0;
  try {
    record({ kind: 'scent', x: 0, z: -2, t: GROUND.years, m: 1 });
    record({ kind: 'droppings', x: 0.5, z: -2, t: GROUND.years, m: 0.01 });
    const traceSources = deltaSources(nose.x, nose.z, 2400);
    assert.equal(traceSources.length, 2);
    const traceScents = smell(nose, traceSources, { x: 0, z: 1 }, nose.heading);
    assert.equal(traceScents.length, 2);
    assert.ok(traceScents.every(h => h.level >= SENSES.threshold));
    // Visual candidate list excludes deltaSources; only visible world bodies enter see().
    const traceVisualHits = see(WOLF_NEEDS, nose, [], env);
    assert.equal(traceVisualHits.length, 0);
  } finally {
    DELTAS.log.length = 0;
  }

  // 4. Verify src/ui/senses.ts wires see(), deer brain speed, visitor speed, and non-embodied live hares independently of lastHits.
  const hud = readFileSync(new URL('../src/ui/senses.ts', import.meta.url), 'utf8');
  assert.match(hud, /see\(needs/);
  assert.match(hud, /view\.lookup\(key\)\?\.brain\?\.speed/);
  assert.match(hud, /view\.visitorOf\(key\)\?\.speed/);
  assert.match(hud, /h\.sim\.alive && !h\.embodied/);
  assert.doesNotMatch(hud, /h\.root\.visible/);
});
