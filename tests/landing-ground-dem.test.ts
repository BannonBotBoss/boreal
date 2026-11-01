/** #192 ten-site finding: the landing census read the seeded planet's height, so the Saskatchewan prairie
 *  landed on a seeded mountain (rock) and a Montana wetland on seeded ocean. A cached DEM now wins. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundForCover } from '../src/world/globe/openTiles';
import { coverKind } from '../src/world/globe/coverKind';

test('DEM height wins over a seeded mountain at the prairie click', () => {
  const g = groundForCover({ kind: '', h: 2900, level: 0 }, 600);
  assert.deepEqual(g, { water: false, elevM: 600 });
  assert.equal(coverKind(51, g.elevM, 0.45, g.water), 'prairie');
});

test('DEM land wins over seeded ocean; a lake and an uncached tile keep the planet', () => {
  assert.deepEqual(groundForCover({ kind: 'ocean', h: -40, level: 0 }, 640), { water: false, elevM: 640 });
  assert.equal(groundForCover({ kind: 'lake', h: 300, level: 0 }, 640).water, true);
  assert.deepEqual(groundForCover({ kind: '', h: 350, level: 0 }, null), { water: false, elevM: 350 });
  assert.equal(groundForCover({ kind: 'ocean', h: -40, level: 0 }, null).water, true);
});
