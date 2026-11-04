import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('the VR entry is Meta Immersive Web SDK and requires hands', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string>; overrides?: Record<string, string> };
  assert.match(pkg.dependencies['@iwsdk/core'], /^1\./);
  assert.match(pkg.dependencies.three, /super-three@0\.185\.0/);
  assert.match(pkg.overrides?.three ?? '', /super-three@0\.185\.0/);
  const src = readFileSync('src/vr/session.ts', 'utf8');
  assert.match(src, /from '@iwsdk\/core'/);
  assert.match(src, /World\.create/);
  assert.match(src, /handTracking: \{ required: true \}/);
  assert.match(src, /useHandPinchForGrab: true/);
  assert.match(src, /TurningMethod\.SnapTurn/);
  assert.doesNotMatch(src, /browserControls/);
  assert.match(readFileSync('src/main.ts', 'utf8'), /import\('\.\/vr\/session'\)/);
  const pages = readFileSync('.github/workflows/pages.yml', 'utf8');
  assert.match(pages, /PAGES_FROZEN/);
  assert.equal(existsSync('.github/PAGES_FROZEN'), false);
});
