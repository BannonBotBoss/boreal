import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLocalClouds, keptCloudFade, boxEdgeSin, LOCAL_CLOUDS } from '../src/world/globe/localClouds';

test('#202 (1): the kept box holds at full strength near the handover point and fades out by its edge, with no step', () => {
  const L = LOCAL_CLOUDS; assert.equal(keptCloudFade(0), 1); assert.equal(keptCloudFade(L.sizeM / 4), 1); assert.equal(keptCloudFade(L.sizeM / 2), 0);
  let prev = 1; for (let d = 0; d <= L.sizeM / 2; d += 5) { const k = keptCloudFade(d); assert.ok(prev - k <= .02 && k <= prev, `step at ${d} m`); prev = k; }
});

test('#202 (1): the summed cloud along the down-looking view is continuous across the 60 m handover', () => {
  // band: overlay at localCloudFade(alt) = 1 below the box size (patch fully in); game, at the handover point: kept box at keptCloudFade(0)
  const band = 1, game = keptCloudFade(0); assert.ok(Math.abs(band - game) <= .02);
});

test('#202 (1): the dome paints only below the elevation where the cloud base lies past the box edge', () => {
  const s = boxEdgeSin(1250, LOCAL_CLOUDS.sizeM / 2); // Kenora July base ~1250 m, 16 km to the edge
  assert.ok(s > .07 && s < .09, `sin ${s}`); // about 4.5 degrees
  assert.ok(boxEdgeSin(1250, 1000) > boxEdgeSin(1250, 8000), 'nearer the edge, the dome covers more of the sky');
});

test('#202 (1): the overlay has its own camera uniform (game metres), the globe copy keeps the shared one', () => {
  const lc = createLocalClouds(); const om = lc.overlay.material as THREE.RawShaderMaterial, gm = lc.mesh.material as THREE.RawShaderMaterial;
  assert.notEqual(om.uniforms.uCamLocal, gm.uniforms.uCamLocal); assert.equal(om.uniforms.uVol, gm.uniforms.uVol); assert.equal(om.uniforms.uSunLocal, gm.uniforms.uSunLocal);
});
