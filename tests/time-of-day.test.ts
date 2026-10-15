import test from 'node:test';
import assert from 'node:assert/strict';
import { gameHour, formatHour, sunPosition, declination, lighting, LATITUDE, DAY_OF_YEAR, REAL_SECONDS_PER_GAME_HOUR } from '../src/core/timeOfDay';
test('one game hour every 5 real minutes; a day takes 2 real hours and wraps', () => {
  assert.equal(REAL_SECONDS_PER_GAME_HOUR, 300);
  assert.equal(gameHour(300, 8), 9); assert.equal(gameHour(2 * 3600, 8), 8); assert.equal(gameHour(5 * 3600, 20), 8);
  assert.equal(formatHour(13.5), '13:30'); assert.equal(formatHour(0.25), '00:15');
});
test('solar geometry: noon elevation = 90 − latitude + declination, due south; midnight below the horizon', () => {
  const noon = sunPosition(12);
  assert.ok(Math.abs(noon.elevation - (90 - LATITUDE + declination(DAY_OF_YEAR))) < 1e-9);
  assert.ok(Math.abs(noon.azimuth - 180) < 1e-6); assert.ok(noon.direction.z > 0, 'south is +z');
  assert.ok(sunPosition(0).elevation < -10);
  assert.ok(Math.abs(declination(172) - 23.44) < .1 && Math.abs(declination(355) + 23.44) < .1, 'solstices');
});
test('sun rises in the east, sets in the west, and day length fits mid-August at 49.5°N (~14 h)', () => {
  let rise = -1, set = -1;
  for (let m = 0; m < 24 * 60; m++) { const e = sunPosition(m / 60).elevation, e2 = sunPosition((m + 1) / 60).elevation;
    if (e < 0 && e2 >= 0) rise = m / 60; if (e >= 0 && e2 < 0) set = m / 60; }
  assert.ok(set - rise > 13.5 && set - rise < 15, `day length ${set - rise}`);
  assert.ok(sunPosition(rise).direction.x > 0 && sunPosition(set).direction.x < 0, 'east is +x');
  assert.ok(sunPosition(rise + .01).azimuth > 45 && sunPosition(rise + .01).azimuth < 90);
});
test('lighting: full day above 8°, dark below civil twilight, warm near the horizon', () => {
  assert.equal(lighting(30).day, 1); assert.equal(lighting(-10).day, 0); assert.equal(lighting(-10).night, 1);
  assert.ok(lighting(1).golden > .8 && lighting(40).golden === 0);
});
