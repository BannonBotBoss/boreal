// Channel slope per drawn river cell (filled surface, game metres, same formula as rivers.ts riverAt) and the velocity three
// ways: the game's Manning with constant n = .035 (capped 3 m/s), Jarrett 1984's high-gradient n = .39 S^.38 R_ft^-.16 = .32 S^.38 R_m^-.16 (valid
// S .002-.04, R .15-2.1 m) and the share of river length in each slope class (Montgomery & Buffington 1997 reach types).
// npx tsx refs/water/river-audit/slopes.ts > refs/water/river-audit/slopes.json
import { riverGrid, RIVER } from '../../../src/core/stages/rivers';
import { elevationGrid, flowGrid, toWorld, STAGES } from '../../../src/core/stages/elevation';

const seed = STAGES.seed, R = riverGrid(seed), g = elevationGrid(seed), f = flowGrid(seed), n = R.n, s = R.cell;
const rows: { S: number; d: number; vGame: number; vJarrett: number | null; order: number }[] = [];
for (let c = 0; c < n * n; c++) {
  if (!R.drawn[c]) continue; const r = f.dir[c]; if (r < 0) continue;
  const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1, len = Math.hypot(ox, oz) * s;
  const S = Math.max(1e-5, (toWorld(g, f.filled[c]) - toWorld(g, f.filled[r])) / len), d = R.depth[c];
  const vGame = Math.min(3, d ** (2 / 3) * Math.sqrt(S) / RIVER.manningN);
  // Jarrett 1984 takes R in feet (R ~ depth for these wide shallow channels)
  const nJ = .39 * S ** .38 * (d * 3.281) ** -.16, vJarrett = S >= .002 ? d ** (2 / 3) * Math.sqrt(S) / nJ : null;
  rows.push({ S, d, vGame, vJarrett, order: R.order[c] });
}
const cls = [['flat fill (S <= 1e-4)', 0, 1e-4], ['pool-riffle / plane-bed (1e-4 - .02)', 1e-4, .02], ['step-pool (.02 - .08)', .02, .08], ['cascade (> .08)', .08, 9]] as const;
const share = cls.map(([name, a, b]) => { const k = rows.filter(x => x.S > a && x.S <= b); return { name, share: +(k.length / rows.length).toFixed(3),
  vGameMed: k.length ? +k.map(x => x.vGame).sort((p, q) => p - q)[k.length >> 1].toFixed(2) : null,
  vJarrettMed: k.filter(x => x.vJarrett !== null).length ? +k.filter(x => x.vJarrett !== null).map(x => x.vJarrett!).sort((p, q) => p - q)[k.filter(x => x.vJarrett !== null).length >> 1].toFixed(2) : null,
  sMed: k.length ? +k.map(x => x.S).sort((p, q) => p - q)[k.length >> 1].toFixed(4) : null }; });
const capped = rows.filter(x => x.vGame >= 3);
console.log(JSON.stringify({ cells: rows.length, classes: share, capped: { share: +(capped.length / rows.length).toFixed(3), sMin: +Math.min(...capped.map(x => x.S)).toFixed(4),
  jarrettAtCapped: capped.filter(x => x.vJarrett).map(x => x.vJarrett!).sort((p, q) => p - q).filter((_, i, a) => i === 0 || i === a.length >> 1 || i === a.length - 1).map(v => +v.toFixed(2)) } }, null, 1));
