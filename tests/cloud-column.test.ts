import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudColumn, dewPointC, esatPa, iceFraction, iceOpacity, moistLapse, snowShareAtGround } from '../src/core/atmo/cloudColumn';
import { anvilDepthGate, coreStrength, bakeLocal, columnAt, LOCAL_CLOUDS, localCloudFade } from '../src/world/globe/localClouds';
import CC from '../data/earth/cloud-column.json';

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
  const undul = L.baseUndulM ?? 0, base = Math.floor((c.lcl - undul) / (L.topM / L.nz)); for (let j = 0; j < Math.max(0, base - 1); j++) assert.equal(full[L.nx * j], 0); // clear below the undulated LCL floor
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
test('layered bake: convective towers share the LCL base, tops vary by cell (below the anvil), mid-strength cells stop at the buoyant top', () => {
  const col = cloudColumn(28, qOf(28, .75), .6, LOCAL_CLOUDS.topM), L = LOCAL_CLOUDS, dz = L.topM / L.nz, b = bakeLocal(col, .6, 0, 0);
  assert.ok(col.lcl > 0 && col.top > col.lcl);
  const undul = L.baseUndulM ?? 0, tops: number[] = [];
  for (let k = 0; k < L.nx; k += 4) for (let i = 0; i < L.nx; i += 4) { let lo = -1, hi = -1;
    for (let j = 0; j < L.nz; j++) if (b[i + L.nx * (j + L.nz * k)] > 8 && (j + 1) * dz < col.top - 1500 && col.layers[Math.round((j + .5) * dz / col.layers[1].z)].strat === 0) { if (lo < 0) lo = j; hi = j; }
    if (lo >= 0) { assert.ok((lo + 1) * dz >= col.lcl - undul - dz, 'no convective cloud below the undulated dew-point base'); assert.ok(hi * dz <= col.top + dz, 'mid-tower cells stay at or below the buoyant top'); tops.push(hi); } }
  assert.ok(tops.length > 3 && Math.max(...tops) - Math.min(...tops) >= 2, `tower tops should differ by cell: ${tops}`);
});
test('layered bake: dew-point bases undulate per cell around the column LCL (not ruler-flat)', () => {
  const col = cloudColumn(28, qOf(28, .75), .6, LOCAL_CLOUDS.topM), L = LOCAL_CLOUDS, dz = L.topM / L.nz;
  assert.ok((L.baseUndulM ?? 0) >= 250, 'undulation spans >1 bake voxel');
  const b = bakeLocal(col, .6, 0, 0), bases: number[] = [];
  for (let k = 0; k < L.nx; k += 2) for (let i = 0; i < L.nx; i += 2) { let lo = -1;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, v = b[i + L.nx * (j + L.nz * k)];
      // convective-only: skip strat-heavy layers near the LCL
      if (v > 8 && z < col.top - 1500 && (col.layers[Math.min(col.layers.length - 1, Math.round(z / (col.layers[1]?.z || 250)))]?.strat ?? 0) === 0) { lo = j; break; }
    }
    if (lo >= 0) bases.push(lo); }
  assert.ok(bases.length > 8, `lit bases ${bases.length}`);
  assert.ok(Math.max(...bases) - Math.min(...bases) >= 1, `base voxels should vary by cell: ${Math.min(...bases)}..${Math.max(...bases)}`);
  for (const j of bases) assert.ok((j + 1) * dz >= col.lcl - L.baseUndulM - dz && j * dz <= col.lcl + L.baseUndulM + dz, `base near LCL ${col.lcl}`);
});
test('layered bake: dew-point bases soft-feather over a thin condensation zone (not a knife-edge)', () => {
  // Real LCL bases build condensate over O(100 m); finer nz so baseFeatherM spans >1 bake level.
  const col = cloudColumn(28, qOf(28, .75), .6, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 96 }, dz = L.topM / L.nz;
  assert.ok((L.baseFeatherM ?? 0) >= 150 && L.baseFeatherM > dz, 'feather spans >1 bake voxel');
  const soft = bakeLocal(col, .6, 0, 0, L), hard = bakeLocal(col, .6, 0, 0, { ...L, baseFeatherM: 0 });
  let softNear = 0, mid = 0, hardNear = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let lo = -1, midS = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, vH = hard[i + L.nx * (j + L.nz * k)], vS = soft[i + L.nx * (j + L.nz * k)];
      const strat = col.layers[Math.min(col.layers.length - 1, Math.round(z / (col.layers[1]?.z || 250)))]?.strat ?? 0;
      if (strat > 0 || z > col.top - 1500) continue;
      if (lo < 0 && vH > 8) lo = j; // knife-edge first lit level
      if (z >= col.lcl + .35 * (col.top - col.lcl) && z <= col.lcl + .55 * (col.top - col.lcl)) midS = Math.max(midS, vS);
    }
    if (lo < 0 || midS < 40) continue;
    const nearS = soft[i + L.nx * (lo + L.nz * k)], nearH = hard[i + L.nx * (lo + L.nz * k)];
    softNear += nearS; hardNear += nearH; mid += midS; n++;
  }
  assert.ok(n > 3, `mature cells ${n}`);
  assert.ok(softNear < mid, `density just above LCL softer than mid-tower (${softNear} < ${mid})`);
  assert.ok(softNear < hardNear, `feather lowers near-base density vs knife-edge (${softNear} < ${hardNear})`);
});
test('layered bake: stratiform decks soft-feather at vertical edges (not a knife-edge sheet)', () => {
  // Cold saturated column → high strat sheet. Finer nz so baseFeatherM spans >1 bake level.
  const col = cloudColumn(0, qOf(0, .9), 1, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 96 }, dz = L.topM / L.nz;
  assert.ok((L.baseFeatherM ?? 0) >= 150 && L.baseFeatherM > dz, 'feather spans >1 bake voxel');
  const step = col.layers[1]?.z || 250;
  // Meaningful strat only (tiny residual layers near zero confuse a min>0 scan)
  const hasStrat = (j: number) => (col.layers[Math.min(col.layers.length - 1, Math.round((j + .5) * dz / step))]?.strat ?? 0) > 1e-4;
  let lo = -1, hi = -1;
  for (let j = 0; j < L.nz; j++) if (hasStrat(j)) { if (lo < 0) lo = j; hi = j; }
  assert.ok(lo >= 0 && hi > lo + 2, `strat band spans bake levels ${lo}..${hi}`);
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  const on = (b: Uint8Array, j: number) => {
    let s = 0; for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) s += b[i + L.nx * (j + L.nz * k)];
    return s;
  };
  const edgeSoft = on(soft, hi), edgeHard = on(hard, hi), mid = Math.floor((lo + hi) / 2), midSoft = on(soft, mid);
  assert.ok(midSoft > 100, `mid-deck lit (${midSoft})`);
  assert.ok(edgeSoft < midSoft, `strat top edge softer than mid-deck (${edgeSoft} < ${midSoft})`);
  assert.ok(edgeSoft < edgeHard, `feather lowers top edge vs knife-edge (${edgeSoft} < ${edgeHard})`);
});
test('overshoot bake: a strong tower paints a tapered plume above the buoyant top; a weak one barely does', () => {
  const L = LOCAL_CLOUDS, dz = L.topM / L.nz;
  const hot = cloudColumn(30, qOf(30, .8), 1, L.topM), cool = cloudColumn(10, qOf(10, .5), 1, L.topM);
  assert.ok(hot.overshootM > 800, `hot overshoot ${hot.overshootM}`);
  assert.ok(cool.overshootM < hot.overshootM / 5, `cool overshoot ${cool.overshootM}`);
  const bh = bakeLocal(hot, 1, 0, 0), bc = bakeLocal(cool, 1, 0, 0);
  const tipH = Math.min(L.topM, hot.top + hot.overshootM), tipC = Math.min(L.topM, cool.top + cool.overshootM);
  let hotPlume = 0, coolPlume = 0, maxHot = 0, hotPastTip = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) for (let j = 0; j < L.nz; j++) {
    const z = (j + .5) * dz;
    const vh = bh[i + L.nx * (j + L.nz * k)], vc = bc[i + L.nx * (j + L.nz * k)];
    if (z > hot.top + dz && z <= tipH + dz && vh > 0) { hotPlume++; maxHot = Math.max(maxHot, vh); }
    if (z > tipH + dz && vh > 0 && z < hot.top + hot.overshootM + 500) hotPastTip++; // only the overshoot path paints here for deep towers (strat is below)
    if (z > cool.top + dz && z <= tipC + dz && vc > 0) coolPlume++;
  }
  assert.ok(hotPlume > 10, `hot plume voxels ${hotPlume}`);
  assert.ok(maxHot > 15 && maxHot < 80, `tapered ice-thinned plume density ${maxHot}`); // iceOpacity ~0.36 caps raw .45*255
  assert.ok(coolPlume < hotPlume / 3, `cool plume ${coolPlume} vs hot ${hotPlume}`);
  assert.equal(hotPastTip, 0, `nothing past the clamped tip (${hotPastTip})`);
});
test('overshoot bake: cell strength scales tip height — mid cells stop short of the full overshoot', () => {
  const L = { ...LOCAL_CLOUDS, nx: 16, nz: 48 }, dz = L.topM / L.nz;
  const hot = cloudColumn(30, qOf(30, .8), 1, L.topM);
  assert.ok(hot.overshootM > 800 && hot.top > 0, `column overshoot ${hot.overshootM} top ${hot.top}`);
  const b = bakeLocal(hot, 1, 0, 0, L), tipFull = Math.min(L.topM, hot.top + hot.overshootM);
  let midShort = 0, coreHigh = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let maxZ = -1;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, v = b[i + L.nx * (j + L.nz * k)];
      if (z > hot.top + dz && v > 0 && z > maxZ) maxZ = z;
    }
    if (maxZ < 0) continue;
    if (maxZ >= tipFull - dz) coreHigh++;
    else if (maxZ > hot.top + hot.overshootM * .15 && maxZ < tipFull - 2 * dz) midShort++;
  }
  assert.ok(coreHigh > 0, `at least one mature core reaches the full tip (${coreHigh})`);
  assert.ok(midShort > 0, `some weaker cells stop short in the overshoot band (${midShort})`);
  assert.ok(midShort + coreHigh > 2, `overshoot footprint has more than one cell (${midShort + coreHigh})`);
});
test('overshoot bake: plume uses iceOpacity so glaciated tops are optically thinner', () => {
  const L = LOCAL_CLOUDS, dz = L.topM / L.nz;
  const hot = cloudColumn(30, qOf(30, .8), 1, L.topM);
  assert.ok(hot.overshootM > 800 && hot.top > 0, `hot overshoot ${hot.overshootM}`);
  const b = bakeLocal(hot, 1, 0, 0, L), tip = Math.min(L.topM, hot.top + hot.overshootM);
  const step = hot.layers[1]?.z || 250;
  let maxV = 0, iceNear = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) for (let j = 0; j < L.nz; j++) {
    const z = (j + .5) * dz, v = b[i + L.nx * (j + L.nz * k)];
    if (z > hot.top + dz && z <= tip + dz && v > maxV) {
      maxV = v;
      const li = Math.min(hot.layers.length - 1, Math.round(z / step));
      iceNear = hot.layers[li]?.ice ?? 0;
    }
  }
  assert.ok(maxV > 0, `plume painted (${maxV})`);
  assert.ok(iceNear > .9, `overshoot layer is ice (${iceNear})`);
  const rawMax = Math.round(255 * .45); // pre-opacity formula at u=0, frac=1
  const thinnedCap = Math.round(255 * Math.min(1, .45 * iceOpacity(iceNear)));
  assert.ok(maxV <= thinnedCap + 1, `plume ≤ ice-thinned cap: ${maxV} vs ${thinnedCap} (raw would be ${rawMax})`);
  assert.ok(maxV < rawMax * .55, `clearly thinner than a liquid tip (${maxV} < ${rawMax * .55})`);
});
test('overshoot bake: plume soft-narrows into a turret — mid cells thinner near the tip than mature cores', () => {
  const L = { ...LOCAL_CLOUDS, nx: 16, nz: 48 }, dz = L.topM / L.nz;
  const hot = cloudColumn(30, qOf(30, .8), 1, L.topM);
  assert.ok(hot.overshootM > 800 && hot.top > 0, `column overshoot ${hot.overshootM} top ${hot.top}`);
  const b = bakeLocal(hot, 1, 0, 0, L);
  const step = hot.layers[1]?.z || 250, bakeTop = hot.top + step / 2; // bakeLocal buoyant top
  const tipFull = Math.min(L.topM, bakeTop + hot.overshootM), overIn = tipFull - bakeTop;
  // low band (near EL) vs upper overshoot: turret should shrink the lit footprint with height
  const lo0 = bakeTop + overIn * .05, lo1 = bakeTop + overIn * .25;
  const hi0 = bakeTop + overIn * .6, hi1 = bakeTop + overIn * .85;
  let litLo = 0, litHi = 0, maxCoreHi = 0, maxMidHi = 0, midZeroHi = 0, midSeen = 0, coreSeen = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let maxZ = -1, densLo = 0, densHi = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, v = b[i + L.nx * (j + L.nz * k)];
      if (z > bakeTop && v > 0 && z > maxZ) maxZ = z;
      if (z >= lo0 && z <= lo1) densLo = Math.max(densLo, v);
      if (z >= hi0 && z <= hi1) densHi = Math.max(densHi, v);
    }
    if (maxZ < 0) continue;
    if (densLo > 0) litLo++;
    if (densHi > 0) litHi++;
    const mature = maxZ >= tipFull - dz;
    const mid = !mature && maxZ > bakeTop + overIn * .15 && maxZ < tipFull - 3 * dz;
    if (mature) { coreSeen++; maxCoreHi = Math.max(maxCoreHi, densHi); }
    if (mid) { midSeen++; maxMidHi = Math.max(maxMidHi, densHi); if (densHi === 0) midZeroHi++; }
  }
  assert.ok(litLo > litHi, `turret narrows with height: lit low ${litLo} > high ${litHi}`);
  assert.ok(coreSeen > 0 && maxCoreHi > 0, `mature core paints upper band (${coreSeen}, dens ${maxCoreHi})`);
  assert.ok(midSeen > 0, `mid cells present (${midSeen})`);
  assert.ok(maxCoreHi > maxMidHi, `upper-band density: mature ${maxCoreHi} > mid ${maxMidHi}`);
  assert.ok(maxMidHi === 0 || maxCoreHi >= maxMidHi * 2, `mid zero or clearly thinner near tip (${maxMidHi} vs ${maxCoreHi})`);
  assert.ok(midZeroHi > 0 || maxMidHi === 0, `some mid cells already gone in upper band (${midZeroHi})`);
});
test('layered bake: convective towers soft-narrow with height — footprint shrinks toward the buoyant top', () => {
  const L = { ...LOCAL_CLOUDS, nx: 16, nz: 48 }, dz = L.topM / L.nz;
  const hot = cloudColumn(30, qOf(30, .85), 1, L.topM);
  assert.ok(hot.top - hot.lcl >= 6000 && hot.top > 0, `deep tower depth ${hot.top - hot.lcl} top ${hot.top}`);
  const b = bakeLocal(hot, 1, 0, 0, L);
  const step = hot.layers[1]?.z || 250, base = hot.lcl, bakeTop = hot.top + step / 2; // bakeLocal buoyant top
  const span = bakeTop - base;
  // low band near LCL vs high band near buoyant top, kept below the anvil ice deck so anvil spread does not widen the count
  const lo0 = base + span * .05, lo1 = base + span * .2;
  const hi0 = base + span * .72, hi1 = base + span * .82;
  let litLo = 0, litHi = 0, maxCoreHi = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let densLo = 0, densHi = 0, densTop = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, v = b[i + L.nx * (j + L.nz * k)];
      if (z >= lo0 && z <= lo1) densLo = Math.max(densLo, v);
      if (z >= hi0 && z <= hi1) densHi = Math.max(densHi, v);
      if (z >= bakeTop - span * .08 && z < bakeTop) densTop = Math.max(densTop, v);
    }
    if (densLo > 0) litLo++;
    if (densHi > 0) litHi++;
    maxCoreHi = Math.max(maxCoreHi, densHi, densTop);
  }
  assert.ok(litLo > litHi, `tower soft-narrows with height: lit low ${litLo} > high ${litHi}`);
  assert.ok(maxCoreHi > 0, `mature cores still paint near the buoyant top (dens ${maxCoreHi})`);
});
test('anvil bake: soft strength weights keep a dense core and a weaker fringe in the ice deck', () => {
  const L = LOCAL_CLOUDS, col = cloudColumn(30, qOf(30, .85), 1, L.topM), dz = L.topM / L.nz;
  assert.ok(col.top - col.lcl >= 3000, 'deep glaciated tower for anvil');
  const b = bakeLocal(col, 1, 0, 0, L);
  const dens: number[] = [];
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let sum = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz;
      if (z > col.top - 600 && z <= col.top + dz) sum += b[i + L.nx * (j + L.nz * k)];
    }
    if (sum > 0) dens.push(sum);
  }
  assert.ok(dens.length > 8, `anvil footprint ${dens.length}`);
  dens.sort((a, b) => b - a);
  const fringe = dens.filter(d => d < dens[0] * .55);
  assert.ok(fringe.length > 0, `weaker fringe cells under soft weights (${fringe.length})`);
  assert.ok(dens[0] > dens[dens.length - 1], `core denser than outer fringe (${dens[0]} > ${dens[dens.length - 1]})`);
});

