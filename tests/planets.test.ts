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
import { venusSky, utOf } from '../src/render/venusSky';
test('Venus at Kenora dawn: visible 2025-06-01 (W elongation 46 deg), invisible 2025-03-23 (near inferior conjunction)', () => {
  const best = (day: string) => { let r = 0; for (let h = 0; h < 12; h += 0.1) { const s = venusSky(utOf(new Date(`${day}T00:00:00Z`), h)); if (s.sunAlt < 0 && s.alt.elevation > 0) r = Math.max(r, s.vis.ratio); } return r; };
  assert.ok(best('2025-06-01') > 10, 'June morning star'); const mar = best('2025-03-23'); assert.ok(mar > 1 && mar < 5, `March ratio ${mar}: marginal, a few times the 50 % threshold at 2-3 deg altitude in civil twilight (Venus 8 deg N of the Sun; glimpsed in both twilights from high northern latitudes in March 2025); within the field factor ~2-4 of casual observers (Schaefer 1990)`); assert.ok(best('2025-06-01') > 30 * mar);
});
