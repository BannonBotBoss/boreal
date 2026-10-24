import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUN, fluxAt, angularRadius, discXYZ, chromaticity, contrast, limb } from '../src/world/sun/spectrum';
import { ev100FromSettings, ev100FromLuminance, exposureFromEV100, adapt, targetEV, CAM, pixelsFor, fovFromFocal } from '../src/render/exposure';
import { parseSilso, groupsOn, meanLatitude, joyTilt, halePolarity, omega, radiusFrac, SPOT } from '../src/world/sun/sunspots';
import { BANDS, band, quietBrightness, scaleHeight } from '../src/world/sun/bands';

test('TSI and angular size from IAU nominal values', () => {
  assert.ok(Math.abs(fluxAt() - SUN.TSI) < 2, `TSI ${fluxAt()}`);
  assert.ok(Math.abs(angularRadius() * 180 / Math.PI - .2666) < .0005);
  assert.ok(angularRadius(SUN.AU * 1.0167) < angularRadius(SUN.AU * .9833)); // aphelion smaller
});
test('luminance ~1.6e9 cd/m2 at the ground; white from space, yellow-orange low in the sky', () => {
  const space = discXYZ(null), zen = discXYZ(1), low = discXYZ(Math.cos(85 * Math.PI / 180));
  assert.ok(zen[1] > 1.3e9 && zen[1] < 2.1e9, `Y ${zen[1]}`);
  const [xs, ys] = chromaticity(space), [xl] = chromaticity(low);
  assert.ok(xs > .31 && xs < .34 && ys > .31 && ys < .35, `space xy ${xs},${ys}`);
  assert.ok(xl > xs + .05, `low sun redder ${xl}`);
});
test('limb darkening and spot contrast', () => {
  assert.ok(Math.abs(limb(.5) - .7) < .05); // Neckel & Labs ~0.7 at mu=0.5, 550 nm
  const u = contrast(SPOT.umbraT); assert.ok(u > .05 && u < .3, `umbra ${u}`);
});
test('Frostbite EV100 and adaptation', () => {
  assert.ok(Math.abs(ev100FromSettings(16, 1 / 100, 100) - 14.64) < .01); // sunny-16 ~ EV 15
  assert.ok(Math.abs(exposureFromEV100(0) - 1 / 1.2) < 1e-9);
  assert.ok(Math.abs(ev100FromLuminance(12.5 / 100)) < 1e-9);
  const up = adapt(0, 10, CAM.tauLight), down = adapt(10, 0, CAM.tauLight);
  assert.ok(up > 6 && down > 9); // bright fast, dark slow
  const t = targetEV(5000, 1.6e9); assert.ok(1.6e9 * exposureFromEV100(t) < 2, 'staring at the Sun pulls the disc to the shoulder');
  assert.ok(targetEV(5000, 5000) === ev100FromLuminance(5000));
});
test('2 px rule: spots invisible at 50 mm, visible at 2000 mm', () => {
  const r = radiusFrac(300) * angularRadius();
  assert.ok(pixelsFor(2 * r, fovFromFocal(50), 1080) < 2); assert.ok(pixelsFor(2 * r, fovFromFocal(2000), 1080) > 2);
});
test('cycle laws', () => {
  assert.ok(meanLatitude(0) > 25 && meanLatitude(132) < 8);
  assert.ok(joyTilt(20) > 10 && joyTilt(-20) < 0);
  assert.equal(halePolarity(25, true), -halePolarity(24, true)); assert.equal(halePolarity(25, true), -halePolarity(25, false));
  assert.ok(omega(0) > omega(30));
});
test('SILSO-driven groups match Hoyt & Schatten counts on average', () => {
  const silso = parseSilso(readFileSync('public/data/silso/SN_d_tot_V2.0.csv', 'utf8'));
  assert.equal(silso.get('2024-05-10'), 172);
  let want = 0, got = 0; for (let d = 0; d < 365; d++) { const date = new Date(Date.UTC(2024, 0, 1) + d * 864e5); want += silso.get(date.toISOString().slice(0, 10))! * SPOT.groupsPerR; got += groupsOn(date, silso).length; }
  assert.ok(Math.abs(got / want - 1) < .35, `groups ${got} vs ${want}`);
  assert.equal(groupsOn(new Date(Date.UTC(2008, 11, 15)), silso).length < 3, true); // solar minimum
});
test('bands: thin coronal lines limb-brighten, X-ray quiet disc dark', () => {
  const v = band('visible'), e = band('euv171'), x = band('xray');
  assert.ok(quietBrightness(v, .1, .99, .5) < quietBrightness(v, 1, 0, .5));
  assert.ok(quietBrightness(e, .1, .99, 0) > quietBrightness(e, 1, 0, 0));
  assert.ok(quietBrightness(x, 1, 0, 0) < .05 && x.ar > 1);
  assert.ok(scaleHeight(1e6) > .05 && scaleHeight(1e6) < .1); // ~50 Mm
  assert.equal(BANDS.length, 8);
});
