import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SITE, SURFACE, climate, columnLongwave, qsat, solar, surfaceBalance } from '../src/core/weather';
import { albedoAt, budgetFromAlbedo, cellCloud, homeBudgetDirection, solarBudget } from '../src/core/planet/solarBudget';
import { atmosphereFrom } from '../src/core/planet/atmosphereBudget';
import { PLANET, fibonacci, fromLatLon, planetFor, toLatLon, type Vec3 } from '../src/world/globe/planet';
import { CLOUDS } from '../src/world/globe/atmosphere';
import { applySolarAttribute, solarLayerGate, solarLayerOn } from '../src/world/globe/tile';

const RAD = Math.PI / 180;

/** A budget that ignores the cell and always uses Kenora's latitude. The known-bad case. */
function fixedLatitude(seed: number, day: number, hour: number, _dir: Vec3, cloud: number | null = 0) {
  return solarBudget(seed, day, hour, homeBudgetDirection(), cloud);
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
/** Home-latitude TOA matches solar(), and a winter noon at the equator is that equator, not Kenora. */
function budgetGate(fn: typeof solarBudget) {
  const home = fn(7, 172, 12, homeBudgetDirection(), 0);
  const sun = solar(172, 12, PLANET.home.latDeg, SITE.lon);
  if (!close(home.toa, sun.toa)) return false;
  const eq = fromLatLon(0, SITE.lon * RAD);
  const winter = fn(7, 355, 12, eq, 0);
  const eqSun = solar(355, 12, 0, SITE.lon);
  const kenora = solar(355, 12, PLANET.home.latDeg, SITE.lon);
  return close(winter.toa, eqSun.toa) && winter.toa >= 0 && Math.abs(eqSun.toa - kenora.toa) > 1 && winter.cosZ > 0;
}

test('T-0057: home-direction TOA matches solar() and a fixed latitude fails', () => {
  const dir = homeBudgetDirection();
  const got = solarBudget(7, 172, 12, dir, 0);
  const sun = solar(172, 12, PLANET.home.latDeg, SITE.lon);
  console.log(`TOA home-direction ${got.toa} solar(${PLANET.home.latDeg}) ${sun.toa}`);
  assert.ok(close(got.toa, sun.toa), `TOA ${got.toa} vs ${sun.toa}`);
  const back = toLatLon(dir);
  const same = solar(172, 12, back.lat * 180 / Math.PI, back.lon * 180 / Math.PI, SITE.tz);
  assert.equal(got.toa, same.toa);
  assert.equal(got.zenith, same.zenith);
  assert.equal(got.cosZ, same.cosZ);
  assert.ok(got.absorbed >= 0 && got.reflected >= 0 && got.outgoing > 0);
  assert.ok(Math.abs(got.absorbed / (1 - got.albedo) - got.reflected / got.albedo) < 1e-6);

  const eq = fromLatLon(0, SITE.lon * RAD);
  const noon = solarBudget(7, 172, 12, eq, 0);
  const eqSun = solar(172, 12, 0, SITE.lon);
  console.log(`TOA equator noon day 172 ${noon.toa} solar(0) ${eqSun.toa} cosZ ${noon.cosZ}`);
  assert.ok(close(noon.toa, eqSun.toa), `equator TOA ${noon.toa} vs ${eqSun.toa}`);
  assert.equal(noon.cosZ, solar(172, 12, toLatLon(eq).lat * 180 / Math.PI, toLatLon(eq).lon * 180 / Math.PI, SITE.tz).cosZ);
  assert.ok(noon.toa >= 0 && noon.cosZ > 0);
  assert.ok(close(noon.toa, Math.max(0, (eqSun.toa / eqSun.cosZ) * noon.cosZ)));

  const kenoraWinter = solar(355, 12, PLANET.home.latDeg, SITE.lon);
  const eqWinter = solar(355, 12, 0, SITE.lon);
  assert.notEqual(eqWinter.toa, kenoraWinter.toa);
  assert.equal(budgetGate(solarBudget), true);
  assert.equal(budgetGate(fixedLatitude), false);

  const p = planetFor(7);
  const ll = toLatLon(p.home);
  const atHome = solarBudget(7, 172, 12, p.home, 0);
  assert.equal(atHome.toa, solar(172, 12, ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI, SITE.tz).toa);

  let ocean: Vec3 | null = null;
  for (let k = 0; k < 400 && !ocean; k++) {
    const d = fibonacci(k, 400), s = p.sampleSurface(d);
    if (s.kind === 'ocean') ocean = [d[0], d[1], d[2]];
  }
  assert.ok(ocean);
  assert.equal(albedoAt(7, ocean!), SURFACE.water.albedo);
  const sea = solarBudget(7, 172, 12, ocean!, 0);
  assert.equal(sea.albedo, SURFACE.water.albedo);
  assert.ok(sea.absorbed + sea.reflected >= 0);

  const nightDir = fromLatLon(0, SITE.lon * RAD);
  let nightHour = 0;
  for (let h = 0; h < 24; h++) if (solar(172, h, 0, SITE.lon).cosZ <= 0) { nightHour = h; break; }
  const night = solarBudget(7, 172, nightHour, nightDir, 0);
  assert.equal(night.toa, 0);
  assert.equal(night.absorbed, 0);
  assert.equal(night.reflected, 0);
});

test('T-0057: outgoing longwave is the term inside surfaceBalance', () => {
  const col = climate(172, 12, 0), q = col.rh * qsat(col.tC, col.p);
  const lw = columnLongwave(col.tC, q, col.p, 0.4);
  const sw = 320;
  const sb = surfaceBalance('forest', sw, col.tC, q, col.p, col.u, 0.4, 0.5);
  const short = (1 - SURFACE.forest.albedo) * sw;
  assert.ok(Math.abs(sb.Rn - (short + lw.net)) < 1e-6, `Rn ${sb.Rn} vs ${short + lw.net}`);
  const cell = budgetFromAlbedo(172, 12, homeBudgetDirection(), 0.1, 0.4);
  assert.equal(cell.outgoing, lw.up);
  assert.ok(cell.outgoing > 0 && cell.outgoing < 800);
});

test('T-0057: absorbed attribute is absent at Minimum and present when octaves are above 0', () => {
  assert.equal(CLOUDS.octaves[CLOUDS.octaves.length - 1], 0);
  assert.equal(solarLayerOn(CLOUDS.octaves.length - 1), false);
  assert.equal(solarLayerOn(0), true);
  assert.equal(solarLayerGate(false, 0), false); // missing attribute on a tier that draws the layer
  assert.equal(solarLayerGate(true, CLOUDS.octaves.length - 1), false); // attribute still present at Minimum
  assert.equal(solarLayerGate(false, CLOUDS.octaves.length - 1), true);
  assert.equal(solarLayerGate(true, 0), true);

  const dir = homeBudgetDirection();
  const centre: Vec3 = [dir[0] * PLANET.radius, dir[1] * PLANET.radius, dir[2] * PLANET.radius];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.05, 0.08, 0.03]), 3));
  g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array([120]), 1));
  g.setAttribute('aAbsorbed', new THREE.BufferAttribute(new Float32Array([1]), 1));
  assert.equal(solarLayerGate(g.getAttribute('aAbsorbed') != null, CLOUDS.octaves.length - 1), false);
  assert.equal(applySolarAttribute(g, centre, 172, 12, CLOUDS.octaves.length - 1), false);
  assert.equal(g.getAttribute('aAbsorbed'), undefined);
  assert.equal(solarLayerGate(g.getAttribute('aAbsorbed') != null, CLOUDS.octaves.length - 1), true);

  assert.equal(applySolarAttribute(g, centre, 172, 12, 0), true);
  const attr = g.getAttribute('aAbsorbed');
  assert.ok(attr);
  assert.equal(solarLayerGate(true, 0), true);
  const albedo = 0.2126 * 0.05 + 0.7152 * 0.08 + 0.0722 * 0.03;
  const expect = budgetFromAlbedo(172, 12, dir, albedo, null).absorbed;
  assert.ok(Math.abs((attr.array as Float32Array)[0] - expect) < 1e-3, `vertex ${attr.array[0]} vs ${expect}`);

  const bare = new THREE.BufferGeometry();
  bare.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  bare.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.05, 0.08, 0.03]), 3));
  bare.setAttribute('aH', new THREE.BufferAttribute(new Float32Array([120]), 1));
  assert.equal(solarLayerGate(bare.getAttribute('aAbsorbed') != null, 0), false);
});

test('T-0059 feed: null cloud is the cell\'s own atmosphere cover, and cover cuts absorbed sunlight', () => {
  const dir = homeBudgetDirection();
  const cf = cellCloud(172, 12, dir);
  const ll = toLatLon(dir);
  assert.equal(cf, atmosphereFrom(172, 12, ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI, 0).cloudFraction);
  const fed = budgetFromAlbedo(172, 12, dir, 0.1, null), clear = budgetFromAlbedo(172, 12, dir, 0.1, 0);
  assert.equal(fed.absorbed, budgetFromAlbedo(172, 12, dir, 0.1, cf).absorbed);
  assert.ok(budgetFromAlbedo(172, 12, dir, 0.1, 1).absorbed < clear.absorbed);
  assert.ok(fed.absorbed <= clear.absorbed);
});
