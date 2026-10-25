/**
 * River planform (T-0031). The network stays the D8 graph from flow.ts. The centreline does not:
 * a circular fillet replaces each bend, and a low-gradient reach adds a lateral wave.
 *  - Bend radius / width. Williams 1986, J. Hydrol. 88:147-164, 79 sites: Rc/W is modal in 2–3,
 *    geometric mean 2.43. The centreline is built at that mean and is not allowed under 2
 *    (the floor of the modal bin; about a third of Williams' sites are tighter, and this task is not).
 *  - Meander wavelength λ/W = 10.9 and belt amplitude A/W = 2.7. Leopold & Wolman 1960, GSA Bull.
 *    71:769-793, linear form of λ = 10.9 W^1.01 and A = 2.7 W^1.1 (Leopold, Wolman & Miller 1964 treat
 *    the exponents as about 1, so the ratios are dimensionless). A is the crest-to-crest belt, so the
 *    centreline crest is A/2. A sine of wavelength λ has apex radius λ² / (4 π² a). Meeting the
 *    valley tangent takes a circular fillet of radius 2.43 W on the way in and the way out: the
 *    fillet ends off the chord, so the sine amplitude is the value that puts the crest, not the
 *    sine coefficient, at A/2. One lobe is half a wavelength between those fillets (8.0 W of chord
 *    for this pair of ratios). A reach that can hold three, five, … half-waves repeats the bend.
 *    Steep reaches and reaches shorter than one lobe keep the valley line. D8 turns of 45° are the
 *    grid staircase of a straighter valley (the only other D8 turn is 90°), so those vertices are
 *    dropped and the chord slope, not each 30 m step, is the reach slope.
 *  - Reach split. Montgomery & Buffington 1997, GSA Bull. 109:596-611: slopes under 0.015 are likely
 *    pool-riffle (lateral bars). Plane-bed, step-pool, cascade and bedrock reaches are straighter;
 *    their oscillation is vertical or the valley walls confine them, so they keep the valley line
 *    and only the fillet. Canadian Shield bedrock is the steep case of that split, not a second map.
 * Pieces are stored relative to a grid cell and evaluated per query, so a chunk boundary is not special.
 */
import type { Rivers } from './rivers';

const TAU = Math.PI * 2;

export const PLANFORM = {
  rcOverW: 2.43,
  rcMinOverW: 2,
  lambdaOverW: 10.9,
  beltOverW: 2.7,
  /** Montgomery & Buffington 1997: pool-riffle is the likely morphology below this slope. */
  poolRiffleSlope: 0.015,
};
/** Sine coefficient, in widths, whose crest (fillet pedestal + coefficient) equals the Leopold half-belt. */
function sineAmpOverW() {
  const crest = PLANFORM.beltOverW / 2, rf = PLANFORM.rcOverW, k = TAU / PLANFORM.lambdaOverW;
  let lo = 0, hi = crest;
  for (let i = 0; i < 50; i++) {
    const a = (lo + hi) / 2, y1 = rf * (1 - Math.cos(Math.atan(a * k)));
    if (y1 + a > crest) hi = a; else lo = a;
  }
  return (lo + hi) / 2;
}
const SINE_AMP_OVER_W = sineAmpOverW();
const LOBE_BETA = Math.atan(SINE_AMP_OVER_W * TAU / PLANFORM.lambdaOverW);
/** Chord length of one half-wave plus both fillets, in widths. Shorter reaches are not meandered. */
const MIN_REACH_OVER_W = 2 * PLANFORM.rcOverW * Math.sin(LOBE_BETA) + PLANFORM.lambdaOverW / 2;
const SLOTS = 3;
const STRIDE = 16;
const MIN_TURN = 2 * Math.PI / 180;

export type RiverPlan = {
  n: number;
  cell: number;
  kind: Uint8Array;
  data: Float32Array;
  up: Int32Array;
  down: Int32Array;
  mouth: Uint8Array;
  /** One point on each centreline piece, for the containment audit. */
  samples: { x: number; z: number }[];
};

export type GeoHit = {
  d: number; dirX: number; dirZ: number; t: number;
  elev0: number; elev1: number; w0: number; w1: number;
  up: number; down: number; mouth: boolean; run: number;
};

