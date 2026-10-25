// Planform of the drawn network. The D8 polyline still turns 0/45/90 deg at a point (zero radius). The centreline
// the mesh follows is the fillet-and-lobe curve: planformReport counts samples whose osculating radius is under
// 2 channel widths. npx tsx refs/water/river-audit/kinks.ts > refs/water/river-audit/kinks.json
import { riverGrid, riverPlan } from '../../../src/core/stages/rivers';
import { flowGrid, STAGES } from '../../../src/core/stages/elevation';
import { planformReport } from '../../../src/core/stages/riverPlanform';
const seed = STAGES.seed, R = riverGrid(seed), f = flowGrid(seed), n = R.n;
const off = (c: number, r: number) => [((r % n) - (c % n) + n + 1) % n - 1, (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1];
const turns: Record<number, number> = { 0: 0, 45: 0, 90: 0, 135: 0 }; let nodes = 0;
for (let c = 0; c < n * n; c++) { if (!R.drawn[c]) continue; const r = f.dir[c]; if (r < 0 || !R.drawn[r]) continue; const r2 = f.dir[r]; if (r2 < 0 || !R.drawn[r2]) continue;
  const [ax, az] = off(c, r), [bx, bz] = off(r, r2), a = Math.round(Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / Math.hypot(ax, az) / Math.hypot(bx, bz)))) * 180 / Math.PI / 45) * 45;
  turns[a]++; nodes++; }
const plan = riverPlan(seed);
const curved = plan ? planformReport(R, f.dir, plan) : null;
console.log(JSON.stringify({
  nodes, turnShare: Object.fromEntries(Object.entries(turns).map(([k, v]) => [k, nodes ? +(v / nodes).toFixed(3) : 0])),
  segmentM: { straight: R.cell, diagonal: +(R.cell * Math.SQRT2).toFixed(1) },
  curved,
}));
