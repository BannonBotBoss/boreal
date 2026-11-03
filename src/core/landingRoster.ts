/**
 * What to draw after a globe landing (issue #192).
 *
 * The simulation already lists the animals in a patch: `PlanetSim.landingPopulation`
 * (rust species.rs `landing_population`, wasm `landing_population`). This module only
 * chooses a capped handful of that list and stands them in front of the camera.
 * It does not invent a second density table. A species the list omits is not drawn.
 *
 * Species ranges in the simulation cover North America only. A landing outside those
 * ranges shows only what `landingPopulation` returns, which may be nothing. This module
 * does not add stand-in animals for other continents.
 *
 * The census side is the bridge default (5 km). Counts from that square say who lives
 * here. The drawn count is capped so the existing picture ladder (six full meshes)
 * can show them in the first view.
 *
 * The follow camera sits `camera.riderDistance` behind the wolf (48° vertical, 16:9).
 * A lone species used to be slot 0, 5.2 m to the side at 5 m ahead, so its body sat on
 * the frame edge (desert fox) or out of the frame in cover (tropics deer). Slots are
 * now centred on the aim, inside that cone, at a distance the full mesh still draws.
 */
import { SYSTEM_PROPERTIES } from '../config/systemProperties';

export const LANDING_CENSUS_SIDE_M = 5000;
export const LANDING_YEAR = 2026;
/** Individuals placed in the first view. One slot stays for the embodied animal's full mesh. */
export const LANDING_SHOWN_CAP = 5;
/** Metres ahead of the player. Camera distance stays inside the full-mesh band (16 m). */
export const LANDING_READ_M = 7.2;
export const LANDING_AHEAD_MIN = 4.5;
/** Far edge of the readable band. Past this, a wet arc may walk out to a dry bank. */
export const LANDING_AHEAD_BAND = 11;
/** Half-width of a broadside body, so the whole animal stays inside the frame. */
export const LANDING_BODY_HALF_M = 0.9;
/** Follow camera, the same numbers `positionCamera` uses. */
export const LANDING_CAM_BACK_M = SYSTEM_PROPERTIES.camera.riderDistance;
export const LANDING_CAM_EYE_M = SYSTEM_PROPERTIES.camera.riderHeight;
export const LANDING_CAM_FOV_DEG = 48;
export const LANDING_CAM_ASPECT = 16 / 9;
/** Grass and low plants dropped around each spawn so the body is not buried. */
export const LANDING_CLEAR_R_M = 2.4;
/**
 * How many steps to walk looking for dry ground. Fourteen steps of 2.5 m stay inside the
 * picture's low-body distance (~48 m), so a lake bank still reads as a body instead of a speck.
 */
export const LANDING_DRY_RINGS = 14;
/** Gap between neighbours, metres. Five animals then span about ±3.3 m, inside the cone. */
const LANDING_GAP_M = 1.65;
/** Readable-band search: ahead offset, then side offset, ideal first. */
const LANDING_NUDGE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 0.9], [0, -0.9],
  [0.7, 1.7], [0.7, -1.7],
  [-0.7, 1.7], [-0.7, -1.7],
  [1.4, 0], [-1.1, 0],
  [1.3, 2.2], [1.3, -2.2],
];

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

/** Half the horizontal field of the follow camera, radians. */
export function landingHalfHoriz(fovDeg = LANDING_CAM_FOV_DEG, aspect = LANDING_CAM_ASPECT) {
  return Math.atan(Math.tan((fovDeg * Math.PI) / 360) * aspect);
}

/** Lateral metres that still leave a broadside body inside the frame at `ahead` metres. */
export function landingSideRoom(aheadM: number) {
  const depth = aheadM + LANDING_CAM_BACK_M;
  const limit = Math.max(0.2, landingHalfHoriz() - 0.12);
  return Math.max(0.8, depth * Math.tan(limit) - LANDING_BODY_HALF_M);
}

/** Ahead (along the aim) and side (to the right of the aim) of a point, in metres. */
export function landingOffsets(origin: { x: number; z: number; yaw: number }, x: number, z: number) {
  const fx = -Math.sin(origin.yaw), fz = -Math.cos(origin.yaw);
  const rx = Math.cos(origin.yaw), rz = -Math.sin(origin.yaw);
  const dx = x - origin.x, dz = z - origin.z;
  return { ahead: dx * fx + dz * fz, side: dx * rx + dz * rz };
}

/**
 * True when a broadside body at (x, z) is inside the follow camera's frame.
 * The chest is `chest` metres above the ground the feet stand on. A point behind
 * the wolf, or whose body crosses the frame edge, is not in frame.
 */
export function landingInFrame(origin: { x: number; z: number; yaw: number }, x: number, z: number, chest = 0.7) {
  const { ahead, side } = landingOffsets(origin, x, z);
  if (ahead < 3.5) return false;
  const depth = ahead + LANDING_CAM_BACK_M;
  const edge = Math.atan2(Math.abs(side) + LANDING_BODY_HALF_M, depth);
  if (edge >= landingHalfHoriz() - 0.04) return false;
  const pitch = SYSTEM_PROPERTIES.camera.defaultPitchDeg * Math.PI / 180;
  const lookUp = -pitch;
  const fromLook = Math.atan2(chest - LANDING_CAM_EYE_M, depth) - lookUp;
  const halfV = (LANDING_CAM_FOV_DEG * Math.PI) / 360;
  return Math.abs(fromLook) < halfV - 0.03;
}

