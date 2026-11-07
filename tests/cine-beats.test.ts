import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CINE, KEYFRAMES, LATER_AUDIO, NARRATION, PANEL_COPY, YEAR_S, bangAt, bangFlash, bedDb, cineStage, cosmicSeconds, cue2Db, cycleToSeconds, dbToGain, eraOfSeconds, flashLuma, formatClock, formatCosmicSeconds, haloFade, heroAt, kickOffset, narrationEndFallback, offsetYr, panelFigure, pinHeld, plasmaClear, plasmaGain, plasmaHeat, secondsToCycle, shellOnScreen, shellRadius, starsLit, subtitleAt, sunKeyframeCheck, voDuckDb } from '../src/world/cosmos/cineBeats';
import { MILESTONES, deepTimeAt } from '../src/core/deepTime';

test('cosmic clock matches the sheet keyframes and does not jump', () => {
  assert.equal(cosmicSeconds(0), 1e-43);
  assert.equal(cosmicSeconds(18.67), 1e-43);
  assert.equal(cosmicSeconds(26), 1e-32);
  assert.equal(cosmicSeconds(36), 1e-6);
  assert.equal(cosmicSeconds(44), 1200);
  assert.equal(cosmicSeconds(54), 1.2e13);
  assert.equal(cosmicSeconds(82), 9.2e9 * YEAR_S);
  assert.equal(cosmicSeconds(112), 13.8e9 * YEAR_S);
  let prev = 0;
  for (let t = 18.67; t <= 112; t += 0.25) {
    const s = cosmicSeconds(t);
    assert.ok(s >= prev, `time went backwards at ${t}`);
    prev = s;
  }
  const mid = cosmicSeconds(22);
  assert.ok(mid > 1e-43 && mid < 1e-32, `log walk at the panel: ${mid}`);
  const lin = (cosmicSeconds(97) - cosmicSeconds(92)) / (97 - 92);
  const lin2 = (cosmicSeconds(102) - cosmicSeconds(97)) / (102 - 97);
  assert.ok(Math.abs(lin - lin2) / lin < 1e-9, 'years are linear after the Sun');
});

test('the Sun keyframe is exact, and today is still deepTimeAt(0)', () => {
  const sun = sunKeyframeCheck();
  assert.equal(sun.age, 9.2e9);
  assert.equal(sun.fromNow, -4.6e9);
  assert.equal(deepTimeAt(0).label, 'now');
  assert.equal(sun.now.label, 'now');
  assert.equal(offsetYr(13.8e9 * YEAR_S), 0);
  assert.ok(sun.sunGapYr > 1e6 && sun.sunGapYr < 1e8, `known gap vs the CAI age, not an arithmetic slip: ${sun.sunGapYr}`);
  assert.ok(!MILESTONES.some(m => /ocean|plant/i.test(m.label)));
  assert.equal(PANEL_COPY.oceansGya, 4.4);
  assert.equal(PANEL_COPY.plantsMya, 470);
});

test('cycle map matches cosmic_time.rs, and the first keyframe is Planck', () => {
  assert.equal(cycleToSeconds(0), 0);
  assert.equal(cycleToSeconds(1), 5.39e-44);
  assert.ok(Math.abs(secondsToCycle(cycleToSeconds(44.2)) - 44.2) < 1e-9);
  assert.equal(eraOfSeconds(1e-43), 'Planck');
  assert.equal(eraOfSeconds(1e-34), 'inflation');
  assert.equal(eraOfSeconds(13.8e9 * YEAR_S), 'today');
});

