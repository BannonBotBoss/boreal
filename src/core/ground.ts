/**
 * Layered ground (Grok Bot). The surface is a column of material layers per 2 m cell, not a hard plane:
 * live moss mat, fresh litter, fragmented litter, duff (fibrous), humus (amorphous), mineral soil (Ae/B with SOM), bedrock,
 * or a water column below the water line. Organic pools follow a linear decay chain with real CBM-CFS3 rates, solved in
 * CLOSED FORM (Bateman + steady state) from the stand's fire origin to now, so any cell is deterministic from
 * seed + elapsed years, and catch-up on chunk load is exact. Deposits (litter, droppings) are pulses superposed on top.
 * Softness uses Bekker pressure–sinkage; appearance comes from the top-layer composition.
 * Every constant has a citation (PROJECT-RULES rule 5); [verify] = from memory or derived, still to be checked.
 */
import { hash, random } from '../proc/rng';
import { f } from '../proc/trace';
import { CHUNK_SIZE, WORLD_SEED, heightAt, generateChunk } from './world';
import { LEVEL } from './tuning';
import { HYDRO, WEATHER, setSurfaceSource, weatherAt } from './weather';

export const CELL = 2; // m
/** Organic pools (dry mass, kg/m²) in chain order. CBM-CFS3 DOM pools (Kurz et al. 2009, Ecol. Model. 220:480, Table 3) [verify]:
 * k = base decay rate at 10 °C (1/yr), toNext = share of the loss passed down the chain (rest is respired as CO₂), Q10. */
export const POOLS = [
  { id: 'freshLitter', label: 'fresh litter (L)', k: .355, toNext: .185, q10: 2.65, bulk: 25 },   // CBM very fast AG: k .355, 81.5 % to air
  { id: 'fragmented', label: 'fragmented litter (F)', k: .1435, toNext: .17, q10: 2, bulk: 50 },  // CBM fast AG: .1435, 83 % to air
  { id: 'duff', label: 'duff / fibrous (Of)', k: .0374, toNext: .17, q10: 2, bulk: 70 },          // CBM medium: .0374, 83 % to air
  { id: 'humus', label: 'humus / amorphous (Oh)', k: .021, toNext: .006 / .021, q10: 2.65, bulk: 150 }, // CBM slow AG .015 decay + .006 turnover to BG
  { id: 'som', label: 'soil organic matter (in mineral)', k: .0033, toNext: 0, q10: 2.65, bulk: 0 }, // CBM slow BG .0033
] as const;
// Bulk densities (kg/m³): BOREAS black spruce organic horizons live < fibrous < amorphous (Yi et al. 2009, JGR 114:G04002,
// data sets S8–S10: live ~0.02, fibrous ~0.05–0.08, amorphous ~0.1–0.2 g/cm³) [verify exact means].
export const CLIMATE = {
  meanAnnualTempC: 2.5,  // Kenora, ON 1981–2010 normal ≈ 2.5–2.6 °C (Environment and Climate Change Canada Climate Normals) [verify]
  refTempC: 10,          // CBM-CFS3 reference temperature for base rates (Kurz et al. 2009)
  fireReturnYears: [40, 160], // NW Ontario boreal stand ages after fire; fire cycle ~100 yr (Stocks et al. 2002, JGR 108:8149) [verify]
};
/** Aboveground litterfall per unit canopy cover, dry kg/m²/yr. */
export const LITTERFALL: Record<string, number> = {
  'black-spruce': .121, // BFTCS black spruce 121 g/m²/yr, 2000–2010 mean (Norris et al., EGU 2012-11989)
  'white-spruce': .121, // [verify] no stand value found; uses black spruce
  'jack-pine': .110,    // BFTCS jack pine 110 g/m²/yr (Norris et al., EGU 2012-11989)
  'paper-birch': .25,   // [verify] deciduous; between conifers and BOREAS aspen (Gower et al. 1997, JGR 102:29029)
  'aspen': .25,         // [verify] BOREAS aspen litterfall N 30–41 kg/ha/yr (Gower et al. 2000) implies 2–5 t/ha/yr; low end used
};
/** Moss productivity into the duff pool, dry kg/m²/yr: surface moss/detritus inputs 0.06–0.1 kg C/m²/yr after fire,
 * ×2 for dry mass at 50 % C (Trumbore & Harden 1997, JGR 102:28817). Drier cells get the low end. */
