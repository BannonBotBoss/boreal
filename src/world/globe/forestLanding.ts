/**
 * Where the seated drop puts the mama (issue #290).
 *
 * Her stored territory mark faces the shore. The camera sits behind her, so the
 * picture is open ground. The animal store has no den. The den is the closed
 * stand nearest that mark: dry land, canopy from the fire-patch stand, and the
 * drawn spruce cover. The landing is the edge of that stand, facing in, outside
 * the origin clearing where chunks draw no trees. A double-click still drops on
 * the point that was clicked. Nothing is placed for the camera.
 */
import { plantsGrowAt } from '../../core/altitudeZones';
import { livingRoster } from '../../core/enterLiving';
import { treesAround } from '../../core/ground';
import { standAt } from '../../core/stand';
import { isDry } from '../../core/stages/surfaceAt';
import { heightAt } from '../../core/world';
import { viewBlocked } from './handoff';

export const FOREST_LANDING = {
  searchM: 220,
  stepM: 12,
  /** The origin chunk draws no trees inside 13 m. Stay outside that hole. */
  clearM: 15,
  closedCanopy: 0.7,
  minStems: 8,
  edgeMinM: 16,
  edgeMaxM: 36,
  stemR: 14,
};

export interface ForestSpot { x: number; z: number; yaw: number; canopy: number; stems: number }
export interface ForestLanding { den: ForestSpot; land: ForestSpot }

const round = (v: number) => Math.round(v * 10) / 10;

/** The territory holder. Her own id is the territory id. */
export function mamaTerritory(): { x: number; z: number } {
  const roster = livingRoster();
  const mama = roster.find(a => a.species === 'wolf' && a.territory === a.handle) ?? roster.find(a => a.species === 'wolf');
  return mama ? { x: mama.x, z: mama.z } : { x: 0, z: 0 };
}

function usable(x: number, z: number) {
  if (Math.hypot(x, z) < FOREST_LANDING.clearM) return false;
  return isDry(x, z) && plantsGrowAt(heightAt(x, z));
}

function stemsNear(x: number, z: number, radius = FOREST_LANDING.stemR) {
  let n = 0;
  const r2 = radius * radius;
  for (const t of treesAround(x, z)) if ((t.x - x) ** 2 + (t.z - z) ** 2 <= r2) n++;
  return n;
}

/** Trees in front of a heading, and trees behind it. The camera sits behind. */
export function standEitherSide(x: number, z: number, yaw: number) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let ahead = 0, rear = 0;
  for (const t of treesAround(x, z)) {
    const dx = t.x - x, dz = t.z - z, d = Math.hypot(dx, dz);
    if (d > 26 || d < 3) continue;
    const along = dx * fx + dz * fz;
    if (along > 3) ahead++;
    else if (along < -3) rear++;
  }
  return { ahead, rear };
}

/**
 * Den and the edge to land on, around the mama's territory.
 * The den maximises drawn stems on a closed canopy, preferring a nearer stand.
 * The edge is 16–36 m out, still in the stand, facing the den, with the camera line clear.
 */
let landingMemo: { key: string; value: ForestLanding } | null = null;
export function forestLanding(around: { x: number; z: number } = mamaTerritory()): ForestLanding {
  const key = `${around.x},${around.z}`;
  if (landingMemo?.key === key) return landingMemo.value;
  const value = findForestLanding(around);
  landingMemo = { key, value };
  return value;
}
function findForestLanding(around: { x: number; z: number }): ForestLanding {
  const { searchM, stepM, closedCanopy, minStems, edgeMinM, edgeMaxM } = FOREST_LANDING;
  let den: { x: number; z: number; stems: number; canopy: number; score: number } | null = null;
  for (let r = 0; r <= searchM; r += stepM) {
    const k = r === 0 ? 1 : Math.max(8, Math.round(2 * Math.PI * r / stepM));
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const x = around.x + Math.cos(a) * r, z = around.z + Math.sin(a) * r;
      if (!usable(x, z)) continue;
      const canopy = standAt(x, z).canopy;
      const stems = stemsNear(x, z);
      if (canopy < closedCanopy || stems < minStems) continue;
      const score = stems * canopy - Math.hypot(x - around.x, z - around.z) / 50;
      if (!den || score > den.score) den = { x, z, stems, canopy, score };
    }
  }
  const denX = den?.x ?? around.x, denZ = den?.z ?? around.z;
  const denStems = den?.stems ?? stemsNear(denX, denZ);
  const denCanopy = den?.canopy ?? standAt(denX, denZ).canopy;
  let edge: { x: number; z: number; yaw: number; stems: number; score: number } | null = null;
  for (let r = edgeMinM; r <= edgeMaxM; r += 4) {
    const k = Math.max(8, Math.round(2 * Math.PI * r / 8));
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const x = denX + Math.cos(a) * r, z = denZ + Math.sin(a) * r;
      if (!usable(x, z)) continue;
      const stems = stemsNear(x, z, 16);
      if (stems < 4) continue;
      const dx = denX - x, dz = denZ - z, dist = Math.hypot(dx, dz) || 1;
      const yaw = Math.atan2(-dx / dist, -dz / dist);
      const { ahead, rear } = standEitherSide(x, z, yaw);
      if (ahead < 6) continue;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      if (!usable(x + fx * 8, z + fz * 8)) continue;
      let close = 0;
      for (const t of treesAround(x, z)) {
        const dx = t.x - x, dz = t.z - z, d = Math.hypot(dx, dz);
        const along = dx * fx + dz * fz;
        if (d < 16 && along > 3 && along < 14) close++;
      }
      if (close < 3) continue;
      const open = viewBlocked(x, z, yaw, treesAround(x, z)) ? 0 : 8;
      const score = close * 4 + ahead * 2 - rear + stems * 0.25 + open;
      if (!edge || score > edge.score) edge = { x, z, yaw, stems, score };
    }
  }
  const landX = edge?.x ?? denX, landZ = edge?.z ?? denZ;
  const yaw = edge?.yaw ?? 0;
  return {
    den: { x: round(denX), z: round(denZ), yaw, canopy: denCanopy, stems: denStems },
    land: { x: round(landX), z: round(landZ), yaw, canopy: standAt(landX, landZ).canopy, stems: edge?.stems ?? denStems },
  };
}
