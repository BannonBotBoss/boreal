import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clearSite, setSite, siteLatitude, siteLongitude } from '../src/core/sitePhase';
import { DAY, initDay, setDay, setHour, sunPosition } from '../src/core/timeOfDay';
import { SITE as WEATHER_SITE } from '../src/core/weather';
import { createVenus, siteVenusSky, utOf, venusSky } from '../src/render/venusSky';
import { chronoSunState, dialGradient } from '../src/ui/chronometer';

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

test('T-0170: siteLongitude defaults to homeLon and follows remote setSite / clearSite', () => {
  try {
    clearSite();
    near(siteLatitude(WEATHER_SITE.lat), WEATHER_SITE.lat);
    near(siteLongitude(WEATHER_SITE.lon), WEATHER_SITE.lon);

    setSite({
      latDeg: -23.44,
      lonDeg: 15.0,
      datumM: 120,
      salt: 7,
      dir: [0, 1, 0],
      east: [1, 0, 0],
      north: [0, 0, 1],
    });
    near(siteLatitude(WEATHER_SITE.lat), -23.44);
    near(siteLongitude(WEATHER_SITE.lon), 15.0);
  } finally {
    clearSite();
  }
  near(siteLongitude(WEATHER_SITE.lon), WEATHER_SITE.lon);
});

test('T-0170: chronoSunState and dialGradient follow world date and landed siteLatitude across seasons', () => {
  try {
    clearSite();
    initDay('?day=355&hour=12', null, 0);
    const winterNoon = chronoSunState(0);
    near(winterNoon.elevation, sunPosition(12, 355, WEATHER_SITE.lat).elevation, 1e-9);
    assert.equal(winterNoon.glyph, '☀');
    assert.equal(winterNoon.text, 'sun 17° up');

    setHour(16.5, 0);
    const winterDusk = chronoSunState(0);
    assert.ok(winterDusk.elevation < -4, `expected sun below horizon at 16:30 on Dec 21, got ${winterDusk.elevation}`);
    assert.equal(winterDusk.glyph, '☾');
    assert.equal(winterDusk.text, 'sun 4° down');

    // Remote Tropic of Capricorn landing (-23.44°S) at Dec 21 solar noon: sun near zenith (~90° up)
    setHour(12, 0);
    setSite({
      latDeg: -23.44,
      lonDeg: 15.0,
      datumM: 0,
      salt: 1,
      dir: [0, 1, 0],
      east: [1, 0, 0],
      north: [0, 0, 1],
    });
    const tropicNoon = chronoSunState(0);
    assert.ok(tropicNoon.elevation > 89.9, `expected near-zenith sun, got ${tropicNoon.elevation}`);
    assert.equal(tropicNoon.glyph, '☀');
    assert.equal(tropicNoon.text, 'sun 90° up');

    // August 15 baseline at Kenora (49.79°N)
    clearSite();
    setDay(227, 0);
    setHour(12, 0);
    const augNoon = chronoSunState(0);
    near(augNoon.elevation, sunPosition(12, 227, WEATHER_SITE.lat).elevation, 1e-9);
    assert.equal(augNoon.text, 'sun 55° up');

    // Dial conic-gradient reflects seasonal and latitude day-length differences
    const gWinterHome = dialGradient(355, WEATHER_SITE.lat);
    const gAugHome = dialGradient(227, WEATHER_SITE.lat);
    const gWinterTropic = dialGradient(355, -23.44);
    assert.notEqual(gWinterHome, gAugHome, 'winter and summer dial gradients must differ at 49.79°N');
    assert.notEqual(gWinterHome, gWinterTropic, '49.79°N and -23.44°S dial gradients must differ on day 355');
  } finally {
    clearSite();
    DAY.offset = 0;
    DAY.dayOffset = 0;
    DAY.year = 2026;
  }
});

test('T-0170: siteVenusSky and createVenus.update use landed siteLatitude and siteLongitude', () => {
  const date355 = new Date(Date.UTC(2026, 0, 355));
  const scene = new THREE.Scene();
  const venus = createVenus(scene, '');
  const camPos = new THREE.Vector3(0, 2, 0);
  try {
    clearSite();
    const home = venus.update(date355, 12, camPos);
    const expectedHome = venusSky(utOf(date355, 12, WEATHER_SITE.lon), WEATHER_SITE.lat, WEATHER_SITE.lon);
    assert.ok(home);
    near(home.alt.elevation, expectedHome.alt.elevation, 1e-9);
    near(home.sunAlt, expectedHome.sunAlt, 1e-9);

    setSite({
      latDeg: -23.44,
      lonDeg: 15.0,
      datumM: 0,
      salt: 1,
      dir: [0, 1, 0],
      east: [1, 0, 0],
      north: [0, 0, 1],
    });
    const remote = venus.update(date355, 12, camPos);
    const expectedRemote = venusSky(utOf(date355, 12, 15.0), -23.44, 15.0);
    const directHelper = siteVenusSky(date355, 12);
    assert.ok(remote);
    near(remote.alt.elevation, expectedRemote.alt.elevation, 1e-9);
    near(remote.sunAlt, expectedRemote.sunAlt, 1e-9);
    near(directHelper.alt.elevation, expectedRemote.alt.elevation, 1e-9);
    assert.ok(Math.abs(remote.alt.elevation - home.alt.elevation) > 25, 'remote Venus altitude differs by >25 deg from Kenora');
    assert.ok(Math.abs(remote.sunAlt - home.sunAlt) > 70, 'remote noon Sun altitude (~89.2 deg) differs by >70 deg from Kenora (~16.8 deg)');
  } finally {
    clearSite();
  }
});
