import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceDataAt } from '../src/world/globe/surfaceData';
import { plantsGrowAt, treeLineM, iceLineM } from '../src/core/altitudeZones';
import { heightAt } from '../src/core/world';
import { setSite, clearSite } from '../src/core/sitePhase';

// T-0072 follow-up: the globe surface sampler must read the landed site's latitude, like plantsGrowAt does,
// so a remote landing never reports "forest" where the game has already removed the plants (or the reverse).
test('surfaceDataAt zone follows the landed site latitude', () => {
  const pts: [number, number][] = [[0, 0], [400, -300], [-800, 650], [1500, 1200]];
  // Equator at 3000 m a.s.l.: below the tropical tree line, but above the ice line at Kenora's latitude.
  assert.ok(3000 < treeLineM(0) && 3000 > iceLineM(49.77));
  setSite({ latDeg: 0, lonDeg: -78, datumM: 3000, salt: 7, dir: [1, 0, 0], east: [0, 0, 1], north: [0, 1, 0] });
  try {
    for (const [x, z] of pts) {
      const d = surfaceDataAt(x, z, undefined, false);
      assert.equal(d.zone === 'forest', plantsGrowAt(heightAt(x, z)), `zone ${d.zone} disagrees with plantsGrowAt at ${x},${z}`);
    }
    assert.equal(surfaceDataAt(0, 0, undefined, false).zone === 'forest', plantsGrowAt(heightAt(0, 0)));
  } finally { clearSite(); }
  for (const [x, z] of pts) assert.equal(surfaceDataAt(x, z, undefined, false).zone === 'forest', plantsGrowAt(heightAt(x, z)));
});
