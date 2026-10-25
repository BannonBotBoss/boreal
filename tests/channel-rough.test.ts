import test from 'node:test';
import assert from 'node:assert/strict';
import { gravity } from '../src/proc/physics';
import { ROCK_SIZES } from '../src/core/rocks';
import { TRANSACTIONS } from '../src/core/transactions';
import { STAGES } from '../src/core/stages/elevation';
import { RIVER, channelSpeed, riverAt, riverGrid, roughnessN, segmentGeom } from '../src/core/stages/rivers';
import {
  REACH, Y90, advectionScore, channelStepAt, foamLocality, inceptionAir, inLee, patternMetres,
  roughnessFroude, roughnessK, stepHeight, stepsOnSegment, surfaceAeration, type ChannelStep,
} from '../src/core/stages/channelRough';
import { stepText, whyOf } from '../src/core/why';
import { CHUNK_SIZE, generateChunk } from '../src/core/world';

const lin = (c: number) => (c /= 255) > .04045 ? ((c + .055) / 1.055) ** 2.4 : c / 12.92;
/** The river-audit foam pixel: relative luminance > 0.45 and HSV saturation < 0.18 (measure.mjs). */
const foamPixel = (r: number, g: number, b: number) => {
  const L = .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return L > .45 && (mx ? (mx - mn) / mx : 0) < .18;
};
/** Shader albedo: 0x578d91 mixed toward (0.85, 0.9, 0.9). amount is the foam factor, not a new constant. */
const mixAlbedo = (amount: number): [number, number, number] => {
  const base = [0x57, 0x8d, 0x91], white = [.85 * 255, .9 * 255, .9 * 255];
  return [0, 1, 2].map(i => base[i] * (1 - amount) + white[i] * amount) as [number, number, number];
};

test('Chow below S = 0.002, Jarrett at and above, and the 3 m/s cap is gone', () => {
  assert.equal(roughnessN(.0019, .4), RIVER.manningN);
  const chow = .4 ** (2 / 3) * Math.sqrt(.001) / RIVER.manningN;
  assert.ok(Math.abs(channelSpeed(.4, .001) - chow) < 1e-12);
  const S = .01, d = .5;
  const nFt = .39 * S ** .38 * (d / .3048) ** -.16;
  const v = d ** (2 / 3) * Math.sqrt(S) / nFt;
  assert.ok(Math.abs(roughnessN(S, d) - nFt) < 1e-12, 'feet form, 1 ft = 0.3048 m');
  assert.ok(Math.abs(channelSpeed(d, S) - v) < 1e-12);
  const raw = 1.5 ** (2 / 3) * Math.sqrt(.2) / roughnessN(.2, 1.5);
  assert.ok(Math.abs(channelSpeed(1.5, .2) - raw) < 1e-12);
  assert.ok(raw > 3, `uncapped velocity ${raw}`);
});

test('roughness Froude and inception air match an independent transcription', () => {
  const q = .3, S = .04, H = ROCK_SIZES[9];
  const theta = Math.atan(S), k = H * Math.cos(theta), g = gravity();
  const f = q / Math.sqrt(g * Math.sin(theta) * k ** 3);
  assert.ok(Math.abs(roughnessK(H, S) - k) < 1e-12);
  assert.ok(Math.abs(roughnessFroude(q, S, k) - f) < 1e-9);
  const c = .163 * f ** .154;
  assert.ok(Math.abs(inceptionAir(f) - c) < 1e-12);
  // USBR quotes about 0.2 for steep spillways. F* = 10 is that regime; a boulder in a shallow stream has a smaller F*.
  const spillway = inceptionAir(10);
  assert.ok(spillway > .2 && spillway < .25, `F* = 10 inception air ${spillway}`);
  assert.ok(c > 0 && c < spillway, `this stream-scale F* gives ${c}, below the spillway figure`);
  assert.equal(TRANSACTIONS.run('water', 'rock', { q, slope: S, k, inLee: false }, 'aerate'), 0);
  assert.equal(TRANSACTIONS.run('water', 'rock', { q, slope: S, k, inLee: true }, 'aerate'), Y90);
  assert.equal(TRANSACTIONS.get('water', 'rock', 'aerate')?.source.includes('Boes'), true);
});

test('foam locality and advection scores: a known match is 1 and a known mismatch is not', () => {
  const lee = [true, true, false, false, false];
  assert.equal(foamLocality([true, true, false, false, false], lee), 1);
  assert.equal(foamLocality([false, false, false, false, false], lee), 1, 'a clear glide is not a fail');
  assert.ok(Math.abs(foamLocality([true, true, true, true, true], lee) - .4) < 1e-12, 'uniform white scores the lee area');
  assert.equal(advectionScore(1.25, 1.25), 1);
  assert.ok(advectionScore(2.5, 1.25) <= 0, 'twice the model speed scores 0');
  assert.equal(patternMetres(.8, 2), 1.6);
  assert.equal(foamPixel(...mixAlbedo(0)), false, 'clear albedo is not foam');
  assert.equal(foamPixel(...mixAlbedo(Y90 * .75)), true, 'the shader floor on Y90 still reads as foam');
  assert.equal(foamPixel(...mixAlbedo(Y90)), true);
});

