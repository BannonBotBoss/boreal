/**
 * D29. The band camera used the home gnomonic after the drop, so "Gliding above the land"
 * was a flat field. Over the Pacific aim it has to sit on that direction, 400 m above the sea.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlanet, fromLatLon } from '../src/world/globe/planet';
import { figureRadius } from '../src/world/globe/figure';
import { gameToPlanet, planetToGame } from '../src/world/globe/transition';
import { clearLanding, engageLanding } from '../src/world/globe/landingSite';
import { SITE } from '../src/core/sitePhase';
import { surfaceRadius } from '../src/world/globe/radial';
import { planetFor } from '../src/world/globe/planet';

const LAT = 8.487;
const LON = -129.334;

test('the glide camera is 400 m above the aimed sea, and returns to the home frame after', () => {
  const p = createPlanet(1400);
  const home = gameToPlanet(p, 0, 400, 0);
  const aim = fromLatLon(LAT * Math.PI / 180, LON * Math.PI / 180);
  engageLanding(aim, 0);
  try {
    const v = gameToPlanet(p, 0, 400, 0);
    const len = Math.hypot(v[0], v[1], v[2]);
    const dot = (v[0] * SITE.dir[0] + v[1] * SITE.dir[1] + v[2] * SITE.dir[2]) / len;
    assert.ok(dot > 0.999, `camera left the aim, dot ${dot}`);
    const sea = surfaceRadius(planetFor(1400, undefined, '', true), SITE.dir);
    const fig = figureRadius(SITE.dir);
    assert.ok(Math.abs(sea - fig) < 1, 'the aimed surface is sea level');
    assert.ok(Math.abs(len - (sea + 400)) < 2, `camera is ${len - sea} m above the sea`);
    assert.ok(len - fig < 1000, 'not inside a 5074 m mountain');
    const back = planetToGame(p, v);
    assert.ok(Math.abs(back.y - 400) < 1e-2 && Math.abs(back.x) < 1e-2 && Math.abs(back.z) < 1e-2);
  } finally {
    clearLanding();
  }
  const again = gameToPlanet(p, 0, 400, 0);
  assert.ok(Math.hypot(again[0] - home[0], again[1] - home[1], again[2] - home[2]) < 1);
});
