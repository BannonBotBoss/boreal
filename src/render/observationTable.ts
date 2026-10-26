/**
 * T-0078 phase 1. The picture does not import this file. It is the table a later step reads.
 *
 * Height stations are issue #107. Time levels, the two chains, and the hysteresis pair are issue #109.
 * A blank rate is a level #109 named and did not number. Stiffness, damping, and a metre gap for height
 * are not here, because #109 did not give them.
 *
 * The live time wheel is `observation()` on `grokbot-3/single-time-control` (pull request #92,
 * `notes/design-roadmap.md` steps 30–33). This file does not choose a level and does not add a second dial.
 * `CODE_REACH` is the distances already exported by the picture, so the table cannot drift from them.
 */
import { INTEREST } from '../core/interest';
import { GRASS } from './grass/cover';
import { TREES_V2 } from './trees/game';
import { HANDOFF } from '../world/globe/handoff';
import { TRANSITION } from '../world/globe/transition';
import { FEATURE_SIZE_M } from '../world/globe/visibility';
import { LOCAL_CLOUDS } from '../world/globe/localClouds';

export interface HeightStation {
  id: 'ground' | 'm100' | 'km1' | 'km100' | 'continental' | 'orbital';
  /** Metres #107 wrote for the station. Null when #107 named the station and gave no single height. */
  namedMetres: number | null;
  shows: readonly string[];
  source: 'GitHub issue #107';
}

export const HEIGHT_STATIONS: readonly HeightStation[] = [
  { id: 'ground', namedMetres: null, shows: ['Grass', 'Insects', 'Tracks', 'Scents'], source: 'GitHub issue #107' },
  { id: 'm100', namedMetres: 100, shows: ['Animals', 'Trees', 'Streams'], source: 'GitHub issue #107' },
  { id: 'km1', namedMetres: 1_000, shows: ['Habitats', 'Territories', 'Migration Routes'], source: 'GitHub issue #107' },
  { id: 'km100', namedMetres: 100_000, shows: ['Biomes', 'Watersheds', 'Population Density'], source: 'GitHub issue #107' },
  { id: 'continental', namedMetres: null, shows: ['Climate Zones', 'Species Ranges', 'Ocean Currents'], source: 'GitHub issue #107' },
  { id: 'orbital', namedMetres: null, shows: ['Weather Systems', 'Seasonality', 'Vegetation Density'], source: 'GitHub issue #107' },
];

export interface TimeLevel {
  id: 'Individual' | 'Group' | 'Population' | 'Ecosystem' | 'Biome' | 'Evolution' | 'Geological';
  /** Inclusive rate, as a multiple of real time. Null when #109 named the level and gave no edge. */
  minRate: number | null;
  maxRate: number | null;
  shows: readonly string[];
  source: 'GitHub issue #109';
}

export const TIME_LEVELS: readonly TimeLevel[] = [
  { id: 'Individual', minRate: 0.1, maxRate: 50, shows: ['Animals', 'Footsteps', 'Behavior trees'], source: 'GitHub issue #109' },
  { id: 'Group', minRate: 20, maxRate: 500, shows: ['Herds', 'Packs', 'Flocks'], source: 'GitHub issue #109' },
  { id: 'Population', minRate: 100, maxRate: 10_000, shows: ['Population density', 'Territories', 'Migration'], source: 'GitHub issue #109' },
  { id: 'Ecosystem', minRate: 1_000, maxRate: 1_000_000, shows: ['Food webs', 'Predator/prey dynamics', 'Forest succession'], source: 'GitHub issue #109' },
  { id: 'Biome', minRate: null, maxRate: null, shows: [], source: 'GitHub issue #109' },
  { id: 'Evolution', minRate: 100_000, maxRate: null, shows: ['Genetic divergence', 'Extinction', 'Speciation'], source: 'GitHub issue #109' },
  { id: 'Geological', minRate: null, maxRate: null, shows: [], source: 'GitHub issue #109' },
];

/** #109's cited pair for behaviour giving way to migration. Not a new band. */
export const HYSTERESIS = {
  from: 'Behavior',
  to: 'Migration',
  enterRate: 1_200,
  exitRate: 800,
  blendFrom: 800,
  blendTo: 1_200,
  source: 'GitHub issue #109',
} as const;

/** #109: a thing transforms. It does not disappear because the rate changed. */
export const CONTINUITY = {
  animal: ['Wolf', 'Pack', 'Population', 'Species Distribution', 'Canid Evolutionary Lineage'],
  plant: ['Tree', 'Forest Stand', 'Forest Biome', 'Vegetation Belt', 'Plant Evolutionary Branch'],
  source: 'GitHub issue #109',
} as const;

/** Distances the picture already exports. The draw still decides with its own copies of these. */
export const CODE_REACH = {
  interestNearM: INTEREST.near,
  interestMidM: INTEREST.mid,
  grassRadiusM: GRASS.radius,
  treeNearM: TREES_V2.nearM,
  bandTopM: HANDOFF.alt,
  fadeFullM: TRANSITION.fadeFull,
  handoverM: TRANSITION.handover,
  forestPatchM: FEATURE_SIZE_M.forest.m,
  localCloudsBelowM: LOCAL_CLOUDS.showBelowM,
} as const;
