// T-0044 run 13 (grok-gait): soft IK for the fore two-bone (shoulder -> wrist), the pure part.
// Deterministic, plain numbers in and out: no three.js, no Math.random, no module state, no clock (maps 1:1 onto Rust fns).
//
// prior_art: Andy Nicholas, "Soft IK in XSI", Softimage Blog, 14 Aug 2006, http://www.softimageblog.com/archives/108
//   (archived: https://web.archive.org/web/2010/http://www.softimageblog.com/archives/108). As an IK chain nears full length the
//   bones' speed toward the straight pose tends to infinity; a "soft distance" from full extension makes the chain lag the effector
//   so it never quite straightens. The equation is an image on that page; its text form is taken from Paul Molodowitch's Maya
//   port pmSoftIK (https://github.com/pmolodo/pmSoftIK, src/pmSoftIK.py lines 56-57 and 76-87, "from
//   http://www.xsi-blog.com/userContent/anicholas/softik/Equation.gif"):
//       softDist = softRatio * chainLength;  hardDist = chainLength - softDist
//       final    = softDist * (1 - exp((hardDist - x) / softDist)) + hardDist      (x > hardDist; else x)
//   The same form is in the Maya node on tech-artists.org ("Soft IK Setup Help!", shortd = softDist*(1-exp(-(d-daU)/softDist))+daU).
//   pmSoftIK has no licence file, so no code is copied: only this one-line published equation is re-implemented here, with credit
//   to Nicholas (equation) and Molodowitch (transcription).
// The two-bone solve is the law of cosines (the same as core/animalBehavior solveLeg, which stays untouched).
// Angles follow ik.ts / soleOf: direction(t) = (-sin t, -cos t) in the limb plane (z back, y up).

/** Nicholas soft-IK split of a chain: soft = ratio x chain, hard = chain - soft (pmSoftIK lines 56-57). */
export function softSplit(chain: number, ratio: number): { soft: number; hard: number } {
  const soft = Math.max(0, ratio) * chain;
  return { soft, hard: chain - soft };
}

/** Nicholas soft distance: x unchanged up to hard, then soft * (1 - exp((hard - x) / soft)) + hard, which tends to the chain
 *  length and never reaches it (pmSoftIK line 87). soft <= 0: x clamped to the chain (hard IK). */
export function softDistance(x: number, hard: number, soft: number): number {
  if (soft <= 0) return Math.min(x, hard);
  return x <= hard ? x : soft * (1 - Math.exp((hard - x) / soft)) + hard;
}

/** Elbow bend (rad, 0 = straight) of a two-bone chain U, L whose ends are d apart (law of cosines). */
export function bendForDistance(d: number, U: number, L: number): number {
  const c = (U * U + L * L - d * d) / (2 * U * L);
  return Math.PI - Math.acos(Math.max(-1, Math.min(1, c)));
}

/** Shoulder-wrist distance of a two-bone chain with elbow bend b (inverse of bendForDistance on [0, pi]). */
export function distanceForBend(b: number, U: number, L: number): number {
  return Math.sqrt(Math.max(0, U * U + L * L + 2 * U * L * Math.cos(b)));
}

/** Smallest elbow bend that keeps the chain out of the soft zone (shoulder-wrist <= hard). */
export function softBendMin(U: number, L: number, ratio: number): number {
  return bendForDistance(softSplit(U + L, ratio).hard, U, L);
}

/** How far into the soft zone a chain with bend b is, as a fraction of the soft distance (0 outside it). */
export function softExcess(b: number, U: number, L: number, ratio: number): number {
  const { soft, hard } = softSplit(U + L, ratio), d = distanceForBend(Math.abs(b), U, L);
  return soft > 0 ? Math.max(0, d - hard) / soft : 0;
}

/** Soft two-bone solve: shoulder (jz, jy) toward the wrist target (wz, wy), reaching only the Nicholas soft distance along
 *  the same line. `sign` is the side the elbow folds to (the sign of the knee angle). Returns the humerus segment angle a1
 *  and the knee angle; the wrist lands at shoulder + soft distance along the aim. */
export function softTwoBone(jz: number, jy: number, wz: number, wy: number, U: number, L: number, ratio: number, sign: number): { a1: number; knee: number; d: number; dSoft: number } {
  const dz = wz - jz, dy = wy - jy, d = Math.hypot(dz, dy), { soft, hard } = softSplit(U + L, ratio);
  const ds = Math.max(Math.abs(U - L) + 1e-6, Math.min(U + L - 1e-6, softDistance(d, hard, soft)));
  const aim = Math.atan2(-dz, -dy), b = bendForDistance(ds, U, L);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (U * U + ds * ds - L * L) / (2 * U * ds))));
  const s = sign < 0 ? -1 : 1;
  return { a1: aim - s * alpha, knee: s * b, d, dSoft: ds };
}