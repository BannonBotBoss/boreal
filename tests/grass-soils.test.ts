import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCover, siteAt } from '../src/render/grass/cover';
import { STAGES } from '../src/core/stages/elevation';
import { soilAt } from '../src/core/stages/soils';

test('staged grass cover follows stage-3 soils: bare only on bedrock, not on all high ground', () => {
  STAGES.on = true;
  try {
    let land = 0, bare = 0, bareOffRock = 0;
    for (let i = 0; i < 2500; i++) { const x = (i % 50) * 37.3 - 900, z = ((i / 50) | 0) * 41.1 - 1000, s = siteAt(x, z); if (s.water) continue; land++;
      if (defaultCover(x, z, s).density === 0) { bare++; if (soilAt(STAGES.seed, x, z).kind !== 'bedrock' && s.rock === 0) bareOffRock++; } }
    assert.ok(land > 500, `${land} land points`);
    assert.ok(bare / land > .03 && bare / land < .25, `bare share ${(bare / land).toFixed(3)} (bedrock is ~11 % of land)`);
    assert.equal(bareOffRock, 0, 'no bare ground away from bedrock and steep faces');
  } finally { STAGES.on = false; }
});
