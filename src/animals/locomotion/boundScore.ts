/**
 * Bound gate metric (grok-gait, T-0009; board RULES 11: a score counts only with a named metric, tool and calibration).
 * Metric "bound-checks": run a body for `seconds` at each test speed, then per speed check seven things a reader of a
 * side-on recording of a bounding lagomorph checks (each pass/fail, score = share passed × 100):
 *  1 overtake   every hind touchdown lands ahead (world, along travel) of the fore touchdown before it
 *               (Lagomorpha Locomotion 2021: the hind feet land ahead of the forefeet in the half-bound and gallop)
 *  2 phases     every stride shows each suspension the row's data implies at that speed (gaitData suspensions at the
 *               data duty: gathered after the fore lift-off, extended after the hind; Bramble 1989 four stages)
 *  3 flex       at ≥ 3 m/s: peak spine flexion within ±0.08 stride of the first hind touchdown and peak extension within
 *               ±0.08 of the last hind lift-off (Schilling & Hackert 2006); below: back stiff, |flex| < 0.05 rad (Bertram &
 *               Gutmann 2009: slow half-bounds are stiff-backed)
 *  4 planted    planted slip < 1 cm on every frame and no leash steps after the warm-up (T-0009 ask (c))
 *  5 cadence    measured stride frequency within 5 % of the row's (BoundGait cadence: Heglund & Taylor 1988 allometry)
 *  6 order      footfall order of the row: LF, RF, LH, RH (half-bound) / LF, RF, RH, LH (gallop-lagomorph)
 *  7 contact    measured duty ≥ 80 % of the data duty (contact 16-18 % of the stride at speed in jackrabbits, Lagomorpha
 *               Locomotion 2021; the BoundGait duty line)
 * Tool: scoreTrace() over a trace of frames (the controller's BoundFrame subset below); tools/bound-score.ts runs it.
 * Calibration (tests/bound.test.ts): known match = a trace synthesised from the BoundGait itself (ideal planted feet and
 * spine timing) scores 100; known mismatches = the same with trot offsets, and with sliding feet, score low.
 */
export interface TraceFrame {
  t: number; stride: number; speed: number; contact: boolean[]; slip: number[]; spineFlex: number; leashes: number;
  touchdowns: { leg: number; at: { x: number; y: number; z: number } }[]; fwd: { x: number; z: number };
}
export interface CheckResult { name: string; pass: boolean; value: string }
export interface SpeedScore { speed: number; row: string; checks: CheckResult[]; score: number }
const LEGS = ['LF', 'LH', 'RF', 'RH'];
const frac = (x: number) => x - Math.floor(x);
const circ = (a: number, b: number) => { const d = frac(a - b); return Math.min(d, 1 - d); };

/** Score one steady run. `hz` and `dutyData` are the row's data values; `order` the expected footfall order (leg indices). */
export function scoreTrace(tr: TraceFrame[], o: { speed: number; row: string; hz: number; dutyData: number; order: number[]; warm: number; expect: ('gathered' | 'extended')[] }): SpeedScore {
  const run = tr.filter(f => f.t >= o.warm), checks: CheckResult[] = [];
  const along = (p: { x: number; z: number }, f: TraceFrame) => p.x * f.fwd.x + p.z * f.fwd.z;
  // 1 overtake
  let lastFore: number | null = null, hinds = 0, ahead = 0, worst = Infinity;
  for (const f of run) for (const td of f.touchdowns) {
    const a = along(td.at, f);
    if (td.leg % 2 === 0) lastFore = a; else if (lastFore !== null) { hinds++; const d = a - lastFore; worst = Math.min(worst, d); if (d > 0) ahead++; }
  }
  checks.push({ name: 'overtake', pass: hinds > 0 && ahead === hinds, value: `${ahead}/${hinds} hind prints ahead (worst ${(worst * 100).toFixed(1)} cm)` });
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
  checks.push({ name: 'phases', pass: full.length > 0 && both === full.length, value: `${both}/${full.length} strides show ${o.expect.join(' + ') || 'no suspension (data)'}` });
  // 3 flex timing
  let okFlex = 0; const stiff = o.speed < 3;
  for (const s of full) {
    if (stiff) { if (Math.max(...s.map(f => Math.abs(f.spineFlex))) < .05) okFlex++; continue; }
    let maxF = -Infinity, minF = Infinity, atMax = 0, atMin = 0, hindTd: number | null = null, hindLift: number | null = null;
    for (let k = 1; k < s.length; k++) {
      const f = s[k]; if (f.spineFlex > maxF) { maxF = f.spineFlex; atMax = f.stride; } if (f.spineFlex < minF) { minF = f.spineFlex; atMin = f.stride; }
      for (const i of [1, 3]) { if (!s[k - 1].contact[i] && f.contact[i] && hindTd === null) hindTd = f.stride; if (s[k - 1].contact[i] && !f.contact[i]) hindLift = f.stride; }
    }
    if (hindTd !== null && hindLift !== null && maxF - minF > .02 && circ(atMax, hindTd) <= .08 && circ(atMin, hindLift) <= .08) okFlex++;
  }
  checks.push({ name: 'flex', pass: full.length > 0 && okFlex === full.length, value: `${okFlex}/${full.length} strides: ${stiff ? 'stiff back' : 'flexion peak at hind touchdown, extension at hind lift-off'}` });
  // 4 planted
  const slip = Math.max(0, ...run.map(f => Math.max(...f.slip))), leash = run.length ? run[run.length - 1].leashes - run[0].leashes : 0;
  checks.push({ name: 'planted', pass: slip < .01 && leash === 0, value: `max slip ${(slip * 1000).toFixed(1)} mm, ${leash} leash steps` });
  // 5 cadence (LF touchdowns)
  const lf = run.filter(f => f.touchdowns.some(t => t.leg === 0)).map(f => f.t), hz = lf.length > 2 ? (lf.length - 1) / (lf[lf.length - 1] - lf[0]) : 0;
  checks.push({ name: 'cadence', pass: Math.abs(hz / o.hz - 1) <= .05, value: `${hz.toFixed(2)} Hz vs ${o.hz.toFixed(2)} Hz` });
  // 6 order: touchdown sequence within strides (start at LF)
  const seq: number[] = []; for (const f of run) for (const td of f.touchdowns) seq.push(td.leg);
  const start = seq.indexOf(0); let good = 0, n = 0;
  for (let k = start; k >= 0 && k + 4 <= seq.length; k += 4) { n++; if (seq.slice(k, k + 4).join() === o.order.join()) good++; }
  checks.push({ name: 'order', pass: n > 0 && good === n, value: `${good}/${n} strides ${o.order.map(i => LEGS[i]).join('-')}` });
  // 7 contact
  let down = 0, all = 0; for (const f of run) { down += f.contact.filter(Boolean).length; all += 4; }
  const duty = all ? down / all : 0;
  checks.push({ name: 'contact', pass: duty >= .8 * o.dutyData, value: `duty ${duty.toFixed(3)} vs data ${o.dutyData.toFixed(3)}` });
  return { speed: o.speed, row: o.row, checks, score: 100 * checks.filter(c => c.pass).length / checks.length };
}