export const MOSS_INPUT: [number, number] = [.12, .2];
/** Mineral profile of a sandy podzol on Shield till: Ae 5–15 cm, B 20–50 cm, bulk density 1.2–1.5 g/cm³, depth to bedrock 0.5–3 m
 * (Soil Classification Working Group 1998, Canadian System of Soil Classification, 3rd ed.) [verify ranges]. SOM start: mineral C
 * 2.2–3.0 kg C/m² to 50 cm under jack pine (Norris et al. EGU 2012) → ×2 dry mass. */
export const MINERAL = { ae: [.05, .15], b: [.2, .5], bulk: [1200, 1500], bedrock: [.5, 3], som0: [4.4, 6] };
/** Bekker pressure–sinkage p = (kc/b + kφ) zⁿ (kPa, z in m, b in m). Wong, Theory of Ground Vehicles, 3rd ed. (2001), Table 2.3. */
export const BEKKER = {
  sandyLoam15: { n: .7, kc: 5.27, kphi: 1515.04 },  // sandy loam, 15 % moisture
  wetLoam32: { n: .5, kc: .77, kphi: 51.91 },       // sandy loam, 32 % moisture: softest upland soil in the table; PROXY for the
  // organic mat until muskeg parameters (Wong, Radforth & Preston-Thomas 1982, J. Terramech. 19:107) are sourced [verify]
  drySand: { n: 1.1, kc: .99, kphi: 1528.43 },
  snow: { n: 1.6, kc: 4.37, kphi: 196.72 },         // snow (US): used for the snowpack layer (core/weather)
};
/** Foot contact (one foot): wolf track 10–13 × 8–10 cm (Mech 1970, The Wolf); white-tailed deer hoof 5–9 cm (Rezendes 1999,
 * Tracking and the Art of Seeing); grizzly hind foot ~25 × 15 cm (Murie 1954, Peterson Field Guide to Animal Tracks) [verify]. */
export const FOOT: Record<string, { w: number; l: number }> = { canid: { w: .09, l: .115 }, cervid: { w: .045, l: .07 }, ursid: { w: .15, l: .25 }, leporid: { w: .05, l: .12 } };
/** Pellet groups per white-tailed deer per day: 12.7 (Neff 1968, J. Wildl. Manage. 32:597). Faecal dry matter ≈ (1 − digestibility)
 * × intake; intake ~2.2 % body mass/day, digestibility ~0.55 (Ullrey et al. 1970, J. Wildl. Manage. 34:863) [verify]. */
export const FAUNA = { deerPelletGroupsPerDay: 12.7, deerIntakeShare: .022, deerDigestibility: .55 };

// ---- closed-form decay chain ------------------------------------------------------------------------------------
const n = POOLS.length;
export const rates = (tempC = CLIMATE.meanAnnualTempC, speed = 1) => POOLS.map(p => p.k * p.q10 ** ((tempC - CLIMATE.refTempC) / 10) * speed);
/** x(t) for dx/dt = A x + b with A lower-bidiagonal (decay k_i, transfer h_i k_i to i+1): exact (Bateman + steady state). */
export function chain(x0: readonly number[], input: readonly number[], t: number, k = rates()) {
  const h = POOLS.map(p => p.toNext), xs: number[] = [];
  for (let j = 0; j < n; j++) xs.push((input[j] + (j ? h[j - 1] * k[j - 1] * xs[j - 1] : 0)) / k[j]); // steady state
  const d = x0.map((v, i) => v - xs[i]), out = xs.slice();
  for (let j = 0; j < n; j++) for (let i = 0; i <= j; i++) {
    let coef = d[i]; for (let m = i; m < j; m++) coef *= h[m] * k[m];
    let sum = 0; for (let p = i; p <= j; p++) { let den = 1; for (let q = i; q <= j; q++) if (q !== p) den *= k[q] - k[p]; sum += Math.exp(-k[p] * t) / den; }
    out[j] += coef * sum;
  }
  return out.map(v => Math.max(0, v));
}
/** Forward-Euler reference (tests): also returns respired mass. */
export function chainStep(x0: readonly number[], input: readonly number[], t: number, dt: number, k = rates()) {
  const x = x0.slice(); let resp = 0;
  for (let s = 0; s < Math.round(t / dt); s++) { const loss = x.map((v, i) => k[i] * v * dt);
    for (let i = 0; i < n; i++) { x[i] += input[i] * dt - loss[i]; if (i) x[i] += POOLS[i - 1].toNext * loss[i - 1]; resp += loss[i] * (1 - POOLS[i].toNext); } }
  return { x, resp };
}

