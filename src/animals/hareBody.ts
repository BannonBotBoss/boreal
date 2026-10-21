import { dent, push, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from '../core/body';

/**
 * Procedural snowshoe hare skin (Grok Bot, T-0028): the wolf's and bear's tube skin (core/body.ts buildBody, dent, push) swept
 * around the hare's OWN bone table, in the bind pose the bounding rig stands in (HARE_PLAN / HARE_BODY in animals/hare.ts).
 * No mesh file: every vertex comes from the rings below. Pure (no THREE), so the numbers are testable; render/hareMesh.ts
 * turns it into a skinned skin + fur-card mesh. Model space = the hare root: metres, feet at y 0, forward -z, origin on the
 * ground under the hip joints (bounding.ts / bodyPlan.ts body frame).
 *
 * Dimensions (tasks/T-0028 number table): head-body 361-479 mm (ADW: total 413-518 minus tail 39-52), modelled nose to rump
 * .42 m; tail 45 mm (ADW 39-52); ear 66 mm notch to tip (= HARE_BODY.ear, ADW 62-70); hind foot = the rig's .132 m (ADW
 * 117-147); fore paw about 5 x 3 cm and hind 12 x 8 cm prints (NatureNorth); 1.43-1.55 kg (ADW) at ~1000 kg/m3 [estimate:
 * water density, mammal soft tissue ~1.0-1.1] sets the skin volume ~1.5 L; girths, head and leg thickness [estimate: drawn
 * to the reference photos, refs/hare/].
 */

/** The hare's own bone table (the wolfBody BONE / legBone pattern; NOT the wolf's indices). Four rig segments per leg:
 *  fore = blade, upper arm, forearm, manus; hind = thigh, shank, metatarsus, toes (bounding.ts limbPoints order). */
export const HARE_BONE = { body: 0, head: 1, earL: 2, earR: 3, tail: 4 } as const;
export const HARE_LEG_SEGS = 4;
export const hareLegBone = (leg: number, seg: number) => 5 + leg * HARE_LEG_SEGS + seg;
export const HARE_BONE_COUNT = 5 + 4 * HARE_LEG_SEGS;
/** Tube order (sculpting and fur filters): trunk, neck, head, ears, tail, then one tube per leg (LF, LH, RF, RH). */
export const HARE_TUBE = { trunk: 0, neck: 1, head: 2, earL: 3, earR: 4, tail: 5 } as const;
export const hareLegTube = (leg: number) => 6 + leg;

/** Bind pose from the rig standing still (animals/hare.ts hareBind): the body pivot (hip joints), the head bone (relative to the
 *  pivot, HARE_BODY.headY / headZ) and each leg's drawn joints in root space (fore: blade pivot, glenoid, elbow, wrist, toe;
 *  hind: hip, knee, hock, MTP, toe tip). */
export interface HareBind { pivot: Vec3; head: Vec3; ear: number; limbs: Vec3[][] }

export interface HareCoat { back: RGB; belly: RGB; dark: RGB; accent: RGB; foot: RGB; nose: RGB; tip: RGB; tipAmount: number }
/** Summer: grizzled rusty / greyish brown back, white belly, brownish ears with black tips (ADW); hind feet keep white patches
 *  (Hinterland Who's Who). Winter: white all over but the black ear tips (ADW). Shades [estimate: read from refs/hare/]. */
export const HARE_SUMMER: HareCoat = { back: [.36, .27, .18], belly: [.86, .84, .8], dark: [.07, .06, .055], accent: [.55, .45, .33], foot: [.72, .66, .56], nose: [.3, .2, .18], tip: [.1, .08, .06], tipAmount: .35 };
export const HARE_WINTER: HareCoat = { back: [.9, .9, .88], belly: [.93, .93, .91], dark: [.06, .055, .05], accent: [.9, .89, .86], foot: [.92, .92, .9], nose: [.4, .28, .26], tip: [.96, .96, .95], tipAmount: 0 };
const mixC = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mixCoat = (t: number): HareCoat => ({ back: mixC(HARE_SUMMER.back, HARE_WINTER.back, t), belly: mixC(HARE_SUMMER.belly, HARE_WINTER.belly, t), dark: mixC(HARE_SUMMER.dark, HARE_WINTER.dark, t),
  accent: mixC(HARE_SUMMER.accent, HARE_WINTER.accent, t), foot: mixC(HARE_SUMMER.foot, HARE_WINTER.foot, t), nose: mixC(HARE_SUMMER.nose, HARE_WINTER.nose, t),
  tip: mixC(HARE_SUMMER.tip, HARE_WINTER.tip, t), tipAmount: HARE_SUMMER.tipAmount + (HARE_WINTER.tipAmount - HARE_SUMMER.tipAmount) * t });

/**
 * Seasonal moult, Mills et al. 2013 PNAS 110(18):7360-7365 (doi:10.1073/pnas.1222724110, snowshoe hares, Seeley Lake MT): the
 * initiation dates are fixed by day length, ~10 Oct (autumn) and ~10 Apr (spring); the autumn brown-to-white moult takes about
 * 40 d every year; the spring white-to-brown rate is plastic (30-50 d) - modelled at its 40 d middle. Returns the whole-coat
 * whiteness 0 (summer brown) .. 1 (winter white) for a day of the year (1 = 1 Jan; any integer, wrapped to 365).
 */
export const MOULT = { autumnStart: 283, autumnDays: 40, springStart: 100, springDays: 40 };
export function moultWhiteness(dayOfYear: number) {
  const d = ((Math.floor(dayOfYear) - 1) % 365 + 365) % 365 + 1, M = MOULT;
  if (d >= M.autumnStart) return Math.min(1, (d - M.autumnStart) / M.autumnDays);
  if (d < M.springStart) return 1;
  return Math.max(0, 1 - (d - M.springStart) / M.springDays);
}
/** Where on the body the moult has got to: low parts (feet, legs, belly) turn first in autumn and stay white longest in spring;
 *  the back and head last [estimate: Hinterland Who's Who - hind feet keep white patches into summer]. `y` in metres. */
export const MOULT_SPREAD = .6;
export function localWhiteness(whole: number, y: number) {
  const order = Math.max(0, Math.min(1, y / .24)) * MOULT_SPREAD; // 0 at the ground .. MOULT_SPREAD at the top of the back
  return Math.max(0, Math.min(1, (whole * (1 + MOULT_SPREAD) - order) / 1));
}

const only = (b: number): Ring['w'] => [[b, 1]];
const blend = (a: number, b: number, wb: number): Ring['w'] => [[a, 1 - wb], [b, wb]];
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Leg girths (half-widths, m) at each drawn joint: [sagittal, lateral]. Muscular thigh in the haunch, slim shank, broad furred
 *  snowshoe hind foot; slim forelimb [estimate: drawn to the reference photos]. Hind foot width ~ the 8 cm print less its fur. */
const HIND_R: Array<[number, number]> = [[.026, .016], [.02, .013], [.011, .012], [.008, .02], [.006, .017]];
const FORE_R: Array<[number, number]> = [[.022, .02], [.014, .013], [.01, .01], [.008, .009], [.006, .011]];

/** Pelt: the dense downy underfur (25 mm, Sheriff et al. 2009) lying at ~45 deg reads as a solid layer ~18 mm deep over the
 *  body [estimate: 25 mm x sin 45]; the skin is drawn at that surface and the guard-hair cards rise from it. pelt 0 = the bare
 *  body, whose volume is the mass check. Thinner on the head and limbs, none on the nose and ears. */
export const PELT = { body: .018, head: .008, limb: .007, ear: .0015 };
export function hareTubes(bind: HareBind, coat: HareCoat = HARE_SUMMER, pelt = 1): Tube[] {
  const tubes = rawTubes(bind, coat, pelt), kind = (i: number) => i <= HARE_TUBE.neck || i === HARE_TUBE.tail ? PELT.body : i === HARE_TUBE.head ? PELT.head : i <= HARE_TUBE.earR ? PELT.ear : PELT.limb;
  return tubes.map((t, i) => ({ ...t, rings: t.rings.map(r => (r.fur ?? 1) < .03 ? r : { ...r, rx: r.rx + kind(i) * pelt, ry: r.ry + kind(i) * pelt }) }));
}
function rawTubes(bind: HareBind, coat: HareCoat, pelt: number): Tube[] {
  const B = HARE_BONE, [, py, pz] = bind.pivot, tubes: Tube[] = [];
  const palette = { back: coat.back, belly: coat.belly, dark: coat.dark, accent: coat.accent };
  const T = (z: number, y: number): Vec3 => [0, py + y, pz + z]; // trunk rings relative to the pivot
  const H = (x: number, y: number, z: number): Vec3 => [x, py + bind.head[1] + y, pz + bind.head[2] + z]; // head-bone space
  // Trunk: round rump behind the hip, the haunch over the hip joints (the back arches highest over the loins), tapering to a
  // narrow chest between the forelegs. Nose (head z -.05) to rump end +.07 = .42 m head-body.
  tubes.push({ ...palette, radial: 16, smooth: 1, lay: [0, -.1, 1], rings: [
    { p: T(.075, .02), rx: 0.014, ry: 0.019, w: only(B.body), fur: 1 },
    { p: T(.05, .022), rx: 0.025, ry: 0.036, w: only(B.body), fur: 1 },
    { p: T(.0, .022), rx: 0.026, ry: 0.040, w: only(B.body), fur: 1 },
    { p: T(-.07, .016), rx: 0.021, ry: 0.035, w: only(B.body), fur: 1 },
    { p: T(-.14, -.008), rx: 0.020, ry: 0.036, w: only(B.body), fur: 1 },
    { p: T(-.2, -.004), rx: 0.017, ry: 0.033, w: only(B.body), fur: 1 },
    { p: T(-.235, .02), rx: 0.012, ry: 0.019, w: blend(B.body, B.head, .2), fur: .95 },
  ] });
  // Neck into the back of the skull.
  tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, -.2, 1], rings: [
    { p: T(-.225, .02), rx: 0.018, ry: 0.023, w: only(B.body), fur: .95 },
    { p: H(0, -.02, .045), rx: 0.016, ry: 0.019, w: blend(B.body, B.head, .6), fur: .85 },
    { p: H(0, -.005, .025), rx: 0.015, ry: 0.017, w: only(B.head), fur: .8 },
  ] });
  // Head: rounded cranium, puffy buff cheeks, blunt muzzle, dark-brown nose leather (bare: fur < .03 grows no cards).
  tubes.push({ ...palette, radial: 14, smooth: 1, rings: [
    { p: H(0, .002, .03), rx: .022, ry: .024, w: only(B.head), fur: .7 },
    { p: H(0, .004, .008), rx: .027, ry: .029, w: only(B.head), fur: .6, accent: .25 },
    { p: H(0, -.002, -.018), rx: .025, ry: .026, w: only(B.head), fur: .5, accent: .55 },
    { p: H(0, -.009, -.036), rx: .019, ry: .02, w: only(B.head), fur: .4, accent: .5 },
    { p: H(0, -.013, -.048), rx: .012, ry: .013, w: only(B.head), fur: .3, accent: .3, pale: .2 },
    { p: H(0, -.013, -.054), rx: .006, ry: .006, w: only(B.head), fur: .02, dark: .8 },
  ] });
  // Ears: flat leaves, opening forward (ref), standing from the crown; brownish with black tips in summer, black tips in winter.
  for (const side of [-1, 1]) {
    const b = side < 0 ? B.earL : B.earR, E = bind.ear, base = H(side * .014, .02, .012);
    const at = (t: number): Vec3 => [base[0], base[1] + E * t, base[2] + .004 * t];
    tubes.push({ ...palette, radial: 10, smooth: 1, lay: [0, 1, 0], ref: [side * .8, 0, -.6], rings: [
      { p: at(0), rx: .009, ry: .007, w: blend(B.head, b, .5), fur: .5 },
      { p: at(.25), rx: .014, ry: .0045, w: only(b), fur: .4 },
      { p: at(.6), rx: .015, ry: .004, w: only(b), fur: .35, dark: .1 },
      { p: at(.85), rx: .012, ry: .0035, w: only(b), fur: .35, dark: .7 },
      { p: at(1), rx: .006, ry: .003, w: only(b), fur: .3, dark: 1 },
    ] });
  }
  // Tail: a short round puff, white below (the belly colour), 45 mm (ADW 39-52).
  tubes.push({ ...palette, radial: 10, lay: [0, .3, 1], rings: [
    { p: T(.06, .03), rx: .014, ry: .014, w: blend(B.body, B.tail, .5), fur: 1 },
    { p: T(.085, .035), rx: .016, ry: .015, w: only(B.tail), fur: .7, pale: .3 },
    { p: T(.1, .033), rx: .01, ry: .01, w: only(B.tail), fur: .6, pale: .5 },
  ] });
  // Legs: one smooth tube through the rig's joints, a ring at each joint (blending the two bones) and at each mid-segment. The
  // sagittal axis is rx (ref +x keeps the ring frame from flipping as the chain turns at the knee and hock); feet sit on the sole.
  const arms: Tube[] = [];
  bind.limbs.forEach((P, leg) => {
    const hind = leg % 2 === 1, R = hind ? HIND_R : FORE_R, bone = (s: number) => hareLegBone(leg, s), rings: Ring[] = [];
    // no ring reaches below the ground: a ring lower than its sagittal half-width (+ pelt) is lifted onto the sole
    const fur = (k: number) => hind ? (k >= 2.5 ? .55 : k >= 1.5 ? .5 : .75) : (k >= 3 ? .45 : .5);
    const ring = (p: Vec3, r: [number, number], w: Ring['w'], k: number): Ring => ({ p: [p[0], p[1] + Math.max(0, r[0] + PELT.limb * pelt - p[1]), p[2]], rx: r[0], ry: r[1], w, fur: fur(k), pale: hind ? (k >= 2.5 ? .75 : k >= 2 ? .3 : 0) : (k >= 3.5 ? .45 : 0) });
    const upper: Ring[] = [];
    if (hind) rings.push(ring(P[0], R[0], blend(B.body, bone(0), .5), 0));
    else { // the fore chain folds ~150 deg at the elbow (upper arm back, forearm down): the blade and upper arm are their own
      // short tube inside the chest, and the leg tube starts at the elbow, so no ring sits edge-on across the fold
      upper.push(ring(lerp3(P[0], P[1], .55), R[0], blend(B.body, bone(0), .6), 0), ring(P[1], R[1], blend(bone(0), bone(1), .5), 1),
        ring(lerp3(P[1], P[2], .5), R[1], only(bone(1)), 1.5), ring(P[2], R[2], blend(bone(1), bone(2), .5), 2));
      rings.push(ring(P[2], R[2], blend(bone(1), bone(2), .5), 2));
    }
    for (let k = hind ? 1 : 3; k < P.length; k++) {
      const mid: [number, number] = [(R[k - 1][0] + R[k][0]) / 2, (R[k - 1][1] + R[k][1]) / 2];
      rings.push(ring(lerp3(P[k - 1], P[k], .5), mid, only(bone(k - 1)), k - .5));
      rings.push(ring(P[k], R[k], k === P.length - 1 ? only(bone(k - 1)) : blend(bone(k - 1), bone(k), .5), k));
    }
    tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, -1, 0], ref: [1, 0, 0], rings });
    if (upper.length) arms.push({ ...palette, radial: 10, lay: [0, -1, 0], ref: [1, 0, 0], rings: upper });
  });
  tubes.push(...arms); // after the four leg tubes, so hareLegTube(leg) stays 6 + leg
  return tubes;
}
/** Eye sockets and the cheek bulge; returns the fur clear zones (eyes). Eye relative to the head bone [estimate: reference]. */
export const HARE_EYE_AT: Vec3 = [.022, .009, -.012];
export function sculptHare(body: BodyData, bind: HareBind): Array<{ center: Vec3; radius: number }> {
  const clear: Array<{ center: Vec3; radius: number }> = [];
  const head = (v: Vec3): Vec3 => [v[0], bind.pivot[1] + bind.head[1] + v[1], bind.pivot[2] + bind.head[2] + v[2]];
  for (const side of [-1, 1]) {
    const eye = head([side * HARE_EYE_AT[0], HARE_EYE_AT[1], HARE_EYE_AT[2]]);
    dent(body, HARE_TUBE.head, eye, .012, .004);
    push(body, HARE_TUBE.head, head([side * .02, -.01, -.02]), .016, [side * .003, -.002, 0]); // cheek
    clear.push({ center: eye, radius: .0095 });
  }
  return clear;
}

