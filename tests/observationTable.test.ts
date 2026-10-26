import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { INTEREST } from '../src/core/interest';
import { GRASS } from '../src/render/grass/cover';
import { TREES_V2 } from '../src/render/trees/game';
import { HANDOFF } from '../src/world/globe/handoff';
import { TRANSITION } from '../src/world/globe/transition';
import { FEATURE_SIZE_M } from '../src/world/globe/visibility';
import { LOCAL_CLOUDS } from '../src/world/globe/localClouds';
import { CODE_REACH, CONTINUITY, HEIGHT_STATIONS, HYSTERESIS, TIME_LEVELS } from '../src/render/observationTable';

/** Issue #107, "Spatial Observation Framework". A station #107 did not number stays null. */
const STATIONS = [
  { id: 'ground', namedMetres: null, shows: ['Grass', 'Insects', 'Tracks', 'Scents'] },
  { id: 'm100', namedMetres: 100, shows: ['Animals', 'Trees', 'Streams'] },
  { id: 'km1', namedMetres: 1_000, shows: ['Habitats', 'Territories', 'Migration Routes'] },
  { id: 'km100', namedMetres: 100_000, shows: ['Biomes', 'Watersheds', 'Population Density'] },
  { id: 'continental', namedMetres: null, shows: ['Climate Zones', 'Species Ranges', 'Ocean Currents'] },
  { id: 'orbital', namedMetres: null, shows: ['Weather Systems', 'Seasonality', 'Vegetation Density'] },
];

/** Issue #109, "Temporal LOD Hierarchy" and "Transition Rules". Blank edges are levels #109 named and did not number. */
const LEVELS = [
  { id: 'Individual', minRate: 0.1, maxRate: 50, shows: ['Animals', 'Footsteps', 'Behavior trees'] },
  { id: 'Group', minRate: 20, maxRate: 500, shows: ['Herds', 'Packs', 'Flocks'] },
  { id: 'Population', minRate: 100, maxRate: 10_000, shows: ['Population density', 'Territories', 'Migration'] },
  { id: 'Ecosystem', minRate: 1_000, maxRate: 1_000_000, shows: ['Food webs', 'Predator/prey dynamics', 'Forest succession'] },
  { id: 'Biome', minRate: null, maxRate: null, shows: [] },
  { id: 'Evolution', minRate: 100_000, maxRate: null, shows: ['Genetic divergence', 'Extinction', 'Speciation'] },
  { id: 'Geological', minRate: null, maxRate: null, shows: [] },
];

test('height stations match issue #107 and do not invent a height #107 left blank', () => {
  assert.deepEqual(HEIGHT_STATIONS.map(s => ({ id: s.id, namedMetres: s.namedMetres, shows: [...s.shows] })), STATIONS);
  assert.equal(HEIGHT_STATIONS.every(s => s.source === 'GitHub issue #107'), true);
});

test('time levels match issue #109, including the levels with no rate', () => {
  assert.deepEqual(TIME_LEVELS.map(s => ({ id: s.id, minRate: s.minRate, maxRate: s.maxRate, shows: [...s.shows] })), LEVELS);
  assert.equal(TIME_LEVELS.every(s => s.source === 'GitHub issue #109'), true);
  assert.equal(TIME_LEVELS.find(s => s.id === 'Biome')?.minRate, null);
  assert.equal(TIME_LEVELS.find(s => s.id === 'Geological')?.maxRate, null);
});

test('hysteresis pair and continuity chains match issue #109', () => {
  assert.deepEqual(HYSTERESIS, {
    from: 'Behavior', to: 'Migration', enterRate: 1_200, exitRate: 800, blendFrom: 800, blendTo: 1_200, source: 'GitHub issue #109',
  });
  assert.deepEqual([...CONTINUITY.animal], ['Wolf', 'Pack', 'Population', 'Species Distribution', 'Canid Evolutionary Lineage']);
  assert.deepEqual([...CONTINUITY.plant], ['Tree', 'Forest Stand', 'Forest Biome', 'Vegetation Belt', 'Plant Evolutionary Branch']);
});

test('the table does not store stiffness, damping, or a height hysteresis gap', () => {
  const bag = JSON.stringify({ HEIGHT_STATIONS, TIME_LEVELS, HYSTERESIS, CONTINUITY });
  assert.equal(bag.includes('stiffness'), false);
  assert.equal(bag.includes('damping'), false);
  assert.equal(Object.hasOwn(HYSTERESIS, 'stiffness'), false);
});

test('code reach copies the distances the picture already exports', () => {
  assert.equal(CODE_REACH.interestNearM, INTEREST.near);
  assert.equal(CODE_REACH.interestMidM, INTEREST.mid);
  assert.equal(CODE_REACH.grassRadiusM, GRASS.radius);
  assert.equal(CODE_REACH.treeNearM, TREES_V2.nearM);
  assert.equal(CODE_REACH.bandTopM, HANDOFF.alt);
  assert.equal(CODE_REACH.fadeFullM, TRANSITION.fadeFull);
  assert.equal(CODE_REACH.handoverM, TRANSITION.handover);
  assert.equal(CODE_REACH.forestPatchM, FEATURE_SIZE_M.forest.m);
  assert.equal(CODE_REACH.localCloudsBelowM, LOCAL_CLOUDS.showBelowM);
});

test('the draw loop does not read the observation table', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith('.ts') && !path.endsWith('observationTable.ts')) files.push(path);
    }
  };
  walk('src');
  const readers = files.filter(path => readFileSync(path, 'utf8').includes('observationTable'));
  assert.deepEqual(readers, []);
});
