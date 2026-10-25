// Channel slope per drawn river cell (filled surface, game metres, same formula as rivers.ts riverAt) and the velocity
// two ways: the game's channelSpeed (Chow n = 0.035 below S = 0.002, Jarrett 1984 n = 0.39 S^0.38 R_ft^-0.16 at and
// above it, no 3 m/s cap) and Jarrett's own velocity where his fit applies. Slope classes approximate Montgomery &
// Buffington 1997. Jarrett's fit is S 0.002–0.04 and R 0.15–2.1 m; steeper cells are the same equation, outside the fit.
// npx tsx refs/water/river-audit/slopes.ts > refs/water/river-audit/slopes.json
import { riverGrid, RIVER, channelSpeed, roughnessN } from '../../../src/core/stages/rivers';
import { elevationGrid, flowGrid, toWorld, STAGES } from '../../../src/core/stages/elevation';

const seed = STAGES.seed, R = riverGrid(seed), g = elevationGrid(seed), f = flowGrid(seed), n = R.n, s = R.cell;
const rows: { S: number; d: number; vGame: number; vJarrett: number | null; order: number }[] = [];
for (let c = 0; c < n * n; c++) {
  if (!R.drawn[c]) continue; const r = f.dir[c]; if (r < 0) continue;
  const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1, len = Math.hypot(ox, oz) * s;
  const S = Math.max(1e-5, (toWorld(g, f.filled[c]) - toWorld(g, f.filled[r])) / len), d = R.depth[c];
  const vGame = channelSpeed(d, S);
  // Jarrett 1984, same feet form as roughnessN (1 ft = 0.3048 m). Null below the fit, where the game uses Chow.
  const nJ = roughnessN(S, d), vJarrett = S >= RIVER.jarrettMinS ? d ** (2 / 3) * Math.sqrt(S) / nJ : null;
  rows.push({ S, d, vGame, vJarrett, order: R.order[c] });
}
const cls = [['flat fill (S <= 1e-4)', 0, 1e-4], ['pool-riffle / plane-bed (1e-4 - .02)', 1e-4, .02], ['step-pool (.02 - .08)', .02, .08], ['cascade (> .08)', .08, 9]] as const;
const share = cls.map(([name, a, b]) => { const k = rows.filter(x => x.S > a && x.S <= b); return { name, share: +(k.length / rows.length).toFixed(3),
  vGameMed: k.length ? +k.map(x => x.vGame).sort((p, q) => p - q)[k.length >> 1].toFixed(2) : null,
  vJarrettMed: k.filter(x => x.vJarrett !== null).length ? +k.filter(x => x.vJarrett !== null).map(x => x.vJarrett!).sort((p, q) => p - q)[k.filter(x => x.vJarrett !== null).length >> 1].toFixed(2) : null,
  sMed: k.length ? +k.map(x => x.S).sort((p, q) => p - q)[k.length >> 1].toFixed(4) : null }; });
const capped = rows.filter(x => x.vGame >= 3);
const sMin = capped.length ? +Math.min(...capped.map(x => x.S)).toFixed(4) : null;
console.log(JSON.stringify({ cells: rows.length, classes: share, capped: { share: +(capped.length / rows.length).toFixed(3), sMin,
  jarrettAtCapped: capped.filter(x => x.vJarrett).map(x => x.vJarrett!).sort((p, q) => p - q).filter((_, i, a) => i === 0 || i === a.length >> 1 || i === a.length - 1).map(v => +v.toFixed(2)) } }, null, 1));
