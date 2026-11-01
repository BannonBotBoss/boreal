import { hash, random } from './random';
import { ANIMAL_DEFAULT_ENERGY } from './animalBehavior';
import { surfaceDetail } from './surface';
import type { Kind } from './catalog';
import { LEVEL } from './tuning';
import { groundPlantsGrowAt, plantsGrowAt } from './altitudeZones';
import { STAGES, elevationGrid, flowGrid, lakeAt, sampleGrid, toWorld } from './stages/elevation';
import { cellAt, twi } from './stages/flow';
import { carve, pondAt, riverAt } from './stages/rivers';
import { soilAt, type SoilKind } from './stages/soils';
import { fastRockSite, placeRockSeed, withRockTier } from './rocks';
import { stepsInRect } from './stages/channelRough';
import { f, choose, scope, tracing } from '../proc/trace';
import { siteAt } from './flora/site';
import { berrySuit } from './forageLight';
import { remoteGameHeight } from './siteHeight';
import { SITE, siteSalt } from './sitePhase';
export const GENERATOR_VERSION = 1;
export const WORLD_SEED = 1400;
export const CHUNK_SIZE = 40;
export interface Entity {
  key: string; kind: Kind; seed: number; generatorVersion: number;
  x: number; z: number; rotation: number; scale: number;
  energy?: number; rollX?: number; rollZ?: number;
}
export function riverCenter(z: number) { return 45 + Math.sin(z / 44) * 17; }
/** Legacy river gaussian scale² (m²). heightAt carves exp(−d² / this) about riverCenter. One constant, shared with the why. */
export const LEGACY_RIVER_FOLD2 = 110;
const T = 'terrain';
/** One stacked terrain layer: traced contribution = (overridable) amplitude x shape. */
const layer = (name: string, shape: number, amp: number) => f(T, name, shape * f(T, `amp.${name}`, amp));
export function heightAt(x: number, z: number) {
  const remote = remoteGameHeight(x, z);
  if (remote !== null) return remote; // a landing off the home square: the planet sample, not the Kenora grid
  if (STAGES.on) { // stage 1 (core/stages/elevation): eroded coarse grid mapped so the lowest 8 % is open water and the top 15 % is upland rock (Shield ridges)
    const g = elevationGrid(STAGES.seed);
    if (tracing()) { const fl = flowGrid(STAGES.seed), c = cellAt(fl, x, z); f('hydrology', 'flow accumulation (cells)', fl.acc[c]); f('hydrology', 'upslope area (ha)', fl.acc[c] * fl.cell * fl.cell / 1e4);
      f('hydrology', 'fill depth (m)', fl.filled[c] - g.h[c]); f('hydrology', 'TWI ln(a/tanβ)', twi(fl, c)); f('hydrology', 'D8 receiver', fl.dir[c]); const lk = lakeAt(STAGES.seed, x, z); if (lk) { f('hydrology', 'water body', `${lk.kind} #${lk.body}`); f('hydrology', 'water area (ha)', lk.areaHa); f('hydrology', 'max depth (m)', lk.maxDepth); }
      const pond = pondAt(STAGES.seed, x, z); if (pond) { f('hydrology', 'river pond', `${pond.kind} #${pond.body}`); f('hydrology', 'pond why', pond.why.join(' -> ')); f('hydrology', 'pond spill (m)', pond.surface); f('hydrology', 'pond depth (m)', pond.maxDepth); }
      f('hydrology', 'grid build (ms)', Math.round(g.ms + fl.ms));
      const rv = riverAt(STAGES.seed, x, z); if (rv) { f('hydrology', 'river Strahler order', rv.order); f('hydrology', 'river basin (km2)', rv.areaKm2); f('hydrology', 'river width (m)', rv.half * 2); f('hydrology', 'river depth (m)', rv.depth); f('hydrology', 'river speed (m/s)', rv.speed); f('hydrology', 'distance to centreline (m)', rv.d); }
      const so = soilAt(STAGES.seed, x, z); f('soil', 'material', so.label); f('soil', 'landscape (Gharari 2011)', so.landscape); f('soil', 'HAND (m)', so.hand); f('soil', 'slope (m/m)', so.slope); f('soil', 'TWI', so.twi); f('soil', 'flow distance to drainage (m)', so.dist); f('soil', 'site wetness', so.wet); }
    const h = f(T, 'stage1 elevation', toWorld(g, sampleGrid(g, x, z))) + f(T, 'depressions', surfaceDetail(x, z)) * .5, rv = riverAt(STAGES.seed, x, z); // stage 2c: rivers carve their channel
    return rv ? f(T, 'river carve', carve(h, rv)) : h; }
  const distance = Math.abs(x - riverCenter(z));
  const land = f(T, 'base', 1.8) + layer('ridgesX', Math.sin(x * .043), 1.4) + layer('ridgesZ', Math.cos(z * .038), 1.3)
    + layer('ripples', Math.sin(x * .13 + z * .09), .28);
  return land - layer('riverCarve', Math.exp(-(distance * distance) / LEGACY_RIVER_FOLD2), 5.8) + f(T, 'depressions', surfaceDetail(x, z));
}
/** Terrain band from the tuning thresholds (colour, water); thresholds are traced so the inspector can what-if them. */
export function terrainBand(y: number, x?: number, z?: number): 'water' | 'shore' | 'upland' | 'forest' | SoilKind {
  if (STAGES.on && x !== undefined && z !== undefined) { if (y < LEVEL.waterSurface || lakeAt(STAGES.seed, x, z) || pondAt(STAGES.seed, x, z)) return 'water'; return f('biome', 'stage-3 material', soilAt(STAGES.seed, x, z).kind); } // staged: bands are materials, not heights
  return y < f('biome', 'level.waterSurface', LEVEL.waterSurface) ? 'water' : y < f('biome', 'level.shore', LEVEL.shore) ? 'shore'
    : y > f('biome', 'level.upland', LEVEL.upland) ? 'upland' : 'forest';
}
/** Inside a stage-2c channel (bed or the inner bank). */
const inRiver = (x: number, z: number) => { const r = riverAt(STAGES.seed, x, z); return !!r && r.d < r.half + 1; };
/** Revalidate land-bound encounters after restoring old events against the current terrain. */
export const isDryLand = (x: number, z: number, h = heightAt(x, z)) => h >= LEVEL.shore
  && !(STAGES.on && (lakeAt(STAGES.seed, x, z) || pondAt(STAGES.seed, x, z) || inRiver(x, z)));