test('anvil bake: blurred strength scales ice-deck depth — near-top footprint wider than deep', () => {
  const L = LOCAL_CLOUDS, col = cloudColumn(30, qOf(30, .85), 1, L.topM), dz = L.topM / L.nz;
  assert.ok(col.top - col.lcl >= 6000, 'deep glaciated tower for anvil');
  const b = bakeLocal(col, 1, 0, 0, L);
  let near = 0, deep = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let sn = 0, sd = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, d = col.top - z, v = b[i + L.nx * (j + L.nz * k)];
      if (d >= 0 && d <= 350) sn += v;
      if (d >= 900 && d <= 1400) sd += v;
    }
    if (sn > 40) near++;
    if (sd > 40) deep++;
  }
  assert.ok(deep > 0, `some mature cells still reach deep into the anvil (${deep})`);
  assert.ok(near > deep, `near-top footprint ${near} wider than deep ${deep}`);
});

test('anvil bake: ice-deck denser near the buoyant top than deeper (Houze outflow at the EL)', () => {
  // fringe columns: anvil outflow with little mid-tower convective fill, so the taper is visible
  const L = LOCAL_CLOUDS, col = cloudColumn(30, qOf(30, .85), 1, L.topM), dz = L.topM / L.nz;
  assert.ok(col.top - col.lcl >= 6000, 'deep glaciated tower for anvil');
  const b = bakeLocal(col, 1, 0, 0, L), midZ = col.lcl + .5 * (col.top - col.lcl);
  let topSum = 0, deepSum = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let st = 0, sd = 0, mid = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, d = col.top - z, v = b[i + L.nx * (j + L.nz * k)];
      if (d >= 0 && d <= 250) st += v;
      if (d >= 900 && d <= 1150) sd += v;
      if (Math.abs(z - midZ) < dz) mid += v;
    }
    if (st > 20 && mid < 10) { topSum += st; deepSum += sd; n++; } // anvil fringe, not a convective core
  }
  assert.ok(n > 2, `anvil fringe cells (${n})`);
  assert.ok(topSum > deepSum * 1.3, `near-top denser than deep on fringe (${topSum} vs ${deepSum})`);
});