test('B2 and B3 key off narration ended, and the flash is the impact peak', () => {
  const end = narrationEndFallback();
  assert.equal(end, CINE.b1 + NARRATION.seconds);
  assert.equal(bangAt(end), end + CINE.b2);
  const peak = bangAt(end) + CINE.bangPeak;
  assert.equal(bangFlash(peak, end, false), 1);
  assert.ok(Math.abs(bangFlash(peak, end, true) - 0.4 / 0.7) < 1e-9);
  assert.equal(bangFlash(peak - 1, end, false), 0);
  let sum = 0, n = 0;
  for (let y = -1; y <= 1; y += 0.1) for (let x = -1; x <= 1; x += 0.1) { sum += flashLuma(x, y, 1); n++; }
  assert.ok(Math.abs(sum / n - 0.7) < 0.06, `frame average ${sum / n}`);
  assert.ok(flashLuma(0, 0, 1) > 0.98);
  assert.ok(flashLuma(1, 1, 1) < flashLuma(0, 0, 1));
  assert.equal(shellRadius(0), 0);
  assert.ok(shellRadius(0.6) > 1.4);
  assert.equal(shellOnScreen(0.3), true);
  assert.equal(shellOnScreen(0.9), false);
  assert.equal(haloFade(84.9, 85, 89.8, 0.3, 1), 0);
  assert.equal(haloFade(89.8, 85, 89.8, 0.3, 1), 0);
  assert.ok(haloFade(85.15, 85, 89.8, 0.3, 1) > 0.4 && haloFade(85.15, 85, 89.8, 0.3, 1) < 0.6);
  assert.equal(haloFade(86, 85, 89.8, 0.3, 1), 1);
  assert.equal(haloFade(88.6, 85, 89.8, 0.3, 1), 1);
  assert.ok(haloFade(89.3, 85, 89.8, 0.3, 1) > 0.4 && haloFade(89.3, 85, 89.8, 0.3, 1) < 0.6);
  assert.equal(haloFade(91.9, 92, 102, 0.3, 1), 0);
  assert.equal(haloFade(94, 92, 102, 0.3, 1), 1);
  assert.ok(haloFade(101.5, 92, 102, 0.3, 1) > 0.4 && haloFade(101.5, 92, 102, 0.3, 1) < 0.6);
  assert.equal(haloFade(102, 92, 102, 0.3, 1), 0);
  assert.equal(bangFlash(bangAt(end) + CINE.bangPeak, end, false), 1);
  assert.equal(panelFigure(28), 'Temperature 10²⁷ K');
  assert.equal(panelFigure(33), 'Energy ≈ 100 GeV per particle');
  assert.equal(panelFigure(40), 'Hydrogen 75% · Helium 25%');
  assert.equal(panelFigure(50), 'Light still trapped');
  assert.equal(panelFigure(54), 'Temperature ≈ 3000 K');
  assert.equal(panelFigure(63), '');
  assert.equal(panelFigure(67), 'First stars');
  assert.equal(panelFigure(72), 'Galaxies');
  assert.equal(panelFigure(81), 'The Sun');
  assert.equal(panelFigure(96), '4.4 Gya oceans');
  assert.equal(panelFigure(102), '2.4 Gya');
  assert.equal(panelFigure(106), '470 Mya plants');
  assert.equal(panelFigure(112), '');
  assert.equal(formatClock(85), '4.54 billion years ago');
  assert.equal(formatClock(106), '470 million years ago');
  assert.equal(formatClock(112), 'Today');
  const late = [103, 104, 105, 106, 107, 108].map(t => formatClock(t));
  assert.ok(new Set(late).size >= 5, `clock must keep moving: ${late.join(' | ')}`);
  assert.match(formatClock(30), /s$/);
  const h20 = plasmaHeat(20), h26 = plasmaHeat(26), h30 = plasmaHeat(30);
  assert.ok(h20 > 0 && h20 < h26 && h26 < h30 && h30 < plasmaHeat(36));
  assert.ok(plasmaHeat(26.2) - plasmaHeat(25.8) < 0.05);
  assert.ok(Math.abs(plasmaHeat(36) - 1) < 1e-9);
  assert.ok(Math.abs(plasmaHeat(44) - 2) < 1e-9);
  assert.ok(Math.abs(plasmaHeat(54) - 3) < 1e-9);
  assert.equal(plasmaClear(54), 0);
  assert.ok(Math.abs(plasmaClear(55) - 0.5) < 1e-9);
  assert.equal(plasmaClear(56), 1);
  assert.equal(starsLit(65.9), 0);
  assert.equal(starsLit(66.5), 1);
  assert.equal(starsLit(70), 8);
  assert.equal(cineStage(55, true, end), 'b7');
  assert.equal(cineStage(63, true, end), 'b8');
  assert.equal(cineStage(68, true, end), 'b9');
  assert.equal(cineStage(78, true, end), 'b10');
  assert.equal(cineStage(82, true, end), 'b10');
  assert.equal(cineStage(88, true, end), 'b11');
  assert.equal(cineStage(96, true, end), 'b12');
  assert.equal(cineStage(104, true, end), 'b13');
  assert.equal(cineStage(112, true, end), 'b14');
  assert.equal(cineStage(116, true, end), 'hold');
  assert.ok(plasmaGain(30) > plasmaGain(40) && plasmaGain(40) > plasmaGain(50));
  assert.ok(kickOffset(0.1, false).y > 10);
  assert.equal(kickOffset(-0.1, false).y, 0);
  assert.equal(kickOffset(0.1, true).y, 0);
  assert.equal(pinHeld(peak, bangAt(end)), false);
  assert.equal(cineStage(30, true, end), 'b4');
  assert.equal(cineStage(40, true, end), 'b5');
  assert.equal(cineStage(48, true, end), 'b6');
  assert.equal(cineStage(1, false, null), 'fade');
  assert.equal(cineStage(2, false, null), 'wait');
  assert.equal(cineStage(10, true, null), 'b1');
  assert.equal(cineStage(end + 0.2, true, end), 'b2');
  assert.equal(cineStage(end + 1, true, end), 'b3');
  assert.equal(subtitleAt(4, null).startsWith('In the beginning'), true);
  assert.equal(heroAt(22), '');
  assert.equal(heroAt(23), 'THE BIG BANG');
  assert.equal(heroAt(54), '380,000 years');
  assert.match(formatCosmicSeconds(1e-43), /10⁻⁴³ s/);
});

