import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, lakeAt } from '../src/core/stages/elevation';
import { POND_WHY, pondAt, riverAt, riverGrid, riverPondGrid } from '../src/core/stages/rivers';
import { riverContainment } from '../src/core/stages/riverContain';
import { surfaceAt } from '../src/core/stages/surfaceAt';
import { finish } from '../src/core/interest';
import { heightAt } from '../src/core/world';
import { terrainCore } from '../src/render/terrainCore';

test('channel depressions pond at the spill, and drawn water is not above unconfined ground', () => {
  const seed = 1400, P = riverPondGrid(seed), R = riverGrid(seed);
  assert.ok(P.bodies.length > 0, 'seed 1400 has channel ponds');
  for (const b of P.bodies) {
    assert.deepEqual(b.why, POND_WHY);
    assert.equal(b.kind, b.areaHa < 2 ? 'pond' : 'lake');
    assert.ok(b.level > -Infinity && b.maxDepth > 0.12, `depth ${b.maxDepth}`);
  }
  let pondChannel = 0;
  for (let c = 0; c < R.channel.length; c++) if (R.channel[c] && P.id[c] >= 0) { assert.equal(R.drawn[c], 0, 'pond channel is not drawn'); pondChannel++; }
  assert.ok(pondChannel > 0, 'some channel cells sit in ponds');
  // The recorded float reach (refs/water/river-audit/views.json) was a sheet 4 m above the meadow.
  const floated = surfaceAt(-1875, -255, seed);
  assert.ok(floated.lake, 'the flat reach is standing water, not a wall');
  const hit = pondAt(seed, -1875, -255);
  assert.ok(hit, 'pondAt names that water');
  assert.equal(hit!.surface, hit!.level);
  assert.deepEqual([...hit!.why], [...POND_WHY]);
  const c1400 = riverContainment(seed);
  assert.equal(c1400.openShare, 0, JSON.stringify(c1400));
  assert.equal(c1400.edgeHeightM, null);
  const c7 = riverContainment(7);
  assert.equal(c7.openShare, 0, JSON.stringify(c7));
});

test('water-sheet shore vertices meet the ground; no wet vertex stands above a dry neighbour', () => {
  const prev = STAGES.on, seed = STAGES.seed; STAGES.on = true; STAGES.seed = 1400;
  try {
    // Chunks that hold the audited float, slow1 and order2 viewpoints.
    let shores = 0;
    for (const [cx, cz] of [[-47, -7], [-30, -17], [74, 7]]) {
      const t = finish(terrainCore({ cx, cz, segments: 8, waterSeg: 16, stagesOn: true, stagesSeed: 1400 }));
      assert.ok(t.water, `chunk ${cx},${cz} has a water sheet`);
      const wp = t.water.position, wr = 17;
      const wet = (i: number) => {
        const x = wp[i * 3], z = wp[i * 3 + 2];
        if (lakeAt(1400, x, z) || pondAt(1400, x, z)) return true;
        const rv = riverAt(1400, x, z); return !!rv && rv.d < rv.half + rv.bank;
      };
      for (let i = 0; i < wr * wr; i++) if (wet(i)) {
        const ix = i % wr, iz = (i / wr) | 0, y = wp[i * 3 + 1];
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= wr || nz >= wr) continue;
          const j = nz * wr + nx; if (wet(j)) continue;
          shores++;
          const gy = heightAt(wp[j * 3], wp[j * 3 + 2]);
          assert.ok(y <= gy + 0.05, `chunk ${cx},${cz} water ${y.toFixed(2)} above dry ground ${gy.toFixed(2)}`);
          assert.ok(Math.abs(wp[j * 3 + 1] - Math.fround(gy)) < 1e-4, 'shore vertex is the ground, not ground-0.6');
        }
      }
    }
    assert.ok(shores > 0, 'at least one audited chunk has a shore edge');
  } finally { STAGES.on = prev; STAGES.seed = seed; }
});
