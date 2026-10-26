/**
 * Foot swing trajectory: a literal TypeScript port of the MIT Cheetah swing-leg trajectory (glue only).
 *
 * Upstream: mit-biomimetics/Cheetah-Software, MIT License, Copyright (c) 2019 MIT Biomimetic Robotics Lab.
 * - common/src/Controllers/FootSwingTrajectory.cpp (FootSwingTrajectory::computeSwingTrajectoryBezier)
 * - common/include/Math/Interpolation.h (Interpolate::cubicBezier, cubicBezierFirstDerivative, cubicBezierSecondDerivative)
 * File commit c54e50bf5d68f685d8944c8d9047a84a474b454d (repo head c71c5a138d3e418cc833e94e25357ceea8955daa):
 * https://github.com/mit-biomimetics/Cheetah-Software/blob/c54e50bf5d68f685d8944c8d9047a84a474b454d/common/src/Controllers/FootSwingTrajectory.cpp
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * Port notes: Vec3<T> -> number[] (any length; the upstream "height" axis is index 2 = z-up, passed here as `up`), templates ->
 * number (JS doubles), the upstream asserts (0 <= x <= 1) kept as clamps-free checks in comments only. Names kept.
 */

/** Interpolate::cubicBezier: y0 + (x^3 + 3 x^2 (1 - x)) (yf - y0) */
export const cubicBezier = (y0: number, yf: number, x: number) => y0 + (x * x * x + 3 * (x * x * (1 - x))) * (yf - y0);
/** Interpolate::cubicBezierFirstDerivative: 6 x (1 - x) (yf - y0) */
export const cubicBezierFirstDerivative = (y0: number, yf: number, x: number) => 6 * x * (1 - x) * (yf - y0);
/** Interpolate::cubicBezierSecondDerivative: (6 - 12 x) (yf - y0) */
export const cubicBezierSecondDerivative = (y0: number, yf: number, x: number) => (6 - 12 * x) * (yf - y0);

export interface SwingState { p: number[]; v: number[]; a: number[] }
/**
 * FootSwingTrajectory::computeSwingTrajectoryBezier(phase, swingTime): every axis by cubicBezier from p0 to pf; the `up` axis
 * instead rises p0 -> p0 + height over the first half and falls to pf over the second.
 */
export function computeSwingTrajectoryBezier(p0: readonly number[], pf: readonly number[], height: number, phase: number, swingTime: number, up = 2): SwingState {
  const p = p0.map((a, k) => cubicBezier(a, pf[k], phase));
  const v = p0.map((a, k) => cubicBezierFirstDerivative(a, pf[k], phase) / swingTime);
  const a = p0.map((b, k) => cubicBezierSecondDerivative(b, pf[k], phase) / (swingTime * swingTime));
  let zp: number, zv: number, za: number;
  if (phase < .5) {
    zp = cubicBezier(p0[up], p0[up] + height, phase * 2);
    zv = cubicBezierFirstDerivative(p0[up], p0[up] + height, phase * 2) * 2 / swingTime;
    za = cubicBezierSecondDerivative(p0[up], p0[up] + height, phase * 2) * 4 / (swingTime * swingTime);
  } else {
    zp = cubicBezier(p0[up] + height, pf[up], phase * 2 - 1);
    zv = cubicBezierFirstDerivative(p0[up] + height, pf[up], phase * 2 - 1) * 2 / swingTime;
    za = cubicBezierSecondDerivative(p0[up] + height, pf[up], phase * 2 - 1) * 4 / (swingTime * swingTime);
  }
  p[up] = zp; v[up] = zv; a[up] = za;
  return { p, v, a };
}
