/**
 * Ground cover class, one rule shared with the simulation (rust/boreal-sim/src/cover.rs, issue #167).
 *
 * Classes come from causes, not latitude bands: below the ice line (warm season under 0 C) is ice; above the
 * tree line is rock in mountains and tundra where the tree line is already near sea level (Koerner and Paulsen
 * 2004, core/altitudeZones). Below the tree line the planet sample's vegetation weight (0..1) splits desert,
 * prairie and boreal at data/earth/cover-density.json's thresholds. tests/cover-kind.test.ts checks this matches
 * the wasm cover_cell everywhere, so the viewer and the simulation agree on what grows at a landing.
 */
import { iceLineM, treeLineM } from '../../core/altitudeZones';
import C from '../../../data/earth/cover-density.json';

export type CoverKind = 'water' | 'ice' | 'tundra' | 'rock' | 'desert' | 'prairie' | 'boreal';

export function coverKind(latDeg: number, elevM: number, vegetation: number, water: boolean): CoverKind {
  if (water) return 'water';
  const lat = Math.abs(latDeg), elev = Math.max(0, elevM);
  if (elev >= iceLineM(lat)) return 'ice';
  const tree = treeLineM(lat);
  if (elev > tree) return tree < 80 && elev < tree + 300 ? 'tundra' : 'rock';
  if (vegetation < C.veg_desert_below) return 'desert';
  if (vegetation < C.veg_prairie_below) return 'prairie';
  return 'boreal';
}

/**
 * Metres between billboards. Water, ice, tundra and rock place none.
 * Boreal 6 m is a closed stand: about 280 stems per hectare. A real closed
 * boreal stand is often 1,000–3,000 stems/ha (the crowns overlap at 6 m).
 * This is still a calibration, not the census in issue #167.
 */
export function coverSpacingM(kind: CoverKind): number | null {
  if (kind === 'boreal') return 6;
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