test('drawn cells use Jarrett where his fit applies, and the old 3 m/s peg is gone', () => {
  const R = riverGrid(1400); let n = 0, peg = 0;
  for (let j = 0; j < R.n; j++) for (let i = 0; i < R.n; i++) {
    const seg = segmentGeom(1400, i, j); if (!seg) continue; n++;
    const v = channelSpeed(seg.depth0, seg.slope);
    if (seg.slope >= RIVER.jarrettMinS) {
      const nFt = .39 * seg.slope ** .38 * (seg.depth0 / .3048) ** -.16;
      const ref = seg.depth0 ** (2 / 3) * Math.sqrt(seg.slope) / nFt;
      assert.ok(Math.abs(v - ref) < 1e-9);
      if (Math.abs(v - 3) < 1e-6 && ref > 3 + 1e-4) peg++;
    } else assert.equal(roughnessN(seg.slope, seg.depth0), RIVER.manningN);
  }
  assert.ok(n > 100, `drew ${n}`);
  assert.equal(peg, 0);
});

test('steep reaches place a T-0026 boulder on the Abrahams spacing, and only its lee aerates', () => {
  const R = riverGrid(1400), n = R.n;
  let steep: ChannelStep | undefined, flat: { x: number; z: number } | undefined;
  for (let j = 0; j < n && !(steep && flat); j += 1) for (let i = 0; i < n && !(steep && flat); i += 1) {
    const seg = segmentGeom(1400, i, j); if (!seg) continue;
    if (!steep && seg.slope > REACH.stepPoolS) { const steps = stepsOnSegment(seg); if (steps.length) steep = steps[0]; }
    if (!flat && seg.slope < RIVER.jarrettMinS) flat = { x: seg.ax + seg.dirX * Math.min(1, seg.len * .5), z: seg.az + seg.dirZ * Math.min(1, seg.len * .5) };
  }
  assert.ok(steep, 'a step-pool or cascade segment exists');
  assert.ok(flat, 'a below-Jarrett glide exists');
  assert.equal(steep.height, stepHeight(steep.slope));
  assert.equal(steep.height, steep.slope > REACH.cascadeS ? ROCK_SIZES[10] : ROCK_SIZES[9]);
  assert.ok(Math.abs(steep.spacing - steep.height / steep.slope) < 1e-9);
  const hit = riverAt(1400, steep.x, steep.z);
  assert.ok(hit && hit.d <= hit.half, 'the step sits in the wetted channel');
  assert.ok(Math.abs(hit!.speed - channelSpeed(hit!.depth, hit!.slope)) < 1e-9);
  assert.equal(surfaceAeration(1400, steep.x, steep.z), Y90);
  const upstream = { x: steep.x - steep.dirX * steep.height * 4, z: steep.z - steep.dirZ * steep.height * 4 };
  assert.equal(inLee(upstream.x, upstream.z, steep, 0), false);
  const upHit = riverAt(1400, upstream.x, upstream.z);
  if (upHit && upHit.d <= upHit.half) assert.equal(surfaceAeration(1400, upstream.x, upstream.z), 0, 'four clast-heights upstream of the step is clear');
  assert.equal(surfaceAeration(1400, flat.x, flat.z), 0, 'a glide with no step stays clear');
  const beside = { x: steep.x + -steep.dirZ * (steep.height / 2 + .05), z: steep.z + steep.dirX * (steep.height / 2 + .05) };
  assert.equal(inLee(beside.x, beside.z, steep, 0), false);
  assert.equal(inLee(beside.x, beside.z, steep, .1), true, 'half a cell of sampling reaches the vertex next to the clast');
  const fast = riverAt(1400, -790, -1100);
  assert.ok(fast, 'audit fast1');
  assert.ok(fast.speed < 3, `fast1 is no longer pegged at 3 m/s (${fast.speed})`);
  assert.ok(Math.abs(fast.speed - channelSpeed(fast.depth, fast.slope)) < 1e-9);
});

test('a step boulder is exposed then scoured, and it is spawned only while stages are on', () => {
  const R = riverGrid(1400);
  let steep: ChannelStep | undefined;
  for (let c = 0; c < R.n * R.n && !steep; c += 17) {
    const i = c % R.n, j = (c / R.n) | 0, seg = segmentGeom(1400, i, j); if (!seg) continue;
    steep = stepsOnSegment(seg)[0];
  }
  assert.ok(steep);
  assert.equal(channelStepAt(1400, steep.x, steep.z)?.height, steep.height);
  const was = STAGES.on;
  STAGES.on = true;
  try {
    const w = whyOf({ kind: 'rock', x: steep.x, z: steep.z });
    assert.deepEqual(w.map(s => s.step), ['exposed', 'scoured']);
    assert.equal(stepText(w[0]), 'exposed by the flow');
    assert.equal(stepText(w[1]), 'scoured by the flow');
    const cx = Math.floor(steep.x / CHUNK_SIZE), cz = Math.floor(steep.z / CHUNK_SIZE);
    const spawned = generateChunk(cx, cz).filter(e => e.key.startsWith('step:'));
    assert.ok(spawned.some(e => Math.hypot(e.x - steep.x, e.z - steep.z) < .02), 'the chunk draws the step');
    STAGES.on = false;
    assert.equal(generateChunk(cx, cz).some(e => e.key.startsWith('step:')), false, 'stages off keeps the pinned chunk stream');
    assert.equal(whyOf({ kind: 'rock', x: steep.x, z: steep.z }).some(s => s.step === 'exposed'), false);
  } finally { STAGES.on = was; }
});
