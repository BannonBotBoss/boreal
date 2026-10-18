import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_LAYERS, groundCover, lichenOnRock, mossOctaves } from '../src/core/flora/mosses';
import { LADDER } from '../src/core/quality';
import type { Site } from '../src/core/flora/site';

const site = (o: Partial<Site>): Site => ({ water: false, slopeDeg: 3, wet: .5, rock: 0, depth: 1, h: 5, light: .5, soil: 'till', ...o });
const by = (s: Site) => Object.fromEntries(groundCover(s).map((c, i) => [GROUND_LAYERS[i].id, c]));

test('ground layer: feathermoss under closed mesic canopy, lichen on dry open bedrock / sand, Sphagnum on wet peat', () => {
  const shade = by(site({ light: .3 })), open = by(site({ light: 1 }));
  assert.ok(shade.feathermoss > .5 && shade.feathermoss > 4 * open.feathermoss, 'feathermoss carpets the shade (FEIS: ~58 % cover)');
  const rock = by(site({ soil: 'bedrock', rock: .85, wet: .1, light: .95 })), sand = by(site({ soil: 'sand', wet: .15, light: .9 }));
  assert.ok(rock.lichen > .5 && rock.lichen > 3 * rock.feathermoss, 'reindeer lichen on open bedrock');
  assert.ok(sand.lichen > .4, 'lichen woodland on jack pine outwash');
  const bog = by(site({ soil: 'peat', wet: .95, light: .7 }));
  assert.ok(bog.sphagnum > .7 && bog.sphagnum > 3 * bog.lichen, 'Sphagnum on saturated peat');
  assert.deepEqual(groundCover(site({ water: true })), [0, 0, 0]);
  for (const w of [0, .3, .6, 1]) for (const l of [0, .5, 1]) for (const soil of ['bedrock', 'till', 'sand', 'clay', 'peat'] as const) {
    const c = groundCover(site({ wet: w, light: l, soil, rock: soil === 'bedrock' ? .85 : 0 })); assert.ok(c.every(v => v >= 0) && c.reduce((a, b) => a + b, 0) <= 1 + 1e-9); }
  for (const g of GROUND_LAYERS) for (const a of g.albedo) assert.ok(a.every(v => v > 0 && v < .5), `${g.id} albedo is a physical reflectance`);
});

test('ground layer: patch detail scales down the governor ladder and switches off at foliage 0', () => {
  const oct = LADDER.map(t => mossOctaves(t.foliage));
  assert.equal(oct[0], 5); assert.equal(oct[oct.length - 1], 2);
  for (let i = 1; i < oct.length; i++) assert.ok(oct[i] <= oct[i - 1], `${LADDER[i].name} not above ${LADDER[i - 1].name}`);
  assert.equal(mossOctaves(0), 0);
});
test('ground layer: lichen mats on outcrops thin out on the bare crests and fill the thin-soil margins', () => {
  const crest = by(site({ soil: 'bedrock', rock: .85, wet: .08, light: .9, depth: .03 })), margin = by(site({ soil: 'bedrock', rock: .85, wet: .08, light: .9, depth: .35 }));
  assert.ok(crest.lichen < .35 && crest.lichen > .1, `crest ${crest.lichen.toFixed(2)}: mostly bare granite`);
  assert.ok(margin.lichen > 2 * crest.lichen, 'margins carry the mats');
  assert.equal(lichenOnRock(1), 1);
  // a typical outcrop pixel (crest-ish depth .06) mixes rock and mats to near the Sentinel-2 'bare' albedo (green 0.125)
  const mid = by(site({ soil: 'bedrock', rock: .85, wet: .08, light: .9, depth: .06 })).lichen, mat = GROUND_LAYERS[1].albedo[0][1];
  const pixel = (1 - mid) * .126 + mid * mat; assert.ok(pixel > .12 && pixel < .16, `outcrop pixel green ${pixel.toFixed(3)}`);
});