test('anvil bake: lateral density falls as anv^1.5 — outer fringe much thinner than near-core anvil', () => {
  // depth stays on linear soft-weight; density uses anv^1.5 so Houze outflow thins radially from the updraught
  const L = LOCAL_CLOUDS, col = cloudColumn(30, qOf(30, .85), 1, L.topM), dz = L.topM / L.nz;
  assert.ok(col.top - col.lcl >= 6000, 'deep glaciated tower for anvil');
  const b = bakeLocal(col, 1, 0, 0, L), midZ = col.lcl + .5 * (col.top - col.lcl);
  const fringe: number[] = [];
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    let st = 0, mid = 0;
    for (let j = 0; j < L.nz; j++) {
      const z = (j + .5) * dz, d = col.top - z, v = b[i + L.nx * (j + L.nz * k)];
      if (d >= 0 && d <= 250) st += v;
      if (Math.abs(z - midZ) < dz) mid += v;
    }
    if (st > 15 && mid < 10) fringe.push(st); // anvil fringe, not a convective core
  }
  assert.ok(fringe.length > 4, `anvil fringe cells (${fringe.length})`);
  fringe.sort((a, b) => b - a);
  const outer = fringe[fringe.length - 1], near = fringe[0];
  assert.ok(near > outer * 2.5, `near-core anvil denser than outer fringe (${near} vs ${outer})`);
});