const mod = (i: number, n: number) => ((i % n) + n) % n;
const d8 = (n: number, c: number, r: number): [number, number] => [
  ((r % n) - (c % n) + n + 1) % n - 1,
  (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1,
];
const drawnW = (R: Rivers, c: number) => 2 * Math.min(0.4 * R.cell, R.width[c] / 2);
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** Circumradius of triangle (a, b, c). Infinity when the points are colinear. */
export function circumradius(ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
  const ab = Math.hypot(bx - ax, bz - az), bc = Math.hypot(cx - bx, cz - bz), ca = Math.hypot(ax - cx, az - cz);
  const area = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) * 0.5;
  if (area < 1e-8 || ab < 1e-6 || bc < 1e-6 || ca < 1e-6) return Infinity;
  return ab * bc * ca / (4 * area);
}

/** Circular fillet from the chord tangent. u is chord distance from the straight end, at most R sin β. */
function filletYZ(u: number, radius: number): [number, number] {
  const x = Math.min(radius - 1e-4, Math.max(0, u)), h = Math.sqrt(radius * radius - x * x);
  return [radius - h, x / h];
}

/**
 * Lateral offset of a pool-riffle chord. A half-wave of the Leopold sine sits between two fillets
 * of radius 2.43 W, so the lobe meets the valley tangent. Zero wherever one lobe does not fit.
 */
function meanderLateral(s: number, len: number, amp: number, wave: number, phase: number): [number, number] {
  const width = wave / PLANFORM.lambdaOverW;
  const radius = PLANFORM.rcOverW * width, k = TAU / wave, a = SINE_AMP_OVER_W * width;
  const y1 = radius * (1 - Math.cos(LOBE_BETA)), s1 = radius * Math.sin(LOBE_BETA), half = wave / 2;
  if (!(s1 > 0.05) || len < 2 * s1 + half) return [0, 0];
  const maxHalf = Math.floor((len - 2 * s1) / half + 1e-6);
  const nHalf = maxHalf % 2 === 1 ? maxHalf : maxHalf - 1;
  if (nHalf < 1) return [0, 0];
  const span = 2 * s1 + nHalf * half, stub = (len - span) / 2, u = s - stub;
  if (u <= 0 || u >= span) return [0, 0];
  const sign = Math.cos(phase) >= 0 ? 1 : -1;
  let y: number, yp: number;
  if (u <= s1) { const e = filletYZ(u, radius); y = e[0]; yp = e[1]; }
  else if (u >= span - s1) { const e = filletYZ(span - u, radius); y = e[0]; yp = -e[1]; }
  else { const sig = u - s1; y = y1 + a * Math.sin(k * sig); yp = a * k * Math.cos(k * sig); }
  return [sign * y, sign * yp];
}

/** Point and unit tangent of a meandered chord. t is 0..1 along the stored segment. */
function lineAt(ax: number, az: number, bx: number, bz: number, amp: number, wave: number, phase: number, t: number) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1e-6;
  const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
  const s = Math.max(0, Math.min(1, t)) * len;
  if (amp < 1e-4 || wave < 1e-3) return { x: ax + ux * s, z: az + uz * s, dirX: ux, dirZ: uz, len };
  const [off, doff] = meanderLateral(s, len, amp, wave, phase);
  const tx = ux + nx * doff, tz = uz + nz * doff, tl = Math.hypot(tx, tz) || 1;
  return { x: ax + ux * s + nx * off, z: az + uz * s + nz * off, dirX: tx / tl, dirZ: tz / tl, len };
}

function closestLine(px: number, pz: number, ax: number, az: number, bx: number, bz: number, amp: number, wave: number, phase: number) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  if (amp < 1e-4 || len2 < 1e-8) {
    const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
    const p = lineAt(ax, az, bx, bz, 0, 1, 0, t);
    return { d: Math.hypot(px - p.x, pz - p.z), t, dirX: p.dirX, dirZ: p.dirZ, run: Math.sqrt(len2) };
  }
  const len = Math.sqrt(len2);
  const step = Math.max(0.02, Math.min(0.25, 2 / len));
  let bestT = 0, bestD = Infinity;
  for (let t = 0; t <= 1.0001; t += step) {
    const p = lineAt(ax, az, bx, bz, amp, wave, phase, Math.min(1, t));
    const d = Math.hypot(px - p.x, pz - p.z);
    if (d < bestD) { bestD = d; bestT = Math.min(1, t); }
  }
  let lo = Math.max(0, bestT - step), hi = Math.min(1, bestT + step);
  for (let i = 0; i < 12; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    const p1 = lineAt(ax, az, bx, bz, amp, wave, phase, m1), p2 = lineAt(ax, az, bx, bz, amp, wave, phase, m2);
    if (Math.hypot(px - p1.x, pz - p1.z) < Math.hypot(px - p2.x, pz - p2.z)) hi = m2; else lo = m1;
  }
  const t = (lo + hi) / 2, p = lineAt(ax, az, bx, bz, amp, wave, phase, t);
  return { d: Math.hypot(px - p.x, pz - p.z), t, dirX: p.dirX, dirZ: p.dirZ, run: len };
}

