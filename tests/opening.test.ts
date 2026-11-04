import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPENING, openingCycle, sphereInputs } from '../src/world/cosmos/opening';
import { sphereLook } from '../src/world/cosmos/look';
import type { EngineReport } from '../src/core/engineReport';

test('the cooling arc is visible for half a minute, then the violet holds, then the planet', () => {
  const total = OPENING.arcSec + OPENING.holdSec;
  assert.ok(total >= 30 && total <= 45, `the arc is ${total}s`);
  const start = openingCycle(0);
  assert.equal(start.cycle, OPENING.from);
  assert.equal(start.planet, false);
  const hot = openingCycle(4);
  assert.ok(hot.cycle < 12 && !hot.planet, `still hot at ${hot.cycle}`);
  const mid = openingCycle(20);
  assert.ok(mid.cycle > 35 && mid.cycle < 48 && !mid.planet, `mid colour at ${mid.cycle}`);
  const held = openingCycle(total - 1);
  assert.equal(held.violet, true);
  assert.equal(held.cycle, OPENING.violetAt);
  assert.equal(held.planet, false);
  const planet = openingCycle(total);
  assert.equal(planet.planet, true);
  assert.equal(planet.cycle, OPENING.planetAt);
  const journey = readFileSync('src/vr/journey.ts', 'utf8');
  assert.match(journey, /openingCycle\(this\.elapsed\)/);
  assert.match(journey, /OPENING\.planetAt/);
  assert.match(readFileSync('src/world/cosmos/sphere.ts', 'utf8'), /Math\.max\(tier\.segments, 192\)/);
  assert.match(readFileSync('src/world/cosmos/sphere.ts', 'utf8'), /1\.0 - edge/);
  assert.match(readFileSync('src/world/cosmos/opening.ts', 'utf8'), /pointerdown/);
});

test('a missing report stays pink-white, and a cool Rust temperature is blue-violet', () => {
  const held = sphereLook(1e-40, 1, sphereInputs(null).temperature, 1);
  assert.ok(held.color[0] > 0.9 && held.color[2] < 0.95);
  const report = {
    instances: [{
      type: 'reheating',
      vars: [{ label: 'temperature', value: 59 }],
    }, {
      type: 'spacetime',
      vars: [{ label: 'scale factor a', value: 1e-8 }, { label: 'Hubble rate', value: 1 }, { label: 'total density', value: 1 }],
    }],
  } as EngineReport;
  const cool = sphereLook(1e-8, 1, sphereInputs(report).temperature, 1);
  assert.ok(cool.color[2] > cool.color[0]);
});
