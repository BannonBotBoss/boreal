/**
 * Fore touchdown forearm scorer (grok-gait, T-0009 run 8). Metric "touchdown-forearm" v1: the fore forearm (elbow -> wrist)
 * angle below the horizontal AT the contact instant, gated to 11-36 deg - the range measured at fore touchdown in small
 * therians (Schmidt 2008, JEB 211:3775, Table 4; pika 33 deg, Fischer et al. 2002, JEB 205:1315).
 *
 * Why not per-frame: at 11.6 m/s the body covers 19 / 10 / 5 cm per 60 / 120 / 240 Hz frame, so the last swing frame and the
 * first stance frame can sit up to one frame away from contact, and both the late swing (the reach ease-off) and the early
 * stance (the elbow folding as the body runs over the paw) change the forearm fast. A per-frame minimum then measures the
 * frame rate, and a straight line between the two frames is no better (the angle is far from linear over one frame).
 *
 * How (exact contact): the scorer drives the controller itself. Contact starts when a fore leg's phase wraps past 1 (stance =
 * phase < duty). Before each frame it predicts, from the phase rate of the frame before, whether a fore leg will wrap inside
 * this frame; if so it splits the frame at the predicted contact time (+1 us), reads the forearm on the controller's own frame
 * there, then finishes the frame. The residual (phase past contact at the read) is reported; the rate is constant over a frame
 * in a steady run, so it is ~0. The split adds one extra controller step per contact, so the per-frame values (`frame`,
 * `lastSwing`, `lin`) come from a separate unsplit run at the same rate.
 */
import { limbPoints, type BoundController, type BoundFrame, type BoundRowId } from './bounding';
import type { Skeleton } from './bodyPlan';

/** deg below the horizontal (Schmidt 2008 JEB 211:3775 Table 4, whole degrees: a value passes when it ROUNDS into the range) */
export const TOUCHDOWN_FOREARM = { min: 11, max: 36 };
export const inTouchdownRange = (deg: number, r = TOUCHDOWN_FOREARM) => Math.round(deg) >= r.min && Math.round(deg) <= r.max;
const D = 180 / Math.PI, FORE = [0, 2];
const frac = (x: number) => x - Math.floor(x);

/** Forearm (elbow -> wrist) angle below the horizontal, deg (as tests/forearm.test.ts). */
export function forearmBelow(sk: Skeleton, f: BoundFrame, i: number) {
  const P = limbPoints(sk, f, i), k = P[2], w = P[3];
  return Math.atan2(k.y - w.y, Math.hypot(w.z - k.z, (w.x ?? 0) - (k.x ?? 0))) * D;
}

export interface ContactRun {
  /** forearm at each exact contact instant (split run) */ exact: number[]; /** phase past contact at those reads (cycles) */ residual: number[];
  /** unsplit run: first stance frame, last swing frame, straight line between them at the contact time */ frame: number[]; lastSwing: number[]; lin: number[];
}
export interface ContactOptions { speed: number; hz: number; seconds?: number; warm?: number; ramp?: number; row?: BoundRowId; /** also run the unsplit pass (default true) */ perFrame?: boolean }

/** Drive a fresh controller (`make`) at `hz` up to `speed` (linear ramp over `ramp` s) and read every fore touchdown after `warm` s. */
export function foreContacts(make: () => BoundController, sk: Skeleton, o: ContactOptions): ContactRun {
  const { speed: v, hz, seconds = 6, warm = 2.5, ramp = 1.5, row, perFrame = true } = o, dt = 1 / hz, sp = (t: number) => Math.min(v, v * t / ramp);
  const out: ContactRun = { exact: [], residual: [], frame: [], lastSwing: [], lin: [] };
  if (perFrame) { // unsplit: what a host drawing at hz shows
    const c = make(); let last: BoundFrame | undefined;
    for (let n = 0; n * dt < seconds; n++) { const t = n * dt, f = c.update(dt, sp(t), 0, null, row);
      if (last && t >= warm) for (const i of FORE) if (f.contact[i] && !last.contact[i]) {
        const a = (1 - last.phases[i]) / ((1 - last.phases[i]) + f.phases[i]), x0 = forearmBelow(sk, last, i), x1 = forearmBelow(sk, f, i);
        out.frame.push(x1); out.lastSwing.push(x0); out.lin.push(x0 + a * (x1 - x0)); }
      last = f; }
  }
  { // split at each predicted fore contact
    const c = make(); let last: BoundFrame | undefined, rate = [0, 0, 0, 0], t = 0;
    for (let n = 0; n * dt < seconds; n++) { t = n * dt;
      let cut = dt, legs: number[] = [];
      if (last) for (const i of FORE) if (!last.contact[i] && rate[i] > 0) { const left = (1 - last.phases[i]) / rate[i];
        if (left < dt) { const s = Math.max(1e-6, left + 1e-6); if (s < cut - 1e-9) { cut = s; legs = [i]; } else if (Math.abs(s - cut) < 1e-9) legs.push(i); } }
      let f = c.update(cut, sp(t), 0, null, row);
      if (cut < dt) { if (t >= warm) for (const i of legs) if (f.contact[i]) { out.exact.push(forearmBelow(sk, f, i)); out.residual.push(f.phases[i]); }
        const g = c.update(dt - cut, sp(t + cut), 0, null, row); if (last) rate = g.phases.map((p, i) => frac(p - last!.phases[i]) / dt); f = g; }
      else if (last) rate = f.phases.map((p, i) => frac(p - last!.phases[i]) / dt);
      last = f; }
  }
  return out;
}

export const range = (a: number[]) => a.length ? { min: Math.min(...a), max: Math.max(...a), n: a.length } : { min: NaN, max: NaN, n: 0 };
