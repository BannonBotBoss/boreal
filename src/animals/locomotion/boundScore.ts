/**
 * Bound gate metric (grok-gait, T-0009; board RULES 11: a score counts only with a named metric, tool and calibration).
 * Metric "bound-checks" v2 (grok, T-0009 run 5): run a body for `seconds` at each test speed, then per speed grade what a
 * reader of a side-on recording of a bounding hare checks. Each check is GRADED 0..1 (v1 was pass/fail, so it could not tell
 * good from better); a speed's score = mean grade x 100. `pass` = grade >= .95 (for reports only).
 *  1 overtake   per hind touchdown, how far it lands ahead (world, along travel) of the fore touchdown before it, as a share
 *               of REF.overtake = one hind print (.12 m: snowshoe hind print 12 x 8 cm, NatureNorth tracking guide): in hare
 *               track groups the large hind prints lie wholly ahead of the fore prints (NPS "Patterns in the Snow"; USFWS
 *               "Snow tracks"; Lagomorpha Locomotion 2021). Grade = mean of clamp(d / .12, 0, 1).
 *  2 phases     share of strides that show each suspension the row's data implies (gaitData suspensions; Bramble 1989)
 *  3 flex       share of strides: at >= 3 m/s peak flexion within +-.08 stride of the first hind touchdown and peak
 *               extension within +-.08 of the last hind lift-off (Schilling & Hackert 2006); below, |flex| < .05 rad (Bertram
 *               & Gutmann 2009)
 *  4 planted    1 - max planted slip / REF.slip (1 cm, T-0009 ask (c); the reference frames show no sliding foot), minus
 *               .25 per leash step after the warm-up
 *  5 cadence    1 within 5 % of the row's stride frequency (Heglund & Taylor 1988), falling linearly to 0 at 20 %
 *  6 order      share of strides with the row's footfall order
 *  7 contact    per pair, measured duty against Hildebrand 1977's floors (J Mammal 58:131, p.135-136): hind contact
 *               "approaches 20 percent of the cycle for various fast runners ... rabbit. It is less than 18 percent only for
 *               individual strides of exceptional cursors"; fore "approaches 16 percent ... rarely less than 13 percent for
 *               consecutive strides"; neither above 70 % in steady progression. Grade per pair = min(1, duty / floor,
 *               .70 / duty) with floors hind .18, fore .13; mean of the pairs. (v1 compared with 80 % of the mean data duty,
 *               .180 at 11.6 m/s: an unsourced target, dropped.)
 *  8 pitch      at >= 5 m/s, when the trace carries trunk pitch: the trunk pitch span (max - min over the steady run) against
 *               the reference bound (refs/hare/graze-alert-flight attempt4 frames v19-v25, back line hip to withers read at
 *               about +3 .. +25 deg nose-up, span REF.pitchSpan 22 deg, reading +-5 deg). Grade 1 within +-5 deg, falling
 *               linearly to 0 at +-27 deg. Only the span is compared: the reference is the first bounds out of a stand
 *               (accelerating, nose up), the score runs are steady.
 * Tool: scoreTrace() over a trace of frames (the controller's BoundFrame subset below); tools/bound-score.ts runs it.
 * Calibration (tests/bound.test.ts, recorded in tasks/handoffs/T-0009-grok.md run 5): known match = a trace synthesised from
 * the BoundGait itself (planted feet, spine timing, hind prints .45 m ahead, 22 deg pitch span) scores 100; known mismatches
 * (trot timing, sliding feet + flat back) score low; graded pairs rank: prints .04 m ahead < .12 m, slip 5 mm < .5 mm,
 * a flat trunk < the reference span.
 */
