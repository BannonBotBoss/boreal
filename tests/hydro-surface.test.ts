import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HYDRO, SITE, SURFACE, bucketStep, climate } from '../src/core/weather';
import { cellAir, hydrosphereBudget, SEA_FREEZE_C } from '../src/core/planet/hydrosphereBudget';
import { HEAT_JM2K, surfaceBudget } from '../src/core/planet/surfaceBudget';
import { fibonacci, fromLatLon, planetFor, vegetationWeight, type Vec3 } from '../src/world/globe/planet';
import { CLOUDS } from '../src/world/globe/atmosphere';
import { solarLayerOn } from '../src/world/globe/tile';
import { bakeHydro, hydroLayerOn, icePlacement, HYDRO_NLAT } from '../src/world/globe/hydroLayer';

const RAD = Math.PI / 180;
const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

test('T-0058: a full 150 mm bucket that receives 10 mm stays at 150 and runs off 10', () => {
  assert.equal(HYDRO.bucketMm, 150);
  const held = bucketStep(HYDRO.bucketMm, 10);
  assert.equal(held.soil, 150);
  assert.equal(held.runoff, 10);
  const dry = bucketStep(5, 0, 10);
  assert.equal(dry.soil, 0);
  assert.equal(dry.runoff, 0);
});

test('T-0058: Kenora sea-level temperature matches climate(), water and forest keep the SURFACE roughness pair', () => {
  const air = cellAir(172, 15, SITE.lat, SITE.lon, 0);
  const col = climate(172, 15, 0);
  console.log(`T-0058 Kenora tC ${air.tC} climate ${col.tC}`);
  assert.ok(close(air.tC, col.tC), `cell ${air.tC} vs climate ${col.tC}`);

  const p = planetFor(7);
  let ocean: Vec3 | null = null, forest: Vec3 | null = null;
  const home = p.home as Vec3;
  const homeSurf = surfaceBudget(7, 200, 15, home);
  if (homeSurf.kind === 'forest') forest = home;
  for (let k = 0; k < 800 && (!ocean || !forest); k++) {
    const d = fibonacci(k, 800) as Vec3;
    const s = p.sampleSurface(d);
    if (!ocean && s.kind === 'ocean') ocean = [d[0], d[1], d[2]];
    if (!forest && s.kind !== 'ocean' && s.kind !== 'lake' && s.h >= s.level && vegetationWeight(s, d) >= 0.35) {
      const surf = surfaceBudget(7, 200, 15, [d[0], d[1], d[2]]);
      if (surf.kind === 'forest') forest = [d[0], d[1], d[2]];
    }
  }
  assert.ok(ocean);
  assert.ok(forest);
  const sea = surfaceBudget(7, 200, 15, ocean!);
  const land = surfaceBudget(7, 200, 15, forest!);
  console.log(`T-0058 roughness water ${sea.roughness} forest ${land.roughness} heat water ${sea.heatCap} land ${land.heatCap}`);
  assert.equal(sea.roughness, SURFACE.water.z0);
  assert.equal(SURFACE.water.z0, 0.0002);
  assert.equal(land.roughness, SURFACE.forest.z0);
  assert.equal(SURFACE.forest.z0, 1.5);
  assert.equal(sea.land, 0);
  assert.equal(sea.sea, 1);
  assert.equal(land.land, 1);
  assert.equal(land.sea, 0);
  assert.ok(land.vegetation > 0);
  assert.equal(sea.vegetation, 0);
  assert.equal(sea.heatCap, HEAT_JM2K.water);
  assert.equal(land.heatCap, HEAT_JM2K.forest);
  assert.ok(sea.heatCap > 50 * land.heatCap);

  const hydro = hydrosphereBudget(7, 200, 15, ocean!);
  assert.ok(hydro.humidityColumn > 0);
  assert.ok(hydro.evaporation >= 0);
  assert.ok(hydro.precipitation > 0);
  assert.ok(hydro.soilMm >= 0 && hydro.soilMm <= HYDRO.bucketMm);
  const eq = fromLatLon(0, 0);
  const eqAir = cellAir(200, 12, 0, 0, 0);
  console.log(`T-0058 equator tMonth ${eqAir.tMonth} freeze ${SEA_FREEZE_C}`);
  assert.ok(eqAir.tMonth > 20 && eqAir.tMonth < 35);
  const janN = cellAir(15, 12, 80, 0, 0), julS = cellAir(200, 12, -40, 0, 0), janS = cellAir(15, 12, -40, 0, 0);
  console.log(`T-0058 Jan 80N ${janN.tMonth} Jan 40S ${janS.tMonth} Jul 40S ${julS.tMonth}`);
  assert.ok(janN.tMonth < SEA_FREEZE_C);
  assert.ok(janS.tMonth > janN.tMonth);
  assert.equal(hydrosphereBudget(7, 200, 12, eq).ice, 0);
});

test('T-0058: the layer is off when cloud octaves are 0, and January ice sits on the winter pole', () => {
  assert.equal(CLOUDS.octaves[CLOUDS.octaves.length - 1], 0);
  for (let tier = 0; tier < CLOUDS.octaves.length; tier++) assert.equal(hydroLayerOn(tier), solarLayerOn(tier));
  assert.equal(hydroLayerOn(0), true);
  assert.equal(hydroLayerOn(CLOUDS.octaves.length - 1), false);

  const nlat = 24;
  const jan = bakeHydro(7, 15, 12, nlat);
  const place = icePlacement(jan, nlat, 'north');
  console.log(`T-0058 January placement pole ${place.poleFrac.toFixed(3)} tropics ${place.tropFrac.toFixed(3)} score ${place.score.toFixed(3)}`);
  assert.ok(place.score >= 0.95, `January ice placement ${place.score}`);

  const nlon = nlat * 2;
  const paint = (poleOn: boolean, tropOn: boolean) => {
    const out = new Uint8Array(nlat * nlon * 4);
    for (let j = 0; j < nlat; j++) {
      const lat = -90 + (j + 0.5) * 180 / nlat;
      const on = Math.abs(lat) <= 20 ? tropOn : lat >= 70 ? poleOn : false;
      if (!on) continue;
      for (let i = 0; i < nlon; i++) out[(j * nlon + i) * 4 + 1] = 255;
    }
    return out;
  };
  const match = icePlacement(paint(true, false), nlat, 'north');
  const bad = icePlacement(paint(false, true), nlat, 'north');
  console.log(`T-0058 calibration match ${match.score} mismatch ${bad.score}`);
  assert.equal(match.score, 1);
  assert.equal(bad.score, 0);

  const jul = bakeHydro(7, 200, 12, nlat);
  const julTrop = icePlacement(jul, nlat, 'north');
  assert.ok(julTrop.tropFrac < 0.05, `July tropics covered ${julTrop.tropFrac}`);
  assert.equal(HYDRO_NLAT, 48);
});
