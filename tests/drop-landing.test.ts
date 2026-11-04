/**
 * The planet drop must put the mama on forest that is already in the scene.
 * A slow frame used to advance the 14 s ease by 0.1 s, then G gave up and the
 * walk kept the drone's chunk disc, so the ground never arrived.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESCENT, descentBegin, descentPitchEase, fallPitch, NADIR } from '../src/world/globe/flight';
import {
  DESCENT_FRAME_CAP, LANDING_JOB_MS, canEmbody, chunkRadius, descentFrameDt, descentFramesAt,
  landingChunkPriority, landingJobBudget, landingPatchReady, streamAltitude,
} from '../src/world/globe/landingStream';

test('a slow frame still finishes the orbit drop in one sitting', () => {
  assert.equal(descentFrameDt(0), 0);
  assert.equal(descentFrameDt(0.05), 0.05);
  assert.equal(descentFrameDt(1), 1);
  assert.equal(descentFrameDt(8), DESCENT_FRAME_CAP);
  const frames = descentFramesAt(1);
  assert.ok(frames <= 30, `1 s frames finish the ${DESCENT.sec} s ease in ${frames} frames, not ~140`);
  assert.ok(descentFramesAt(1, DESCENT.sec, 0.1) >= 140, 'the old tenth-second cap is the long black stretch');
  const open = descentBegin(1.4e7);
  assert.ok(open.y < 2e5, `the drop opens in the air, not in the black (${open.y})`);
  assert.ok(DESCENT.sec - open.t <= 8, `the rest of the fall is ${DESCENT.sec - open.t}s`);
  const globe = readFileSync('src/world/globe/globeView.ts', 'utf8');
  assert.match(globe, /descentBegin\(alt\)/);
  assert.equal(descentPitchEase(open.p, open.p), 0);
  assert.equal(fallPitch(descentPitchEase(open.p, open.p)), NADIR);
  assert.equal(descentPitchEase(1, open.p), 1);
  assert.match(globe, /descentPitchEase\(fall\.p, fall\.p0/);
});

test('after the wolf is back, streaming uses her eye height, not the leftover glide', () => {
  const play = 1.6, glide = 400, mid = 100, chunk = 40;
  assert.equal(streamAltitude(play, glide, false), play);
  assert.equal(streamAltitude(play, glide, true), glide);
  const walked = chunkRadius(streamAltitude(play, glide, false), mid, chunk);
  const drone = chunkRadius(glide, mid, chunk);
  assert.ok(walked <= 3, `walk radius ${walked}`);
  assert.ok(drone >= 5, `glide radius ${drone} is the disc that never finished`);
});

test('a landing cell that was never built is not ready, and G waits for her own chunk', () => {
  const none = () => false;
  assert.equal(landingPatchReady(0, 0, 1, none, none), false);
  assert.equal(landingPatchReady(0, 0, 0, none, () => true), true);
  assert.equal(landingPatchReady(0, 0, 0, key => key === 'chunk:0:0', () => true), false);
  assert.equal(landingChunkPriority(false, true), true);
  assert.equal(landingChunkPriority(true, true), false);
  assert.equal(landingChunkPriority(false, false), false);
  assert.equal(landingJobBudget(false, true), LANDING_JOB_MS);
  assert.equal(landingJobBudget(true, true), undefined);
  assert.equal(canEmbody(false, true), false);
  assert.equal(canEmbody(true, true), true);
  assert.equal(canEmbody(true, false), false);
});

test('the drop path uses those rules', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const page = readFileSync('src/world/globe/inpage.ts', 'utf8');
  const globe = readFileSync('src/world/globe/globeView.ts', 'utf8');
  const scene = readFileSync('src/render/buildScene.ts', 'utf8');
  assert.match(main, /streamAltitude\(altitude, inpage\?\.height \?\? 0, !!inpage\?\.blocksGame\(\)\)/);
  assert.doesNotMatch(main, /Math\.max\(altitude, inpage\?\.height/);
  assert.match(globe, /stepDescent\(fall, descentFrameDt\(wall\)\)/);
  assert.match(page, /landingPatchReady\(cx, cz, INPAGE\.ring, pending/);
  assert.match(page, /canEmbody\(centreBuilt\(\), wantEmbody\)/);
  assert.match(page, /Math\.exp\(INPAGE\.kUp \* descentFrameDt\(wall\)\)/);
  assert.match(page, /landingJobBudget\(ready, dropStream\)/);
  assert.doesNotMatch(page, /the game streams the rest/);
  assert.match(scene, /chunkRadius\(altitude, INTEREST\.mid, CHUNK_SIZE\)/);
  assert.match(scene, /chunkBuilt: \(a: number, b: number\) => chunks\.has/);
});