test('anvil bake: underside soft-feathers over baseFeatherM (not a knife-edge floor)', () => {
  // Deep glaciated tower; finer nz so baseFeatherM spans >1 bake level.
  const col = cloudColumn(30, qOf(30, .85), 1, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 96 }, dz = L.topM / L.nz;
  assert.ok(col.top - col.lcl >= 6000, 'deep glaciated tower for anvil');
  assert.ok((L.baseFeatherM ?? 0) >= 150 && L.baseFeatherM > dz, 'feather spans >1 bake voxel');
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  const step = col.layers[1]?.z || 250;
  let softBot = 0, hardBot = 0, softTop = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    // fringe columns: anvil present near top, little mid-tower convective fill
    const jTop = Math.min(L.nz - 1, Math.floor((col.top - dz * .5) / dz));
    const jDeep = Math.min(L.nz - 1, Math.floor((col.top - CC.anvil_depth_m * .85) / dz));
    const midZ = col.lcl + .4 * (col.top - col.lcl);
    const jMid = Math.min(L.nz - 1, Math.floor(midZ / dz));
    const st = soft[i + L.nx * (jTop + L.nz * k)], sd = soft[i + L.nx * (jDeep + L.nz * k)];
    const ht = hard[i + L.nx * (jTop + L.nz * k)], hd = hard[i + L.nx * (jDeep + L.nz * k)];
    const mid = soft[i + L.nx * (jMid + L.nz * k)];
    if (st > 20 && mid < 10 && hd > 5) { softBot += sd; hardBot += hd; softTop += st; n++; }
  }
  assert.ok(n > 2, `anvil fringe cells (${n})`);
  assert.ok(softTop > softBot, `top denser than feathered underside (${softTop} > ${softBot})`);
  assert.ok(softBot < hardBot, `feather lowers underside vs knife-edge (${softBot} < ${hardBot})`);
});

test('layered bake: cells without overshoot soft-feather their top at the EL over baseFeatherM', () => {
  // Deep glaciated tower; finer nz so baseFeatherM spans >1 bake level. Fringe cells (anvil, h<=0.5) stop at the EL.
  const col = cloudColumn(30, qOf(30, .85), 1, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 96 }, dz = L.topM / L.nz;
  assert.ok(col.top - col.lcl >= 6000 && col.overshootM > 0, 'deep tower with overshoot for contrast');
  assert.ok((L.baseFeatherM ?? 0) >= 150 && L.baseFeatherM > dz, 'feather spans >1 bake voxel');
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  const step = col.layers[1]?.z || 250, bakeTop = col.top + step / 2;
  const jNear = Math.min(L.nz - 1, Math.floor((bakeTop - dz * .5) / dz));
  const jDeep = Math.min(L.nz - 1, Math.floor((bakeTop - L.baseFeatherM * .85) / dz));
  const midZ = col.lcl + .4 * (col.top - col.lcl);
  const jMid = Math.min(L.nz - 1, Math.floor(midZ / dz));
  let softNear = 0, hardNear = 0, softDeep = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    const sn = soft[i + L.nx * (jNear + L.nz * k)], hn = hard[i + L.nx * (jNear + L.nz * k)];
    const sd = soft[i + L.nx * (jDeep + L.nz * k)], mid = soft[i + L.nx * (jMid + L.nz * k)];
    // fringe: anvil near EL, little mid-tower fill (weak / no overshoot turret)
    if (hn > 15 && mid < 10) { softNear += sn; hardNear += hn; softDeep += sd; n++; }
  }
  assert.ok(n > 2, `EL-stopping fringe cells (${n})`);
  assert.ok(softDeep > softNear, `below-feather denser than feathered EL top (${softDeep} > ${softNear})`);
  assert.ok(softNear < hardNear, `feather lowers EL top vs knife-edge (${softNear} < ${hardNear})`);
});

test('overshoot bake: tip inside the box soft-feathers the cap; plume body stays denser than (1-u)^2', () => {
  // Raise topM so the physical tip sits inside the volume (default 12 km clamps hot overshoots).
  const col = cloudColumn(30, qOf(30, .85), 1, 14000), L = { ...LOCAL_CLOUDS, nx: 16, nz: 112, topM: 14000 }, dz = L.topM / L.nz;
  const tipFull = col.top + col.overshootM;
  assert.ok(col.overshootM > 800 && tipFull < L.topM - L.baseFeatherM, `tip inside box (${tipFull})`);
  assert.ok((L.baseFeatherM ?? 0) > dz, 'feather spans >1 bake voxel');
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  // near tip (inside feather) vs deeper in the plume body
  const jNear = Math.min(L.nz - 1, Math.floor((tipFull - L.baseFeatherM * .3) / dz));
  const jDeep = Math.min(L.nz - 1, Math.floor((tipFull - L.baseFeatherM * .95) / dz));
  const jBody = Math.min(L.nz - 1, Math.floor((col.top + (tipFull - col.top) * .35) / dz));
  assert.ok(jBody < jDeep && jDeep < jNear, 'body < deep-feather < near-tip');
  let softNear = 0, softDeep = 0, softBody = 0, hardBody = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    const sb = soft[i + L.nx * (jBody + L.nz * k)], hb = hard[i + L.nx * (jBody + L.nz * k)];
    if (hb < 8 && sb < 8) continue; // mature / lit plume column
    softNear += soft[i + L.nx * (jNear + L.nz * k)];
    softDeep += soft[i + L.nx * (jDeep + L.nz * k)];
    softBody += sb; hardBody += hb; n++;
  }
  assert.ok(n > 0, `plume columns (${n})`);
  assert.ok(softDeep > softNear, `cap feathers: deeper denser than near tip (${softDeep} > ${softNear})`);
  assert.ok(softBody > hardBody, `feathered body denser than (1-u)^2 taper (${softBody} > ${hardBody})`);
});