/** Reference values of the graded checks (sources above). */
export const REF = { overtake: .12, slip: .01, cadenceTol: .05, cadenceZero: .20, floorHind: .18, floorFore: .13, dutyMax: .70, pitchSpan: 22 * Math.PI / 180, pitchTol: 5 * Math.PI / 180, pitchFrom: 5 };
export interface TraceFrame {
  t: number; stride: number; speed: number; contact: boolean[]; slip: number[]; spineFlex: number; leashes: number;
  touchdowns: { leg: number; at: { x: number; y: number; z: number } }[]; fwd: { x: number; z: number }; /** trunk pitch (rad, + nose up), optional */ pitch?: number;
}
export interface CheckResult { name: string; pass: boolean; value: string; /** 0..1 */ grade: number }
export interface SpeedScore { speed: number; row: string; checks: CheckResult[]; score: number }
const LEGS = ['LF', 'LH', 'RF', 'RH'];
const frac = (x: number) => x - Math.floor(x);
const circ = (a: number, b: number) => { const d = frac(a - b); return Math.min(d, 1 - d); };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const check = (name: string, grade: number, value: string): CheckResult => ({ name, grade: clamp01(grade), pass: clamp01(grade) >= .95, value: `${value} [${(100 * clamp01(grade)).toFixed(0)} %]` });

