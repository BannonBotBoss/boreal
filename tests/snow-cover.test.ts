import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snowOnGroundCm, SNOW_VISIBLE_CM } from '../src/render/snowCover';

test('a thin snow residual is not a cover, and the HUD uses that same number', () => {
  assert.equal(snowOnGroundCm(0), 0);
  assert.equal(snowOnGroundCm(10.5), 0);
  assert.equal(snowOnGroundCm(SNOW_VISIBLE_CM), SNOW_VISIBLE_CM);
  assert.equal(snowOnGroundCm(22), 22);
  const hud = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const grass = readFileSync(new URL('../src/render/grass/grass.ts', import.meta.url), 'utf8');
  assert.match(hud, /snowOnGroundCm\(stood\.depthCm\)/);
  assert.match(hud, /autoplay', 'noprobe', 'tier', 'bench'/);
  assert.match(grass, /snowOnGroundCm\(snowDepthCm/);
  assert.equal(grass.includes('step(aBlade.y, uSnowM)'), false, 'snow must not delete a blade');
  assert.match(grass, /GRASS_INFO = \{[^}]*near:/);
});
