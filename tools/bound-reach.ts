/**
 * T-0009 reach budget (grok-gait): what the host's gait data asks each limb pair to sweep in stance (duty × stride) against
 * what the sourced mechanisms can give: the limb chord inside the body's joint ranges at the running posture (bounding.ts
 * reachOf: foot roll heel-to-toe is inside it, hindFoot picks the foot angle per position) plus the girdle — the lumbar spine
 * / pelvis for the hind (±GIRDLE.spineMax, pika leading stance 109° → 151° = 42°: Schilling & Hackert 2006) and the scapula for the fore
 * (±GIRDLE.scapulaMax, pika 46° → 80°: Fischer et al. 2002), each on its lever (hip height). Prints a table; --json for data.
 * Run 3: a fore limb with its blade in the chain (BodyPlan.scapula) has the blade inside its chord (no extra girdle term).
 * `npx tsx tools/bound-reach.ts [--plan=<name>[:level] ...]` (names: tools/bound-plans.ts)
 */
import { HOST_GAIT, planFor, poseFor } from './bound-plans';
import { reachOf, boundPlan, selectRow, GIRDLE } from '../src/animals/locomotion/bounding';
export const SPEEDS = [1.68, 3, 5, 8.5, 11.6];
export function reachBudget(planName: string) {
  const sk = planFor(planName), r = reachOf(sk, GIRDLE, poseFor(planName), HOST_GAIT), lever = r.body.hind.hindLever;
  const hindCap = r.hind.chord + 2 * r.girdle.spineMax * lever, foreCap = r.fore.chord + (r.foreBlade ? 0 : 2 * r.girdle.scapulaMax * r.body.fore.foreLever); // a blade in the chain is inside the chord
  return { plan: planName, level: poseFor(planName).level, rise: r.rise, foreChord: r.fore.chord, hindChord: r.hind.chord, hindCap, foreCap,
    rows: SPEEDS.map(v => { const p = boundPlan(HOST_GAIT, v, r, selectRow(v));
      const hindNeed = p.dutyData * p.stride, foreNeed = p.foreDutyData * p.stride;
      return { speed: v, stride: p.stride, hindDutyData: p.dutyData, hindDuty: p.duty, hindNeed, hindCap, hindShort: hindNeed - hindCap, foreDutyData: p.foreDutyData, foreDuty: p.foreDuty, foreNeed, foreCap, foreShort: foreNeed - foreCap,
        /** hind duty if the sweep were 1.2 x the hind leg + foot (dog at 9.2 m/s: Walter & Carrier 2007) [comparison only] */ hindDutyAtDogRatio: 1.2 * (sk.plan.hindLeg + sk.plan.hindFoot) / p.stride }; }) };
}
if (process.argv[1]?.endsWith('bound-reach.ts')) {
  const pick = process.argv.filter(a => a.startsWith('--plan=')).map(a => a.slice(7)), plans = (pick.length ? pick : ['game', 'game:level', 'blade', 'blade:level', 'host', 'split', 'v3', 'v3:level']).map(reachBudget);
  if (process.argv.includes('--json')) console.log(JSON.stringify(plans, null, 1));
  else for (const b of plans) {
    console.log(`plan ${b.plan} (trunk level ${b.level}): running hip rise ${(b.rise * 100).toFixed(1)} cm; chords fore ${b.foreChord.toFixed(3)} hind ${b.hindChord.toFixed(3)} m; capacity (chord + girdle) fore ${b.foreCap.toFixed(3)} hind ${b.hindCap.toFixed(3)} m`);
    for (const r of b.rows) console.log(`  ${r.speed} m/s stride ${r.stride.toFixed(3)}  hind duty ${r.hindDutyData.toFixed(3)}→${r.hindDuty.toFixed(3)} need ${r.hindNeed.toFixed(3)} short ${r.hindShort.toFixed(3)} m (${(100 * b.hindCap / r.hindNeed).toFixed(0)}%)  fore duty ${r.foreDutyData.toFixed(3)}→${r.foreDuty.toFixed(3)} need ${r.foreNeed.toFixed(3)} short ${r.foreShort.toFixed(3)} m (${(100 * b.foreCap / r.foreNeed).toFixed(0)}%)  dog-ratio hind duty ${r.hindDutyAtDogRatio.toFixed(3)}`);
  }
}
