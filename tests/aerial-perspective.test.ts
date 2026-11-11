/** Aerial perspective: Hillaire's exponential integral, Koschmieder visibility. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BETA_M, HEIGHT_M, KOCHMIEDER, mieVisibility, opticalDepth, transmittance } from '../src/render/aerial';
import { horizonMetres } from '../src/world/globe/horizonSkirt';

test('a horizontal ray matches beta * distance * exp(-h/H), and zero distance is clear', () => {
  assert.equal(opticalDepth(40, 40, 0, HEIGHT_M), 0);
  const dist = 1000, h = 40;
  const got = opticalDepth(h, h, dist, HEIGHT_M);
  const expect = dist * Math.exp(-h / HEIGHT_M);
  assert.ok(Math.abs(got - expect) < 1e-6, `${got} vs ${expect}`);
  const down = opticalDepth(400, 0, 500, HEIGHT_M);
  assert.ok(down > 0, 'a downward ray still has optical depth');
});

test('Mie visibility is Koschmieder 3.912/beta, and the horizon at 40 m is mostly air', () => {
  const V = mieVisibility();
  assert.ok(Math.abs(V - KOCHMIEDER / BETA_M) < 1e-6);
  assert.ok(V > 12000 && V < 25000, `visibility ${V} m`);
  const horizon = horizonMetres(40);
  const T = transmittance(40, 0, horizon);
  // The land line is air. A little red remains; blue is gone.
  assert.ok(T[0] < 0.08, `red transmittance ${T[0]}`);
  assert.ok(T[2] < 0.05, `blue transmittance ${T[2]}`);
  assert.ok(T[2] < T[0], 'Rayleigh removes blue first');
  const near = transmittance(2, 2, 30);
  assert.ok(near[1] > 0.95, `30 m stays clear (${near[1]})`);
});
