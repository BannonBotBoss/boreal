// T-0044 (grok-gait): the literal port of MIT Cheetah FootSwingTrajectory / Interpolation.h (src/animals/locomotion/footSwing.ts)
// against values worked by hand from the upstream formulas (c54e50b): bezier = x^3 + 3x^2(1-x), d = 6x(1-x), dd = 6 - 12x.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier, cubicBezierFirstDerivative, cubicBezierSecondDerivative, computeSwingTrajectoryBezier } from '../src/animals/locomotion/footSwing';
const near = (a: number, b: number, m: string) => assert.ok(Math.abs(a - b) < 1e-12, `${m}: ${a} vs ${b}`);
test('Interpolate::cubicBezier and derivatives (upstream formulas)', () => {
  near(cubicBezier(2, 6, 0), 2, 'x0'); near(cubicBezier(2, 6, 1), 6, 'x1'); near(cubicBezier(0, 1, .25), .15625, 'x.25'); near(cubicBezier(0, 1, .5), .5, 'x.5');
  near(cubicBezierFirstDerivative(0, 1, 0), 0, 'v0'); near(cubicBezierFirstDerivative(0, 1, 1), 0, 'v1'); near(cubicBezierFirstDerivative(0, 2, .5), 3, 'v.5');
  near(cubicBezierSecondDerivative(0, 1, 0), 6, 'a0'); near(cubicBezierSecondDerivative(0, 1, 1), -6, 'a1');
});
test('computeSwingTrajectoryBezier: ends on p0 / pf, apex p0z + height at half swing, zero end velocity', () => {
  const p0 = [0, 0, .1], pf = [.3, -.1, .05], h = .08, T = .2;
  const s0 = computeSwingTrajectoryBezier(p0, pf, h, 0, T), s1 = computeSwingTrajectoryBezier(p0, pf, h, 1, T), sm = computeSwingTrajectoryBezier(p0, pf, h, .5, T), sq = computeSwingTrajectoryBezier(p0, pf, h, .25, T);
  s0.p.forEach((v, k) => near(v, p0[k], `p0[${k}]`)); s1.p.forEach((v, k) => near(v, pf[k], `pf[${k}]`));
  near(sm.p[2], p0[2] + h, 'apex'); near(sq.p[2], p0[2] + h / 2, 'quarter'); near(sm.p[0], .15, 'mid x');
  [...s0.v, ...s1.v].forEach(v => near(v, 0, 'end velocity'));
  near(sq.v[2], 6 * .5 * .5 * h * 2 / T, 'quarter z velocity');
});
