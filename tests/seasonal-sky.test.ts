import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DAY,
  DAY_OF_YEAR,
  LATITUDE,
  REAL_SECONDS_PER_GAME_HOUR,
  START_HOUR,
  dayAt,
  declination,
  hourAt,
  setDay,
  setHour,
  sunPosition,
} from '../src/core/timeOfDay';
import { SITE as WEATHER_SITE, WEATHER } from '../src/core/weather';
import { clearSite, setSite } from '../src/core/sitePhase';
import { createSky } from '../src/render/sky';
import { LIGHTING } from '../src/render/pbr';
import { moonAge } from '../src/core/light';
import { createPlanet, fromLatLon, planetSunDirection, toLatLon } from '../src/world/globe/planet';
import { shadowAway } from '../src/render/trees/overheadCrowns';

const RAD = Math.PI / 180;

/**
 * Independent NOAA General Solar Position reference (Spencer 1971 Fourier series):
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
function noaaSolarRef(hourLocalSolar: number, dayOfYear: number, latDeg: number) {
  const doy = ((dayOfYear - 1) % 365 + 365) % 365 + 1;
  // declination(dayOfYear) in timeOfDay.ts evaluates Spencer 1971 at noon (hour=12)
  const g = (2 * Math.PI / 365) * (doy - 1 + (12 - 12) / 24);
  const declRad =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const phi = latDeg * RAD;
  const h = 15 * (hourLocalSolar - 12) * RAD;
  const sinEl = Math.sin(phi) * Math.sin(declRad) + Math.cos(phi) * Math.cos(declRad) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(declRad) * Math.cos(phi)) + Math.PI;
  return {
    declDeg: declRad / RAD,
    elevationDeg: el / RAD,
    azimuthDeg: ((az / RAD) % 360 + 360) % 360,
    direction: {
      x: Math.cos(el) * Math.sin(az),
      y: Math.sin(el),
      z: -Math.cos(el) * Math.cos(az),
    },
  };
}

describe('T-0022 seasonal solar date propagation and NOAA geometry', () => {
  const savedOffset = DAY.offset;
  const savedDayOffset = DAY.dayOffset;
  const savedWeatherDay = WEATHER.day;
  const savedWeatherOn = WEATHER.on;

  afterEach(() => {
    DAY.offset = savedOffset;
    DAY.dayOffset = savedDayOffset;
    WEATHER.day = savedWeatherDay;
    WEATHER.on = savedWeatherOn;
    clearSite();
  });

  it('preserves default day 227 appearance and matches NOAA Spencer (1971) on day 227 and day 355', () => {
    const defNoon = sunPosition(12);
    const exp227 = noaaSolarRef(12, DAY_OF_YEAR, LATITUDE);
    assert.ok(Math.abs(defNoon.elevation - exp227.elevationDeg) < 1e-9);
    assert.ok(Math.abs(defNoon.azimuth - 180) < 1e-9);

    const win355 = sunPosition(12, 355, LATITUDE);
    const exp355 = noaaSolarRef(12, 355, LATITUDE);
    assert.ok(Math.abs(win355.elevation - exp355.elevationDeg) < 1e-9);
    // Winter solstice noon at 49.5 N is ~17.07 deg, ~37.7 deg lower than Aug 15 (~54.79 deg)
    assert.ok(win355.elevation > 16.9 && win355.elevation < 17.2);
    assert.ok(defNoon.elevation - win355.elevation > 37.5);
  });

  it('wraps positive multi-year rollover and negative rewind days cleanly across 365-day years', () => {
    for (const [dA, dB] of [
      [1, 366],
      [227, 227 + 365],
      [355, 355 + 730],
      [365, 0],
      [355, -10],
    ] as const) {
      const a = sunPosition(14.5, dA, WEATHER_SITE.lat);
      const b = sunPosition(14.5, dB, WEATHER_SITE.lat);
      assert.ok(Math.abs(a.elevation - b.elevation) < 1e-9, `mismatch between day ${dA} and ${dB}`);
      assert.ok(Math.abs(a.azimuth - b.azimuth) < 1e-9, `azimuth mismatch between day ${dA} and ${dB}`);
    }
  });

  it('propagates authoritative world date and site latitude to createSky sun, aerial uniforms, and lunar age/elevation', () => {
    WEATHER.on = false;
    WEATHER.day = 227; // deliberately stale WEATHER.day to prove sky.ts uses dayAt(time)
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 10, 500);
    const skyHandle = createSky(scene);
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
    const focus = new THREE.Vector3(0, 0, 0);

    // Advance clock to day 355 at 12:00 solar noon
    DAY.offset = 0;
    DAY.dayOffset = 0;
    setDay(355, 0);
    setHour(12, 0);
    assert.equal(dayAt(0), 355);
    assert.ok(Math.abs(hourAt(0) - 12) < 1e-9);

    skyHandle.update(hourAt(0), 0, cam, focus);
    const uSun = (skyHandle.sky.material as THREE.ShaderMaterial).uniforms.sunPosition.value as THREE.Vector3;
    const expected355 = noaaSolarRef(12, 355, WEATHER_SITE.lat);
    const skyElevDeg = Math.asin(Math.max(-1, Math.min(1, uSun.y))) / RAD;
    assert.ok(Math.abs(skyElevDeg - expected355.elevationDeg) < 1e-6);
    assert.ok(Math.abs(LIGHTING.moonAge - moonAge(355)) < 1e-9, 'LIGHTING.moonAge must track dayAt(time), not stale WEATHER.day');
    assert.notEqual(moonAge(355), moonAge(227));

    // Verify Southern Hemisphere landing site latitude propagates to both sun and moon in sky.update
    const latS = -42.0, lonS = 172.0;
    const dir = fromLatLon(latS * RAD, lonS * RAD);
    setSite({
      latDeg: latS,
      lonDeg: lonS,
      datumM: 120,
      salt: 1,
      treeShare: 0.6,
      coastM: 50000,
      dir,
      east: [-Math.sin(lonS * RAD), 0, Math.cos(lonS * RAD)],
      north: [-Math.sin(latS * RAD) * Math.cos(lonS * RAD), Math.cos(latS * RAD), -Math.sin(latS * RAD) * Math.sin(lonS * RAD)],
    });
    skyHandle.update(12, 0, cam, focus);
    const southRef = noaaSolarRef(12, 355, latS);
    const southSkyElevDeg = Math.asin(Math.max(-1, Math.min(1, uSun.y))) / RAD;
    assert.ok(Math.abs(southSkyElevDeg - southRef.elevationDeg) < 1e-6);
    // At 42 S on Dec 21 (day 355), noon sun is high (~71.4 deg) and in the north (+z < 0 -> z < 0, wait: north is -z so sun.direction.z < 0!)
    assert.ok(southSkyElevDeg > 71.0);
    assert.ok(uSun.z < 0, 'Southern Hemisphere summer noon sun is due north (-z)');
  });

  it('aligns planetSunDirection and overheadCrowns shadowAway with geocentric solar declination at planet.home', () => {
    const planet = createPlanet(42);
    const homeLl = toLatLon(planet.home);
    for (const day of [80, 172, 227, 355, 592]) {
      // At local solar noon (hour = 12) at planet.home, the geocentric subsolar latitude MUST equal solar declination(day)
      // and the subsolar longitude MUST equal planet.home longitude.
      const sunVec = planetSunDirection(planet, 12, day);
      const subsolar = toLatLon(sunVec);
      const subsolarLatDeg = subsolar.lat / RAD;
      const expectedDeclDeg = declination(day);
      assert.ok(
        Math.abs(subsolarLatDeg - expectedDeclDeg) < 1e-9,
        `day ${day}: subsolar lat ${subsolarLatDeg} != declination ${expectedDeclDeg}`,
      );
      assert.ok(Math.abs(subsolar.lon - homeLl.lon) < 1e-9);
    }

    // At planet.home noon on day 355, sun is due south of home, so overhead crown shadow points due north (n > 0.999, |e| < 1e-6)
    DAY.offset = 0;
    DAY.dayOffset = 0;
    setDay(355, 0);
    setHour(12, 0);
    const sh = shadowAway(
      planet,
      new THREE.Vector3(...planet.east),
      new THREE.Vector3(...planet.north),
      0,
    );
    assert.ok(Math.abs(sh.e) < 1e-6);
    assert.ok(sh.n > 0.999999);
    // Advance worldSec by 138 days (from day 227 baseline to day 365) via worldSec argument
    const secPlus12h = 12 * REAL_SECONDS_PER_GAME_HOUR;
    const shMidnight = shadowAway(
      planet,
      new THREE.Vector3(...planet.east),
      new THREE.Vector3(...planet.north),
      secPlus12h,
    );
    assert.ok(shMidnight.n < -0.999999, 'at solar midnight, anti-sun horizontal projection points south');
  });
});
