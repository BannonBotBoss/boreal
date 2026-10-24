// OI 557.7 nm airglow: 250 R at zenith -> luminance (Rayleigh definition, h c / lambda, K_cd, V), and its panel toggle
import test from 'node:test'; import assert from 'node:assert/strict';
import { AIRGLOW } from '../src/world/globe/atmosphere';
import { LAYERS, parseHidden } from '../src/world/globe/layerPanel';
test('airglow: 250 R green line is ~4.8e-5 cd/m2 at zenith (~22 mag/arcsec2 class: far below the 1.7e-4 night floor alone), toggleable', () => {
  assert.ok(Math.abs(AIRGLOW.zenithCd / 4.83e-5 - 1) < .02, `${AIRGLOW.zenithCd}`);
  assert.ok(AIRGLOW.peakKm >= 90 && AIRGLOW.peakKm <= 100);
  assert.ok((LAYERS as readonly string[]).includes('airglow')); assert.ok(parseHidden('?hide=airglow', null).has('airglow')); assert.ok(!parseHidden('', null).has('airglow'));
});
