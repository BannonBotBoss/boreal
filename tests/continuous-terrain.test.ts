/** One terrain mesh to the horizon. Chunked LOD, skirts, the same height function. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvatureDrop, horizonMetres } from '../src/world/globe/horizonSkirt';
import { buildContinuousMesh, selectTerrainLeaves, SKIRT_FLOOR_M } from '../src/render/continuousTerrain';

function area(leaves: { size: number }[]) {
  return leaves.reduce((s, l) => s + l.size * l.size, 0);
}

test('the leaves tile one square that passes the horizon, with no overlap', () => {
  for (const eye of [1.6, 40, 400]) {
    const { leaves, root } = selectTerrainLeaves(120, -40, eye);
    assert.equal(area(leaves), root.size * root.size, `eye ${eye} area`);
    assert.ok(root.size / 2 >= horizonMetres(eye), `eye ${eye} root reaches the horizon`);
    const seen = new Set<string>();
    for (const leaf of leaves) {
      const k = `${leaf.x0},${leaf.z0}`;
      assert.equal(seen.has(k), false, 'two leaves share a corner');
      seen.add(k);
      assert.ok(leaf.x0 >= root.x0 - 1e-6 && leaf.z0 >= root.z0 - 1e-6);
      assert.ok(leaf.x0 + leaf.size <= root.x0 + root.size + 1e-6);
    }
    // A neighbour is at most twice as large (restricted quadtree).
    const cover = (x: number, z: number) => leaves.find(l => x >= l.x0 && z >= l.z0 && x < l.x0 + l.size && z < l.z0 + l.size);
    for (const leaf of leaves) {
      const n = cover(leaf.x0 + leaf.size / 2, leaf.z0 - leaf.size * 0.25);
      if (n) assert.ok(n.size <= leaf.size * 2 + 0.01, `south neighbour ${n.size} vs ${leaf.size}`);
    }
  }
});

test('every vertex is the height function minus earth curvature, and skirts drop below it', () => {
  const height = (x: number, z: number) => 4 + Math.sin(x * 0.01) + Math.cos(z * 0.013);
  const mesh = buildContinuousMesh(0, 0, 40, height);
  assert.ok(mesh.outerM >= horizonMetres(40) * 0.99, `outer ${mesh.outerM}`);
  assert.equal(mesh.index.length, mesh.triangles * 3);
  assert.ok(mesh.leaves > 8 && mesh.leaves < 800, `leaves ${mesh.leaves}`);
  let skirts = 0, surface = 0;
  for (let i = 0; i < mesh.position.length / 3; i++) {
    const x = mesh.position[i * 3], y = mesh.position[i * 3 + 1], z = mesh.position[i * 3 + 2];
    const expected = height(x, z) - curvatureDrop(Math.hypot(x, z));
    const below = expected - y;
    assert.ok(below > -0.05, `vertex above the surface (${below})`);
    if (below > SKIRT_FLOOR_M * 0.5) skirts++;
    else { surface++; assert.ok(below < 0.05, `surface vertex off the height function by ${below}`); }
    assert.ok(mesh.normal[i * 3 + 1] > 0.2, 'normal points up');
  }
  assert.ok(surface > skirts, 'most vertices are the surface');
  assert.ok(skirts > mesh.leaves * 4, 'each leaf has a skirt');
  // Winding of the first triangle faces up.
  const p = (i: number) => [mesh.position[i * 3], mesh.position[i * 3 + 1], mesh.position[i * 3 + 2]];
  const a = p(mesh.index[0]), b = p(mesh.index[1]), c = p(mesh.index[2]);
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  assert.ok(ny > 0, 'first triangle is counter-clockwise from above');
});