test('overshoot bake: soft-feathers tower→plume at the EL over baseFeatherM (not a knife handoff)', () => {
  // Deep overshooting tower; finer nz so baseFeatherM spans >1 bake level.
  const col = cloudColumn(30, qOf(30, .85), 1, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 96 }, dz = L.topM / L.nz;
  assert.ok(col.overshootM > 800 && col.top > col.lcl, `overshooting tower (${col.overshootM})`);
  assert.ok((L.baseFeatherM ?? 0) > dz, 'feather spans >1 bake voxel');
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  const jNear = Math.min(L.nz - 1, Math.floor((col.top - L.baseFeatherM * .3) / dz)); // inside feather, below EL
  assert.ok(jNear * dz < col.top, 'near-EL sample is below the buoyant top');
  let softNear = 0, hardNear = 0, softPlume = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    // mature overshooting cores: lit plume just above the EL
    const jPlume = Math.min(L.nz - 1, Math.floor((col.top + dz) / dz));
    const pl = soft[i + L.nx * (jPlume + L.nz * k)];
    const sn = soft[i + L.nx * (jNear + L.nz * k)], hn = hard[i + L.nx * (jNear + L.nz * k)];
    if (pl > 8 && hn > 40) { softNear += sn; hardNear += hn; softPlume += pl; n++; }
  }
  assert.ok(n > 0, `overshooting core columns (${n})`);
  assert.ok(softNear < hardNear, `feather lowers near-EL vs knife handoff (${softNear} < ${hardNear})`);
  // Soft attach moves the near-EL sample toward the ice-plume density (not the full knife tower).
  assert.ok(Math.abs(softNear - softPlume) < Math.abs(hardNear - softPlume),
    `soft near-EL closer to plume than knife (${softNear} vs plume ${softPlume}, knife ${hardNear})`);
});

test('anvil bake: ice-share gate smoothsteps mixed phase (0.25→0.75), full at ice≥0.75', () => {
  // Mirrors the iceOk ramp in bakeLocal (ECMWF IFS Cy47r1 ice_phase band).
  const gate = (ice: number) => { const u = Math.min(1, Math.max(0, (ice - .25) / .5)); return u * u * (3 - 2 * u); };
  assert.equal(gate(0), 0);
  assert.equal(gate(.25), 0);
  assert.equal(gate(.5), .5);
  assert.equal(gate(.75), 1);
  assert.equal(gate(1), 1);
  assert.ok(gate(.4) > 0 && gate(.4) < gate(.6) && gate(.6) < 1, 'strictly rising through mixed phase');
});

test('layered bake: soft-feathers toward the horizontal box rim (not a knife wall)', () => {
  const col = cloudColumn(30, qOf(30, .85), 1, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 48 };
  assert.ok((L.baseFeatherM ?? 0) > 0, 'feathering on');
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  // Outer ring (edge=0) vs one cell in (edge=1) near the buoyant top / anvil band
  const jTop = Math.min(L.nz - 1, Math.floor((col.top - L.topM / L.nz * .5) / (L.topM / L.nz)));
  let softRim = 0, softIn = 0, hardRim = 0, hardIn = 0, n = 0;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) {
    const edge = Math.min(i, k, L.nx - 1 - i, L.nx - 1 - k);
    const s = soft[i + L.nx * (jTop + L.nz * k)], h = hard[i + L.nx * (jTop + L.nz * k)];
    if (edge === 0) { softRim += s; hardRim += h; n++; }
    else if (edge === 1) { softIn += s; hardIn += h; }
  }
  assert.ok(n > 0, `rim cells (${n})`);
  assert.ok(hardRim > 0, `knife wall has cloud on the rim (${hardRim})`);
  assert.ok(softRim < hardRim, `feather lowers rim vs knife (${softRim} < ${hardRim})`);
  assert.ok(softIn > softRim, `inboard denser than rim (${softIn} > ${softRim})`);
});

test('layered bake: soft-feathers toward the vertical box lid (not a knife ceiling)', () => {
  // Clamp the box below the buoyant top so the main write truncates at the lid (not the overshoot path).
  const col = cloudColumn(30, qOf(30, .85), 1, LOCAL_CLOUDS.topM), L = { ...LOCAL_CLOUDS, nx: 16, nz: 48, topM: 6000 };
  assert.ok((L.baseFeatherM ?? 0) > 0, 'feathering on');
  assert.ok(col.top > L.topM, `EL above lid (${col.top} > ${L.topM})`);
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  const jLid = L.nz - 1, jIn = L.nz - 2, mid = (L.nx / 2) | 0;
  let softLid = 0, softIn = 0, hardLid = 0, n = 0;
  for (let k = mid - 2; k <= mid + 2; k++) for (let i = mid - 2; i <= mid + 2; i++) {
    softLid += soft[i + L.nx * (jLid + L.nz * k)];
    hardLid += hard[i + L.nx * (jLid + L.nz * k)];
    softIn += soft[i + L.nx * (jIn + L.nz * k)];
    n++;
  }
  assert.ok(n > 0, `lid cells (${n})`);
  assert.ok(hardLid > 0, `knife ceiling has cloud on the lid (${hardLid})`);
  assert.ok(softLid < hardLid, `feather lowers lid vs knife (${softLid} < ${hardLid})`);
  assert.ok(softIn > softLid, `below-lid denser than lid (${softIn} > ${softLid})`);
});

