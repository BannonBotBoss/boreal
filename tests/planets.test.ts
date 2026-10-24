import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { venusAt } from '../src/core/planets';
const H = JSON.parse(readFileSync('data/horizons/venus-2025.json', 'utf8')).rows as { utc: string; ra: number; dec: number; mag: number; elong: number }[];
test('Venus from Kepler elements matches JPL Horizons within 0.5 deg (RA/Dec, elongation) and 0.1 mag', () => {
  for (const h of H) { const v = venusAt(new Date(h.utc)), dra = ((v.ra - h.ra + 540) % 360 - 180) * Math.cos(h.dec * Math.PI / 180);
    assert.ok(Math.hypot(dra, v.dec - h.dec) < 0.5, `${h.utc} pos`); assert.ok(Math.abs(v.elong - h.elong) < 0.5, `${h.utc} elong`); assert.ok(Math.abs(v.mag - h.mag) < 0.1, `${h.utc} mag ${v.mag}`); }
  assert.equal(venusAt(new Date('2025-06-01T00:00Z')).morning, true);
});
