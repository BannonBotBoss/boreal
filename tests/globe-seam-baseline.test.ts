/** Sprint #192 (Oct 29): globe -> landscape seam baseline over ten site kinds (tools/globe-seam-baseline.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEAM_LOCATIONS, measureSeam, pickSite } from '../tools/globe-seam-baseline';

const rows = SEAM_LOCATIONS.map(l => ({ l, p: pickSite(l) }));

test('every baseline kind finds a site on the planet and lands on its coordinates', () => {
  for (const { l, p } of rows) {
    assert.ok(p, `${l.name}: no site`);
    const m = measureSeam(p.lat, p.lon);
    assert.deepEqual(m.errors, [], l.name);
    assert.ok(m.dLatDeg! < 0.05 && m.dLonDeg! < 0.05, `${l.name}: lat/lon drift`);
    assert.ok(m.landingDeltaM! < 0.05, `${l.name}: landing height vs skirt ${m.landingDeltaM}`);
  }
});

test('an off-home landing keeps the planet relief and meets the horizon skirt without a step', () => {
  for (const { l, p } of rows) {
    if (!p || l.name.startsWith('wetland') || l.name === 'ocean edge') continue;
    const m = measureSeam(p.lat, p.lon);
    // Before the fix the local patch was flat (0.04 m relief) and stepped up to 32 m against the skirt at 600 m.
    assert.ok(Math.abs(m.localReliefM! - m.planetReliefM!) < 0.1, `${l.name}: relief ${m.localReliefM} vs ${m.planetReliefM}`);
    for (const [r, d] of Object.entries(m.seamMaxM!)) assert.ok(d < 0.1, `${l.name}: seam ${d} m at ${r} m`);
  }
});