function closestArc(px: number, pz: number, cx: number, cz: number, R: number, a0: number, sweep: number) {
  if (!(R > 0) || Math.abs(sweep) < 1e-6) {
    const x = cx + R * Math.cos(a0), z = cz + R * Math.sin(a0);
    return { d: Math.hypot(px - x, pz - z), t: 0, dirX: -Math.sin(a0), dirZ: Math.cos(a0), run: 0 };
  }
  let rel = wrap(Math.atan2(pz - cz, px - cx) - a0);
  if (sweep >= 0) rel = Math.max(0, Math.min(sweep, rel));
  else rel = Math.min(0, Math.max(sweep, rel));
  const a = a0 + rel, x = cx + R * Math.cos(a), z = cz + R * Math.sin(a);
  const sign = sweep >= 0 ? 1 : -1;
  return { d: Math.hypot(px - x, pz - z), t: rel / sweep, dirX: -Math.sin(a) * sign, dirZ: Math.cos(a) * sign, run: Math.abs(R * sweep) };
}

export function queryPlan(plan: RiverPlan, x: number, z: number): GeoHit | undefined {
  const { n, cell: s, kind, data, up, down, mouth } = plan;
  const fi = Math.floor(x / s), fj = Math.floor(z / s);
  let best: GeoHit | undefined;
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const i = fi + di, j = fj + dj, c = mod(j, n) * n + mod(i, n), ox = i * s, oz = j * s;
    for (let slot = 0; slot < SLOTS; slot++) {
      const k = kind[c * SLOTS + slot]; if (!k) continue;
      const o = (c * SLOTS + slot) * STRIDE;
      const hit = k === 1
        ? closestLine(x - ox, z - oz, data[o], data[o + 1], data[o + 2], data[o + 3], data[o + 5], data[o + 6], data[o + 7])
        : closestArc(x - ox, z - oz, data[o], data[o + 1], data[o + 2], data[o + 3], data[o + 4]);
      if (best && hit.d >= best.d) continue;
      best = {
        d: hit.d, dirX: hit.dirX, dirZ: hit.dirZ, t: hit.t,
        elev0: data[o + 8], elev1: data[o + 9], w0: data[o + 10], w1: data[o + 11],
        up: up[c * SLOTS + slot], down: down[c * SLOTS + slot], mouth: mouth[c * SLOTS + slot] === 1, run: Math.max(1e-3, hit.run),
      };
    }
  }
  return best;
}

type Slot = {
  kind: 1 | 2;
  ax: number; az: number; bx: number; bz: number; // line ends, or arc centre / radius / a0 / sweep in bx,bz, and sweep passed separately
  sweep: number;
  amp: number; wave: number; phase: number;
  elev0: number; elev1: number; w0: number; w1: number;
  up: number; down: number; mouth: boolean; run: number;
};

