/**
 * T-0002 gait-maths budget bench (grok-gait). `npx tsx tools/bench-gait.ts [runs=5]`
 * Per the plan: after 10 000 warm-up calls, time 100 000 calls of one frame's gait path with performance.now(), at walk,
 * trot and sprint speeds, and report the median of `runs` runs in µs per call. Budget: ≤ 50 µs (0.05 ms) per wolf per frame.
 * - default wolf: AnimalBrain.expend + quadrupedPose (WOLF_LEGS), 1/30 s sim steps as in main.ts
 * - ?loco=1: createLocomotion(...).update at 1/60 s (near LOD), on flat ground
 */
import { performance } from 'node:perf_hooks';
import { AnimalBrain, WOLF_LEGS, quadrupedPose, type Motion } from '../src/core/animalBehavior';
import { createLocomotion, referenceLayout } from '../src/animals/locomotion';

const WARM = 10_000, N = 100_000, RUNS = Number(process.argv[2] ?? 5);
const SPEEDS: Array<[string, Motion, number]> = [['walk', 'walk', 1.27], ['trot', 'run', 2.7], ['sprint', 'run', 10.5]];
let sink = 0;
function defaultWolf(motion: Motion, v: number) {
  const b = new AnimalBrain(1); b.legs = WOLF_LEGS; b.motion = motion; b.speed = v; const dt = 1 / 30;
  return () => { b.expend(dt, v * dt); const p = quadrupedPose(b.motion, b.phase, b.jumpTime, b.legs, b.gaitSpeed); sink += p.feet[0].z; };
}
function loco(v: number) {
  const dt = 1 / 60, layout = referenceLayout(); let z = 0;
  const l = createLocomotion(layout, () => 0, { x: 0, z: 0, heading: 0 });
  return () => { z -= v * dt; if (z < -1e4) z = 0; const p = l.update({ x: 0, z, heading: 0, speed: v }, dt, 'near'); sink += p.froude; };
}
function time(step: () => void) {
  for (let i = 0; i < WARM; i++) step();
  const t0 = performance.now(); for (let i = 0; i < N; i++) step(); return (performance.now() - t0) * 1000 / N;
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log(`bench-gait: ${RUNS} runs × ${N} calls after ${WARM} warm-up; median µs per call (budget 50)`);
for (const [name, motion, v] of SPEEDS) {
  const d = median(Array.from({ length: RUNS }, () => time(defaultWolf(motion, v))));
  const c = median(Array.from({ length: RUNS }, () => time(loco(v))));
  console.log(`  ${name.padEnd(6)} ${v.toFixed(2)} m/s  default wolf ${d.toFixed(3)} µs   ?loco=1 ${c.toFixed(3)} µs`);
}
if (sink === 42) console.log('');