test('bed hands to cue 2 at 0:42; voice ducks are later, and there is no loop', () => {
  assert.equal(bedDb(1, null), -80);
  assert.equal(bedDb(10, null), -6);
  const end = narrationEndFallback();
  assert.ok(bedDb(end + 0.2, end) < -6 && bedDb(end + 0.2, end) > -18);
  assert.ok(Math.abs(bedDb(22, end)) < 1e-6);
  assert.ok(Math.abs(bedDb(41, end)) < 1e-6);
  assert.ok(Math.abs(bedDb(43, end)) < 1e-6);
  assert.ok(Math.abs(bedDb(45, end)) < 1e-6);
  assert.ok(bedDb(45.5, end) < -2 && bedDb(45.5, end) > -5);
  assert.equal(bedDb(46, end), -80);
  assert.equal(cue2Db(41), -80);
  assert.ok(cue2Db(44) < -2 && cue2Db(44) > -5);
  assert.ok(Math.abs(cue2Db(46)) < 1e-6);
  assert.ok(Math.abs(cue2Db(63)) < 1e-6);
  assert.equal(voDuckDb(54.5), -6);
  assert.equal(voDuckDb(63), 0);
  assert.equal(voDuckDb(10), 0);
  assert.equal(LATER_AUDIO.voB7At, 54);
  assert.ok(dbToGain(-6) < 0.51 && dbToGain(-6) > 0.5);
  assert.equal(LATER_AUDIO.cue2At, 42);
  assert.equal(LATER_AUDIO.cue2Fade, 4);
  assert.doesNotMatch(readFileSync('src/audio/bigBang.ts', 'utf8'), /from: 20|loop bed/);
  for (const f of [NARRATION.file, LATER_AUDIO.bed, LATER_AUDIO.bang, LATER_AUDIO.cue2, LATER_AUDIO.voB7, LATER_AUDIO.voB9, LATER_AUDIO.voB14, 'audio/big-bang/vo-b7-light-alt1.mp3']) {
    assert.ok(existsSync('public/' + f), f);
  }
});

test('the film keeps the loading path and does not skip to the planet', () => {
  const opening = readFileSync('src/world/cosmos/opening.ts', 'utf8');
  assert.match(opening, /pointerdown/);
  assert.match(opening, /Click or press any key to begin/);
  assert.match(opening, /first visit does not skip/);
  assert.match(opening, /cine-refs/);
  assert.match(readFileSync('src/main.ts', 'utf8'), /createOpening\(/);
  for (const f of ['PLACEHOLDER_B1.mp4', 'PLACEHOLDER_B3.mp4', 'PLACEHOLDER_B4.jpg', 'PLACEHOLDER_B5.jpg', 'PLACEHOLDER_B6_B7.jpg', 'PLACEHOLDER_B8_B9.jpg', 'PLACEHOLDER_B10.jpg', 'PLACEHOLDER_B11.jpg', 'PLACEHOLDER_B12.jpg', 'PLACEHOLDER_B13.jpg']) {
    assert.ok(existsSync('public/cinematic/refs/' + f), f);
  }
  assert.equal(KEYFRAMES[0].seconds, 1e-43);
});
