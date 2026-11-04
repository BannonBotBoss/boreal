import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundAhead, headingToward, refToWorld, snapYaw } from '../src/vr/forestHands';

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
