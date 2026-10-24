import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { AURORA, AIRGLOW, auroraKR, auroraPole } from '../src/world/globe/atmosphere';
import { auroraFromSolarWind, fieldLineR } from '../src/core/geodynamo';
const omni = (f: string) => JSON.parse(readFileSync(new URL(`../data/omni/${f}.json`, import.meta.url), 'utf8')).hours;
test('aurora: dipole pole at IGRF geomagnetic north, unit vector', () => { const p = auroraPole(); assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-12);
  assert.ok(Math.abs(Math.asin(p[1]) * 180 / Math.PI - 80.7) < 1e-9); });
test('aurora: Gannon storm oval far equatorward and IBC III-IV bright; quiet IBC I-II', () => {
  const g = auroraFromSolarWind(omni('gannon-2024-05-10')), q = auroraFromSolarWind(omni('quiet-2024-04-27'));
  const gp = g.reduce((a, b) => b.phiKV > a.phiKV ? b : a), qp = q.reduce((a, b) => b.phiKV > a.phiKV ? b : a);
  assert.ok(gp.ovalEqMlat < 55, `gannon edge ${gp.ovalEqMlat}`); assert.ok(qp.ovalEqMlat > gp.ovalEqMlat + 5);
  const kg = auroraKR(gp.emission.relBrightness), kq = auroraKR(qp.emission.relBrightness);
  assert.ok(kg >= 30 && kg <= 1000, `gannon ${kg} kR`); assert.ok(kq >= 0.5 && kq < 30, `quiet ${kq} kR`);
  assert.ok(kg * 1000 / AIRGLOW.zenithR > 100, 'storm aurora >> airglow'); assert.ok(AURORA.redKm > AURORA.greenKm); });
test('field lines: r = L cos^2 reaches the surface at mlat acos(sqrt(1/L))', () => { for (const L of [1.5, 4, 8]) assert.ok(Math.abs(fieldLineR(L, Math.acos(Math.sqrt(1 / L)) * 180 / Math.PI) - 1) < 1e-12); });