/** Feet sit on the ground sample. A missing sample stays at 0 rather than sinking to NaN. */
export function landingStandY(groundY: number) {
  return Number.isFinite(groundY) ? groundY : 0;
}

export interface LandingClear { x: number; z: number; r: number }
/** Camera-to-animal corridor. Plants on this segment hide the body even when the feet are clear. */
export interface LandingSight { x0: number; z0: number; x1: number; z1: number; r: number }
let clears: LandingClear[] = [];
let sights: LandingSight[] = [];

/** Discs the viewer uses to drop grass, flowers and the nearest trunks at the spawn. */
export function setLandingClear(next: readonly LandingClear[]) {
  clears = next.slice(0, LANDING_SHOWN_CAP).map(d => ({ x: d.x, z: d.z, r: d.r }));
}
export function landingClearDiscs(): readonly LandingClear[] { return clears; }

/** Corridors from the follow camera to each animal. The viewer drops plants that stand in them. */
export function setLandingSight(next: readonly LandingSight[]) {
  sights = next.slice(0, LANDING_SHOWN_CAP).map(s => ({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, r: s.r }));
}
export function landingSightLines(): readonly LandingSight[] { return sights; }

/** True when (x, z) is within `extra` metres of a camera-to-animal corridor. */
export function landingOnSight(x: number, z: number, extra = 0) {
  for (const s of sights) {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0;
    const L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.x0) * dx + (z - s.z0) * dz) / L2));
    const qx = s.x0 + t * dx, qz = s.z0 + t * dz;
    const px = x - qx, pz = z - qz;
    const r = s.r + extra;
    if (px * px + pz * pz < r * r) return true;
  }
  return false;
}

/** True when (x, z) lies in a spawn disc grown by `extra` metres. */
export function landingClearAt(x: number, z: number, extra = 0) {
  for (const d of clears) {
    const r = d.r + extra;
    const dx = x - d.x, dz = z - d.z;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

/** Grass uses the disc. Flowers grow the disc a little. A trunk grows it enough to drop the stem beside the body. */
export function landingHidesCover(x: number, z: number, kind: 'grass' | 'plant' | 'spruce') {
  const extra = kind === 'spruce' ? 1.1 : kind === 'plant' ? 0.4 : 0;
  if (landingClearAt(x, z, extra)) return true;
  return landingOnSight(x, z, kind === 'spruce' ? 0.5 : 0);
}

/**
 * Stand the slots in front of the player, centred on the aim. Forward matches the game
 * camera: the lens sits at +sin(yaw), +cos(yaw), so ahead is the opposite. A wet cell
 * in that cone is skipped. `open` rejects a trunk or a rock; the nearest open cell in
 * the cone wins, and a fully closed cone still stands the animal so the viewer can
 * clear the plants. Only a fully wet cone walks out to a dry bank. The same inputs
 * return the same places. Yaw is broadside, so the profile faces the lens.
 */
export function placeLandingAnimals(
  slots: readonly LandingSlot[],
  origin: { x: number; z: number; yaw: number },
  dry: (x: number, z: number) => boolean,
  open?: (x: number, z: number) => boolean,
): PlacedAnimal[] {
  const yaw = origin.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const n = slots.length;
  const gap = n <= 1 ? 0 : LANDING_GAP_M;
  const at = (ahead: number, side: number) => ({
    x: origin.x + fx * ahead + rx * side,
    z: origin.z + fz * ahead + rz * side,
  });
  const out: PlacedAnimal[] = [];
  slots.forEach((slot, index) => {
    // One animal on the aim stands directly behind the embodied wolf. A couple of metres
    // to the right puts the whole body beside the wolf and still inside the frame.
    const side0 = n <= 1 ? 2.05 : (index - (n - 1) / 2) * gap;
    const push = (x: number, z: number) => out.push({ ...slot, index, x, z, yaw: yaw + Math.PI / 2 });
    const readable: { x: number; z: number; open: boolean }[] = [];
    for (const [da, ds] of LANDING_NUDGE) {
      const ahead = LANDING_READ_M + da;
      const side = side0 + ds;
      if (ahead < LANDING_AHEAD_MIN || ahead > LANDING_AHEAD_BAND) continue;
      if (Math.abs(side) > landingSideRoom(ahead)) continue;
      const p = at(ahead, side);
      if (!dry(p.x, p.z)) continue;
      readable.push({ ...p, open: !open || open(p.x, p.z) });
    }
    const best = readable.find(p => p.open) ?? readable[0];
    if (best) { push(best.x, best.z); return; }
    const far = (requireOpen: boolean) => {
      for (let ring = 0; ring < LANDING_DRY_RINGS; ring++) {
        const ahead = LANDING_AHEAD_BAND + 2 + ring * 2.5;
        if (ahead > 46) return false;
        const side = side0 * Math.min(1, LANDING_READ_M / ahead);
        if (Math.abs(side) > landingSideRoom(Math.min(ahead, 18))) continue;
        const p = at(ahead, side);
        if (!dry(p.x, p.z)) continue;
        if (requireOpen && open && !open(p.x, p.z)) continue;
        push(p.x, p.z);
        return true;
      }
      return false;
    };
    if (far(true) || far(false)) return;
    // The player is already standing here. A cast the list named is not dropped when the cone is wet.
    const fallback = at(LANDING_READ_M, side0);
    push(fallback.x, fallback.z);
  });
  return out;
}
