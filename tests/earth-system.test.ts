import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orbitAt, seasonLengths, milankovitch, ORBIT } from '../src/core/orbit';
import { B0, dipoleB, shueR0, dynPressure, chapmanFerraroR, bowShockR, parkerAngle, auroraFromSolarWind, INTERIOR } from '../src/core/geodynamo';
import { COMPOSITION, rayleighPerKm, scaleHeightKm } from '../src/world/globe/composition';
import { MILESTONES } from '../src/core/deepTime';
const omni = (f: string) => JSON.parse(readFileSync(new URL(`../data/omni/${f}.json`, import.meta.url), 'utf8')).hours;

test('orbit: perihelion 147.1 / aphelion 152.1 Mkm, speed 30.29 / 29.29 km/s, 1/r^2 insolation', () => {
  const p = orbitAt(0), a = orbitAt(ORBIT.siderealYearD / 2);
  assert.ok(Math.abs(p.r / 1e6 - 147.1) < 0.1 && Math.abs(a.r / 1e6 - 152.1) < 0.1); assert.ok(Math.abs(p.v - 30.29) < 0.02 && Math.abs(a.v - 29.29) < 0.02);
  assert.ok(Math.abs(p.insolationFactor - 1.034) < 0.002);
});
test('Kepler 2nd law: NH summer ~4.7 d longer than winter', () => { const s = seasonLengths(); const d = s.summer - s.winter; assert.ok(d > 4.4 && d < 4.9, `${d}`); });
test('Milankovitch ranges (approximate sinusoids): obliquity 22.1-24.5, e 0-0.06, today = today', () => {
  assert.ok(Math.abs(milankovitch(0).obliquityDeg - ORBIT.obliquityDeg) < 1e-6);
  for (let t = -1e6; t <= 0; t += 7e3) { const m = milankovitch(t); assert.ok(m.obliquityDeg >= 22.09 && m.obliquityDeg <= 24.51); assert.ok(m.e >= 0 && m.e <= 0.06); }
});
test('dipole: ~30 uT equator, ~60 uT pole; PREM inner core 1221.5 km', () => {
  assert.ok(B0() > 28e-6 && B0() < 32e-6); assert.ok(Math.abs(dipoleB(90) / B0() - 2) < 1e-9); assert.equal(INTERIOR.innerCore.radiusKm, 1221.5);
});
test('magnetosphere: magnetopause ~10 Re (Shue and pressure balance agree), bow shock ~13-14 Re, Parker ~45 deg', () => {
  const r = shueR0(0, dynPressure(5, 400)); assert.ok(r > 9.5 && r < 11.5); assert.ok(Math.abs(chapmanFerraroR(5, 400) - r) < 1.5);
  const b = bowShockR(r); assert.ok(b > 12.5 && b < 15); const p = parkerAngle(400); assert.ok(p > 42 && p < 50);
});
test('aurora emerges from OMNI solar wind: Gannon storm 2024-05-10 oval reaches < 48 deg MLAT; quiet day stays 65-76', () => {
  const g = auroraFromSolarWind(omni('gannon-2024-05-10')), q = auroraFromSolarWind(omni('quiet-2024-04-27'));
  assert.ok(Math.min(...g.map(x => x.ovalEqMlat)) < 48); const qs = q.map(x => x.ovalEqMlat); assert.ok(Math.min(...qs) > 65 && Math.max(...qs) < 76);
  assert.match(g[0].why, /Phi_D=.*open flux.*MLAT/);
});
test('atmosphere composition -> Rayleigh: tau(550) ~0.097 (Bucholtz 1995), H ~8.4 km, dry air sums to 1', () => {
  const tau = rayleighPerKm(550) * scaleHeightKm(); assert.ok(Math.abs(tau - 0.097) < 0.005, `${tau}`);
  assert.ok(Math.abs(scaleHeightKm() - 8.43) < 0.05); const f = COMPOSITION.dryVolumeFraction; assert.ok(Math.abs(f.N2 + f.O2 + f.Ar + f.CO2 - 1) < 1e-3);
  assert.ok(rayleighPerKm(440) / rayleighPerKm(680) > 5.5); // blue limb
});
test('deep time carries the dynamo and the (disputed) inner-core hooks', () => { for (const id of ['dynamo', 'innercore', 'brunhes']) assert.ok(MILESTONES.some(m => m.id === id)); });
// Trenberth, Fasullo & Kiehl 2009 / CERES EBAF global means (W/m2): incoming 341, reflected 102 (79 atm+cloud, 23 surface),
// absorbed atm 78, surface 161, surface LW 396, back 333, OLR 239, latent 80, sensible 17; planetary albedo 0.29-0.31.
// TODO (open gap): the sim after a 48 h spin-up gives TOA 340.3 (ok), surface reflected 22.5 (ok), surface absorbed 95.8 (low),
// surface LW 339.8 (low: mean Ts 5 C vs 15 C), and no atmosphere/cloud reflected or OLR plane to test planetary albedo.
test.todo('annual global-mean energy budget closes to Trenberth 2009 within 5 W/m2 and planetary albedo 0.29-0.31');