test('layered bake: ground fog is not feathered away at the box floor (the floor is the ground)', () => {
  // Synthetic fog deck: stratiform water in the lowest ~1 km only, no convective parcel.
  const L = { ...LOCAL_CLOUDS, nx: 16 }, base = cloudColumn(5, qOf(5, .5), 1, L.topM);
  const layers = base.layers.map(l => ({ ...l, strat: l.z <= 1000 ? L.waterFull : 0, water: l.z <= 1000 ? L.waterFull : 0, ice: 0 }));
  const col = { ...base, layers, lcl: -1, top: -1, overshootM: 0 };
  const soft = bakeLocal(col, 1, 0, 0, L), hard = bakeLocal(col, 1, 0, 0, { ...L, baseFeatherM: 0 });
  let s0 = 0, h0 = 0, sTop = 0, hTop = 0; const jTop = Math.floor(1000 / (L.topM / L.nz)) - 1; // last voxel of the deck
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) { if (Math.min(i, k, L.nx - 1 - i, L.nx - 1 - k) < 3) continue;
    s0 += soft[i + L.nx * L.nz * k]; h0 += hard[i + L.nx * L.nz * k]; sTop += soft[i + L.nx * (jTop + L.nz * k)]; hTop += hard[i + L.nx * (jTop + L.nz * k)]; }
  assert.ok(h0 > 0, `deck has cloud at the ground (${h0})`);
  assert.ok(s0 >= h0 * .9, `floor keeps fog (${s0} vs knife ${h0})`);
  assert.ok(sTop < hTop, `deck top still feathers (${sTop} < ${hTop})`);
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

test('#192: precipitation phase at the ground follows the freezing level and the melting layer', () => {
  assert.equal(snowShareAtGround(cloudColumn(-5, qOf(-5, .9), 1)), 1); // freezing surface: snow
  assert.equal(snowShareAtGround(cloudColumn(25, qOf(25, .8), 1)), 0); // freezing level kilometres up: rain
  const near = cloudColumn(1, qOf(1, .95), 1); // 0 C level ~150 m up, inside the melting layer
  const s = snowShareAtGround(near); assert.ok(s > 0 && s < 1, `mixed ${s} at freeze ${near.freezeM}`);
  const warm = { ...near, layers: near.layers.map(l => ({ ...l, ice: 0 })) };
  assert.equal(snowShareAtGround(warm), 0); // no ice aloft: warm rain
  let prev = 2; for (const t of [-3, 0, 1, 2, 4, 8]) { const v = snowShareAtGround(cloudColumn(t, qOf(t, .95), 1)); assert.ok(v <= prev + 1e-9, `${t}: ${v}`); prev = v; }
});

test('anvil: a deep glaciated tower spreads wider at its buoyant top than through its middle; a shallow cumulus does not', () => {
  const L = LOCAL_CLOUDS, dz = L.topM / L.nz, cover = (b: Uint8Array, j: number) => { let on = 0; for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) if (b[i + L.nx * (j + L.nz * k)] > 8) on++; return on; };
  const col = cloudColumn(30, qOf(30, .8), .4, L.topM); assert.ok(col.top - col.lcl >= 6000, `deep tower expected: ${col.lcl}-${col.top}`);
  const b = bakeLocal(col, .4, 0, 0), jt = Math.floor((col.top - 500) / dz), jm = Math.floor((col.lcl + col.top) / 2 / dz);
  assert.ok(col.layers[Math.round(col.top / col.layers[1].z)].ice >= .5, 'the anvil level is glaciated');
  assert.ok(cover(b, jt) > 1.05 * cover(b, jm), `anvil ${cover(b, jt)} vs mid-tower ${cover(b, jm)}`); // 1.05: wispy anv^1.5 fringe still spreads, lower >8 cover than linear soft-weight
  const sh = cloudColumn(18, qOf(18, .6), .4, L.topM); if (sh.top > sh.lcl) assert.ok(sh.top - sh.lcl < 6000);
  const bs = bakeLocal(sh, .4, 0, 0), js = Math.floor(sh.top / dz) - 1, jsm = Math.floor((sh.lcl + sh.top) / 2 / dz);
  if (sh.top > sh.lcl && js > jsm) assert.ok(cover(bs, js) <= cover(bs, jsm), 'shallow cumulus narrows to its top');
});
test('entrainment: mixing in environment air lowers a deep tower top below the undiluted parcel, base unchanged', async () => {
  const C = (await import('../data/earth/cloud-column.json')).default as { entrain_per_m: number }, keep = C.entrain_per_m;
  const run = () => cloudColumn(30, qOf(30, .8), 1);
  try { C.entrain_per_m = 0; const pure = run(); C.entrain_per_m = keep; const mixed = run();
    assert.equal(mixed.lcl, pure.lcl); assert.ok(keep > 0 && mixed.top <= pure.top, `${mixed.top} vs ${pure.top}`);
    assert.ok(mixed.top - mixed.lcl >= 6000, 'a hot humid tower still reaches anvil depth'); } finally { C.entrain_per_m = keep; }
});
test('CAPE: a hot humid column carries strong convective energy, a cool one little, entrainment and drier air reduce it', async () => {
  const C = (await import('../data/earth/cloud-column.json')).default as { entrain_per_m: number }, keep = C.entrain_per_m;
  const hot = cloudColumn(30, qOf(30, .8), 1), cool = cloudColumn(10, qOf(10, .5), 1), drier = cloudColumn(30, qOf(30, .6), 1);
  assert.ok(hot.cape > 1000, `hot humid CAPE ${hot.cape}`); assert.ok(cool.cape < 300, `cool CAPE ${cool.cape}`);
  assert.ok(drier.cape < hot.cape, `${drier.cape} vs ${hot.cape}`);
  assert.ok(Math.abs(hot.wMax - Math.sqrt(2 * hot.cape)) < 1e-9 && hot.wMax > 40 && cool.wMax < 25, `wMax ${hot.wMax} / ${cool.wMax}`);
  try { C.entrain_per_m = 0; const pure = cloudColumn(30, qOf(30, .8), 1); assert.ok(pure.cape >= hot.cape, `${pure.cape} vs ${hot.cape}`); } finally { C.entrain_per_m = keep; }
});
test('overshooting top: a strong tower punches 1-2 km above its anvil level, a weak one barely, clear air not at all', () => {
  const hot = cloudColumn(30, qOf(30, .8), 1), cool = cloudColumn(10, qOf(10, .5), 1), dry = cloudColumn(30, .001, 1);
  assert.ok(hot.overshootM > 800 && hot.overshootM < 2500, `hot overshoot ${hot.overshootM}`);
  assert.ok(cool.overshootM < hot.overshootM / 2, `cool ${cool.overshootM} vs hot ${hot.overshootM}`);
  if (!(dry.top > dry.lcl && dry.lcl >= 0)) assert.equal(dry.overshootM, 0);
});
test('optical depth: a deep tower is far thicker than shallow cumulus, which is thicker than a near-clear column', () => {
  const hot = cloudColumn(30, qOf(30, .8), 1), cool = cloudColumn(10, qOf(10, .5), 1), dry = cloudColumn(30, .001, 1);
  assert.ok(hot.tau > 3 * cool.tau && cool.tau > 10 * dry.tau, `tau ${hot.tau} / ${cool.tau} / ${dry.tau}`); // deep > shallow still holds under the Kessler cap; the 10x gap was the adiabatic overshoot
  assert.ok(hot.waterPath > cool.waterPath && cool.waterPath > 0, `W ${hot.waterPath} / ${cool.waterPath}`);
  const sum = hot.layers.reduce((a, l) => a + l.water, 0); assert.ok(sum > 0 && hot.waterPath > 0);
});
test('Kessler cap: suspended convective condensate stays at the autoconversion threshold, so water path is a few kg/m2 not the adiabatic tens', async () => {
  const C = (await import('../data/earth/cloud-column.json')).default as { qc_auto_kg_kg: number };
  assert.equal(C.qc_auto_kg_kg, 1e-3); // same Kessler 1969 qc0 as weather.ts KESSLER
  const hot = cloudColumn(30, qOf(30, .8), 1), cool = cloudColumn(10, qOf(10, .5), 1);
  assert.ok(hot.layers.filter(l => l.water > 0 && l.strat === 0).every(l => l.water <= C.qc_auto_kg_kg + 1e-15), 'convective layers stay at or below qc0');
  assert.ok(hot.waterPath > 1 && hot.waterPath < 20, `deep W ${hot.waterPath}`); // observed CB paths are a few kg/m2
  assert.ok(hot.tau > 50 && hot.tau < 2000, `deep tau ${hot.tau}`); // order 10^2-10^3, not the adiabatic 10^3-10^4
  assert.ok(cool.waterPath < hot.waterPath && cool.tau < hot.tau);
});

