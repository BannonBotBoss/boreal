import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { STEM_FILES, STEM_FRAMES, STEM_IDS, STEM_MASTER, STEM_RATE, STEM_SECONDS, STEM_SUM_CAP, THREAT_HOLD, THREAT_OFF, THREAT_ON, capStemSum, encounterThreat, loopPoints, smoothstep, stemTau, stemWeights, stepToward, threatStep } from '../src/audio/adaptiveStems';
import { HUNT } from '../src/core/needs/diet';
import { EXTRA_SOURCES, MUSIC } from '../src/audio/music';
import { MUSIC_SETTINGS, TRACK_OPTIONS, sourceOf } from '../src/audio/musicSettings';
const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('stems weights: clear day is the day stem alone, clear night is the night stem alone', () => {
  const d = stemWeights(0, 0), n = stemWeights(1, 0);
  near(d.day, 1); near(d.night, 0); near(d.weather, 0); near(d.tension, 0);
  near(n.night, 1); near(n.day, 0);
});
test('stems weights: night/day are equal-power at the dusk midpoint and monotone with darkness', () => {
  const m = stemWeights(.5, 0); near(m.night, m.day);
  let pn = -1, pd = 2; for (let x = 0; x <= 1.0001; x += .05) { const w = stemWeights(x, 0); assert.ok(w.night >= pn - 1e-12 && w.day <= pd + 1e-12); pn = w.night; pd = w.day; }
});
test('stems weights: rain brings the weather stem in and ducks day and night; threat brings tension in', () => {
  const dry = stemWeights(0, 0), wet = stemWeights(0, 1), hunt = stemWeights(0, 0, 1);
  assert.equal(dry.weather, 0); assert.ok(wet.weather > .3 && wet.day < dry.day);
  assert.equal(dry.tension, 0); assert.ok(hunt.tension > .3 && hunt.day < dry.day);
  assert.ok(stemWeights(0, .1).weather === 0, 'drizzle below the ramp stays silent');
});
test('stems weights: the layered sum never exceeds the cap, for any darkness / rain / threat, and stays finite', () => {
  for (let a = 0; a <= 1.0001; a += .1) for (let b = 0; b <= 1.0001; b += .1) for (let c = 0; c <= 1.0001; c += .25) {
    const w = stemWeights(a, b, c); assert.ok(sum(w) <= STEM_SUM_CAP + 1e-9, JSON.stringify([a, b, c, w]));
    for (const id of STEM_IDS) assert.ok(Number.isFinite(w[id]) && w[id] >= 0 && w[id] <= 1);
  }
  const bad = stemWeights(NaN, -3, Infinity); for (const id of STEM_IDS) assert.ok(Number.isFinite(bad[id]));
});
test('stems headroom: master gain x summed stem gains x the loudest stem peak (.51) stays under the music limiter threshold (-10 dBFS)', () => {
  assert.ok(STEM_MASTER * STEM_SUM_CAP * .51 <= 10 ** (-10 / 20), 'would reach the compressor');
  const transition = capStemSum({ night: 0, day: 0.82009, weather: 0, tension: 0.44477 });
  near(sum(transition), STEM_SUM_CAP, 1e-9);
  assert.ok(STEM_MASTER * sum(transition) * .51 <= 10 ** (-10 / 20), 'transition sum is capped under the limiter threshold');
});
test('stems smoothing: exponential approach, 63 % of the gap after one tau, never overshoots, no-op at dt 0', () => {
  near(stepToward(0, 1, 6, 6), 1 - Math.exp(-1)); near(stepToward(.3, .3, 1, 2), .3); near(stepToward(0, 1, 0, 6), 0);
  let c = 0; for (let i = 0; i < 600; i++) { c = stepToward(c, 1, 1 / 60, 6); assert.ok(c <= 1); } near(c, 1 - Math.exp(-10 / 6), 1e-9); // 10 s at 60 fps, tau 6
  near(stepToward(1, 0, 3, 3), Math.exp(-1));
  assert.ok(stemTau('tension', true) < stemTau('tension', false), 'tension comes in fast and leaves slowly');
  assert.ok(stemTau('weather', true) < stemTau('weather', false));
  for (const id of STEM_IDS) assert.ok(stemTau(id, true) > 0 && stemTau(id, false) > 0);
});
test('stems smoothing: frame rate does not matter (one 1 s step equals sixty 1/60 s steps)', () => {
  let c = 0; for (let i = 0; i < 60; i++) c = stepToward(c, 1, 1 / 60, 5); near(c, stepToward(0, 1, 1, 5), 1e-12);
});
test('stems threat: switches on at the threshold, holds at least 12 s, then releases below the lower threshold', () => {
  let s = { on: false, since: -1e9 }; let r = threatStep(s, THREAT_ON - .01, 0); assert.equal(r.level, 0);
  r = threatStep(s, THREAT_ON, 10); assert.equal(r.state.on, true); assert.ok(r.level >= THREAT_ON); s = r.state;
  r = threatStep(s, 0, 10 + THREAT_HOLD - .1); assert.equal(r.state.on, true); assert.ok(r.level >= THREAT_ON, 'held');
  r = threatStep(s, THREAT_OFF + .05, 10 + THREAT_HOLD + 5); assert.equal(r.state.on, true, 'between the thresholds it stays on');
  r = threatStep(s, THREAT_OFF - .01, 10 + THREAT_HOLD); assert.equal(r.state.on, false); assert.equal(r.level, 0);
  assert.equal(threatStep({ on: false, since: -1e9 }, NaN, 0).level, 0);
});
test('stems loop points: whole stem, 3,763,200 frames = 85.333 s = 32 bars at 90 BPM, clamped to a shorter decode', () => {
  assert.equal(STEM_FRAMES, 3_763_200); assert.equal(STEM_RATE, 44100); near(STEM_SECONDS, 85.3333333333, 1e-9);
  near(STEM_SECONDS, 32 * 4 * 60 / 90, 1e-9); assert.equal(STEM_FRAMES % STEM_RATE, 3_763_200 % 44100);
  assert.deepEqual(loopPoints(STEM_SECONDS), { loopStart: 0, loopEnd: STEM_SECONDS });
  assert.deepEqual(loopPoints(85.2), { loopStart: 0, loopEnd: 85.2 });
  assert.deepEqual(loopPoints(90), { loopStart: 0, loopEnd: STEM_SECONDS });
  assert.deepEqual(loopPoints(0), { loopStart: 0, loopEnd: STEM_SECONDS });
});
test('stems smoothstep: 0 below, 1 above, .5 at the middle', () => { near(smoothstep(.2, .6, 0), 0); near(smoothstep(.2, .6, 1), 1); near(smoothstep(.2, .6, .4), .5); });
test('stems files: four Ogg files exist, are small, and the stems manifest matches the code', () => {
  const m = JSON.parse(readFileSync('public/music/stems/manifest.json', 'utf8')) as { stems: { id: string; file: string; skills: string[] }[]; key: string; tempo_bpm: number; licence: string };
  assert.deepEqual(m.stems.map(s => [s.id, s.file]), STEM_IDS.map(id => [id, STEM_FILES[id]])); assert.equal(m.tempo_bpm, 90); assert.match(m.key, /A minor/); assert.ok(m.licence.length > 10);
  let total = 0;
  for (const s of m.stems) {
    assert.ok(s.skills.length >= 3);
    const p = `public/music/stems/${s.file}`, size = statSync(p).size; total += size; assert.ok(size > 5e5 && size < 2e6, `${p} ${size} bytes`);
    assert.equal(readFileSync(p).subarray(0, 4).toString('latin1'), 'OggS');
  }
  assert.ok(total < 6e6, `stems total ${total}`);
});
test('stems opt-in: not in the default picker; ?stems adds it; a saved choice falls back unless ?stems', () => {
  assert.ok(!TRACK_OPTIONS.includes('Adaptive stems')); assert.ok((EXTRA_SOURCES as readonly string[]).includes('Adaptive stems'));
  assert.equal(sourceOf('Adaptive stems', false, false), 'Fingerpicked'); assert.equal(sourceOf('Adaptive stems', false, true), 'Adaptive stems'); assert.equal(sourceOf('Adaptive stems', true, false), 'Adaptive stems');
  const src = MUSIC_SETTINGS.find(d => d.id === 'music.source')!; src.apply('Adaptive stems'); assert.equal(MUSIC.source, 'Fingerpicked', 'default page: stems are not selectable');
  for (const d of MUSIC_SETTINGS) d.apply(d.default);
});
test('stems encounterThreat (T-0045): real predator-prey chase or flight drives threat into threatStep and stemWeights', () => {
  assert.equal(HUNT.safeDistance, 35);
  assert.equal(encounterThreat({ x: 0, z: 0, animals: [{ x: 3, z: 0, fleeing: false }, { x: 40, z: 0, fleeing: true }] }), 0, 'calm or beyond safeDistance stays 0');
  const hareBolt = encounterThreat({ x: 0, z: 0, animals: [{ x: 7, z: 0, fleeing: true }] });
  near(hareBolt, 1 - 7 / 35); assert.ok(hareBolt >= THREAT_ON, 'fleeing hare at 7 m crosses THREAT_ON');
  const stepOn = threatStep({ on: false, since: -1e9 }, hareBolt, 5);
  assert.equal(stepOn.state.on, true); assert.ok(stemWeights(0, 0, stepOn.level).tension > 0.25);
  const deerMid = encounterThreat({ x: 0, z: 0, running: false, animals: [{ x: 21, z: 0, fleeing: true }] });
  near(deerMid, 0.4); assert.ok(deerMid >= THREAT_OFF && deerMid < THREAT_ON, 'between THREAT_OFF and THREAT_ON when walking');
  const deerChase = encounterThreat({ x: 0, z: 0, running: true, animals: [{ x: 21, z: 0, fleeing: true }] });
  near(deerChase, THREAT_ON);
  assert.equal(encounterThreat({ x: 0, z: 0, locked: true }), 1, 'hunt lock or autonomous pursuit gives full threat');
  assert.equal(encounterThreat({ x: 10, z: -5, animals: [{ x: 10, z: -5, fleeing: true }] }), 1, 'embodied hare fleeing gives full threat');
  const mainSrc = readFileSync('src/main.ts', 'utf8');
  assert.match(mainSrc, /const threat = encounterThreat\(/);
  assert.match(mainSrc, /a\.problem === 'flee' \|\| a\.problem === 'escape'/);
  assert.match(mainSrc, /view\.playable\.id === 'wolf' && driveCommitted/);
  assert.match(mainSrc, /autoRead\.targetKey\?\.startsWith\('hare:'\)/);
  assert.match(mainSrc, /music\.update\(view\.darkness\(\),\s*Math\.min\(1,\s*weatherAt\(player\.x,\s*player\.z\)\.rainMmH\s*\/\s*2\),\s*threat\)/);
});
