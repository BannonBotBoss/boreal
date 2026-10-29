// T-0044 run 12 (grok-gait): tools/fore-lock-bench.ts with FORE_JOINT switches set first. SET="limit=1,plantW=100" npx tsx tools/fore-lock-bench-joint.ts
// run 13: soft.k=v sets FORE_SOFT (SET="soft.on=0" = run 12 motion)
import { FORE_JOINT, FORE_SOFT } from '../src/animals/locomotion/bounding';
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) { const [k, x] = kv.split('='); if (k.startsWith('soft.')) (FORE_SOFT as any)[k.slice(5)] = Number(x); else (FORE_JOINT as any)[k] = Number(x); }
console.log('FORE_JOINT', JSON.stringify(FORE_JOINT), 'FORE_SOFT', JSON.stringify(FORE_SOFT));
await import('./fore-lock-bench');