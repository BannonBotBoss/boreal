/** T-0060 deep time: the Gough brightening fit, the zero-greenhouse temperature, stage boundaries from cited figures, and the log dial. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEEP, DIAL, MILESTONES, STAGE_INFO, deepTimeAt, dialToYears, equilibriumTempK, formatYears, luminosityRatio, nearestMilestone, stageAt, yearsAtLuminosity, yearsToDial, type DeepStage } from '../src/core/deepTime';
const near = (a: number, b: number, e: number, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} vs ${b} (+-${e})`);

test('known match: Te now is 254.0 K (NASA Earth Fact Sheet, A = 0.306); a static Sun is the known mismatch at 3.7 Ga', () => {
  near(equilibriumTempK(0), 254.0, .5, 'Te now');
  const young = equilibriumTempK(-DEEP.lifeStartYr);
  assert.ok(equilibriumTempK(0) - young > 15, `faint young Sun: ${young}`); // a constant-luminosity model gives 0 K of difference
  near(young, 236.8, 1, 'Te at 3.7 Ga');
});
test('Gough fit: ratio 1 now, 0.714 at the Sun\'s birth (Feulner 2012: ~30 % lower), +1 % per ~110 Myr (Wolf & Toon 2015)', () => {
  near(luminosityRatio(0).ratio, 1, 1e-12); near(luminosityRatio(-DEEP.sunAgeYr).ratio, 1 / 1.4, 1e-12);
  near(luminosityRatio(110e6).ratio, 1.01, .001); assert.equal(luminosityRatio(110e6).extrapolated, false);
  assert.equal(luminosityRatio(DEEP.mainSequenceEndYr).extrapolated, false); assert.equal(luminosityRatio(DEEP.mainSequenceEndYr + 1).extrapolated, true);
  let prev = 0; for (let y = -4.5e9; y <= 5e9; y += 1e8) { const r = luminosityRatio(y).ratio; assert.ok(r > prev, 'brightens monotonically'); prev = r; }
});
test('flux thresholds (Wolf & Toon 2015) become years through the fit: +12.5 % ~1.27 Gyr, +21 % ~2 Gyr from now', () => {
  for (const r of Object.values(DEEP.flux)) near(luminosityRatio(yearsAtLuminosity(r)).ratio, r, 1e-9, 'round trip');
  near(yearsAtLuminosity(DEEP.flux.moistGreenhouse), 1.27e9, .01e9); near(yearsAtLuminosity(DEEP.flux.runaway), 1.98e9, .02e9);
  assert.ok(yearsAtLuminosity(DEEP.flux.runaway) < DEEP.mainSequenceEndYr);
});
test('stages: before Earth no globe, then Hadean, microbial seas, living Earth (now), then the cited futures in order', () => {
  const at = (y: number): DeepStage => stageAt(y);
  assert.equal(at(-4.6e9), 'no-planet'); assert.equal(at(-DEEP.earthAgeYr), 'hadean'); assert.equal(at(-4e9), 'hadean');
  assert.equal(at(-DEEP.lifeStartYr), 'microbial'); assert.equal(at(-1e9), 'microbial');
  assert.equal(at(-DEEP.animalsYr), 'living-earth'); assert.equal(at(-66e6), 'living-earth'); assert.equal(at(0), 'living-earth'); assert.equal(at(1e9), 'living-earth');
  assert.equal(at(1.5e9), 'moist-greenhouse'); assert.equal(at(1.9e9), 'oceans-lost'); assert.equal(at(4.9e9), 'oceans-lost');
  assert.equal(at(DEEP.mainSequenceEndYr), 'red-giant'); assert.equal(at(7e9), 'red-giant'); assert.equal(at(DEEP.engulfedYr), 'engulfed'); assert.equal(at(8e9), 'engulfed');
  const order: DeepStage[] = ['no-planet', 'hadean', 'microbial', 'living-earth', 'moist-greenhouse', 'oceans-lost', 'red-giant', 'engulfed'];
  let k = 0; for (let y = -4.7e9; y <= 8e9; y += 5e6) { const i = order.indexOf(stageAt(y)); assert.ok(i >= k, `stage went backwards at ${y}`); k = i; }
  assert.equal(k, order.length - 1); for (const s of order) assert.ok(STAGE_INFO[s].title && STAGE_INFO[s].sees);
  assert.equal(STAGE_INFO.microbial.embody, 'microbe'); assert.equal(STAGE_INFO['living-earth'].embody, 'animal');
});
test('readout: no temperature when there is no planet; extrapolation is flagged past the main sequence', () => {
  assert.ok(Number.isNaN(deepTimeAt(-4.6e9).equilibriumK)); assert.ok(Number.isNaN(deepTimeAt(8e9).equilibriumK));
  near(deepTimeAt(0).equilibriumK, 254, .5); assert.equal(deepTimeAt(0).label, 'now'); assert.equal(deepTimeAt(6e9).extrapolated, true); assert.equal(deepTimeAt(0).extrapolated, false);
});
test('dial: the present is the centre of one line from solar-system formation, ends reach no planet and engulfment, log spacing, exact round trip, monotone', () => {
  const offset = (s: number) => dialToYears(s) - DEEP.solarSystemAgeYr;
  assert.equal(dialToYears(0), DEEP.solarSystemAgeYr);
  assert.equal(stageAt(offset(-1)), 'no-planet'); assert.equal(stageAt(offset(1)), 'engulfed');
  assert.equal(dialToYears(-1), DEEP.solarSystemAgeYr - (DIAL.pastSpanYr - 1)); assert.equal(dialToYears(5), dialToYears(1)); // clamped
  // The line year is ~1e9, so a fraction of a year is a few ulps. 1e-8 on the slider is well under a minute.
  for (const s of [-1, -.73, -.2, -.001, .001, .2, .5, .93, 1]) near(yearsToDial(dialToYears(s)), s, 1e-8, `s=${s}`);
  let prev = -Infinity; for (let s = -1; s <= 1; s += .01) { const y = dialToYears(s); assert.ok(y > prev); prev = y; }
  assert.ok(Math.abs(offset(-.5)) < 1e6 && Math.abs(offset(.5)) < 1e6); // half a drag is only tens of thousands of years from the present: the dial is log, not linear
});
test('state at time 0 is solar-system formation, and the present is the living Earth on that line (T-0093)', () => {
  const formation = deepTimeAt(0 - DEEP.solarSystemAgeYr);
  assert.equal(formation.stage, 'no-planet'); assert.equal(formation.embody, 'none');
  assert.ok(Number.isNaN(formation.equilibriumK));
  assert.ok(formation.offsetYr < -DEEP.earthAgeYr);
  near(dialToYears(yearsToDial(0)), 0, 1, 'time 0 round trip');

  const presentLine = dialToYears(0);
  const present = deepTimeAt(presentLine - DEEP.solarSystemAgeYr);
  assert.equal(present.offsetYr, 0); assert.equal(present.stage, 'living-earth'); assert.equal(present.label, 'now');
  near(present.equilibriumK, 254.0, .5, 'Te now'); near(present.luminosity, 1, 1e-12, 'L now');

  const earthForms = DEEP.solarSystemAgeYr - DEEP.earthAgeYr;
  assert.equal(presentLine - earthForms, DEEP.earthAgeYr);
  const earth = deepTimeAt(earthForms - DEEP.solarSystemAgeYr);
  assert.equal(earth.offsetYr, -DEEP.earthAgeYr); assert.equal(earth.stage, 'hadean');
});
test('the formation age and Earth age are the cited figures, and there is still one epoch', () => {
  const causes = JSON.parse(readFileSync(new URL('../src/data/deepTimeCauses.json', import.meta.url), 'utf8')) as {
    events: { id: string; onsetYearsAgo: { mean: number; source: string } }[];
    conditioning: { observables: { age: { value: number; source: string } } };
  };
  const nebula = causes.events.find(e => e.id === 'nebula_sun')!;
  assert.equal(DEEP.solarSystemAgeYr, nebula.onsetYearsAgo.mean);
  assert.equal(nebula.onsetYearsAgo.source, 'Connelly 2012 Science 338:651');
  assert.equal(DEEP.earthAgeYr, causes.conditioning.observables.age.value);
  assert.equal(causes.conditioning.observables.age.source, 'Dalrymple 2001');
  assert.notEqual(DEEP.solarSystemAgeYr, 4.5e9); assert.notEqual(DEEP.earthAgeYr, 4.5e9);
  assert.ok(DEEP.solarSystemAgeYr > DEEP.earthAgeYr);

  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const deep = strip(readFileSync(new URL('../src/core/deepTime.ts', import.meta.url), 'utf8'));
  assert.equal(deep.split('solarSystemAgeYr').length - 1, 3);
  const clock = readFileSync(new URL('../src/core/worldClock.ts', import.meta.url), 'utf8');
  const hud = readFileSync(new URL('../src/ui/timeHud.ts', import.meta.url), 'utf8');
  assert.match(clock, /export const epochOffsetYr = \(sec = worldSec\(\)\) => sec \/ K\.julian_year_s/);
  assert.equal(clock.includes('solarSystemAgeYr'), false);
  assert.equal(hud.includes('dialToYears'), false);
  assert.equal(hud.includes('solarSystemAgeYr'), false);
});
test('formatYears reads like the dial label', () => {
  assert.equal(formatYears(0), 'now'); assert.equal(formatYears(-3.7e9), '3.70 Gyr ago'); assert.equal(formatYears(66e6), '66.0 Myr from now');
  assert.equal(formatYears(-315e3), '315 kyr ago'); assert.equal(formatYears(-12), '12 yr ago'); assert.equal(formatYears(1.27e9), '1.27 Gyr from now');
});
test('milestones: ascending, every one cited, "now" is the dial centre, nearest is by log distance and never crosses past/future', () => {
  for (let i = 1; i < MILESTONES.length; i++) assert.ok(MILESTONES[i].yr > MILESTONES[i - 1].yr);
  for (const m of MILESTONES) assert.ok(m.src.length > 8 && m.label, m.id);
  assert.equal(nearestMilestone(0).id, 'now'); assert.equal(nearestMilestone(-3.6e9).id, 'life'); assert.equal(nearestMilestone(-60e6).id, 'kpg');
  assert.equal(nearestMilestone(-4.5e9).id, 'earth'); assert.equal(nearestMilestone(3e9).id, 'now'); // the future has no milestones: nearest is now
  assert.equal(MILESTONES.find(m => m.id === 'life')!.yr, -DEEP.lifeStartYr);
});
