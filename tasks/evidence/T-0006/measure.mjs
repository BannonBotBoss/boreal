/**
 * T-0006 position gate. Tool: `npx tsx tasks/evidence/T-0006/measure.mjs`.
 * Score: contactPositionScore(|at.y - heightAt(at.x, at.z)|) from tools/contact-gate.ts.
 * Calibration (also locked in tests/contact.test.ts): error 0 m -> 1, error 0.0025 m -> 0.95, error 1 m -> 0.
 * A mean of 0.95 needs the contacts within 2.5 mm of the ground. Pass line is 0.95.
 */
import { writeFileSync } from 'node:fs';
import { generateChunk, heightAt } from '../../../src/core/world.ts';
import { logContact } from '../../../src/core/logContact.ts';
import { logSeat } from '../../../src/render/geometry.ts';
import { contactPositionScore, contactTimingScore } from '../../../tools/contact-gate.ts';
import { createContactBus } from '../../../src/core/contactBus.ts';
import { density, COMPOSITIONS } from '../../../src/core/materials.ts';
import { whyOf, nowText } from '../../../src/core/why.ts';
import { catalog } from '../../../src/core/catalog.ts';

const rows = [];
for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) for (const e of generateChunk(cx, cz)) {
  if (e.kind !== 'log') continue;
  const y = heightAt(e.x, e.z), c = logContact(e, y, logSeat);
  const err = c.at[1] - heightAt(c.at[0], c.at[2]);
  rows.push({ key: e.key, source: c.source, err, score: contactPositionScore(err), sink: c.sinkFraction, earth: c.earthDensity, trunk: c.trunkDensity, normalY: c.normal[1] });
}
const mean = rows.reduce((s, r) => s + r.score, 0) / rows.length;
const bus = createContactBus();
const sample = rows[0];
const log = generateChunk(-2, -2).find(e => e.kind === 'log');
const c0 = logContact(log, heightAt(log.x, log.z), logSeat);
bus.begin(c0);
let extra = 0; for (let i = 0; i < 360; i++) if (bus.begin(c0)) extra++;
const timing = contactTimingScore(extra, 360);
const out = {
  tool: 'npx tsx tasks/evidence/T-0006/measure.mjs',
  metric: 'mean contactPositionScore over every log in chunks [-2,2] x [-2,2]; contactTimingScore of 360 repeat begins',
  calibration: { match: contactPositionScore(0), at2_5mm: contactPositionScore(0.0025), mismatch1m: contactPositionScore(1), timingMatch: contactTimingScore(0, 360), timingMismatch: contactTimingScore(360, 360) },
  logs: rows.length,
  meanPosition: mean,
  maxAbsErrM: Math.max(...rows.map(r => Math.abs(r.err))),
  sources: [...new Set(rows.map(r => r.source))],
  sink: { min: Math.min(...rows.map(r => r.sink)), max: Math.max(...rows.map(r => r.sink)) },
  earth: { min: Math.min(...rows.map(r => r.earth)), max: Math.max(...rows.map(r => r.earth)) },
  trunk: density(COMPOSITIONS.log.body),
  timing,
  why: `${catalog.log.title} - ${nowText(whyOf({ kind: 'log' }))}`,
  pass: mean >= 0.95 && timing >= 0.95 && rows.every(r => r.source === 'chunk-build:log-seat'),
};
writeFileSync(new URL('./measure.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ logs: out.logs, meanPosition: out.meanPosition, maxAbsErrM: out.maxAbsErrM, timing: out.timing, pass: out.pass, why: out.why }, null, 2));
if (!out.pass) process.exit(1);
