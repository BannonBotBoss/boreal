/** T-0109 / issue #156. The glide ground reaches the geometric horizon on the planet the globe already samples. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBE_LOD } from '../src/world/globe/lod';
import { PLANET, planetFor } from '../src/world/globe/planet';
import { XR_CAPS } from '../src/core/quality';
import {
  HORIZON_SKIRT, buildSkirtMesh, curvatureDrop, horizonMetres, patchDiscRadius,
  skirtOrigin, skirtRadii, skirtRings, skirtSample, skirtSegments, skirtTriangles,
} from '../src/world/globe/horizonSkirt';

const QUEST_TRIS = 750_000; // core/quality.ts: Quest 3 soft ceiling, triangles per eye

test('the horizon distance and the sphere drop meet at eye level', () => {
  assert.equal(curvatureDrop(0), 0);
  for (const eye of [12, 36, 400, 3048]) {
    const r = horizonMetres(eye);
    const exact = eye * PLANET.radius / (PLANET.radius + eye);
    assert.ok(Math.abs(curvatureDrop(r) - exact) < 0.05, `drop at ${eye} m`);
    // drop = eye * R/(R+eye), so it sits eye^2/R below the eye. Under a kilometre that is centimetres.
    assert.ok(Math.abs(curvatureDrop(r) - eye) < eye * eye / PLANET.radius + 0.05);
    assert.ok(r > eye * 20, 'the horizon is much farther than the eye height');
  }
});

test('rings start under the chunk patch and pass the horizon without a gap', () => {
  for (const eye of [12, 40, 400, 2000]) {
    const rings = skirtRings(eye);
    assert.equal(rings[0].r0, HORIZON_SKIRT.innerM);
    assert.ok(rings[rings.length - 1].r1 >= horizonMetres(eye));
    for (let i = 0; i < rings.length; i++) {
      assert.ok(rings[i].r1 > rings[i].r0);
      if (i) assert.equal(rings[i].r0, rings[i - 1].r1);
    }
    const radii = skirtRadii(rings);
    const rows = radii.length;
    const segments = skirtSegments(rows);
    assert.ok(skirtTriangles(rows, segments) <= HORIZON_SKIRT.maxTriangles);
    assert.ok(segments >= 24);
  }
});

test('a flat place drops to the horizon and the outer ring can dither away', () => {
  const eye = 400;
  const mesh = buildSkirtMesh(0, 0, eye, () => ({ y: 5, rgb: [0.2, 0.4, 0.1] }));
  assert.ok(mesh.triangles <= HORIZON_SKIRT.maxTriangles);
  assert.equal(mesh.index.length, mesh.triangles * 3);
  let minFade = 1, maxFade = 0;
  for (let i = 0; i < mesh.fade.length; i++) {
    minFade = Math.min(minFade, mesh.fade[i]);
    maxFade = Math.max(maxFade, mesh.fade[i]);
    const x = mesh.position[i * 3], y = mesh.position[i * 3 + 1], z = mesh.position[i * 3 + 2];
    const dropped = 5 - curvatureDrop(Math.hypot(x, z));
    assert.ok(Math.abs(y - dropped) < 0.05, `vertex ${i} y ${y} vs ${dropped}`);
    assert.ok(mesh.normal[i * 3 + 1] > 0.5, 'normal points up');
  }
  assert.equal(maxFade, 1);
  assert.ok(minFade < 0.05, 'the outer ring fades out');
  assert.ok(mesh.outerM >= horizonMetres(eye), 'the mesh passes the horizon');
  // Winding: the first triangle's geometric normal points up.
  const i0 = mesh.index[0], i1 = mesh.index[1], i2 = mesh.index[2];
  const p = (i: number) => [mesh.position[i * 3], mesh.position[i * 3 + 1], mesh.position[i * 3 + 2]];
  const a = p(i0), b = p(i1), c = p(i2);
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const ny = uz * vx - ux * vz;
  assert.ok(ny > 0, 'first triangle is counter-clockwise from above');
});

test('home land keeps the local height, and the disc covers the loaded square', () => {
  const planet = planetFor(1400, () => 4, 'skirt-flat');
  const origin = skirtOrigin(planet, 4);
  const at = skirtSample(planet, 0, 0, origin);
  assert.ok(Math.abs(at.y - 4) < 1e-6, `origin ${at.y}`);
  const step = skirtSample(planet, 80, -40, origin);
  assert.ok(Math.abs(step.y - 4) < 1e-3, `near ${step.y}`);
  assert.equal(step.water, false);
  const loaded = 80;
  const disc = patchDiscRadius(loaded);
  assert.ok(disc >= loaded * Math.SQRT2, 'the fade circle covers the chunk-square corners');
});

test('far quads behind the eye are dropped so they cannot smear across the sky', () => {
  const full = buildSkirtMesh(0, 0, 400, () => ({ y: 0, rgb: [0, 1, 0] }));
  const forward = buildSkirtMesh(0, 0, 400, () => ({ y: 0, rgb: [0, 1, 0] }), undefined, (x, _z, ringR) => ringR < 200 || x > -50);
  assert.ok(forward.triangles < full.triangles);
  assert.ok(forward.triangles > 0);
  for (let t = 0; t < forward.index.length; t += 3) {
    const xs = [0, 1, 2].map(k => forward.position[forward.index[t + k] * 3]);
    const rs = xs.map(x => Math.abs(x));
    if (Math.max(...rs) > 200) assert.ok(xs.every(x => x > -50), 'a far triangle stays in front');
  }
});

test('the skirt budget leaves the Quest triangle cap intact', () => {
  const ultra = GLOBE_LOD[0];
  const globeTris = ultra.draw * ultra.segments * ultra.segments * 2;
  assert.ok(globeTris + HORIZON_SKIRT.maxTriangles < QUEST_TRIS, `${globeTris} + skirt`);
  assert.equal(XR_CAPS.gi, 0);
  assert.equal(XR_CAPS.rays, 0);
  assert.equal(XR_CAPS.ssao, 0);
  assert.equal(XR_CAPS.shadows, 1);
  assert.ok((XR_CAPS.trees ?? 1) <= 0.6);
});
