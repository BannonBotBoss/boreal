import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudColumn, dewPointC, esatPa, moistLapse } from '../src/core/atmo/cloudColumn';
import { bakeLocal, columnAt, LOCAL_CLOUDS, localCloudFade } from '../src/world/globe/localClouds';

const qOf = (t: number, rh: number) => .622 * rh * esatPa(t) / 101325;
test('T-0073: Bolton esat and dew point round-trip', () => {
  assert.ok(Math.abs(esatPa(20) - 2339) < 5); // 23.39 hPa at 20 C
  assert.ok(Math.abs(dewPointC(20, 1) - 20) < 1e-9); assert.ok(Math.abs(dewPointC(20, .5) - 9.26) < .05);
  assert.ok(moistLapse(20, 1e5) < .0065 && moistLapse(-40, 5e4) > .008); // moist adiabat: shallow warm, near dry cold
});
test('T-0073: LCL from the dew point matches Espy (125 m/K)', () => {
  for (const [t, rh] of [[20, .7], [30, .5], [15, .9]]) { const c = cloudColumn(t, qOf(t, rh)), espy = 125 * (t - dewPointC(t, rh));
    assert.ok(Math.abs(c.lcl - espy) < 300, `${t} ${rh}: lcl ${c.lcl} vs ${espy}`); assert.ok(c.top >= c.lcl); }
});
test('T-0073: no cloud below the base; a humid column has cloud water above it', () => {
  const c = cloudColumn(25, qOf(25, .8), .8);
  for (const l of c.layers) if (l.z < c.lcl) assert.equal(l.water > 0 && l.rh < .8, false);
  assert.ok(c.layers.some(l => l.z >= c.lcl && l.water > 0));
});
test('T-0073: local bake follows cover and the column', () => {
  const c = cloudColumn(25, qOf(25, .8), .8), L = { ...LOCAL_CLOUDS, nx: 16, nz: 12 };
  const full = bakeLocal(c, 1, 0, 0, L), none = bakeLocal(c, 0, 0, 0, L);
  assert.ok(full.reduce((a, b) => a + b, 0) > none.reduce((a, b) => a + b, 0));
  const base = Math.floor(c.lcl / (L.topM / L.nz)); for (let j = 0; j < base - 1; j++) assert.equal(full[L.nx * j], 0); // clear below the LCL
  const pl = { lat: [49.5, 0], lon: [-94, 0], ts: [18, 28], q: [.009, .018], cloud: [.6, .4] };
  assert.equal(columnAt(pl, [Math.cos(.868) * Math.cos(-1.64), Math.sin(.868), Math.cos(.868) * Math.sin(-1.64)])!.tsC, 18);
});
test('issue #107: the local cloud box fades across the span it already had, with no step', () => {
  assert.equal(localCloudFade(LOCAL_CLOUDS.showBelowM), 0);
  assert.equal(localCloudFade(LOCAL_CLOUDS.showBelowM + 1000), 0);
  assert.equal(localCloudFade(LOCAL_CLOUDS.sizeM), 1);
  assert.equal(localCloudFade(0), 1);
  const mid = (LOCAL_CLOUDS.showBelowM + LOCAL_CLOUDS.sizeM) / 2;
  const at = localCloudFade(mid);
  assert.ok(at > 0.4 && at < 0.6, `mid fade ${at}`);
  let prev = 0;
  for (let alt = LOCAL_CLOUDS.showBelowM; alt >= LOCAL_CLOUDS.sizeM; alt -= 200) {
    const w = localCloudFade(alt);
    assert.ok(w + 1e-9 >= prev, `not rising as altitude falls at ${alt}`);
    prev = w;
  }
});
import { bandCloudOpacity } from '../src/world/globe/localClouds';
import { TRANSITION as TR, patchFade as pf } from '../src/world/globe/transition';
test('issue #202: through the in-page band the far-layer box plus the overlay keep the cloud, with no step', () => {
  let prev = -1;
  for (let h = TR.bandTop + 200; h >= 400; h -= 10) { const f = pf(h, true), a = localCloudFade(h), far = a * (1 - f), over = bandCloudOpacity(h, f);
    assert.ok(Math.abs(far + over - a) < 1e-12, `${h}: ${far} + ${over} vs ${a}`); assert.ok(a > 0, `${h}: box drawn`); // the patch takes f of the far layer, the overlay gives it back
    if (prev >= 0) assert.ok(Math.abs(over - prev) < .02, `${h}: overlay step ${prev} -> ${over}`); prev = over; }
  assert.equal(bandCloudOpacity(TR.bandTop, 0), 0); assert.equal(bandCloudOpacity(500, 1), 1);
});