export function buildRiverPlan(R: Rivers, dir: Int32Array, height: (c: number) => number): RiverPlan {
  const n = R.n, N = n * n, s = R.cell;
  const kind = new Uint8Array(N * SLOTS), data = new Float32Array(N * SLOTS * STRIDE);
  const up = new Int32Array(N * SLOTS).fill(-1), down = new Int32Array(N * SLOTS).fill(-1), mouth = new Uint8Array(N * SLOTS);
  const samples: { x: number; z: number }[] = [];
  const plan: RiverPlan = { n, cell: s, kind, data, up, down, mouth, samples };

  const inflowCount = new Int32Array(N), inflowMain = new Int32Array(N).fill(-1);
  for (let c = 0; c < N; c++) {
    if (!R.drawn[c]) continue;
    const r = dir[c]; if (r < 0 || !R.drawn[r]) continue;
    inflowCount[r]++;
    if (inflowMain[r] < 0 || R.areaKm2[c] >= R.areaKm2[inflowMain[r]]) inflowMain[r] = c;
  }
  const nxt = new Int32Array(N).fill(-1), prv = new Int32Array(N).fill(-1), alive = new Uint8Array(N);
  for (let c = 0; c < N; c++) {
    if (!R.drawn[c]) continue;
    alive[c] = 1;
    if (dir[c] >= 0) nxt[c] = dir[c];
  }
  const relinkPrev = () => {
    prv.fill(-1);
    for (let c = 0; c < N; c++) {
      if (!alive[c]) continue;
      const r = nxt[c]; if (r < 0 || !alive[r]) continue;
      if (inflowCount[r] <= 1 || inflowMain[r] === c) prv[r] = c;
    }
  };
  relinkPrev();

  const walk = (from: number, to: number): [number, number] | null => {
    let c = from, x = 0, z = 0;
    for (let g = 0; g < n && c !== to; g++) {
      const r = dir[c]; if (r < 0) return null;
      const [ox, oz] = d8(n, c, r); x += ox * s; z += oz * s; c = r;
    }
    return c === to ? [x, z] : null;
  };
  const kill = (c: number) => {
    const p = prv[c], q = nxt[c];
    if (p < 0 || q < 0 || !alive[c] || inflowCount[c] > 1) return false;
    alive[c] = 0; nxt[p] = q;
    if (alive[q] && prv[q] === c) prv[q] = p;
    prv[c] = -1; nxt[c] = -1;
    return true;
  };
  const heading = (p: number, q: number) => {
    const v = walk(p, q); if (!v) return null;
    const len = Math.hypot(v[0], v[1]); if (len < 1e-3) return null;
    return { x: v[0], z: v[1], len, ux: v[0] / len, uz: v[1] / len };
  };
  const vertexTurn = (c: number) => {
    const p = prv[c], q = nxt[c];
    if (p < 0 || q < 0 || !alive[c]) return null;
    const inn = heading(p, c), out = heading(c, q); if (!inn || !out) return null;
    const delta = Math.atan2(inn.ux * out.uz - inn.uz * out.ux, inn.ux * out.ux + inn.uz * out.uz);
    return { delta, legIn: inn.len, legOut: out.len, w: drawnW(R, c), inn, out };
  };

  // A 45° D8 step is the staircase a square grid makes of a straighter valley. Drop those vertices
  // on pool-riffle ground so the chord is long enough for one Leopold wavelength. A 90° step stays.
  const stair = 50 * Math.PI / 180;
  // Reach slope is the chord across the vertex, not the steeper of the two 30 m steps.
  const gentleChord = (p: number, q: number) => {
    const hdg = heading(p, q); if (!hdg) return false;
    return Math.max(0, height(p) - height(q)) / hdg.len < PLANFORM.poolRiffleSlope;
  };
  for (let guard = 0; guard < N; guard++) {
    let victim = -1, best = Infinity;
    for (let c = 0; c < N; c++) {
      if (!alive[c] || inflowCount[c] > 1 || prv[c] < 0 || nxt[c] < 0 || !alive[prv[c]] || !alive[nxt[c]]) continue;
      const t = vertexTurn(c); if (!t || Math.abs(t.delta) >= stair || Math.abs(t.delta) >= best) continue;
      if (!gentleChord(prv[c], nxt[c])) continue;
      best = Math.abs(t.delta); victim = c;
    }
    if (victim < 0 || !kill(victim)) break;
  }

  // Drop a bend vertex when its fillet at Rc/W = 2 will not fit on the two chords. The chord
  // that replaces it is longer, so the next bend has room. A confluence stays (several paths share it).
  for (let guard = 0; guard < N; guard++) {
    const want = new Float32Array(N), scale = new Float32Array(N).fill(1);
    for (let c = 0; c < N; c++) {
      const t = vertexTurn(c); if (!t || Math.abs(t.delta) < MIN_TURN) continue;
      want[c] = PLANFORM.rcOverW * t.w * Math.tan(Math.abs(t.delta) / 2);
    }
    for (let p = 0; p < N; p++) {
      if (!alive[p] || nxt[p] < 0) continue;
      const q = nxt[p], hdg = heading(p, q); if (!hdg) continue;
      const tq = q < N && alive[q] ? want[q] : 0, sum = want[p] + tq, budget = hdg.len * 0.98;
      if (sum > budget && sum > 0) {
        const sc = budget / sum;
        if (sc < scale[p]) scale[p] = sc;
        if (alive[q] && sc < scale[q]) scale[q] = sc;
      }
    }
    let victim = -1, worst = Infinity;
    const consider = (cell: number, ratio: number) => {
      if (cell < 0 || !alive[cell] || inflowCount[cell] > 1 || prv[cell] < 0) return;
      if (ratio < worst) { worst = ratio; victim = cell; }
    };
    for (let c = 0; c < N; c++) {
      if (!alive[c]) continue;
      const t = vertexTurn(c);
      if (t && Math.abs(t.delta) >= MIN_TURN) {
        const tan = Math.tan(Math.abs(t.delta) / 2);
        const ratio = tan > 1e-6 ? (want[c] * scale[c]) / tan / Math.max(1e-3, t.w) : Infinity;
        if (ratio < PLANFORM.rcMinOverW - 1e-3) consider(inflowCount[c] > 1 ? prv[c] : c, ratio);
      }
      const q = nxt[c];
      if (q >= 0 && alive[q] && prv[q] !== c && nxt[q] >= 0) {
        const inn = heading(c, q), out = heading(q, nxt[q]);
        if (inn && out) {
          const delta = Math.atan2(inn.ux * out.uz - inn.uz * out.ux, inn.ux * out.ux + inn.uz * out.uz);
          if (Math.abs(delta) >= MIN_TURN) {
            const tUp = want[c] * scale[c];
            const tMax = Math.max(0, inn.len - tUp);
            const ratio = (tMax / Math.tan(Math.abs(delta) / 2)) / Math.max(1e-3, drawnW(R, q));
            if (ratio < PLANFORM.rcMinOverW - 1e-3) consider(c, ratio);
          }
        }
      }
    }
    if (victim < 0 || !kill(victim)) break;
  }

  const want = new Float32Array(N), scale = new Float32Array(N).fill(1);
  for (let c = 0; c < N; c++) {
    const t = vertexTurn(c); if (!t || Math.abs(t.delta) < MIN_TURN) continue;
    want[c] = PLANFORM.rcOverW * t.w * Math.tan(Math.abs(t.delta) / 2);
  }
  for (let p = 0; p < N; p++) {
    if (!alive[p] || nxt[p] < 0) continue;
    const q = nxt[p], hdg = heading(p, q); if (!hdg) continue;
    const tq = alive[q] ? want[q] : 0, sum = want[p] + tq, budget = hdg.len * 0.98;
    if (sum > budget && sum > 0) {
      const sc = budget / sum;
      if (sc < scale[p]) scale[p] = sc;
      if (alive[q] && sc < scale[q]) scale[q] = sc;
    }
  }
  const tangent = new Float32Array(N);
  for (let c = 0; c < N; c++) tangent[c] = want[c] * scale[c];

  const put = (cell: number, slot: number, g: Slot) => {
    if (cell < 0 || cell >= N) return;
    const at = cell * SLOTS + slot;
    kind[at] = g.kind;
    const o = at * STRIDE;
    data[o] = g.ax; data[o + 1] = g.az; data[o + 2] = g.bx; data[o + 3] = g.bz; data[o + 4] = g.sweep;
    data[o + 5] = g.amp; data[o + 6] = g.wave; data[o + 7] = g.phase;
    data[o + 8] = g.elev0; data[o + 9] = g.elev1; data[o + 10] = g.w0; data[o + 11] = g.w1;
    up[at] = g.up; down[at] = g.down; mouth[at] = g.mouth ? 1 : 0;
  };
  const putFree = (cell: number, g: Slot) => {
    for (let slot = 0; slot < SLOTS; slot++) if (!kind[cell * SLOTS + slot]) { put(cell, slot, g); return; }
  };
  const raster = (owner: number, local: (u: number) => { x: number; z: number }, gOf: (ox: number, oz: number) => Slot, steps: number) => {
    const px = (owner % n) * s, pz = ((owner / n) | 0) * s;
    for (let i = 0; i <= steps; i++) {
      const p = local(i / steps);
      const wx = px + p.x, wz = pz + p.z;
      const ci = Math.floor(wx / s), cj = Math.floor(wz / s);
      const cell = mod(cj, n) * n + mod(ci, n);
      // Cell node in the owner's frame. Piece offsets are stored from that node.
      const shifted = gOf(ci * s - px, cj * s - pz);
      // keep a slot that already carries this same piece (copied below); fill an empty one
      let have = false;
      for (let slot = 0; slot < SLOTS; slot++) {
        const at = cell * SLOTS + slot; if (kind[at] !== shifted.kind || up[at] !== shifted.up) continue;
        const o = at * STRIDE;
        if (Math.abs(data[o] - shifted.ax) < 0.05 && Math.abs(data[o + 1] - shifted.az) < 0.05) { have = true; break; }
      }
      if (!have) putFree(cell, shifted);
    }
  };

  const phaseAt = new Float32Array(N);
  const seenPhase = new Uint8Array(N);
  const stack: number[] = [];
  for (let c = 0; c < N; c++) if (alive[c] && prv[c] < 0) stack.push(c);
  const edges: { p: number; q: number }[] = [];
  while (stack.length) {
    const p = stack.pop()!; if (seenPhase[p]) continue; seenPhase[p] = 1;
    const q = nxt[p]; if (q < 0) continue;
    edges.push({ p, q });
    if (alive[q] && prv[q] === p) stack.push(q);
  }
  // Tributary edges are not on the main prev chain. Pick them up from any alive cell.
  const edged = new Uint8Array(N);
  for (const e of edges) edged[e.p] = 1;
  for (let p = 0; p < N; p++) if (alive[p] && nxt[p] >= 0 && !edged[p]) edges.push({ p, q: nxt[p] });

  for (const { p, q } of edges) {
    const hdg = heading(p, q); if (!hdg) continue;
    const qAlive = alive[q] === 1;
    const mainIn = qAlive && prv[q] === p;
    const tq = qAlive && mainIn ? tangent[q] : 0;
    let t0 = hdg.len > 0 ? tangent[p] / hdg.len : 0;
    let t1 = hdg.len > 0 ? 1 - tq / hdg.len : 1;
    // A tributary join keeps its own end fillet, sized to Rc/W = 2.43 when the edge allows.
    let join: { t: number; delta: number; ux: number; uz: number; vx: number; vz: number } | null = null;
    if (qAlive && !mainIn && nxt[q] >= 0) {
      const out = heading(q, nxt[q]);
      if (out) {
        const delta = Math.atan2(hdg.ux * out.uz - hdg.uz * out.ux, hdg.ux * out.ux + hdg.uz * out.uz);
        if (Math.abs(delta) >= MIN_TURN) {
          const w = drawnW(R, q), tan = Math.tan(Math.abs(delta) / 2);
          const tWant = PLANFORM.rcOverW * w * tan;
          const tRoom = Math.max(0, hdg.len - tangent[p]);
          const t = Math.min(tWant, tRoom);
          if (t > 0.05) { join = { t, delta, ux: hdg.ux, uz: hdg.uz, vx: out.ux, vz: out.uz }; t1 = Math.min(t1, 1 - t / hdg.len); }
        }
      }
    }
    if (t0 > t1) { const m = (t0 + t1) / 2; t0 = m; t1 = m; }
    const hp = height(p), hq = height(q);
    const elev0 = hp + (hq - hp) * t0, elev1 = hp + (hq - hp) * t1;
    const w0 = drawnW(R, p), w1 = R.channel[q] ? drawnW(R, q) : w0;
    const slope = hdg.len > 0 ? Math.max(0, hp - hq) / hdg.len : 1;
    // Size the wave to the wider end. Width grows downstream, so the local width never exceeds it,
    // and the apex radius (2.23 of that width) stays at or above 2 local widths.
    const wRef = Math.max(w0, w1, 0.5);
    const free = Math.max(0, t1 - t0) * hdg.len;
    const need = MIN_REACH_OVER_W * wRef;
    const meander = slope < PLANFORM.poolRiffleSlope && free >= need - 1e-2;
    const amp = meander ? (PLANFORM.beltOverW / 2) * wRef : 0;
    const wave = meander ? PLANFORM.lambdaOverW * wRef : 1;
    const phase = phaseAt[p];
    if (qAlive && mainIn) phaseAt[q] = phase + (meander ? Math.PI : 0);
    const mouthEdge = !R.drawn[q];
    const ax = hdg.ux * hdg.len * t0, az = hdg.uz * hdg.len * t0, bx = hdg.ux * hdg.len * t1, bz = hdg.uz * hdg.len * t1;
    const line: Slot = {
      kind: 1, ax, az, bx, bz, sweep: 0, amp, wave, phase, elev0, elev1, w0, w1,
      up: p, down: q, mouth: mouthEdge, run: Math.max(1e-3, (t1 - t0) * hdg.len),
    };
    if (t1 - t0 > 1e-3) {
      put(p, 1, line);
      // Carriers along the curve so a shortcut is still inside the query window.
      const steps = Math.max(1, Math.ceil(hdg.len / 8));
      raster(p, (u) => lineAt(ax, az, bx, bz, amp, wave, phase, u), (ox, oz) => ({
        ...line, ax: ax - ox, az: az - oz, bx: bx - ox, bz: bz - oz,
      }), steps);
      const mid = lineAt(ax, az, bx, bz, amp, wave, phase, 0.5);
      samples.push({ x: (p % n) * s + mid.x, z: ((p / n) | 0) * s + mid.z });
    }
    if (join && qAlive) {
      const sign = join.delta > 0 ? 1 : -1;
      const Rarc = join.t / Math.tan(Math.abs(join.delta) / 2);
      const tinx = -join.ux * join.t, tinz = -join.uz * join.t;
      const nx = sign * -join.uz, nz = sign * join.ux;
      const ocx = tinx + nx * Rarc, ocz = tinz + nz * Rarc;
      const a0 = Math.atan2(tinz - ocz, tinx - ocx);
      const toutx = join.vx * join.t, toutz = join.vz * join.t;
      const a1 = Math.atan2(toutz - ocz, toutx - ocx);
      const sweep = wrap(a1 - a0);
      // The arc is built in q's frame. Shift it into p's frame (the chord p→q).
      const arc: Slot = {
        kind: 2, ax: hdg.x + ocx, az: hdg.z + ocz, bx: Rarc, bz: a0, sweep, amp: 0, wave: 1, phase: 0,
        elev0: elev1, elev1: hq + (height(nxt[q]) - hq) * Math.min(1, join.t / Math.max(1e-3, heading(q, nxt[q])?.len ?? 1)),
        w0: w1, w1: drawnW(R, q), up: p, down: q, mouth: false, run: Math.abs(Rarc * sweep),
      };
      put(p, 2, arc);
      raster(p, (u) => {
        const a = a0 + sweep * u;
        return { x: arc.ax + Rarc * Math.cos(a), z: arc.az + Rarc * Math.sin(a) };
      }, (ox, oz) => ({ ...arc, ax: arc.ax - ox, az: arc.az - oz }), Math.max(1, Math.ceil(Math.abs(Rarc * sweep) / 8)));
    }
  }

  // Fillets at surviving main-stem vertices, in that vertex's own frame.
  for (let c = 0; c < N; c++) {
    if (!(tangent[c] > 0.05)) continue;
    const t = vertexTurn(c); if (!t || Math.abs(t.delta) < MIN_TURN) continue;
    const tan = Math.tan(Math.abs(t.delta) / 2); if (tan < 1e-6) continue;
    const Rarc = tangent[c] / tan;
    const sign = t.delta > 0 ? 1 : -1;
    const tinx = -t.inn.ux * tangent[c], tinz = -t.inn.uz * tangent[c];
    const nx = sign * -t.inn.uz, nz = sign * t.inn.ux;
    const ocx = tinx + nx * Rarc, ocz = tinz + nz * Rarc;
    const a0 = Math.atan2(tinz - ocz, tinx - ocx);
    const toutx = t.out.ux * tangent[c], toutz = t.out.uz * tangent[c];
    const a1 = Math.atan2(toutz - ocz, toutx - ocx);
    const sweep = wrap(a1 - a0);
    const p = prv[c], q = nxt[c];
    const hp = height(p), hc = height(c), hq = height(q);
    const uIn = t.legIn > 0 ? 1 - tangent[c] / t.legIn : 1;
    const uOut = t.legOut > 0 ? tangent[c] / t.legOut : 0;
    const arc: Slot = {
      kind: 2, ax: ocx, az: ocz, bx: Rarc, bz: a0, sweep, amp: 0, wave: 1, phase: 0,
      elev0: hp + (hc - hp) * Math.max(0, Math.min(1, uIn)),
      elev1: hc + (hq - hc) * Math.max(0, Math.min(1, uOut)),
      w0: drawnW(R, p), w1: drawnW(R, c), up: p, down: c, mouth: !R.drawn[q], run: Math.abs(Rarc * sweep),
    };
    put(c, 0, arc);
    raster(c, (u) => {
      const a = a0 + sweep * u;
      return { x: ocx + Rarc * Math.cos(a), z: ocz + Rarc * Math.sin(a) };
    }, (ox, oz) => ({ ...arc, ax: ocx - ox, az: ocz - oz }), Math.max(1, Math.ceil(Math.abs(Rarc * sweep) / 8)));
    const midA = a0 + sweep * 0.5;
    samples.push({ x: (c % n) * s + ocx + Rarc * Math.cos(midA), z: ((c / n) | 0) * s + ocz + Rarc * Math.sin(midA) });
  }
  return plan;
}

