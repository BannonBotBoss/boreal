import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worldSeedFromUniverse, universeStream } from '../src/core/universeSeed';
import { WORLD_SEED, generateChunk } from '../src/core/world';
import { STAGES } from '../src/core/stages/elevation';
import { SITE } from '../src/core/sitePhase';
import { fireAt, standStructure } from '../src/core/stand';
import { thomas } from '../src/core/flora/site';
import { ageAfter, birthPlaces, pupAim } from '../src/core/litter';
import { replay, type Edit } from '../src/core/genome';
import { climate } from '../src/core/weather';

function walkFiles(dir: string, ext: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

test('T-0213 #97: replay named entities identically across visit orders from (seed, place, time, parent)', () => {
  const prevStages = STAGES.on;
  const prevRemote = SITE.remote;
  try {
    STAGES.on = false;
    SITE.remote = false;

    const uSeed = 20261114;
    const wSeed = worldSeedFromUniverse(uSeed);
    assert.equal(wSeed, worldSeedFromUniverse(uSeed));
    assert.equal(universeStream(uSeed, 'dark-ages')(), universeStream(uSeed, 'dark-ages')());

    // First call directly at chunk (0, 0); second call after visiting unrelated chunks (-5, 7) and (3, -2).
    const first = generateChunk(0, 0, WORLD_SEED);
    generateChunk(-5, 7, WORLD_SEED);
    generateChunk(3, -2, wSeed);
    const second = generateChunk(0, 0, WORLD_SEED);
    assert.deepEqual(first, second, 'chunk entities must be pure functions of (seed, place, parent), independent of visit order');

    const firstSpruce = first.find(e => e.kind === 'spruce');
    assert.ok(firstSpruce, 'chunk (0, 0) contains a named spruce entity');
    assert.equal(firstSpruce.key, '0:0:3');
    assert.equal(firstSpruce.seed, 346910013);
    const replayedSpruce = second.find(e => e.key === '0:0:3');
    assert.deepEqual(replayedSpruce, firstSpruce);

    // Parent-offspring till stones: slot i >= 16 clusters within +-2 m of parents[i % 16] when off bedrock.
    const parentStone = first.find(e => e.key === 'stones:0:0:0');
    const childStone = first.find(e => e.key === 'stones:0:0:16');
    assert.ok(parentStone && childStone, 'parent stone 0 and child stone 16 both land on dry ground in chunk (0, 0)');
    assert.ok(Math.abs(childStone.x - parentStone.x) <= 2.0001 && Math.abs(childStone.z - parentStone.z) <= 2.0001);

    // Stand fire age -> parent stand canopy -> Thomas parent-offspring plant cluster.
    const patchA = fireAt(140, -90, WORLD_SEED);
    const patchB = fireAt(140, -90, WORLD_SEED);
    assert.deepEqual(patchA, patchB);
    const stand = standStructure(patchA.age, 0.5);
    const suit = () => Math.max(0.1, 1 - stand.canopy);
    const cluster1 = thomas('blueberry', 2, -3, 20, { kappa: 0.04, mu: 4, sigma: 1.8 }, suit, WORLD_SEED);
    const cluster2 = thomas('blueberry', 2, -3, 20, { kappa: 0.04, mu: 4, sigma: 1.8 }, suit, WORLD_SEED);
    assert.deepEqual(cluster1, cluster2);

    // Litter & developmental time: birthPlaces(place) -> ageAfter(time) -> pupAim(slot, parent, time).
    const denPups1 = birthPlaces(12, -8);
    const denPups2 = birthPlaces(12, -8);
    assert.deepEqual(denPups1, denPups2);
    const grownAge = ageAfter(denPups1[4].ageYears, 3600);
    const pup1 = pupAim(4, 12, -8, 0.5, 18.0, true, grownAge, false);
    const pup2 = pupAim(4, 12, -8, 0.5, 18.0, true, grownAge, false);
    assert.deepEqual(pup1, pup2);
    const pupThreatened = pupAim(4, 12, -8, 0.5, 18.0, true, grownAge, true);
    assert.notDeepEqual(pup1, pupThreatened, 'changing parent threat state changes pup aim deterministically');

    // Weather & genome replay from (seed, place, time) and (parent + edit log).
    assert.deepEqual(climate(220, 14.5, 20), climate(220, 14.5, 20));
    const edits: Edit[] = [
      { param: 'size', old: 1, new: 1.12, time: 1000, op: 'set', group: 0 },
      { param: 'hue', old: 0, new: -15, time: 1001, op: 'set', group: 1 },
    ];
    assert.deepEqual(replay(edits), replay(edits));
  } finally {
    STAGES.on = prevStages;
    SITE.remote = prevRemote;
  }
});

test('T-0213 #97: zero unseeded RNG calls exist in world/entity generators across src/ and rust/boreal-sim/src/', () => {
  const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const tsHits: string[] = [];
  for (const f of walkFiles('src', '.ts').sort()) {
    const src = stripComments(readFileSync(f, 'utf8'));
    if (/\bMath\.random\b|\bcrypto\.getRandomValues\b/.test(src)) tsHits.push(f);
  }
  assert.deepEqual(
    tsHits,
    ['src/core/universeSeed.ts'],
    'only mintUniverseSeed may touch Math.random or crypto.getRandomValues',
  );

  const rsHits: string[] = [];
  for (const f of walkFiles('rust/boreal-sim/src', '.rs').sort()) {
    const src = stripComments(readFileSync(f, 'utf8'));
    if (/\bthread_rng\b|\bOsRng\b|\bSystemTime\b|\brand::/.test(src)) rsHits.push(f);
  }
  assert.deepEqual(rsHits, [], 'Rust simulation crate uses zero unseeded RNG or SystemTime sources');
});
