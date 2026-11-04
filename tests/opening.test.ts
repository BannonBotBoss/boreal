import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPENING, sphereInputs, stepOpening } from '../src/world/cosmos/opening';
import { sphereLook } from '../src/world/cosmos/look';
import type { EngineReport } from '../src/core/engineReport';

test('the opening cools from cycle 1 and hands the screen to the planet at cycle 62', () => {
  assert.equal(OPENING.from, 1);
  assert.equal(OPENING.planetAt, 62);
  const first = stepOpening(1, 0);
  assert.equal(first.cycle, 1);
  assert.equal(first.planet, false);
  const hot = stepOpening(1, 0.4);
  assert.ok(hot.cycle < 3 && !hot.planet);
  const cool = stepOpening(60, 0.1);
  assert.ok(cool.cycle < 62 && !cool.planet);
  const planet = stepOpening(61, 1);
  assert.equal(planet.cycle, 62);
  assert.equal(planet.planet, true);
  const journey = readFileSync('src/vr/journey.ts', 'utf8');
  assert.match(journey, /this\.begin\(\)/);
  assert.match(journey, /open palm/);
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