export type RadiusReport = {
  /** D8 continuation nodes whose straight polyline bends at least 20°. Their centreline radius is 0. */
  d8Nodes: number;
  d8SharpShare: number;
  /** Samples of the curved centreline whose osculating radius is under 2 widths. */
  samples: number;
  under2: number;
  shareUnder2: number;
  minRcOverW: number;
  meanderPieces: number;
  steepMeanderPieces: number;
  medianLambdaOverW: number;
  medianHalfAmpOverW: number;
};

function pushRatio(ratios: number[], r: number, w: number) {
  if (w > 0.5 && Number.isFinite(r)) ratios.push(r / w);
}

/** Osculating radius along each stored piece, plus the raw D8 kink share (the known mismatch). */
export function planformReport(R: Rivers, dir: Int32Array, plan: RiverPlan): RadiusReport {
  const n = R.n, N = n * n, s = R.cell;
  let d8Nodes = 0, d8Sharp = 0;
  for (let c = 0; c < N; c++) {
    if (!R.drawn[c]) continue;
    const r = dir[c]; if (r < 0 || !R.drawn[r]) continue;
    const r2 = dir[r]; if (r2 < 0 || !R.drawn[r2]) continue;
    const [ax, az] = d8(n, c, r), [bx, bz] = d8(n, r, r2);
    const dot = (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz));
    const deg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    d8Nodes++; if (deg >= 20) d8Sharp++;
  }
  const ratios: number[] = [];
  const lambdas: number[] = [], amps: number[] = [];
  let meanderPieces = 0, steepMeanderPieces = 0, under2 = 0, samples = 0;
  const seen = new Set<string>();
  for (let c = 0; c < N; c++) for (let slot = 0; slot < SLOTS; slot++) {
    const at = c * SLOTS + slot, k = plan.kind[at]; if (!k) continue;
    const o = at * STRIDE, owner = plan.up[at];
    const key = `${k}:${owner}:${plan.data[o].toFixed(2)}:${plan.data[o + 1].toFixed(2)}:${plan.data[o + 2].toFixed(2)}`;
    if (seen.has(key)) continue; seen.add(key);
    const w0 = plan.data[o + 10], w1 = plan.data[o + 11];
    if (k === 2) {
      const Rarc = plan.data[o + 2], w = w1 > 0.5 ? w1 : w0;
      samples++; if (w > 0.5 && Rarc < PLANFORM.rcMinOverW * w - 1e-2) under2++;
      pushRatio(ratios, Rarc, w);
      continue;
    }
    const amp = plan.data[o + 5], wave = plan.data[o + 6];
    if (amp > 1e-3) {
      meanderPieces++;
      const wRef = Math.max(w0, w1, 0.5);
      lambdas.push(wave / wRef); amps.push(amp / wRef);
      const ax = plan.data[o], az = plan.data[o + 1], bx = plan.data[o + 2], bz = plan.data[o + 3], phase = plan.data[o + 7];
      const len = Math.hypot(bx - ax, bz - az);
      const step = 1 / Math.max(len, 1);
      let prev: { x: number; z: number } | undefined, mid: { x: number; z: number } | undefined;
      let minR = Infinity;
      for (let t = 0; t <= 1.0001; t += step) {
        const p = lineAt(ax, az, bx, bz, amp, wave, phase, Math.min(1, t));
        if (prev && mid) {
          const cr = circumradius(prev.x, prev.z, mid.x, mid.z, p.x, p.z);
          if (cr < minR) minR = cr;
          samples++;
          const u = Math.min(1, t);
          const wHere = w0 + (w1 - w0) * u;
          if (wHere > 0.5 && cr < PLANFORM.rcMinOverW * wHere - 1e-2) under2++;
        }
        prev = mid; mid = p;
      }
      pushRatio(ratios, minR, Math.max(w0, w1));
    }
  }
  // A meander on a piece whose end elevations drop at or above the pool-riffle slope is a miss.
  // Recomputed from stored elevations and run length (index 4 is sweep/len; lines store 0 there).
  for (let c = 0; c < N; c++) for (let slot = 0; slot < SLOTS; slot++) {
    const at = c * SLOTS + slot; if (plan.kind[at] !== 1 || plan.data[at * STRIDE + 5] < 1e-3) continue;
    const o = at * STRIDE;
    const run = Math.hypot(plan.data[o + 2] - plan.data[o], plan.data[o + 3] - plan.data[o + 1]);
    const slope = run > 0 ? Math.max(0, plan.data[o + 8] - plan.data[o + 9]) / run : 1;
    // elev0/elev1 are the trimmed ends, so this slope is the piece's. Count it when it is steep.
    if (slope >= PLANFORM.poolRiffleSlope) steepMeanderPieces++;
  }
  ratios.sort((a, b) => a - b);
  const med = (a: number[]) => a.length ? a[a.length >> 1] : 0;
  lambdas.sort((a, b) => a - b); amps.sort((a, b) => a - b);
  return {
    d8Nodes, d8SharpShare: d8Nodes ? +(d8Sharp / d8Nodes).toFixed(3) : 0,
    samples, under2, shareUnder2: samples ? under2 / samples : 0,
    minRcOverW: ratios.length ? +ratios[0].toFixed(3) : Infinity,
    meanderPieces, steepMeanderPieces,
    medianLambdaOverW: +med(lambdas).toFixed(3),
    medianHalfAmpOverW: +med(amps).toFixed(3),
  };
}