/** Score one steady run. `hz` and `dutyData` are the row's data values; `order` the expected footfall order (leg indices). */
export function scoreTrace(tr: TraceFrame[], o: { speed: number; row: string; hz: number; dutyData: number; order: number[]; warm: number; expect: ('gathered' | 'extended')[] }): SpeedScore {
  const run = tr.filter(f => f.t >= o.warm), checks: CheckResult[] = [];
  const along = (p: { x: number; z: number }, f: TraceFrame) => p.x * f.fwd.x + p.z * f.fwd.z;
  // 1 overtake
  let lastFore: number | null = null, hinds = 0, ahead = 0, worst = Infinity, sum = 0, gsum = 0;
  for (const f of run) for (const td of f.touchdowns) {
    const a = along(td.at, f);
    if (td.leg % 2 === 0) lastFore = a; else if (lastFore !== null) { hinds++; const d = a - lastFore; worst = Math.min(worst, d); sum += d; gsum += clamp01(d / REF.overtake); if (d > 0) ahead++; }
  }
  checks.push(check('overtake', hinds ? gsum / hinds : 0, `${ahead}/${hinds} hind prints ahead, mean ${(100 * sum / Math.max(1, hinds)).toFixed(1)} cm (worst ${(worst * 100).toFixed(1)}) vs one print ${REF.overtake * 100} cm`));
  // stride segmentation on the stride phase wrapping
  const strides: TraceFrame[][] = []; let cur: TraceFrame[] = [];
  for (let k = 0; k < run.length; k++) { if (k && run[k].stride < run[k - 1].stride - .5) { if (cur.length) strides.push(cur); cur = []; } cur.push(run[k]); }
  const full = strides.slice(1); // the first may be partial
  // 2 phases
  let both = 0;
  for (const s of full) {
    let gathered = false, extended = false, lastLift = -1;
    for (let k = 1; k < s.length; k++) {
      for (let i = 0; i < 4; i++) if (s[k - 1].contact[i] && !s[k].contact[i]) lastLift = i;
      if (s[k].contact.every(c => !c)) { if (lastLift % 2 === 0) gathered = true; else if (lastLift >= 0) extended = true; }
    }
    if ((!o.expect.includes('gathered') || gathered) && (!o.expect.includes('extended') || extended)) both++;
  }
  checks.push(check('phases', full.length ? both / full.length : 0, `${both}/${full.length} strides show ${o.expect.join(' + ') || 'no suspension (data)'}`));
  // 3 flex timing
  let okFlex = 0; const stiff = o.speed < 3;
  for (const s of full) {
    if (stiff) { if (Math.max(...s.map(f => Math.abs(f.spineFlex))) < .05) okFlex++; continue; }
    let maxF = -Infinity, minF = Infinity, hindTd: number | null = null, hindLift: number | null = null;
    for (let k = 1; k < s.length; k++) {
      const f = s[k]; maxF = Math.max(maxF, f.spineFlex); minF = Math.min(minF, f.spineFlex);
      for (const i of [1, 3]) { if (!s[k - 1].contact[i] && f.contact[i] && hindTd === null) hindTd = f.stride; if (s[k - 1].contact[i] && !f.contact[i]) hindLift = f.stride; }
    }
    // the peak's time = circular mean phase of the frames within 0.01 rad of the extreme: a back held at its range limit (a
    // clipped plateau through the gathered or extended suspension, Bramble 1989) peaks at the plateau's middle (grok, run 3)
    const peakAt = (pick: (x: number) => boolean) => { let cx = 0, cy = 0; for (const f of s.slice(1)) if (pick(f.spineFlex)) { cx += Math.cos(2 * Math.PI * f.stride); cy += Math.sin(2 * Math.PI * f.stride); } return frac(Math.atan2(cy, cx) / (2 * Math.PI)); };
    const atMax = peakAt(x => x >= maxF - .01), atMin = peakAt(x => x <= minF + .01);
    if (hindTd !== null && hindLift !== null && maxF - minF > .02 && circ(atMax, hindTd) <= .08 && circ(atMin, hindLift) <= .08) okFlex++;
  }
  checks.push(check('flex', full.length ? okFlex / full.length : 0, `${okFlex}/${full.length} strides: ${stiff ? 'stiff back' : 'flexion peak at hind touchdown, extension at hind lift-off'}`));
  // 4 planted
  const slip = Math.max(0, ...run.map(f => Math.max(...f.slip))), leash = run.length ? run[run.length - 1].leashes - run[0].leashes : 0;
  checks.push(check('planted', 1 - slip / REF.slip - .25 * leash, `max slip ${(slip * 1000).toFixed(1)} mm, ${leash} leash steps`));
  // 5 cadence (LF touchdowns)
  const lf = run.filter(f => f.touchdowns.some(t => t.leg === 0)).map(f => f.t), hz = lf.length > 2 ? (lf.length - 1) / (lf[lf.length - 1] - lf[0]) : 0;
  const cErr = Math.abs(hz / o.hz - 1);
  checks.push(check('cadence', cErr <= REF.cadenceTol ? 1 : 1 - (cErr - REF.cadenceTol) / (REF.cadenceZero - REF.cadenceTol), `${hz.toFixed(2)} Hz vs ${o.hz.toFixed(2)} Hz`));
  // 6 order: touchdown sequence within strides (start at LF)
  const seq: number[] = []; for (const f of run) for (const td of f.touchdowns) seq.push(td.leg);
  const start = seq.indexOf(0); let good = 0, n = 0;
  for (let k = start; k >= 0 && k + 4 <= seq.length; k += 4) { n++; if (seq.slice(k, k + 4).join() === o.order.join()) good++; }
  checks.push(check('order', n ? good / n : 0, `${good}/${n} strides ${o.order.map(i => LEGS[i]).join('-')}`));
  // 7 contact
  let fore = 0, hind = 0; for (const f of run) { fore += (+f.contact[0] + +f.contact[2]) / 2; hind += (+f.contact[1] + +f.contact[3]) / 2; }
  fore /= Math.max(1, run.length); hind /= Math.max(1, run.length);
  const pair = (d: number, floor: number) => d > 0 ? Math.min(1, d / floor, REF.dutyMax / d) : 0;
  checks.push(check('contact', (pair(hind, REF.floorHind) + pair(fore, REF.floorFore)) / 2, `duty hind ${hind.toFixed(3)} fore ${fore.toFixed(3)} vs floors ${REF.floorHind}/${REF.floorFore} (Hildebrand 1977)`));
  // 8 pitch span vs the reference bound
  const ps = run.map(f => f.pitch).filter((p): p is number => p !== undefined);
  if (o.speed >= REF.pitchFrom && ps.length) { const span = Math.max(...ps) - Math.min(...ps), err = Math.abs(span - REF.pitchSpan), D = 180 / Math.PI;
    checks.push(check('pitch', err <= REF.pitchTol ? 1 : 1 - (err - REF.pitchTol) / REF.pitchSpan, `trunk pitch ${(Math.min(...ps) * D).toFixed(1)}..${(Math.max(...ps) * D).toFixed(1)} deg, span ${(span * D).toFixed(1)} vs reference ${(REF.pitchSpan * D).toFixed(0)} deg`)); }
  return { speed: o.speed, row: o.row, checks, score: 100 * checks.reduce((a, c) => a + c.grade, 0) / checks.length };
}