export const chunkSeed = (cx: number, cz: number, worldSeed = WORLD_SEED) => {
  const salt = siteSalt(); // 0 at home, so the hashed string (and the chunk digest) stays the one the tests pin
  const body = `${GENERATOR_VERSION}:${f('chunk', 'worldSeed', worldSeed)}:${cx}:${cz}`;
  return f('chunk', 'chunkSeed', hash(salt ? `${body}:${salt}` : body));
};
/** Candidate roll -> kind (cumulative weights; one data table). */
export const KIND_TABLE = [['spruce', .60], ['rock', .80], ['log', .91], ['plant', .97], ['deer', .995], ['person', 1]] as const;
export function generateChunk(cx: number, cz: number, worldSeed = WORLD_SEED): Entity[] {
  const rng = random(chunkSeed(cx, cz, worldSeed));
  const result: Entity[] = [];
  for (let i = 0; i < 35; i++) {
    scope(`${cx}:${cz}:${i}`);
    const x = f('draw', 'x', (cx + rng()) * CHUNK_SIZE), z = f('draw', 'z', (cz + rng()) * CHUNK_SIZE);
    const roll = rng(), rawSeed = f('draw', 'seed', Math.floor(rng() * 0xffffffff)), rotation = f('draw', 'rotation', rng() * Math.PI * 2);
    const scale = f('draw', 'scale', .75 + rng() * .65);
    const h = heightAt(x, z);
    if (!isDryLand(x, z, h) || Math.hypot(x, z) < 13) continue;
    const kind: Kind = choose('draw', 'kind', roll, KIND_TABLE);
    if ((kind === 'spruce' || kind === 'log' || kind === 'deer') && !plantsGrowAt(h)) continue; // T-0072: above the tree line no trees. Deer use the same line.
    if (kind === 'plant' && !groundPlantsGrowAt(h)) continue; // herbs grow on Arctic tundra too, not on mountain rock or ice
    // Herbs: a separate stream so a rejection does not shift later trees, rocks or deer. Acceptance probability is site light.
    if (kind === 'plant') {
      const site = siteAt(x, z, true, false), keep = random(hash(`herb-light:${worldSeed}:${cx}:${cz}:${i}`))();
      if (site.water || keep >= Math.min(1, Math.max(0, site.light))) continue;
    }
    const seed = kind === 'rock' ? placeRockSeed(x, z, h, rawSeed, true) : rawSeed;
    if (seed === undefined) continue;
    result.push({ key: `${cx}:${cz}:${i}`, kind, seed, generatorVersion: GENERATOR_VERSION, x, z, rotation, scale });
  }
  // Independent detail stream preserves existing trees and encounter identities; parent-offspring clustering on till, continuous outcrops on Shield bedrock.
  const stones = random(hash(`stones-v1:${worldSeed}:${cx}:${cz}`));
  const parents: [number, number][] = [];
  for (let i = 0; i < 120; i++) {
    scope(`stones:${cx}:${cz}:${i}`);
    const u1 = stones(), u2 = stones();
    let x = (cx + u1) * CHUNK_SIZE, z = (cz + u2) * CHUNK_SIZE;
    if (i < 16) parents.push([x, z]);
    else if (!STAGES.on || fastRockSite(x, z).rock < .35) {
      const [px, pz] = parents[i % 16];
      x = Math.min((cx + 1) * CHUNK_SIZE - .5, Math.max(cx * CHUNK_SIZE + .5, px + (u1 - .5) * 4));
      z = Math.min((cz + 1) * CHUNK_SIZE - .5, Math.max(cz * CHUNK_SIZE + .5, pz + (u2 - .5) * 4));
    }
    x = f('draw', 'x', x); z = f('draw', 'z', z);
    const rawSeed = f('draw', 'seed', Math.floor(stones() * 0xffffffff)), rotation = f('draw', 'rotation', stones() * Math.PI * 2);
    const h = heightAt(x, z);
    const seed = h > LEVEL.shore ? placeRockSeed(x, z, h, rawSeed, false) : undefined;
    if (seed !== undefined) result.push({ key: `stones:${cx}:${cz}:${i}`, kind: 'rock', seed,
      generatorVersion: GENERATOR_VERSION, x, z, rotation, scale: 1 });
  }
  // T-0015: every draw happens even when the point is refused, so a dark gap does not slide the next bush.
  // keep < berrySuit(light): Hall et al. 1979, no flowers below half sun. Re-pins the chunk digest (tests/proc.test.ts).
  const forage = random(hash(`forage-v1:${worldSeed}:${cx}:${cz}`));
  for (let i = 0; i < 22; i++) {
    scope(`forage:${cx}:${cz}:${i}`);
    const x = f('draw', 'x', (cx + forage()) * CHUNK_SIZE), z = f('draw', 'z', (cz + forage()) * CHUNK_SIZE);
    const seed = f('draw', 'seed', Math.floor(forage() * 0xffffffff));
    const keep = f('draw', 'keep', forage()), rotation = f('draw', 'rotation', forage() * Math.PI * 2);
    const scale = f('draw', 'scale', .65 + forage() * .35), h = heightAt(x, z), site = siteAt(x, z, true, false);
    if (isDryLand(x, z, h) && groundPlantsGrowAt(h) && !site.water && keep < berrySuit(site.light))
      result.push({ key: `forage:${cx}:${cz}:${i}`, kind: 'forage', x, z, seed, generatorVersion: 1, rotation, scale });
  }
  // T-0030: a steep channel (S > 0.02) exposes a Shield boulder. The ordinary stone stream stays on dry land.
  if (STAGES.on && !SITE.remote) for (const step of stepsInRect(STAGES.seed, cx * CHUNK_SIZE, cz * CHUNK_SIZE, (cx + 1) * CHUNK_SIZE, (cz + 1) * CHUNK_SIZE)) {
    const raw = hash(`channel-step:${worldSeed}:${step.x.toFixed(3)}:${step.z.toFixed(3)}`);
    result.push({
      key: `step:${step.x.toFixed(2)}:${step.z.toFixed(2)}`, kind: 'rock', seed: withRockTier(raw, step.tier),
      generatorVersion: GENERATOR_VERSION, x: step.x, z: step.z, rotation: random(raw)() * Math.PI * 2, scale: 1,
    });
  }
  scope('');
  for (const entity of result) if (entity.kind === 'deer') entity.energy = ANIMAL_DEFAULT_ENERGY;
  return result;
}