// ---- per-cell column --------------------------------------------------------------------------------------------
export interface Deposit { x: number; z: number; year: number; pool: number; kg: number; what: string }
export const GROUND = { years: 0, speed: 1, deposits: [] as Deposit[] }; // game years since world start (persisted by main); speed = flow/decay ×
export const SAVE_KEY_GROUND = 'boreal.ground.v1';
/** Advance the ground clock by `gameSeconds` × the flow/decay multiplier. Nothing is stepped: columns are closed-form in `years`. */
export function tickGround(gameSeconds: number) { GROUND.years += gameSeconds * GROUND.speed / (365.25 * 86400); }
export const saveGround = () => JSON.stringify({ years: GROUND.years, deposits: GROUND.deposits });
export function loadGround(json: string | null) { try { const s = JSON.parse(json ?? ''); GROUND.years = +s.years || 0; GROUND.deposits = Array.isArray(s.deposits) ? s.deposits : []; } catch { /* fresh world */ } }
/** Expected deer droppings (dry kg) over `days`: intake × (1 − digestibility) (FAUNA). Pellet groups: 12.7/day (Neff 1968). */
export const deerDroppingsKg = (massKg: number, days: number) => massKg * FAUNA.deerIntakeShare * (1 - FAUNA.deerDigestibility) * days;
const noise = (x: number, z: number, label: string) => random(hash(`${label}:${WORLD_SEED}:${x}:${z}`))();
const lerp = ([a, b]: readonly number[], t: number) => a + (b - a) * t;
const treeCache = new Map<string, { x: number; z: number; r: number; rate: number }[]>();
let speciesOf: (seed: number) => string = () => 'black-spruce';
let crownOf: (seed: number) => number = () => 1.6;
/** The render layer registers the tree species/crown functions (core stays three.js-free). */
export function setTreeSource(species: (seed: number) => string, crown: (seed: number) => number) { speciesOf = species; crownOf = crown; treeCache.clear(); colCache.clear(); }
function treesNear(cx: number, cz: number) {
  const key = `${cx}:${cz}`; let t = treeCache.get(key); if (t) return t; t = [];
  for (let a = cx - 1; a <= cx + 1; a++) for (let b = cz - 1; b <= cz + 1; b++)
    for (const e of generateChunk(a, b)) if (e.kind === 'spruce') { const sp = speciesOf(e.seed); t.push({ x: e.x, z: e.z, r: crownOf(e.seed) * e.scale, rate: LITTERFALL[sp] ?? .121 }); }
  if (treeCache.size > 64) treeCache.delete(treeCache.keys().next().value!); treeCache.set(key, t); return t;
}
export interface Layer { id: string; label: string; top: number; thickness: number; kg: number; bulk: number; moisture?: number; age?: string; source: string }
/** The layer stack of the cell containing (x, z) at `years` since world start (plus the stand's age since fire). */
const colCache = new Map<string, ReturnType<typeof columnRaw>>();
export function column(x: number, z: number, years = GROUND.years) {
  years = Math.round(years * 365.25) / 365.25; // resolve to one game day: decay is invisible below that and the cache stays warm
  const key = `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}:${years}:${WEATHER.steps >> 6}`; let c = colCache.get(key); // weather (moisture/snow) refreshes every 64 steps
  if (!c) { c = columnRaw(x, z, years); if (colCache.size > 20000) colCache.clear(); colCache.set(key, c); } return c;
}
function columnRaw(x: number, z: number, years: number) {
  const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL), cx = gx * CELL + CELL / 2, cz = gz * CELL + CELL / 2;
  const y = heightAt(cx, cz), wet = Math.min(1, Math.max(0, (LEVEL.shore + 1.5 - y) / 2)); // low ground is wetter
  const standAge = f('ground', 'stand age since fire (yr)', Math.round(lerp(CLIMATE.fireReturnYears, noise(Math.floor(cx / 60), Math.floor(cz / 60), 'fire'))));
  let cover = 0, litter = 0;
  for (const t of treesNear(Math.floor(cx / CHUNK_SIZE), Math.floor(cz / CHUNK_SIZE))) if (Math.hypot(t.x - cx, t.z - cz) < t.r) { cover++; litter += t.rate; }
  const input = [f('ground', 'litterfall (kg/m²/yr)', litter), 0, f('ground', 'moss input (kg/m²/yr)', lerp(MOSS_INPUT, wet)), 0, 0];
  const k = rates(CLIMATE.meanAnnualTempC, 1), som0 = lerp(MINERAL.som0, noise(gx, gz, 'som'));
  const start = [0, 0, 0, 0, som0], age = standAge + years;
  let pool = chain(start, input, age, k);
  for (const d of GROUND.deposits) if (Math.floor(d.x / CELL) === gx && Math.floor(d.z / CELL) === gz && d.year <= years) {
    const pulse = [0, 0, 0, 0, 0]; pulse[d.pool] = d.kg / (CELL * CELL); const after = chain(pulse, [0, 0, 0, 0, 0], years - d.year, k);
    pool = pool.map((v, i) => v + after[i]);
  }
  const layers: Layer[] = []; let top = 0;
  const push = (l: Omit<Layer, 'top'>) => { if (l.thickness > 1e-4) { layers.push({ ...l, top }); top += l.thickness; } };
  // Hydrosphere (core/weather): snowpack on top, bucket soil water blended into the organic layers' moisture.
  const wx = weatherAt(cx, cz), snowM = f('ground', 'snow water equivalent (mm)', wx.sweMm) / HYDRO.snowDensity;
  if (y >= LEVEL.waterSurface) push({ id: 'snow', label: 'snowpack', thickness: snowM, kg: snowM * HYDRO.snowDensity, bulk: HYDRO.snowDensity, moisture: 1, source: 'core/weather Kessler + degree-day melt; Sturm et al. 2010' });
  const moist = f('ground', 'organic moisture (vol. share)', Math.min(1, (.3 + .6 * wet) * .5 + wx.soil * .5));
  if (y < LEVEL.waterSurface) push({ id: 'water', label: 'water', thickness: LEVEL.waterSurface - y, kg: (LEVEL.waterSurface - y) * 998, bulk: 998, source: 'CRC Handbook' });
  push({ id: 'moss', label: 'live moss mat', thickness: .02 + .04 * wet, kg: (.02 + .04 * wet) * 20, bulk: 20, moisture: moist, source: 'Yi et al. 2009 (live horizon) [verify]' });
  POOLS.slice(0, 4).forEach((p, i) => push({ id: p.id, label: p.label, thickness: pool[i] / p.bulk, kg: pool[i], bulk: p.bulk, moisture: moist,
    age: `turnover ${(1 / k[i]).toFixed(0)} yr at ${CLIMATE.meanAnnualTempC} °C`, source: 'CBM-CFS3, Kurz et al. 2009; Yi et al. 2009' }));
  let ae = lerp(MINERAL.ae, noise(gx, gz, 'ae')), b = lerp(MINERAL.b, noise(gx, gz, 'b')), bulk = lerp(MINERAL.bulk, noise(gx, gz, 'bulk'));
  const soil = lerp(MINERAL.bedrock, noise(Math.floor(cx / 20), Math.floor(cz / 20), 'rock')) - top;
  if (ae + b > soil) { const s2 = Math.max(.05, soil) / (ae + b); ae *= s2; b *= s2; }
  push({ id: 'ae', label: 'mineral Ae (eluviated sand)', thickness: ae, kg: ae * bulk, bulk, source: 'CSSC 1998 podzol' });
  push({ id: 'b', label: `mineral B (+ ${pool[4].toFixed(1)} kg/m² SOM)`, thickness: b, kg: b * bulk + pool[4], bulk, age: `SOM turnover ${(1 / k[4]).toFixed(0)} yr`, source: 'CSSC 1998; CBM-CFS3' });
  push({ id: 'bedrock', label: 'bedrock (granite)', thickness: 10, kg: 10 * 2650, bulk: 2650, source: 'Canadian Shield; Klein & Dutrow' });
  return { cell: `${gx}:${gz}`, height: y, cover, input, pools: pool, layers, organic: layers.filter(l => /moss|Litter|fragmented|duff|humus/i.test(l.id)).reduce((s, l) => s + l.thickness, 0), wet };
}
export type Column = ReturnType<typeof columnRaw>;