test('Kessler bake: waterFull matches qc_auto so a deep tower saturates the densest convective voxel', () => {
  assert.equal(LOCAL_CLOUDS.waterFull, CC.qc_auto_kg_kg);
  const L = { ...LOCAL_CLOUDS, nx: 16, nz: 24 }, deep = cloudColumn(30, qOf(30, .85), 1), b = bakeLocal(deep, 1, 0, 0, L);
  assert.ok(Math.max(...b) === 255, `max bake byte ${Math.max(...b)}`); // capped q_c / waterFull reaches 1
});


import { boxExtinction, cellTransmittance } from '../src/world/globe/localClouds';
test('layered render: the box extinction gives the densest cell the column optical depth; thin deck passes sun, deep tower is opaque', () => {
  const L = { ...LOCAL_CLOUDS, nx: 16, nz: 24 }, dens = (b: Uint8Array) => { let best = [0, 0], bs = -1;
    for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) { let s = 0; for (let j = 0; j < L.nz; j++) s += b[i + L.nx * (j + L.nz * k)]; if (s > bs) { bs = s; best = [i, k]; } } return best; };
  const deep = cloudColumn(30, qOf(30, .85), 1), bd = bakeLocal(deep, 1, 0, 0, L), ed = boxExtinction(deep, bd, L), [di, dk] = dens(bd);
  assert.ok(ed > 0); assert.ok(cellTransmittance(bd, ed, di, dk, L) >= Math.exp(-deep.tau) - 1e-9); // never more opaque than the column
  assert.ok(cellTransmittance(bd, ed, di, dk, L) < .01, `deep tower tau ${deep.tau}`);
  const dry = cloudColumn(20, qOf(20, .2), 0), bz = bakeLocal(dry, 0, 0, 0, L);
  assert.equal(boxExtinction(dry, bz, L) >= 0, true);
  const thin = { ...deep, tau: .5 }; assert.ok(cellTransmittance(bd, boxExtinction(thin, bd, L), di, dk, L) > .5); // same shape, thin optical depth lets sun through
});

import { LOCAL_CLOUDS_FRAG, sunTransmittance } from '../src/world/globe/localClouds';
test('layered render shader: no line comment swallows code, braces balance, sun shadow uses the column extinction', () => {
  for (const line of LOCAL_CLOUDS_FRAG.split('\n')) { const c = line.indexOf('//'); if (c >= 0) assert.ok(!/[;{}]/.test(line.slice(c + 2)), `code after // : ${line.slice(c, c + 80)}`); }
  const code = LOCAL_CLOUDS_FRAG.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal((code.match(/{/g) || []).length, (code.match(/}/g) || []).length);
  assert.match(code, /msSun\(sh \* uExt \* sm, ct\)/); assert.match(code, /exp\(-b \* tau\)/);
  const L = { ...LOCAL_CLOUDS, nx: 16, nz: 24 }, deep = cloudColumn(30, qOf(30, .85), 1), bd = bakeLocal(deep, 1, 0, 0, L);
  const eDeep = boxExtinction(deep, bd, L), eThin = boxExtinction({ ...deep, tau: .5 }, bd, L), sun: [number, number, number] = [0, 1, 0];
  assert.ok(sunTransmittance(2, eThin, sun, L) > sunTransmittance(2, eDeep, sun, L)); // deep tower self-shadows more
  assert.ok(sunTransmittance(2, eThin, sun, L) > .5, 'thin deck stays bright inside');
});

import { cloudPhase, hgPhase, CLOUD_G } from '../src/world/globe/localClouds';
test('cloud phase: Henyey-Greenstein is normalised, forward-peaked, and the shader uses it', () => {
  let s = 0; const n = 20000; for (let i = 0; i < n; i++) { const c = -1 + (i + .5) * 2 / n; s += hgPhase(c) * 2 / n; }
  assert.ok(Math.abs(s / 2 - 1) < 1e-3, `mean over the sphere ${s / 2}`); // 4*pi*p_HG averages to 1, so it only redistributes light
  assert.ok(cloudPhase(1) > 5 && cloudPhase(-1) < .05, 'toward the sun bright, away dim');
  assert.ok(cloudPhase(1) <= 6 && CLOUD_G === .85);
  assert.match(LOCAL_CLOUDS_FRAG, /G = 0\.85, PHASE_CAP = 6\.0/); assert.match(LOCAL_CLOUDS_FRAG, /msSun\(sh \* uExt \* sm, ct\)/);
});

import { multiScatterSun, MS_OCTAVES } from '../src/world/globe/localClouds';
test('multiple-scattering octaves keep deep cloud lit and reduce to single scattering in thin cloud', () => {
  assert.equal(MS_OCTAVES, 3);
  // thin cloud: the first octave dominates, total is phase * (1 + .5*p(g/2)/p(g) + ...) and above single scattering
  assert.ok(multiScatterSun(0, 1) >= cloudPhase(1));
  // deep cloud (tau 20): single scattering is ~2e-9, the third octave (a=.25, tau*.25) keeps about .25*e^-5*p, near 1e-3
  const single = Math.exp(-20) * cloudPhase(0); const ms = multiScatterSun(20, 0);
  assert.ok(ms > 1e4 * single && ms > 1e-3 && ms < 1e-2, `ms ${ms}`);
  // still monotonic: more optical depth, less light
  assert.ok(multiScatterSun(1, .3) > multiScatterSun(5, .3));
  assert.match(LOCAL_CLOUDS_FRAG, /n < 3; n\+\+\) \{ s \+= a \* exp\(-b \* tau\)/);
});

