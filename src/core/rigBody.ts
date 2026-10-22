import { dent, push, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from './body';
import { stream } from '../proc/rng';

/**
 * Rig-skinned tube body (Grok Bot, T-0028): a SHARED generator that turns a body spec (data: ring tables, girths, coats, moult,
 * fur) plus the bind pose of a bounding-rig skeleton (animals/locomotion/bounding.ts limbPoints) into the tube skin of
 * core/body.ts (buildBody, dent, push), on a rig bone table: body (the hip pivot), head, two ears, tail, then one bone per rig
 * leg segment. Species are data (PROJECT-RULES): the snowshoe hare is the spec HARE_SKIN in animals/hare.ts; render/rigSkin.ts
 * assembles the skinned skin + fur. Pure (no THREE). Model space = the animal root: metres, feet at y 0, forward -z, origin on
 * the ground under the hip joints.
 */
export const RIG_BONE = { body: 0, head: 1, earL: 2, earR: 3, tail: 4 } as const;
export const RIG_LEG_SEGS = 4;
export const rigLegBone = (leg: number, seg: number) => 5 + leg * RIG_LEG_SEGS + seg;
export const RIG_BONE_COUNT = 5 + 4 * RIG_LEG_SEGS;
/** Tube order: trunk, neck, head, ears, tail, then one tube per leg (LF, LH, RF, RH), then the fore upper-arm tubes. */
export const RIG_TUBE = { trunk: 0, neck: 1, head: 2, earL: 3, earR: 4, tail: 5 } as const;
export const rigLegTube = (leg: number) => 6 + leg;

/** Bind pose: the body pivot (hip joints), the head bone relative to the pivot, ear length, and each leg's drawn joints in root
 *  space (fore: blade pivot, glenoid, elbow, wrist, toe; hind: hip, knee, hock, MTP, toe tip). */
export interface RigBind { pivot: Vec3; head: Vec3; ear: number; limbs: Vec3[][] }
export interface CoatPalette { back: RGB; belly: RGB; dark: RGB; accent: RGB; tip: RGB; tipAmount: number; /** scales the rings' dorsal `saddle` (0 = none in this coat) */ saddle?: number; /** skin shade under the cards in this coat (default fur.rootShade) */ rootShade?: number }
/** A ring of the spec: `at` trunk (z, y from the pivot) or head (z, y from the head bone); `head` / `tail` = weight toward that bone. */
export interface SpecRing { at: 'trunk' | 'head'; z: number; y: number; rx: number; ry: number; fur: number; head?: number; tail?: number; accent?: number; pale?: number; dark?: number; saddle?: number }
export interface Moult { autumnStart: number; autumnDays: number; springStart: number; springDays: number; /** order spread over the body height */ spread: number; height: number }
/** Leg girths [sagittal, lateral] half-widths at each drawn joint; fur / pale as steps along the chain: the value of the last
 *  [fromK, value] whose fromK <= k (k = joint index, .5 = mid-segment). */
export interface LegSpec { r: Array<[number, number]>; fur: Array<[number, number]>; pale: Array<[number, number]> }
export interface SkinSpec {
  name: string;
  trunk: SpecRing[]; neck: SpecRing[]; head: SpecRing[]; tail: SpecRing[];
  /** ear: base (head-bone space, x mirrored), rings along it at t (0 base .. 1 tip of `bind.ear`) */
  ear: { base: Vec3; lean: number; rings: Array<{ t: number; rx: number; ry: number; fur: number; dark?: number; rim?: number }> };
  /** leg girths [sagittal, lateral] half-widths at each drawn joint, and fur / pale per joint (mid rings average) */
  fore: LegSpec; hind: LegSpec;
  pelt: { body: number; head: number; limb: number; ear: number };
  eye: Vec3; eyeClear: number; cheek?: { at: Vec3; radius: number; offset: Vec3 };
  /** dark eyelid ring: skin within `radius` of the eye blends `amount` toward the dark colour */
  eyelid?: { radius: number; amount: number };
  /** winter pelt multiplier (the winter skin + fur are a morph target of the summer one: a rounder winter body) */
  winterPelt?: number;
  summer: CoatPalette; winter: CoatPalette; moult: Moult;
  fur: { cards: number; winterLength: number; summerLength: number; width: number; summerDensity: number; lean: number; tone: number; rootShade: number; bareShade: number; seed: number };
}

/** Whole-coat whiteness (0 summer .. 1 winter) for a day of the year (1 = 1 Jan; wrapped to 365) from the spec's moult dates. */
export function seasonalWhiteness(dayOfYear: number, M: Moult) {
  const d = ((Math.floor(dayOfYear) - 1) % 365 + 365) % 365 + 1;
  if (d >= M.autumnStart) return Math.min(1, (d - M.autumnStart) / M.autumnDays);
  if (d < M.springStart) return 1;
  return Math.max(0, 1 - (d - M.springStart) / M.springDays);
}
/** Where on the body the moult has got to: low parts turn first and stay white longest; `y` in metres. */
export function localWhiteness(whole: number, y: number, M: Pick<Moult, 'spread' | 'height'>) {
  const order = Math.max(0, Math.min(1, y / M.height)) * M.spread;
  return Math.max(0, Math.min(1, whole * (1 + M.spread) - order));
}

const only = (b: number): Ring['w'] => [[b, 1]];
const blend = (a: number, b: number, wb: number): Ring['w'] => [[a, 1 - wb], [b, wb]];
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The spec's tubes over a bind pose in one coat; `pelt` 0 = the bare body (mass check), 1 = drawn with the underfur layer. */
export function rigTubes(bind: RigBind, spec: SkinSpec, coat: CoatPalette = spec.summer, pelt = 1): Tube[] {
  const B = RIG_BONE, [, py, pz] = bind.pivot, P = spec.pelt, tubes: Tube[] = [];
  const palette = { back: coat.back, belly: coat.belly, dark: coat.dark, accent: coat.accent };
  const H = (x: number, y: number, z: number): Vec3 => [x, py + bind.head[1] + y, pz + bind.head[2] + z];
  // pelt > 1 (the winter morph) thickens the body and limbs only: the head and ears keep their size so the eyes stay on the surface
  const grow = (r: number, fur: number, by: number, fixed = false) => fur < .03 ? r : r + by * (fixed ? Math.min(1, pelt) : pelt);
  const ring = (s: SpecRing, by: number, fixed = false): Ring => {
    const p: Vec3 = s.at === 'trunk' ? [0, py + s.y, pz + s.z] : H(0, s.y, s.z);
    const w: Ring['w'] = s.head ? blend(B.body, B.head, s.head) : s.tail ? (s.tail >= 1 ? only(B.tail) : blend(B.body, B.tail, s.tail)) : s.at === 'head' ? only(B.head) : only(B.body);
    return { p, rx: grow(s.rx, s.fur, by, fixed), ry: grow(s.ry, s.fur, by, fixed), w, fur: s.fur, accent: s.accent, pale: s.pale, dark: s.dark, saddle: (s.saddle ?? 0) * (coat.saddle ?? 1) };
  };
  tubes.push({ ...palette, radial: 16, smooth: 1, lay: [0, -.1, 1], rings: spec.trunk.map(s => ring(s, P.body)) });
  tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, -.2, 1], rings: spec.neck.map(s => ring(s, P.body)) });
  tubes.push({ ...palette, radial: 14, smooth: 1, rings: spec.head.map(s => ring(s, P.head, true)) });
  for (const side of [-1, 1]) { // ears: flat leaves standing from the crown, opening forward and out (ref)
    const b = side < 0 ? B.earL : B.earR, E = bind.ear, base = H(side * spec.ear.base[0], spec.ear.base[1], spec.ear.base[2]);
    tubes.push({ ...palette, radial: 10, smooth: 1, lay: [0, 1, 0], ref: [side * .8, 0, -.6], rings: spec.ear.rings.map((e, i) => ({
      p: [base[0], base[1] + E * e.t, base[2] + spec.ear.lean * e.t] as Vec3, rx: grow(e.rx, e.fur, P.ear, true), ry: grow(e.ry, e.fur, P.ear, true),
      w: i === 0 ? blend(B.head, b, .5) : only(b), fur: e.fur, dark: e.dark, rim: e.rim })) });
  }
  tubes.push({ ...palette, radial: 10, lay: [0, .3, 1], rings: spec.tail.map(s => ring(s, P.body)) });
  // Legs: one smooth tube through the rig's joints, a ring at each joint (blending the two bones) and mid-segment; rx is the
  // sagittal axis (ref +x keeps the ring frame from flipping at the knee and hock); no ring reaches below the ground.
  const arms: Tube[] = [];
  bind.limbs.forEach((J, leg) => {
    const hind = leg % 2 === 1, L = hind ? spec.hind : spec.fore, bone = (s: number) => rigLegBone(leg, s), rings: Ring[] = [];
    const at = (steps: Array<[number, number]>, k: number) => steps.reduce((v, [from, x]) => k >= from ? x : v, steps[0][1]);
    const mk = (p: Vec3, r: [number, number], w: Ring['w'], k: number): Ring => { const rx = r[0] + P.limb * pelt, ry = r[1] + P.limb * pelt;
      return { p: [p[0], p[1] + Math.max(0, rx - p[1]), p[2]], rx, ry, w, fur: at(L.fur, k), pale: at(L.pale, k) }; };
    const upper: Ring[] = [];
    if (hind) rings.push(mk(J[0], L.r[0], blend(B.body, bone(0), .5), 0));
    else { // the fore chain folds ~150 deg at the elbow: blade + upper arm are their own short tube inside the chest
      upper.push(mk(lerp3(J[0], J[1], .55), L.r[0], blend(B.body, bone(0), .6), 0), mk(J[1], L.r[1], blend(bone(0), bone(1), .5), 1),
        mk(lerp3(J[1], J[2], .5), L.r[1], only(bone(1)), 1.5), mk(J[2], L.r[2], blend(bone(1), bone(2), .5), 2));
      rings.push(mk(J[2], L.r[2], blend(bone(1), bone(2), .5), 2));
    }
    for (let k = hind ? 1 : 3; k < J.length; k++) {
      const mid: [number, number] = [(L.r[k - 1][0] + L.r[k][0]) / 2, (L.r[k - 1][1] + L.r[k][1]) / 2];
      rings.push(mk(lerp3(J[k - 1], J[k], .5), mid, only(bone(k - 1)), k - .5));
      rings.push(mk(J[k], L.r[k], k === J.length - 1 ? only(bone(k - 1)) : blend(bone(k - 1), bone(k), .5), k));
    }
    tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, -1, 0], ref: [1, 0, 0], rings });
    if (upper.length) arms.push({ ...palette, radial: 10, lay: [0, -1, 0], ref: [1, 0, 0], rings: upper });
  });
  tubes.push(...arms);
  return tubes;
}

