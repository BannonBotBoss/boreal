import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudColumn, dewPointC, esatPa, iceFraction, iceOpacity, moistLapse } from '../src/core/atmo/cloudColumn';
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

test('altitude zones: the column reads pressure at the ground height, so a plateau has a higher base and a capped top', () => {
  const t = 15, q = qOf(t, .7), sea = cloudColumn(t, q, .8), same = cloudColumn(t, q, .8, undefined, undefined, 0), high = cloudColumn(t, q, .8, undefined, undefined, 3000);
  assert.deepEqual(same, sea);
  assert.ok(high.lcl > sea.lcl, `plateau base ${high.lcl} vs sea ${sea.lcl}`); // lower pressure, same q: lower dew point
  assert.ok(high.top < 0 || high.top + 3000 <= 11000, `top ${high.top} past the tropopause`);
});
test('layered bake: convective towers share the LCL base, tops vary by cell, none passes the buoyant top', () => {
  const col = cloudColumn(28, qOf(28, .75), .6, LOCAL_CLOUDS.topM), L = LOCAL_CLOUDS, dz = L.topM / L.nz, b = bakeLocal(col, .6, 0, 0);
  assert.ok(col.lcl > 0 && col.top > col.lcl);
  const tops: number[] = [];
  for (let k = 0; k < L.nx; k += 4) for (let i = 0; i < L.nx; i += 4) { let lo = -1, hi = -1;
    for (let j = 0; j < L.nz; j++) if (b[i + L.nx * (j + L.nz * k)] > 8 && col.layers[Math.round((j + .5) * dz / col.layers[1].z)].strat === 0) { if (lo < 0) lo = j; hi = j; }
    if (lo >= 0) { assert.ok((lo + 1) * dz >= col.lcl - dz, 'no convective cloud below the dew-point base'); assert.ok(hi * dz <= col.top + dz, 'no tower above the buoyant top'); tops.push(hi); } }
  assert.ok(tops.length > 3 && Math.max(...tops) - Math.min(...tops) >= 2, `tower tops should differ by cell: ${tops}`);
});
test('layered bake: a stratiform layer is a broad deck, not broken into convective cells', () => {
  const col = cloudColumn(5, qOf(5, .99), 1, LOCAL_CLOUDS.topM), L = LOCAL_CLOUDS;
  let j = -1; col.layers.forEach((l, i) => { if (l.strat > (col.layers[j]?.strat ?? 0)) j = i; }); assert.ok(j >= 0, 'a saturated cold column has a sheet');
  const jj = Math.min(L.nz - 1, Math.floor(col.layers[j].z / (L.topM / L.nz))), b = bakeLocal(col, 1, 0, 0); let on = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) if (b[i + L.nx * (jj + L.nz * k)] > 0) on++;
  assert.ok(on / (L.nx * L.nx) > .5, `overcast sheet covers most of the box (${on})`);
});

test('#192: cloud condensate glaciates with height: liquid base, mixed middle, ice top', () => {
  assert.equal(iceFraction(5), 0); assert.equal(iceFraction(-30), 1); assert.ok(Math.abs(iceFraction(-11.5) - .75) < 1e-9);
  const c = cloudColumn(30, qOf(30, .7), 1), cl = c.layers.filter(l => l.water > 0);
  assert.ok(c.freezeM > c.lcl, `freeze ${c.freezeM} above base ${c.lcl}`); // a warm tropical base is liquid
  assert.equal(cl[0].ice, 0); assert.ok(cl[cl.length - 1].ice > .9, `top ice ${cl[cl.length - 1].ice}`); // anvil top is ice
  for (let i = 1; i < c.layers.length; i++) if (c.layers[i].z <= c.top) assert.ok(c.layers[i].ice >= c.layers[i - 1].ice - 1e-9); // monotone up the tower
  assert.equal(cloudColumn(-5, qOf(-5, .9), 1).freezeM, 0); // winter surface already below 0 C
});

test('#192: ice condensate is thinner per kg than liquid, so thin cirrus bakes fainter than the same water as liquid', () => {
  assert.equal(iceOpacity(0), 1); assert.ok(Math.abs(iceOpacity(1) - 10000 / (917 * 30)) < 1e-9);
  const col = cloudColumn(0, qOf(0, .9), 1, LOCAL_CLOUDS.topM), liquid = { ...col, layers: col.layers.map(l => ({ ...l, ice: 0 })) };
  assert.ok(col.layers.some(l => l.water > 0 && l.ice > .9), 'a cold column has an upper ice layer');
  const sum = (b: Uint8Array) => b.reduce((a, v) => a + v, 0), bi = bakeLocal(col, 1, 0, 0), bl = bakeLocal(liquid, 1, 0, 0);
  assert.ok(sum(bi) < sum(bl), `ice ${sum(bi)} vs liquid ${sum(bl)}`);
  for (let i = 0; i < bi.length; i++) assert.ok(bi[i] <= bl[i]);
});
