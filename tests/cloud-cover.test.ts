import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CLOUDS } from '../src/world/globe/atmosphere';
import { cloudCoverStats } from '../src/world/globe/cloudCover';
import { OCEAN_GLINT, fresnelF0, globeMaterial, glintRoughness } from '../src/world/globe/tile';
import { GLOBE_COLOURS } from '../src/world/globe/planet';
import { createAtmosphere } from '../src/world/globe/atmosphere';

test('T-0169 cloud cover: convective terms do not move the mean cover off the base fBm', () => {
  for (let i = 0; i < CLOUDS.octaves.length; i++) {
    const oct = CLOUDS.octaves[i];
    if (!oct) continue;
    const base = cloudCoverStats(oct, CLOUDS.edgeCentre[i], CLOUDS.edgeHalf[i], 320, false);
    const next = cloudCoverStats(oct, CLOUDS.edgeCentre[i], CLOUDS.edgeHalf[i], 320, true);
    assert.ok(Math.abs(next.cover - base.cover) < 0.04, `oct ${oct}: cover ${next.cover.toFixed(3)} vs base ${base.cover.toFixed(3)}`);
    assert.ok(next.cover > 0.05 && next.cover < 0.25, `oct ${oct}: cover ${next.cover.toFixed(3)} leaves the calibrated band`);
  }
  const ultra = cloudCoverStats(CLOUDS.octaves[0], CLOUDS.edgeCentre[0], CLOUDS.edgeHalf[0], 320, true);
  assert.ok(Math.abs(ultra.sd - CLOUDS.noiseSd) < 0.03, `sd ${ultra.sd.toFixed(3)} vs noiseSd ${CLOUDS.noiseSd}`);
});

test('T-0169 ocean: deep colour, Matthew fresnel, glint range, lakes stay Cox-Munk', () => {
  assert.ok(GLOBE_COLOURS.deep[2] < 0.02 && GLOBE_COLOURS.deep[0] < 0.002, 'deep is near #030b1e, not royal blue');
  assert.ok(GLOBE_COLOURS.deepSun[2] < 0.04 && GLOBE_COLOURS.deepSun[2] > GLOBE_COLOURS.deep[2], 'face-on lift stays midnight');
  assert.equal(GLOBE_COLOURS.shallow[0], 0.022, 'shallows unchanged');
  assert.ok(OCEAN_GLINT.roughness >= 0.15 && OCEAN_GLINT.roughness <= 0.2);
  assert.ok(OCEAN_GLINT.metalness >= 0.1 && OCEAN_GLINT.metalness <= 0.2);
  assert.ok(glintRoughness() > 0.4 && glintRoughness() < 0.48, 'lakes keep Cox-Munk');
  assert.ok(Math.abs(fresnelF0() - 0.02) < 0.001);
  const m = globeMaterial();
  createAtmosphere(6371000).patch(m);
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader } as unknown as THREE.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(sh, undefined as unknown as THREE.WebGLRenderer);
  const frag = sh.fragmentShader;
  assert.ok(frag.includes('float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);'), 'Matthew fresnel, verbatim');
  assert.ok(frag.includes('smoothstep(-0.08, 0.25, dot( geometryNormal, directLight.direction ))'), 'Lambert penumbra');
  assert.ok(frag.includes('uOceanRough') && frag.includes('uOceanMetal') && frag.includes('uLakeRough'), 'ocean glint and lake roughness both wired');
  assert.ok(frag.includes('gd_snoise('), 'simplex chop');
  assert.equal(frag.split('uniform float uOceanGlint').length, 2, 'uOceanGlint declared once');
  assert.ok(frag.includes('worleyF1(') && frag.includes('abs(nse * 2.0 - 1.0)'), 'billow and Worley are in the patched tile (the shell is the same GLSL)');
  assert.ok(frag.includes('csSpec = 1.0 - smoothstep(0.08, 0.35, coverS)'), 'glint is killed under cloud cover');
});