// ---- softness ----------------------------------------------------------------------------------------------------
/** Static sinkage (m) under one foot at `pressure` kPa: Bekker through the organic mat, then the mineral soil. Monotonic in p. */
export function sinkage(col: Column, pressureKPa: number, footWidth: number) {
  if (col.layers[0]?.id === 'water') return Math.min(2, col.layers[0].thickness); // wading
  const snow = col.layers[0]?.id === 'snow' ? col.layers[0].thickness : 0;
  if (snow) { const sn = BEKKER.snow, zs = (pressureKPa / (sn.kc / footWidth + sn.kphi)) ** (1 / sn.n); if (zs <= snow) return zs; } // sinks into snow first
  const o = BEKKER.wetLoam32, m = BEKKER.sandyLoam15, zo = (pressureKPa / (o.kc / footWidth + o.kphi)) ** (1 / o.n);
  if (zo <= col.organic) return snow + zo;
  return snow + col.organic + (pressureKPa / (m.kc / footWidth + m.kphi)) ** (1 / m.n);
}
/** Ground interaction for an animal: pressure, sink, compaction resistance (Bekker: R = b(kc/b+kφ)z^(n+1)/(n+1)) as a cost factor. */
export function footing(col: Column, massKg: number, plan: string, g: number) {
  const foot = FOOT[plan] ?? FOOT.canid, area = foot.w * foot.l, p = f('ground', 'foot pressure (kPa)', massKg * g / 4 / area / 1000);
  if (col.layers[0]?.id === 'water') return { pressure: p, sink: 0, cost: 1, absorb: 1 }; // swimming/wading is handled by the water code
  const z = f('ground', 'sinkage (m)', sinkage(col, p, foot.w)), o = BEKKER.wetLoam32;
  const R = 4 * foot.w * (o.kc / foot.w + o.kphi) * 1000 * Math.min(z, 2) ** (o.n + 1) / (o.n + 1);
  return { pressure: p, sink: z, cost: f('ground', 'movement cost ×', 1 + R / (massKg * g)), absorb: f('ground', 'impact softening ×', 1 / (1 + z / foot.w)) };
}
/** Surface colour mix from the top 2 cm composition (art mapping of real layers; colours are not measurements). */
const SURFACE: Record<string, number[]> = { snow: [.92, .94, .96], water: [.34, .55, .57], moss: [.37, .48, .23], freshLitter: [.42, .33, .2], fragmented: [.33, .26, .17], duff: [.27, .21, .14], humus: [.2, .15, .1], ae: [.6, .57, .48], b: [.55, .42, .27] };
export function surfaceColor(col: Column) {
  const c = [0, 0, 0]; let w = 0;
  for (const l of col.layers) { const take = Math.max(0, Math.min(l.top + l.thickness, .02) - l.top); if (take <= 0 || !SURFACE[l.id]) continue; SURFACE[l.id].forEach((v, i) => { c[i] += v * take; }); w += take; }
  return w ? c.map(v => v / w) : SURFACE.b;
}
export function addDeposit(d: Deposit) { colCache.clear(); GROUND.deposits.push(d); if (GROUND.deposits.length > 2000) GROUND.deposits.shift(); }
// The weather's surface energy balance reads the top layer of this cell (albedo, surface resistance, roughness).
setSurfaceSource((x, z) => { const c = column(x, z), top = c.layers[0]?.id; return top === 'water' ? 'water' : top === 'snow' ? 'snow' : c.cover ? 'forest' : 'moss'; });
