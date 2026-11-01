/**
 * Shore fallback for a water landing (#192, grokbot-3 finding 3).
 *
 * The landing census asks the simulation for the animals in a 5 km square around the player. When the point under the
 * player is a lake or the sea, that ask returns an empty list, although most of the square around a lake landing is
 * shore. This helper walks rings of eight compass points outwards (within half the census side, so the answer stays
 * inside the same square) and returns the first dry sample, nearest ring first. No dry point means open water: the
 * caller keeps the empty list rather than inventing animals.
 */
export interface GroundSample { lat: number; lon: number; water: boolean }

const M_PER_DEG = 111_320;
/** Ring radii (m). The last is 2.5 km, half the 5 km census side. */
export const SHORE_RINGS_M = [150, 300, 600, 1200, 2500] as const;

export function nearestShore<T extends GroundSample>(lat: number, lon: number, sample: (lat: number, lon: number) => T): T | null {
  const cosLat = Math.max(0.01, Math.cos(lat * Math.PI / 180));
  for (const r of SHORE_RINGS_M) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const s = sample(lat + r * Math.cos(a) / M_PER_DEG, lon + r * Math.sin(a) / (M_PER_DEG * cosLat));
      if (!s.water) return s;
    }
  }
  return null;
}
