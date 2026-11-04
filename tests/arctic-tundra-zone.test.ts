import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneAt, treeLineM, iceLineM, ARCTIC_TREE_LINE_M } from '../src/core/altitudeZones';
import { coverKind } from '../src/world/globe/coverKind';

// #192 owner call (Nov 1): Arctic lowland above a near-sea-level tree line is tundra (low plants, its animals), not bare rock.
test('Yukon north slope (68N, 300 m) is tundra in the local zone, matching cover', () => {
  assert.ok(treeLineM(68) < ARCTIC_TREE_LINE_M && iceLineM(68) > 300);
  assert.equal(zoneAt(300, 68), 'tundra');
  assert.equal(coverKind(68, 300, 0.3, false), 'tundra');
});
test('Arctic tundra still turns to ice above the ice line', () => assert.equal(zoneAt(iceLineM(68) + 10, 68), 'ice'));
test('mountains with a higher tree line keep bare rock above it', () => {
  assert.equal(zoneAt(1800, 49.77), 'rock');
  assert.equal(zoneAt(treeLineM(60) + 50, 60), 'rock');
});
test('local zone and globe cover agree on tundra vs rock across latitudes', () => {
  for (let lat = 40; lat <= 85; lat += 1) for (const alt of [50, 200, 400, 800]) {
    const z = zoneAt(alt, lat), c = coverKind(lat, alt, 0.3, false);
    if (z === 'tundra' || z === 'rock' || z === 'ice') assert.equal(c, z, `${lat}N ${alt} m`);
  }
});