/** Eye sockets and cheek bulge from the spec; returns the fur clear zones (eyes). */
export function sculptRig(body: BodyData, bind: RigBind, spec: SkinSpec): Array<{ center: Vec3; radius: number }> {
  const clear: Array<{ center: Vec3; radius: number }> = [];
  const head = (v: Vec3): Vec3 => [v[0], bind.pivot[1] + bind.head[1] + v[1], bind.pivot[2] + bind.head[2] + v[2]];
  for (const side of [-1, 1]) {
    const eye = head([side * spec.eye[0], spec.eye[1], spec.eye[2]]);
    dent(body, RIG_TUBE.head, eye, .012, .004);
    if (spec.eyelid) { const { radius, amount } = spec.eyelid, dk = spec.summer.dark; // the dark of either coat: near-black
      for (let v = 0; v < body.tube.length; v++) { if (body.tube[v] !== RIG_TUBE.head) continue;
        const d = Math.hypot(body.position[v * 3] - eye[0], body.position[v * 3 + 1] - eye[1], body.position[v * 3 + 2] - eye[2]);
        const w = amount * Math.max(0, Math.min(1, (radius - d) / (radius * .5))); for (let k = 0; k < 3; k++) body.color[v * 3 + k] += (dk[k] - body.color[v * 3 + k]) * w; } }
    if (spec.cheek) push(body, RIG_TUBE.head, head([side * spec.cheek.at[0], spec.cheek.at[1], spec.cheek.at[2]]), spec.cheek.radius, [side * spec.cheek.offset[0], spec.cheek.offset[1], spec.cheek.offset[2]]);
    clear.push({ center: eye, radius: spec.eyeClear });
  }
  return clear;
}

