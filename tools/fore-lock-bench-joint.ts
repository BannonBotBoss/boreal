// T-0044 run 12 (grok-gait): tools/fore-lock-bench.ts with FORE_JOINT switches set first. SET="limit=1,plantW=100" npx tsx tools/fore-lock-bench-joint.ts
import { FORE_JOINT } from '../src/animals/locomotion/bounding';
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); (FORE_JOINT as any)[k] = Number(x); }
console.log('FORE_JOINT', JSON.stringify(FORE_JOINT));
await import('./fore-lock-bench');