/** Volume of each closed tube (divergence theorem over its triangles), m3: the mass check (ADW 1.43-1.55 kg at ~1000 kg/m3). */
export function tubeVolumes(body: BodyData) {
  const vol = new Map<number, number>(), P = (i: number) => [body.position[i * 3], body.position[i * 3 + 1], body.position[i * 3 + 2]];
  for (let t = 0; t < body.index.length; t += 3) {
    const a = P(body.index[t]), b = P(body.index[t + 1]), c = P(body.index[t + 2]);
    const v = (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const k = body.tube[body.index[t]]; vol.set(k, (vol.get(k) ?? 0) + v);
  }
  return vol;
}

/** Volume of the union of the closed tubes (overlaps counted once), m3: Monte Carlo over the bounding box, a point is inside
 *  when a +x ray crosses some tube's surface an odd number of times. Seeded, so repeatable. */
export function unionVolume(body: BodyData, samples = 20000, seed = 7) {
  const tubes = new Map<number, number[]>(); for (let t = 0; t < body.index.length; t += 3) { const k = body.tube[body.index[t]]; (tubes.get(k) ?? tubes.set(k, []).get(k)!).push(t); }
  const P = body.position, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], P[i]); hi[i % 3] = Math.max(hi[i % 3], P[i]); }
  const boxes = [...tubes].map(([k, tris]) => { const l = [1e9, 1e9, 1e9], h = [-1e9, -1e9, -1e9]; for (const t of tris) for (let j = 0; j < 3; j++) for (let c = 0; c < 3; c++) { const v = P[body.index[t + j] * 3 + c]; l[c] = Math.min(l[c], v); h[c] = Math.max(h[c], v); } return { k, tris, l, h }; });
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let inside = 0;
  for (let n = 0; n < samples; n++) {
    const q = [lo[0] + (hi[0] - lo[0]) * rnd(), lo[1] + (hi[1] - lo[1]) * rnd(), lo[2] + (hi[2] - lo[2]) * rnd()];
    for (const b of boxes) {
      if (q[0] < b.l[0] || q[0] > b.h[0] || q[1] < b.l[1] || q[1] > b.h[1] || q[2] < b.l[2] || q[2] > b.h[2]) continue;
      let hits = 0;
      for (const t of b.tris) { // +x ray vs triangle, projected onto the y-z plane
        const a = body.index[t] * 3, c1 = body.index[t + 1] * 3, c2 = body.index[t + 2] * 3;
        const y0 = P[a + 1], z0 = P[a + 2], y1 = P[c1 + 1], z1 = P[c1 + 2], y2 = P[c2 + 1], z2 = P[c2 + 2];
        const d = (y1 - y0) * (z2 - z0) - (y2 - y0) * (z1 - z0); if (Math.abs(d) < 1e-14) continue;
        const u = ((q[1] - y0) * (z2 - z0) - (y2 - y0) * (q[2] - z0)) / d, v = ((y1 - y0) * (q[2] - z0) - (q[1] - y0) * (z1 - z0)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const x = P[a] + u * (P[c1] - P[a]) + v * (P[c2] - P[a]); if (x > q[0]) hits++;
      }
      if (hits % 2) { inside++; break; }
    }
  }
  return inside / samples * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}
