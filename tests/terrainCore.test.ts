import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainCore, gridRel, transferables } from '../src/render/terrainCore';
import { enqueue, runJobs, WAIT, queued, finish } from '../src/core/interest';
import { CHUNK_SIZE, heightAt } from '../src/core/world';
import { STAGES } from '../src/core/stages/elevation';

test('worker terrain core writes world-space heights straight from heightAt (no applyMatrix4)', () => {
  const seg = 10, cx = 3, cz = -2, t = finish(terrainCore({ cx, cz, segments: seg, waterSeg: 0, stagesOn: STAGES.on, stagesSeed: STAGES.seed }));
  assert.equal(t.position.length, (seg + 1) ** 2 * 3);
  for (let iz = 0; iz <= seg; iz++) for (let ix = 0; ix <= seg; ix++) {
    const i = (iz * (seg + 1) + ix) * 3, x = gridRel(ix, seg) + (cx + .5) * CHUNK_SIZE, z = gridRel(iz, seg) + (cz + .5) * CHUNK_SIZE;
    assert.equal(t.position[i], Math.fround(x)); assert.equal(t.position[i + 2], Math.fround(z));
    assert.equal(t.position[i + 1], Math.fround(heightAt(x, z)));
    assert.ok(Math.abs(Math.hypot(t.normal[i], t.normal[i + 1], t.normal[i + 2]) - 1) < 1e-5);
  }
  for (const b of transferables(t)) assert.ok(b instanceof ArrayBuffer);
});

test('a job yielding WAIT is skipped for the rest of the frame, not spun, and resumes later', () => {
  let calls = 0, ready = false, out = '';
  enqueue('waitjob:0', 0, (function* () { while (!ready) { calls++; yield WAIT; } return 'ok'; })(), v => { out = v; });
  enqueue('waitjob:1', 1, (function* () { yield; return 'b'; })(), () => {});
  runJobs(1000); assert.equal(calls, 1); // one probe this frame, the other job still ran to completion
  assert.equal(queued(), 1);
  runJobs(1000); assert.equal(calls, 2);
  ready = true; runJobs(1000); runJobs(1000); assert.equal(out, 'ok'); assert.equal(queued(), 0);
});