import { skyAmbient, SKY_AMB } from '../src/world/globe/localClouds';
test('skylight inside the cloud dims under the cloud above it, clear sky keeps the old ambient', () => {
  assert.ok(Math.abs(skyAmbient(0) - SKY_AMB) < 1e-12);
  assert.ok(skyAmbient(1) < skyAmbient(0) && skyAmbient(10) < skyAmbient(1));
  // deep tower (tau 20): third octave alone keeps .25/1.75*e^-5 of the sky, so a base is dark grey, not black
  const deep = skyAmbient(20) / SKY_AMB; assert.ok(deep > 5e-4 && deep < 5e-3, `deep ${deep}`);
  assert.match(LOCAL_CLOUDS_FRAG, /skyAmb\(up \* uExt \* uBoxM\.y \* \.05\)/);
  assert.match(LOCAL_CLOUDS_FRAG, /return 0\.25 \* s \/ 1\.75;/);
});

import { airMass, sunTint } from '../src/world/globe/localClouds';
test('sunlight on the cloud is tinted by the Rayleigh air path: white overhead, red at the horizon', () => {
  assert.ok(Math.abs(airMass(1) - 1) < 1e-3 && Math.abs(airMass(0) - 38) < 1.5); // Kasten-Young: ~38 air masses at the horizon
  const noon = sunTint(1); noon.forEach(c => assert.ok(Math.abs(c - 1) < 1e-3));
  const low = sunTint(Math.cos(80 * Math.PI / 180)), set = sunTint(0);
  assert.ok(low[0] > low[1] && low[1] > low[2], `low ${low}`); // blue scattered out first: gold
  assert.ok(set[2] < 1e-3 && set[0] > .1, `set ${set}`); // sunset: red survives, blue gone
  assert.match(LOCAL_CLOUDS_FRAG, /vec3 lit = uSunCol \* \(msSun/);
});

import { sunVisible, skyLevel } from '../src/world/globe/localClouds';
test('planet shadow: after sunset the cloud top stays lit after its base, and night clouds go dark', () => {
  const d = (x: number) => Math.sin(x * Math.PI / 180);
  assert.ok(sunVisible(d(10), 1000) === 1 && sunVisible(d(-20), 12000) === 0);
  const mu = d(-2.5); assert.ok(sunVisible(mu, 10000) > .99 && sunVisible(mu, 2000) < .01, 'dip ~3.2 deg at 10 km, ~1.4 deg at 2 km');
  assert.equal(skyLevel(d(5)), 1); assert.ok(Math.abs(Math.log10(skyLevel(d(-6))) + 2.4) < .01 && skyLevel(-1) < 1e-11);
  assert.match(LOCAL_CLOUDS_FRAG, /sunVis\(\(p\.y \+ \.5\) \* uBoxM\.y\)\) \+ uSkyF \* skyAmb/);
});

import { airTransmittance } from '../src/world/globe/localClouds';
test('layered clouds: aerial perspective fades distant clouds into the sky', () => {
  assert.equal(airTransmittance(0, 1000, 2000), 1);
  const near = airTransmittance(2000, 1000, 2000), far = airTransmittance(30000, 1000, 2000);
  assert.ok(near > .97 && far < .75 && far > .6, `near ${near} far ${far}`);
  assert.ok(airTransmittance(30000, 10000, 10000) > far, 'thinner air aloft hazes less');
});

import { groundAlbedo, groundBounce, ALB_FOREST, ALB_SNOW } from '../src/world/globe/localClouds';
test('layered clouds: ground bounce lights bases from below, brighter over snow, gone at night', () => {
  assert.equal(groundAlbedo(10), ALB_FOREST); assert.equal(groundAlbedo(-10), ALB_SNOW);
  assert.ok(Math.abs(groundBounce(.5, 1, 0) - .5) < 1e-12, 'clear below: albedo * mu');
  assert.ok(groundBounce(ALB_SNOW, .5, 1) > 3 * groundBounce(ALB_FOREST, .5, 1));
  assert.ok(groundBounce(ALB_SNOW, .5, 10) < groundBounce(ALB_SNOW, .5, 1));
  assert.equal(groundBounce(ALB_SNOW, -.1, 0), 0);
});

test('anvil bake: tower-depth gate smoothsteps 0.8x→1x anvil_min_tower_m (no on/off pop)', () => {
  const m = CC.anvil_min_tower_m;
  assert.equal(anvilDepthGate(0), 0);
  assert.equal(anvilDepthGate(.8 * m), 0);
  assert.ok(Math.abs(anvilDepthGate(.9 * m) - .5) < 1e-9);
  assert.equal(anvilDepthGate(m), 1);
  assert.equal(anvilDepthGate(2 * m), 1);
  assert.ok(anvilDepthGate(.85 * m) < anvilDepthGate(.95 * m), 'rising through the band');
});

test('layered clouds: core-strength ramp is smooth at both ends (no crease at h=0.5 or 0.85)', () => {
  assert.equal(coreStrength(.4), 0); assert.equal(coreStrength(.5), 0); assert.equal(coreStrength(.85), 1); assert.equal(coreStrength(1), 1);
  assert.ok(Math.abs(coreStrength(.675) - .5) < 1e-9);
  const e = 1e-4, slope = (x: number) => (coreStrength(x + e) - coreStrength(x - e)) / (2 * e);
  assert.ok(slope(.5 + e) < .01 && slope(.85 - e) < .01); // zero slope at the ends
  for (let x = .5; x < .85; x += .01) assert.ok(coreStrength(x + .01) >= coreStrength(x)); // monotone
});

test('layered clouds: EL tower→plume attach shares coreStrength (no leftover linear mid-ramp)', () => {
  // bakeLocal plumeAtEl uses coreStrength(h), same 0.5→0.85 band as the overshoot plume (#368).
  // Near the low knee, smoothstep stays well below a linear (h-0.5)/0.35 — pin that so a revert can't sneak back.
  assert.equal(coreStrength(.5), 0);
  assert.ok(coreStrength(.55) < ((.55 - .5) / .35) * .5);
  assert.ok(Math.abs(coreStrength(.675) - .5) < 1e-9);
  assert.equal(coreStrength(.85), 1);
});
