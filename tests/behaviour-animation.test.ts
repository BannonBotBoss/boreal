/** T-0020: every named behaviour has an animation, and the first set passes the frame gate.
 *  Metric: share of 6 questions × 8 frames. Pass at >= 0.95.
 *  Tool: tools/anim-gate.ts scoreAnimation. Silhouette is IoU after hip alignment and body-length scale.
 *  Known match: the unshifted recording. Identical rasters score IoU 1.
 *  Known mismatch: hare-flee recorded half a cycle late scores below 0.95.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HARE_BODY } from '../src/animals/hare';
import { SWING } from '../src/animals/locomotion/bounding';
import { DEER_LEGS, footTarget, gaitFor, gaitPose, limbOf, WOLF_LEGS } from '../src/core/animalBehavior';
import {
  BEHAVIOURS, FIRST_GATE, GATHER_HEAD, HARE_BONES, HARE_FOLD, LEAP_SHAPE, TUCK_HIP_M, WOLF_BONES, behaviourById,
} from '../src/core/behaviourData';
import { sampleBehaviour } from '../src/core/behaviourPose';
import { HUNT_HOLD, holdVisual } from '../src/core/huntHold';
import { HEAD_AT } from '../src/core/wolfBody';
import { WOLF_SCALE } from '../src/core/wolfModes';
import { PHYS } from '../src/core/tuning';
import { SYSTEM_PROPERTIES } from '../src/config/systemProperties';
import { boundDuty, boundForeDuty } from '../src/core/needs/bound';
import { HARE_GAIT } from '../src/core/needs/species';
import { diagramPose, measureCycle, scoreAnimation, silhouetteIoU } from '../tools/anim-gate';
import { generationPrompt, writeReferenceSet } from '../tools/ref-prompt';

const NAMED = ['graze', 'alert', 'head-up', 'flee', 'trot', 'rest', 'scan', 'stalk', 'crawl', 'leap', 'pin', 'bite', 'carry', 'consume', 'release', 'drink', 'sleep'];
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('every behaviour row has its own animation id and a happening line', () => {
  const ids = new Set<string>();
  for (const b of BEHAVIOURS) {
    assert.equal(b.id.length > 0, true, b.behaviour);
    assert.equal(ids.has(b.id), false, b.id);
    ids.add(b.id);
    assert.match(b.happening, new RegExp(b.species === 'hare' ? /hare/ : /wolf/));
    assert.ok(b.cycleS > 0, b.id);
    assert.equal(b.feet.length, 4, b.id);
  }
  for (const name of NAMED) assert.ok(BEHAVIOURS.some(b => b.behaviour === name), name);
  for (const id of FIRST_GATE) assert.equal(behaviourById(id).id, id);
});

test('bone numbers stay on the rig and the published lengths', () => {
  assert.equal(HARE_BONES.hipY, HARE_BODY.hipY);
  assert.equal(HARE_BONES.shoulderX, -HARE_BODY.shoulderZ);
  assert.equal(HARE_BONES.noseX, -HARE_BODY.headZ);
  assert.equal(HARE_BONES.noseY, HARE_BODY.headY);
  assert.equal(HARE_BONES.ear, HARE_BODY.ear);
  assert.equal(HARE_BONES.shoulderY, HUNT_HOLD.scapulaY);
  assert.equal(WOLF_BONES.shoulderY, WOLF_LEGS.hip);
  assert.equal(WOLF_BONES.hipY, WOLF_LEGS.hind?.hip);
  assert.equal(WOLF_BONES.noseX, -HEAD_AT[2] * WOLF_SCALE);
  assert.equal(WOLF_BONES.noseY, HEAD_AT[1] * WOLF_SCALE);
  assert.equal(HARE_FOLD.fore, SWING.fold.fore);
  assert.equal(HARE_FOLD.hind, SWING.fold.hind);
  assert.equal(GATHER_HEAD, holdVisual().head);
  assert.equal(TUCK_HIP_M, DEER_LEGS.hip);
  assert.equal(LEAP_SHAPE.crouch, SYSTEM_PROPERTIES.jump.crouch);
  assert.equal(LEAP_SHAPE.flight, SYSTEM_PROPERTIES.jump.flight);
  assert.ok(HARE_BONES.bodyLength > 0.36 && HARE_BONES.bodyLength < 0.48);
  assert.ok(WOLF_BONES.bodyLength > 1.05 && WOLF_BONES.bodyLength < 1.6);
});

test('wolf gait paws are the footTarget solver; hare flee duty is the bound row', () => {
  for (const id of ['wolf-stalk', 'wolf-trot', 'wolf-flee', 'wolf-crawl', 'wolf-carry'] as const) {
    const b = behaviourById(id);
    const gait = gaitFor('walk', b.speed, WOLF_LEGS);
    assert.ok(gait);
    for (let i = 0; i < 8; i++) {
      const phase = i / 8;
      const got = sampleBehaviour(id, phase);
      for (let leg = 0; leg < 4; leg++) {
        const ft = footTarget(gait!, 'walk', phase, leg, 0, 0, limbOf(WOLF_LEGS, leg).hip);
        const key = (['pawLF', 'pawLH', 'pawRF', 'pawRH'] as const)[leg];
        const rest = leg % 2 === 0 ? b.bones.shoulderX : b.bones.hipX;
        close(got.points[key].x, rest - ft.z, 1e-9);
        close(got.points[key].y, ft.y, 1e-9);
      }
    }
  }
  const flee = behaviourById('hare-flee');
  const speed = flee.speed;
  close(flee.feet[1].duty, boundDuty(HARE_GAIT, speed), 1e-9); // LH
  close(flee.feet[0].duty, boundForeDuty(HARE_GAIT, speed), 1e-9); // LF
  const m = measureCycle(p => sampleBehaviour('hare-flee', p));
  flee.feet.forEach((f, i) => close(m.duty[i], f.duty, 0.02));
});

test('head height and the leap arc are the sourced poses', () => {
  const nose = (id: string) => sampleBehaviour(id, 0).points.nose.y;
  close(nose('hare-graze'), HARE_BONES.noseY, 1e-9);
  close(nose('hare-head-up'), 0.22, 1e-6);
  close(nose('hare-alert'), 0.20, 1e-6);
  close(nose('hare-scan'), HARE_BONES.shoulderY, 1e-6);
  assert.equal(sampleBehaviour('hare-graze', 0).headDown, true);
  assert.equal(sampleBehaviour('hare-head-up', 0).headDown, false);
  const phase = 0.45;
  const bob = gaitPose('jump', 0, phase * PHYS.jumpSeconds).bob;
  close(sampleBehaviour('wolf-leap', phase).points.hip.y - WOLF_BONES.hipY, bob, 1e-9);
  const air = measureCycle(p => sampleBehaviour('wolf-leap', p)).air;
  assert.ok(Math.abs(air - LEAP_SHAPE.flight) <= 0.02, `air ${air}`);
  assert.equal(sampleBehaviour('wolf-pin', 0.2).contact[0], 'target');
  assert.equal(sampleBehaviour('wolf-pin', 0.2).jaw, false);
  assert.equal(sampleBehaviour('wolf-bite', 0.2).jaw, true);
  assert.equal(sampleBehaviour('wolf-carry', 0.2).jaw, true);
});

test('frame gate: known match passes, half-cycle flee fails', () => {
  const lines: string[] = [];
  for (const b of BEHAVIOURS) {
    const report = scoreAnimation(b.id);
    lines.push(`${b.id} ${report.score.toFixed(3)} ${report.q6}`);
    assert.equal(report.pass, true, `${b.id} ${report.score} ${report.q6} frames ${report.failed}`);
    assert.ok(report.score >= 0.95, b.id);
    const a = sampleBehaviour(b.id, 0.25);
    const d = diagramPose(b.id, 0.25);
    assert.equal(silhouetteIoU(a, d, b.bones.bodyLength), 1, b.id);
  }
  const miss = scoreAnimation('hare-flee', p => sampleBehaviour('hare-flee', p + 0.5));
  assert.ok(miss.score < 0.95, `mismatch ${miss.score}`);
  console.log(lines.join('\n'));
  console.log(`hare-flee half-cycle mismatch ${miss.score.toFixed(3)}`);
});

test('the prompt names the happening, and the refs layout records the diagram', () => {
  const b = behaviourById('hare-graze');
  const prompt = generationPrompt(b);
  assert.match(prompt, /^Generate a frame-by-frame sequence of reference images depicting /);
  assert.match(prompt, /side view plus one 3\/4 view/);
  assert.match(prompt, /plain background/);
  const root = mkdtempSync(join(tmpdir(), 'refs-'));
  try {
    writeReferenceSet(root, '2026-10-25');
    const meta = JSON.parse(readFileSync(join(root, 'hare', 'graze', 'meta.json'), 'utf8'));
    assert.equal(meta.animation, 'hare-graze');
    assert.equal(meta.frames, 8);
    assert.equal(meta.accepted, 'diagram');
    assert.match(readFileSync(join(root, 'hare', 'graze', 'attempts.md'), 'utf8'), /Not accepted as the position reference/);
    assert.match(readFileSync(join(root, 'wolf', 'stalk', 'reference', 'frame-0.svg'), 'utf8'), /<svg/);
    assert.match(readFileSync(join(root, 'hare', 'flee', 'see.txt'), 'utf8'), /frame 0 phase/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
