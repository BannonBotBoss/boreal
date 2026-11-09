import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LUX, NIGHT_READ, SYNODIC, darkAdapted, exposureFor, moonAge, moonLux, nightKey, nightSkyLight, sceneFill, wolfEyes } from '../src/core/light';
import { lighting, sunPosition } from '../src/core/timeOfDay';
import { besideMother } from '../src/core/litter';
import { footLiftMetres } from '../src/render/meshySkin';

function fillAt(hour: number) {
  const sun = sunPosition(hour);
  const day = lighting(sun.elevation).day;
  const age = moonAge(227, 2026);
  const moon = sunPosition(hour - (age / SYNODIC) * 24);
  const Emoon = moonLux(age, Math.sin((moon.elevation * Math.PI) / 180));
  const lux = Emoon + LUX.nightSky;
  const gain = exposureFor(lux) * wolfEyes(lux);
  const rawKey = (3 * Emoon) / LUX.ref * gain + nightKey(gain) * (1 - day);
  const rawHemi = 2.7 * day + (1 - day) * Math.max(0.35, nightSkyLight(Emoon, gain));
  return sceneFill({ elevation: sun.elevation, rawHemi, rawKey, dark: (1 - day) * darkAdapted(lux) });
}

test('hours 0, 3 and 22 keep the ground and the wolf above black', () => {
  for (const hour of [0, 3, 22]) {
    const fill = fillAt(hour);
    assert.ok(fill.ground >= NIGHT_READ.minL, `hour ${hour} ground ${fill.ground}`);
    assert.ok(fill.wolf >= NIGHT_READ.minL, `hour ${hour} wolf ${fill.wolf}`);
    assert.ok(fill.keep > 0.8, `hour ${hour} fill was crushed (${fill.keep})`);
  }
  const noon = fillAt(12);
  assert.ok(noon.eta < 0.05, 'noon does not add the night lamp');
  assert.ok(noon.ground < fillAt(3).ground + 2, 'the night floor is not a second sun');
});

test('mama is lifted onto her feet, and the pups are a clump', () => {
  assert.equal(footLiftMetres(0), 0);
  assert.equal(footLiftMetres(-0.01), 0);
  assert.ok(Math.abs(footLiftMetres(-0.42) - 0.42) < 1e-9);
  const pups = besideMother(10, 20, 0.4);
  assert.equal(pups.length, 5);
  const xs = pups.map(p => p.x), zs = pups.map(p => p.z);
  const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  assert.ok(span > 0.6 && span < 3, `clump span ${span}`);
  const area = Math.abs((pups[1].x - pups[0].x) * (pups[2].z - pups[0].z) - (pups[2].x - pups[0].x) * (pups[1].z - pups[0].z));
  assert.ok(area > 0.05, 'the homes are not a straight row');
});
