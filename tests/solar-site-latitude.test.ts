import test from 'node:test';
import assert from 'node:assert/strict';
import { solar, SITE } from '../src/core/weather';
import { setSite, clearSite } from '../src/core/sitePhase';

// Oct 31 sprint gate (shared location context): after a remote landing the forest sun must use the landed
// site's latitude, so an equatorial landing in June gets a near-overhead noon sun, not Kenora's.
test('solar() follows the landed site latitude, Kenora at home', () => {
  const day = 172, noon = 12 - (SITE.lon / 15 - SITE.tz); // local solar noon at Kenora's meridian
  const home = solar(day, noon);
  assert.ok(Math.abs(home.cosZ - solar(day, noon, SITE.lat).cosZ) < 1e-12);
  setSite({ latDeg: 23.44, lonDeg: -94.36, datumM: 0, salt: 3, dir: [1, 0, 0], east: [0, 0, 1], north: [0, 1, 0] });
  try {
    const remote = solar(day, noon);
    assert.ok(Math.abs(remote.cosZ - solar(day, noon, 23.44).cosZ) < 1e-12);
    assert.ok(remote.cosZ > 0.99, `tropic noon sun cosZ ${remote.cosZ}`);
    assert.ok(remote.cosZ > home.cosZ + 0.05);
  } finally { clearSite(); }
  assert.ok(Math.abs(solar(day, noon).cosZ - home.cosZ) < 1e-12);
});
