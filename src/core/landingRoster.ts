/**
 * What to draw after a globe landing (issue #192).
 *
 * The simulation already lists the animals in a patch: `PlanetSim.landingPopulation`
 * (rust species.rs `landing_population`, wasm `landing_population`). This module only
 * chooses a capped handful of that list and stands them in front of the camera.
 * It does not invent a second density table. A species the list omits is not drawn.
 *
 * The census side is the bridge default (5 km). Counts from that square say who lives
 * here. The drawn count is capped so the existing picture ladder (six full meshes)
 * can show them in the first view.
 */
export const LANDING_CENSUS_SIDE_M = 5000;
export const LANDING_YEAR = 2026;
/** Individuals placed in the first view. One slot stays for the embodied animal's full mesh. */
export const LANDING_SHOWN_CAP = 5;
/** Metres ahead of the player, close enough to stand beside the wolf in the first view. */
export const LANDING_NEAR_M = 5;
export const LANDING_RING_M = 1.4;
export const LANDING_SIDE_M = 2.6;

/** Rust species id (LANDING_SPECIES) to the common name in src/core/species.ts and the model manifest. */
export const LANDING_DISPLAY: Record<string, string> = {
  snowshoe_hare: 'Snowshoe Hare',
  white_tailed_deer: 'White-tailed Deer',
  moose: 'Moose',
  canada_lynx: 'Canada Lynx',
  gray_wolf: 'Gray Wolf',
  caribou: 'Woodland Caribou',
  american_black_bear: 'American Black Bear',
  grizzly_bear: 'Grizzly Bear',
  bald_eagle: 'Bald Eagle',
  beaver: 'Beaver',
  red_fox: 'Red Fox',
  arctic_fox: 'Arctic Fox',
};

/** One of each role first, so a prairie is not eight hares and a forest is not only mice. */
const ROLE: Record<string, 'herb' | 'pred' | 'small' | 'bird'> = {
  snowshoe_hare: 'small',
  white_tailed_deer: 'herb',
  moose: 'herb',
  canada_lynx: 'pred',
  gray_wolf: 'pred',
  caribou: 'herb',
  american_black_bear: 'pred',
  grizzly_bear: 'pred',
  bald_eagle: 'bird',
  beaver: 'small',
  red_fox: 'pred',
  arctic_fox: 'pred',
};

export interface CensusRow { species: string; count: number }

export interface LandingSlot { key: string; display: string; census: number }

export interface PlacedAnimal extends LandingSlot {
  index: number;
  x: number;
  z: number;
  /** Broadside to the view, so the body reads in the first frame. Radians, same yaw as the wolf. */
  yaw: number;
}

/**
 * Up to `cap` slots from the simulation list. One animal per role (the commonest in that role),
 * then the remaining species by count. Never a species with count 0, never a key the bridge does not name.
 */
export function pickLandingSlots(pop: readonly CensusRow[], cap = LANDING_SHOWN_CAP): LandingSlot[] {
  const live = pop.filter(row => row.count > 0 && LANDING_DISPLAY[row.species]);
  const best = new Map<string, CensusRow>();
  for (const row of live) {
    const role = ROLE[row.species] ?? 'small';
    const prev = best.get(role);
    if (!prev || row.count > prev.count) best.set(role, row);
  }
  const chosen: CensusRow[] = [];
  const seen = new Set<string>();
  for (const row of best.values()) {
    if (chosen.length >= cap) break;
    chosen.push(row);
    seen.add(row.species);
  }
  const rest = live.filter(row => !seen.has(row.species)).sort((a, b) => b.count - a.count || a.species.localeCompare(b.species));
  for (const row of rest) {
    if (chosen.length >= cap) break;
    chosen.push(row);
  }
  return chosen.map(row => ({ key: row.species, display: LANDING_DISPLAY[row.species], census: row.count }));
}

/**
 * Stand the slots in front of the player. Forward matches the game camera: the lens sits at
 * +sin(yaw), +cos(yaw), so ahead is the opposite. A wet spot is skipped, not dropped in the water.
 * The same inputs return the same places.
 */
export function placeLandingAnimals(
  slots: readonly LandingSlot[],
  origin: { x: number; z: number; yaw: number },
  dry: (x: number, z: number) => boolean,
): PlacedAnimal[] {
  const yaw = origin.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const out: PlacedAnimal[] = [];
  slots.forEach((slot, index) => {
    let fallback: { x: number; z: number } | null = null;
    for (let ring = 0; ring < 8; ring++) {
      const dist = LANDING_NEAR_M + (index % 3) * LANDING_RING_M + ring * 2.5;
      const side = ((index % 5) - 2) * LANDING_SIDE_M + (ring % 2) * 1.2;
      const x = origin.x + fx * dist + rx * side;
      const z = origin.z + fz * dist + rz * side;
      const ahead = (x - origin.x) * fx + (z - origin.z) * fz;
      if (ahead < 4) continue;
      if (!fallback) fallback = { x, z };
      if (!dry(x, z)) continue;
      out.push({ ...slot, index, x, z, yaw: yaw + Math.PI / 2 });
      return;
    }
    // The player is already standing here. A cast the list named is not dropped when the arc is wet.
    if (fallback) out.push({ ...slot, index, x: fallback.x, z: fallback.z, yaw: yaw + Math.PI / 2 });
  });
  return out;
}
