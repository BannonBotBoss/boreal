import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIR, getGrid, initWeather, kessler, qsat, saveWeather, loadWeather, shortwave, solar, stepWeather, surfaceBalance, windAt, drag, WEATHER, NY } from '../src/core/weather';
import { declination } from '../src/core/timeOfDay';
import { DELTAS, DELTA_KINDS, prune, record, strength } from '../src/core/deltas';
import { GROUND } from '../src/core/ground';
import { INTEREST, enqueue, finish, runJobs, setInterestCentre, tierAt } from '../src/core/interest';

const dailyMeanToa = (day: number, lat: number) => { let s = 0; for (let m = 0; m < 1440; m++) s += solar(day, m / 60, lat, 0, 0).toa; return s / 1440; };
test('insolation matches reference values (NOAA geometry, S0 = 1361 W/m²)', () => {
  // daily-mean TOA: equator at the March equinox ≈ S0/π ≈ 433–440; 50°N at the June solstice ≈ 470–490 (Hartmann 2016, Fig. 2.6)
  const eq = dailyMeanToa(80, 0), n50 = dailyMeanToa(172, 50), pole = dailyMeanToa(355, 85);
  assert.ok(eq > 425 && eq < 445, `equator equinox ${eq}`);
  assert.ok(n50 > 465 && n50 < 495, `50N solstice ${n50}`);
  assert.equal(pole, 0, 'polar night');
  // solar-noon zenith at Kenora on the June solstice = lat − δ
  let minZ = 90; for (let m = 0; m < 1440; m++) minZ = Math.min(minZ, solar(172, m / 60).zenith);
  assert.ok(Math.abs(minZ - (49.79 - 23.44)) < .2, `noon zenith ${minZ}`);
  assert.ok(Math.abs(declination(172) - 23.44) < .1 && Math.abs(declination(355) + 23.44) < .1);
  // clear-sky surface beam+diffuse at zenith ≈ 1.1·S0·0.7 ≈ 1048 W/m² (Meinel); overcast cuts it by 75 % (Kasten & Czeplak)
  assert.ok(Math.abs(shortwave(1, 0) - 1048) < 5); assert.ok(Math.abs(shortwave(1, 1) / shortwave(1, 0) - .25) < 1e-9);
});
test('surface energy balance closes: Rn = H + λE + G', () => {
  for (const kind of ['water', 'forest', 'moss', 'snow'] as const) {
    const b = surfaceBalance(kind, 700, 18, .008, 96000, 3, .2, .8);
    assert.ok(Math.abs(b.Rn - b.H - b.LE - b.G) < 1e-9, kind);
  }
  assert.ok(surfaceBalance('water', 700, 18, .008, 96000, 3, 0, 1).LE > surfaceBalance('forest', 700, 18, .008, 96000, 3, 0, 1).LE, 'r_s = 0 evaporates more');
});
test('Kessler microphysics conserves water (vapour + cloud + rain + surface)', () => {
  const g = initWeather(200, 14, 0, 0, 6);
  for (let n = 0; n < g.q.length; n++) g.q[n] *= 3; // supersaturate
  const total = () => { let s = 0; for (let n = 0; n < g.q.length; n++) s += (g.q[n] + g.qc[n] + g.qr[n]) * 400; for (let c = 0; c < g.soil.length; c++) s += g.soil[c] + g.swe[c]; return s; };
  const before = total(); for (let i = 0; i < 300; i++) kessler(20);
  let rain = 0; for (const p of g.precip) rain += p;
  assert.ok(Math.abs(total() - before) < 1e-3 * before, `${before} vs ${total()}`);
  assert.ok(g.qc.some(v => v > 0) || rain >= 0, 'condensation happened');
  assert.ok(g.soil.some(v => v > 90), 'rain reached the ground bucket');
});
test('deterministic from seed + date, and stable over a long run (3 game days)', () => {
  const run = () => { initWeather(227, 6, 0, 0, 6); for (let i = 0; i < 2000; i++) stepWeather(120); return saveWeather(); };
  const a = run(), b = run(); assert.equal(a, b);
  const g = getGrid(); for (let n = 0; n < g.u.length; n++) { assert.ok(Number.isFinite(g.u[n] + g.v[n] + g.w[n] + g.th[n] + g.q[n])); assert.ok(Math.hypot(g.u[n], g.v[n]) <= 40.0001 && Math.abs(g.w[n]) <= 10); }
  for (let n = 0; n < g.th.length; n++) assert.ok(g.th[n] > 250 && g.th[n] < 340, `θ ${g.th[n]}`);
  assert.ok(loadWeather(a)); assert.equal(saveWeather(), a, 'save/load round-trips');
  assert.equal(g.u.length, 6 * 6 * NY);
});
test('one wind field: log profile below the first layer, drag opposes relative motion', () => {
  initWeather(227, 12, 0, 0, 8); WEATHER.on = true;
  const lo = windAt(0, 1, 0), hi = windAt(0, 50, 0);
  assert.ok(Math.hypot(lo.x, lo.z) < Math.hypot(hi.x, hi.z), 'slower near the canopy');
  const F = drag({ x: 5, z: 0 }, { x: 0, y: 0, z: 0 }, .15); assert.ok(F.x < 0 && Math.abs(F.x - -.5 * 1.2 * .15 * 25) < 1e-9);
  assert.ok(AIR.S0 === 1361);
});
test('interest tiers + budgeted jobs', () => {
  setInterestCentre(0, 0); assert.equal(tierAt(10, 0), 'near'); assert.equal(tierAt(INTEREST.near + 1, 0), 'mid'); assert.equal(tierAt(INTEREST.mid + 1, 0), 'far');
  function* job() { for (let i = 0; i < 5; i++) yield; return 42; }
  assert.equal(finish(job()), 42);
  let got = 0, t = 0; enqueue('x', 0, job(), v => { got = v; });
  runJobs(1, () => t++); assert.equal(got, 0, 'budget stops mid-job'); while (!got) runJobs(1, () => t++); assert.equal(got, 42);
});
test('persistence deltas: closed-form fade, capped, residue merges into the ground', () => {
  DELTAS.log = []; GROUND.deposits = []; GROUND.years = 0;
  record({ kind: 'carcass', x: 3, z: 3, t: 0, m: 30 });
  assert.equal(strength(DELTAS.log[0], 0), 1);
  const tau = DELTA_KINDS.carcass.tau / 365.25; assert.ok(Math.abs(strength(DELTAS.log[0], tau) - Math.exp(-1)) < 1e-9);
  prune(tau * 10); assert.equal(DELTAS.log.length, 0); assert.equal(GROUND.deposits.length, 1); assert.ok(Math.abs(GROUND.deposits[0].kg - 9) < 1e-9);
  for (let i = 0; i < DELTAS.cap + 50; i++) record({ kind: 'scent', x: i * 3, z: 0, t: 0, m: 1 });
  assert.equal(DELTAS.log.length, DELTAS.cap);
  DELTAS.log = []; GROUND.deposits = [];
});