/** Volume of the union of the closed tubes (overlaps counted once), m3: Monte Carlo over the bounding box (seeded through
 *  proc/rng), a point is inside when a +x ray crosses some tube's surface an odd number of times. The mass check. */
export function unionVolume(body: BodyData, samples = 20000, seed = 7) {
  const tubes = new Map<number, number[]>(); for (let t = 0; t < body.index.length; t += 3) { const k = body.tube[body.index[t]]; (tubes.get(k) ?? tubes.set(k, []).get(k)!).push(t); }
  const Pp = body.position, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < Pp.length; i++) { lo[i % 3] = Math.min(lo[i % 3], Pp[i]); hi[i % 3] = Math.max(hi[i % 3], Pp[i]); }
  const boxes = [...tubes].map(([, tris]) => { const l = [1e9, 1e9, 1e9], h = [-1e9, -1e9, -1e9]; for (const t of tris) for (let j = 0; j < 3; j++) for (let c = 0; c < 3; c++) { const v = Pp[body.index[t + j] * 3 + c]; l[c] = Math.min(l[c], v); h[c] = Math.max(h[c], v); } return { tris, l, h }; });
  const rnd = stream(seed, 'rig-volume'); let inside = 0;
  for (let n = 0; n < samples; n++) {
    const q = [lo[0] + (hi[0] - lo[0]) * rnd(), lo[1] + (hi[1] - lo[1]) * rnd(), lo[2] + (hi[2] - lo[2]) * rnd()];
    for (const b of boxes) {
      if (q[0] < b.l[0] || q[0] > b.h[0] || q[1] < b.l[1] || q[1] > b.h[1] || q[2] < b.l[2] || q[2] > b.h[2]) continue;
      let hits = 0;
      for (const t of b.tris) {
        const a = body.index[t] * 3, c1 = body.index[t + 1] * 3, c2 = body.index[t + 2] * 3;
        const y0 = Pp[a + 1], z0 = Pp[a + 2], y1 = Pp[c1 + 1], z1 = Pp[c1 + 2], y2 = Pp[c2 + 1], z2 = Pp[c2 + 2];
        const d = (y1 - y0) * (z2 - z0) - (y2 - y0) * (z1 - z0); if (Math.abs(d) < 1e-14) continue;
        const u = ((q[1] - y0) * (z2 - z0) - (y2 - y0) * (q[2] - z0)) / d, v = ((y1 - y0) * (q[2] - z0) - (q[1] - y0) * (z1 - z0)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        if (Pp[a] + u * (Pp[c1] - Pp[a]) + v * (Pp[c2] - Pp[a]) > q[0]) hits++;
      }
      if (hits % 2) { inside++; break; }
    }
  }
  return inside / samples * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}
