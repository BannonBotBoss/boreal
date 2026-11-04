import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundAhead, headingToward, pawEdge, pawOf, refToWorld, snapYaw } from '../src/vr/forestHands';

test('a pinch aims the mama at the ground point, and the other hand snaps', () => {
  assert.ok(Math.abs(headingToward({ x: 0, z: 0 }, { x: 0, z: -4 }) ?? 1) < 1e-9);
  const west = headingToward({ x: 10, z: 2 }, { x: 6, z: 2 });
  assert.ok(west != null && Math.abs(west - Math.PI / 2) < 1e-9);
  assert.equal(headingToward({ x: 0, z: 0 }, { x: 0.1, z: 0 }), null);
  assert.ok(Math.abs(snapYaw(0.2, 1) - (0.2 + Math.PI / 6)) < 1e-12);
  assert.ok(Math.abs(snapYaw(0.2, -1) - (0.2 - Math.PI / 6)) < 1e-12);
  const world = refToWorld({ x: 37.5, y: 3, z: 8.5, yaw: 0 }, 0, 1.2, -2);
  assert.ok(Math.abs(world.x - 37.5) < 1e-9 && Math.abs(world.y - 4.2) < 1e-9 && Math.abs(world.z - 6.5) < 1e-9);
  const hit = groundAhead({ x: 0, y: 1.2, z: 0 }, { x: 0, y: -1, z: -1 }, 0);
  assert.ok(hit && Math.abs(hit.z - -1.2) < 1e-9);
  assert.equal(groundAhead({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -1 }, 0), null);
});

test('an open paw grabs once and a closed fist digs once; a pinch still points', () => {
  const open = pawOf({ index: 0.18, middle: 0.19, ring: 0.18, pinky: 0.16, thumbIndex: 0.06, pinch: 0 });
  const fist = pawOf({ index: 0.07, middle: 0.065, ring: 0.068, pinky: 0.07, thumbIndex: 0.02, pinch: 0 });
  const point = pawOf({ index: 0.04, middle: 0.03, ring: 0.03, pinky: 0.04, thumbIndex: 0.01, pinch: 1 });
  assert.equal(open, 'open');
  assert.equal(fist, 'fist');
  assert.equal(point, 'point');
  assert.equal(pawEdge('relaxed', 'open'), 'grab');
  assert.equal(pawEdge('open', 'open'), null);
  assert.equal(pawEdge('open', 'fist'), 'dig');
  assert.equal(pawEdge('fist', 'fist'), null);
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /hands\.grab\) perform\('open'\)/);
  assert.match(main, /hands\.dig\) digOrNudge\(\)/);
  assert.match(main, /kind: 'disturbed'/);
  assert.match(readFileSync('src/vr/forestSession.ts', 'utf8'), /pawOf\(pawMeasure/);
});

test('the headset ground step is the real forest and the hands, and the page loop yields', () => {
  const session = readFileSync('src/vr/forestSession.ts', 'utf8');
  const hands = readFileSync('src/vr/forestHands.ts', 'utf8');
  const main = readFileSync('src/main.ts', 'utf8');
  const draw = readFileSync('src/render/buildScene.ts', 'utf8');
  const post = readFileSync('src/render/post.ts', 'utf8');
  const journey = readFileSync('src/vr/journey.ts', 'utf8');
  assert.match(session, /forestLanding\(\)/);
  assert.match(session, /setReferenceSpaceType\('local-floor'\)/);
  assert.match(session, /GOVERNOR\.xr = true/);
  assert.match(hands, /Point and pinch/);
  assert.match(main, /forestHandsOn\(\)/);
  assert.match(main, /if \(!xrDriven\) requestAnimationFrame\(frame\)/);
  assert.match(draw, /xrOrigin\.add\(camera\)/);
  assert.match(draw, /wolf\.root\.visible = !inHeadset/);
  assert.match(post, /renderer\.xr\.isPresenting/);
  assert.match(journey, /this\.phase = 'forest'/);
  assert.match(readFileSync('src/world/globe/inpage.ts', 'utf8'), /showForest\(at/);
  assert.doesNotMatch(session, /performance\.now/);
  assert.doesNotMatch(hands, /performance\.now/);
});
