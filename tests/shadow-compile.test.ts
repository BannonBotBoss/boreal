/** PCSS must not splice `shadow = ...` in front of the sampler uniform. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

test('the first PCF test in three 0.185 is the sampler uniform, before float shadow is declared', () => {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const ifdef = chunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )');
  const declared = chunk.indexOf('float shadow = 1.0');
  assert.ok(ifdef >= 0 && declared > ifdef, 'getShadow still declares float shadow after the uniform');
  const spliced = chunk.replace(
    '#if defined( SHADOWMAP_TYPE_PCF )',
    '#if defined( PCSS )\n\t\t\tshadow = pcssShadow(shadowMap, 1. / shadowMapSize, shadowCoord.xyz);\n\t\t#elif defined( SHADOWMAP_TYPE_PCF )',
  );
  const assign = spliced.indexOf('shadow = pcssShadow');
  assert.ok(assign >= 0 && assign < spliced.indexOf('float shadow = 1.0'), 'the old splice assigns shadow before it exists');
});

test('photoreal does not splice that assignment into the shared shadow chunk', () => {
  const src = readFileSync('src/render/photoreal.ts', 'utf8');
  assert.equal(src.includes("c.replace('#if defined( SHADOWMAP_TYPE_PCF )'"), false);
  assert.equal(src.includes('ShaderChunk.shadowmap_pars_fragment ='), false);
});
