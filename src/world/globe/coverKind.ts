/**
 * Placeholder ground cover until Grokbot-1 publishes per-place densities.
 *
 * The bands follow breaks the globe colour already uses (surfaceColour:
 * temperate south of 45° N, tundra north of 60°). The tree line and the ice
 * line are the existing latitude functions (core/altitudeZones, Koerner and
 * Paulsen 2004; the lapse rate already cited there). Vegetation is
 * vegetationWeight from the planet sample, 0..1.
 *
 * This is not a species range. Densities below are labelled calibration so the
 * picture has a rule today. The issue filed for Grokbot-1 replaces them.
 */
import { iceLineM, treeLineM } from '../../core/altitudeZones';

export type CoverKind = 'water' | 'ice' | 'tundra' | 'rock' | 'desert' | 'prairie' | 'boreal';

export function coverKind(latDeg: number, elevM: number, vegetation: number, water: boolean): CoverKind {
  if (water) return 'water';
  const lat = Math.abs(latDeg);
  if (lat >= 75 || elevM >= iceLineM(lat)) return 'ice';
  // Strictly above the tree line is rock. At 60° N the line is already at sea level, so a low
  // site there is tundra, not a cliff of rock.
  if (elevM > treeLineM(lat) + 80) return 'rock';
  if (lat >= 60 && vegetation < 0.45) return 'tundra';
  if (lat < 32 && vegetation < 0.28) return 'desert';
  if (lat < 48 && vegetation < 0.62) return 'prairie';
  return 'boreal';
}

/** Metres between billboards. Water, ice, tundra and rock place none. */
export function coverSpacingM(kind: CoverKind): number | null {
  if (kind === 'boreal') return 14;
  if (kind === 'prairie') return 46;
  if (kind === 'desert') return 70;
  return null;
}

export interface CoverSpot { x: number; z: number; kind: CoverKind }

/**
 * A grid of billboard spots around the camera, between `inner` and `outer` metres.
 * Capped. Deterministic for a given centre and kind. The near meshes stay inside `inner`.
 */
export function coverSpots(cx: number, cz: number, kind: CoverKind, inner = 36, outer = 520, cap = 480): CoverSpot[] {
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
