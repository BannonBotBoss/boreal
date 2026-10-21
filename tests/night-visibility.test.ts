import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LUX, NIGHT, darkAdapted, exposureFor, moonLux, nightKey, nightSkyLight, wolfEyes } from '../src/core/light';

// grok/night-visibility: wolf low-light vision keeps a moonless night readable without touching day, twilight or full moon.
test('wolf eyes: no boost in daylight, twilight or full moon; full boost on a moonless night', () => {
  assert.equal(wolfEyes(LUX.ref), 1); assert.equal(wolfEyes(400), 1); // overcast day / civil twilight
  const fullMoon = moonLux(14.77, 1) + LUX.nightSky; assert.ok(wolfEyes(fullMoon) < 1.05, `full moon ${wolfEyes(fullMoon)}`);
  assert.equal(wolfEyes(LUX.nightSky), NIGHT.wolf); assert.equal(darkAdapted(1e-5), 1);
  for (let lux = 1e-4; lux < 10; lux *= 1.5) assert.ok(wolfEyes(lux) >= wolfEyes(lux * 1.5) - 1e-12, 'monotonic: darker never adapts less');
});
test('moonless night: adapted sky + key light stay below noon sun (still night), not black', () => {
  const g = exposureFor(LUX.nightSky) * wolfEyes(LUX.nightSky), noonSun = 3;
  const total = nightSkyLight(0, g) + nightKey(g);
  assert.ok(total > .3 && total < noonSun, `night light ${total.toFixed(3)} vs sun ${noonSun}`);
  const before = 3 * LUX.nightSky / LUX.ref * exposureFor(LUX.nightSky); assert.ok(total > 5 * before, 'well above the old near-black level');
});
test('real moonlight takes over from the stand-in key', () => {
  const g = exposureFor(.25) * wolfEyes(.25), key = nightKey(g), moon = 3 * .25 / LUX.ref * g;
  assert.ok(key < .02 * moon, `key ${key} vs moon ${moon}`);
});