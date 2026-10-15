import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32, sampleSurface, triangleAreas } from '../src/core/surfaceSampler';
import { buildBody, wolfCoat } from '../src/core/body';
import { wolfTubes, sculptWolf, BONE_COUNT } from '../src/core/wolfBody';
import { buildFurCards, cardDirections } from '../src/render/furCards';

test('surface sampling is seeded and area-weighted', () => {
  const position = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 5, 4, 0, 5, 0, 4, 5], index = [0, 1, 2, 3, 4, 5]; // areas .5 and 8
  const a = sampleSurface(position, index, 400, mulberry32(3)), b = sampleSurface(position, index, 400, mulberry32(3));
  assert.deepEqual(a, b);
  assert.deepEqual(triangleAreas(position, index), [.5, 8]);
  const big = a.filter(s => s.tri === 1).length / a.length;
  assert.ok(big > .85 && big < .99, `big triangle share ${big}`);
  assert.ok(a.every(s => Math.abs(s.u + s.v + s.w - 1) < 1e-9 && s.u >= 0 && s.v >= 0 && s.w >= 0));
});

test('cards lie along the fur direction, not out like quills', () => {
  const rand = mulberry32(5), N = new THREE.Vector3(0, 1, 0), lay = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 100; i++) {
    const { d1, d2, tangent } = cardDirections(N, lay, rand);
    assert.ok(tangent.dot(lay) > .9, 'tangent follows the lay direction');
    assert.ok(d1.dot(N) < .85 && d1.dot(N) > .4, 'root segment leans out of the skin');
    assert.ok(d2.dot(N) < .4, 'tip segment lies nearly flat');
    assert.ok(d2.dot(lay) > .85, 'tip points along the fur direction');
  }
});

test('fur cards inherit skin weights, stay near the body and respect the clear zones', () => {
  const body = buildBody(wolfTubes(wolfCoat(1400))), clear = sculptWolf(body);
  const g = buildFurCards(body, { count: 3000, length: .03, width: .0065, seed: 9, clear });
  const n = g.getAttribute('position').count;
  assert.ok(n > 3000 * 4 && n <= 3000 * 5, `${n} card vertices`);
  const idx = g.getAttribute('skinIndex'), wts = g.getAttribute('skinWeight'), pos = g.getAttribute('position');
  for (let v = 0; v < n; v++) {
    let sum = 0; for (let k = 0; k < 4; k++) { sum += wts.getX(v) * 0 + [wts.getX(v), wts.getY(v), wts.getZ(v), wts.getW(v)][k]; }
    assert.ok(Math.abs(sum - 1) < 1e-5);
    assert.ok([idx.getX(v), idx.getY(v), idx.getZ(v), idx.getW(v)].every(i => i < BONE_COUNT));
    for (const k of [pos.getX(v), pos.getY(v), pos.getZ(v)]) assert.ok(Number.isFinite(k));
  }
  g.computeBoundingBox();
  assert.ok(g.boundingBox!.max.y < .55 && g.boundingBox!.min.y > -.1);
  const again = buildFurCards(body, { count: 3000, length: .03, width: .0065, seed: 9, clear });
  assert.deepEqual(Array.from(again.getAttribute('position').array.slice(0, 60)), Array.from(pos.array.slice(0, 60)));
});

test('bare parts (lips, tongue, mouth-corner seal) never receive fur cards', () => {
  const body = buildBody(wolfTubes(wolfCoat(1400)));
  const g = buildFurCards(body, { count: 5000, length: .03, width: .0065, seed: 4 });
  const tris = g.userData.tris as number[], source = g.userData.sourceTris as number[];
  assert.ok(source.length > 4000);
  for (const t of source) {
    const fur = (body.furLen[tris[t * 3]] + body.furLen[tris[t * 3 + 1]] + body.furLen[tris[t * 3 + 2]]) / 3;
    assert.ok(fur >= .03, `card grew on a bare triangle (fur ${fur})`);
  }
});
