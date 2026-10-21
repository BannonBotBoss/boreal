import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { waterFresnel, humicK, humicDeepR, shallowReflectance, openWaterGeometry, HUMIC } from '../src/render/water';

// T-0023 water optics: the numbers the shader uses, checked against their sources.
test('water Fresnel: 2 % head-on, ~30-66 % at the grazing angles of a 3.3 m eye 15-45 m out, 100 % at the horizon', () => {
  assert.equal(waterFresnel(1), .02);
  assert.equal(waterFresnel(0), 1);
  const at = (d: number) => waterFresnel(Math.cos(Math.atan2(d, 3.3))); // exact Fresnel (n = 1.333): 30.5 / 54.1 / 66.2 %
  assert.ok(Math.abs(at(15) - .305) < .06 && Math.abs(at(30) - .541) < .06 && Math.abs(at(45) - .662) < .06, `${at(15)} ${at(30)} ${at(45)}`);
});

test('humic water absorbs blue first; deep water leaves ~1 % or less, brown; implied Secchi depth 1-4 m', () => {
  const [r, g, b] = humicK();
  assert.ok(b > g && g > r, `K ${r} ${g} ${b}`);
  const deep = humicDeepR();
  assert.ok(deep.every(v => v < .015) && deep[0] > deep[2], `R∞ ${deep}`); // ~1 % or less, red > blue (Kutser et al.: negligible in very brown lakes)
  const secchi = 1.7 / g; // Poole & Atkins 1929: Kd ≈ 1.7 / Secchi depth
  assert.ok(secchi >= 1 && secchi <= 4, `Secchi ${secchi}`);
});

test('shallow-water reflectance: the bottom at 0 m, fading to the deep body by ~2 m, blue going first', () => {
  assert.deepEqual(shallowReflectance(0), HUMIC.bottom);
  const half = shallowReflectance(.3), deep = shallowReflectance(5), r = humicDeepR();
  assert.ok(half[0] / HUMIC.bottom[0] > half[2] / HUMIC.bottom[2], 'red survives longer than blue (tea colour)');
  deep.forEach((v, i) => assert.ok(Math.abs(v - r[i]) < 1e-3));
});

test('open-water sheet: terrain grid at the water level with depth per vertex; none on a dry chunk', () => {
  const grid = (h: (x: number) => number) => { const g = new THREE.PlaneGeometry(4, 4, 2, 2).rotateX(-Math.PI / 2); /* row-major like terrainCore */ const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, h(p.getX(i))); return g; };
  assert.equal(openWaterGeometry(grid(() => 1), -.25), null);
  const s = openWaterGeometry(grid(x => x * .5), -.25)!; // shore slope: x = -2 is 0.75 m deep, x = 2 is dry
  const d = s.getAttribute('aDepth'), p = s.getAttribute('position');
  for (let i = 0; i < d.count; i++) { assert.equal(p.getY(i), -.25); assert.ok(Math.abs(d.getX(i) - (-.25 - p.getX(i) * .5)) < 1e-6); }
});

test('water-leaving radiance: 1/n² on exit, so above-water Rrs ~0.52-0.56 of the in-water rrs (Lee et al. 2002: 0.52)', () => {
  assert.ok(Math.abs(HUMIC.exit - .5628) < .001);
  assert.ok(HUMIC.exit >= .52 && HUMIC.exit <= .57);
});
