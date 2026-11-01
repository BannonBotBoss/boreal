/**
 * Ground cover class, one rule shared with the simulation (rust/boreal-sim/src/cover.rs, issue #167).
 *
 * Classes come from causes, not latitude bands: below the ice line (warm season under 0 C) is ice; above the
 * tree line is rock in mountains and tundra where the tree line is already near sea level (Koerner and Paulsen
 * 2004, core/altitudeZones). Below the tree line the planet sample's vegetation weight (0..1) splits desert,
 * prairie and boreal at data/earth/cover-density.json's thresholds. tests/cover-kind.test.ts checks this matches
 * the wasm cover_cell everywhere, so the viewer and the simulation agree on what grows at a landing.
 */
import { ARCTIC_TREE_LINE_M, iceLineM, treeLineM } from '../../core/altitudeZones';
import C from '../../../data/earth/cover-density.json';
import Z from '../../../data/earth/altitude-zones.json';

export type CoverKind = 'water' | 'ice' | 'tundra' | 'rock' | 'desert' | 'prairie' | 'boreal' | 'tropical' | 'wetland';

type Range = { stems_per_ha: number[]; height_m: number[] };
const M64 = (1n << 64n) - 1n;
const mul = (a: bigint, b: bigint) => (a * b) & M64;
const i64 = (v: number) => BigInt.asUintN(64, BigInt(Math.round(v * 1e5)));

/** Deterministic 0..1 from a place: the same splitmix64 on quantised lat/lon as cover.rs place_hash. */
export function placeHash(lat: number, lon: number): number {
  const a = i64(lat), b = i64(lon);
  const rotl = ((b << 29n) | (b >> 35n)) & M64;
  let z = mul(a, 0x9E3779B97F4A7C15n) ^ rotl ^ 0xB0E3A1n;
  z = mul(z ^ (z >> 30n), 0xBF58476D1CE4E5B9n);
  z = mul(z ^ (z >> 27n), 0x94D049BB133111EBn);
  z ^= z >> 31n;
  return Number(z >> 11n) / 2 ** 53;
}

export interface CoverRow { kind: CoverKind; stemsPerHa: number; heightM: number }

/** The full #167 row, same as cover.rs cover_row: class, stems per hectare, plant height (m). Deterministic per place. */
export function coverRow(latDeg: number, lonDeg: number, elevM: number, vegetation: number, water: boolean): CoverRow {
  const kind = coverKind(latDeg, elevM, vegetation, water);
  if (kind === 'water' || kind === 'ice' || kind === 'rock') return { kind, stemsPerHa: 0, heightM: 0 };
  const r = (C as unknown as Record<string, Range>)[kind];
  const h = placeHash(latDeg, lonDeg), h2 = placeHash(lonDeg, latDeg);
  const v = Math.min(1, Math.max(0, 0.5 * Math.min(1, Math.max(0, vegetation)) + 0.5 * h));
  const [s0, s1] = r.stems_per_ha, [t0, t1] = r.height_m;
  return { kind, stemsPerHa: Math.round(s0 + (s1 - s0) * v), heightM: t0 + (t1 - t0) * (0.5 * v + 0.5 * h2) };
}

/** Annual mean at the site (C), same as cover.rs site_mean_c: North 1975 sea-level mean minus lapse rate times height. */
export function siteMeanC(latDeg: number, elevM: number): number {
  const x = Math.sin(latDeg * Math.PI / 180);
  return Z.T0_C + Z.T2_C * (3 * x * x - 1) / 2 - Z.lapse_K_per_m * Math.max(0, elevM);
}

export function coverKind(latDeg: number, elevM: number, vegetation: number, water: boolean): CoverKind {
  if (water) return 'water';
  const lat = Math.abs(latDeg), elev = Math.max(0, elevM);
  if (elev >= iceLineM(lat)) return 'ice';
  const tree = treeLineM(lat);
  if (elev > tree) return tree < ARCTIC_TREE_LINE_M ? 'tundra' : 'rock'; // Arctic: tundra up to the ice line (#192)
  if (vegetation < C.veg_desert_below) return 'desert';
  if (vegetation < C.veg_prairie_below) return lat >= C.wetland_lat_min && elev < C.wetland_below_m ? 'wetland' : 'prairie';
  return siteMeanC(latDeg, elev) >= C.tropical_mean_C ? 'tropical' : 'boreal';
}

/**
 * Metres between billboards. Water, ice, tundra and rock place none.
 * Boreal 6 m is a closed stand: about 280 stems per hectare. A real closed
 * boreal stand is often 1,000–3,000 stems/ha (the crowns overlap at 6 m).
 * This is still a calibration, not the census in issue #167.
 */
export function coverSpacingM(kind: CoverKind): number | null {
  if (kind === 'boreal') return 6;
  if (kind === 'tropical') return 5;
  if (kind === 'wetland') return 14;
  if (kind === 'prairie') return 28;
  if (kind === 'desert') return 70;
  return null;
}

export interface CoverSpot { x: number; z: number; kind: CoverKind }

/**
 * A grid of billboard spots around the camera, between `inner` and `outer` metres.
 * Capped. Deterministic for a given centre and kind. The near meshes stay inside `inner`.
 */
export function coverSpots(cx: number, cz: number, kind: CoverKind, inner = 36, outer = 900, cap = 4096): CoverSpot[] {
  const step = coverSpacingM(kind);
  if (step == null) return [];
  const out: CoverSpot[] = [];
  const x0 = Math.floor((cx - outer) / step) * step;
  const z0 = Math.floor((cz - outer) / step) * step;
  for (let x = x0; x <= cx + outer; x += step) {
    for (let z = z0; z <= cz + outer; z += step) {
      const d = Math.hypot(x - cx, z - cz);
      if (d < inner || d > outer) continue;
      out.push({ x, z, kind });
    }
  }
  out.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  return out.slice(0, cap);
}
