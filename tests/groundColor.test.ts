import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { groundColor, STAGED_TOP } from '../src/render/math';

test('groundColor: S2 albedo per soil + 20 % top-layer tint (bedrock 10 %), linear RGB, writes into target', () => {
  const t = new THREE.Color(), out = groundColor('till', t);
  assert.equal(out, t, 'no allocation when a target is passed');
  const want = new THREE.Color(0x394838).lerp(new THREE.Color().setRGB(STAGED_TOP[0], STAGED_TOP[1], STAGED_TOP[2], THREE.SRGBColorSpace), .2);
  assert.ok(Math.abs(t.r - want.r) + Math.abs(t.g - want.g) + Math.abs(t.b - want.b) < 1e-6);
  const rock = groundColor('bedrock'), peat = groundColor('peat'), water = groundColor('water');
  assert.ok(rock.r > groundColor('till').r && rock.r > peat.r, 'outcrop is the brightest ground (albedo .13 vs .04)');
  assert.ok(water.equals(new THREE.Color(0x929771)), 'water: band colour, untinted');
  const moss = groundColor('till', new THREE.Color(), [.2, .5, .1]); assert.ok(moss.g > t.g, 'a per-point tint shifts the colour');
});
