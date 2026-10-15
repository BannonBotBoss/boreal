import { limbOf, isFrontLeg, type LegDims } from './animalBehavior';
import { dent, push, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from './body';

/**
 * Procedural bear, built on the same tube skin, skinning, IK and fur cards as the wolf. Model space is metres (no extra scale):
 * feet at y 0, forward is −z.
 *
 * Plantigrade stance: the foot bone (metacarpus / metatarsus) lies almost flat, so the whole sole from heel to toes rests on the
 * ground; the paw bone keeps the toes level and carries five non-retractable curved claws (long on the front paws, short behind).
 * Grizzly proportions (adult): shoulder (hump) height about 1.05 m on all fours, body about 1.9 m, hind foot about 30 cm.
 */
export type BearVariant = 'grizzly' | 'black';

/**
 * Legs, metres. Front: shoulder blade 0.2, upper arm 0.34, forearm 0.32, forefoot 0.2 lying ~77° from vertical (heel slightly up).
 * Rear: thigh 0.36, shank 0.34 (stifle forward), hind foot 0.26 lying ~86° from vertical (flat, heel on the ground).
 */
export const BEAR_LEGS: LegDims = {
  hip: .62, upper: .34, lower: .32, foot: .2, footAngle: 1.35, footFlex: .5, girdle: .2, girdleRest: .25, girdleSwing: .25, bend: 'back', stance: .14,
  hind: { hip: .66, upper: .36, lower: .34, foot: .26, footAngle: 1.5, footFlex: .6, bend: 'forward', stance: .2 },
};
export const BEAR_BONE = { torso: 0, head: 1, jaw: 2, tail: 3 } as const;
export const bearLegBone = (leg: number) => { const b = 4 + leg * 5; return { girdle: b, leg: b + 1, knee: b + 2, wrist: b + 3, paw: b + 4 }; };
export const BEAR_BONE_COUNT = 4 + 4 * 5;
/** Leg order matches quadrupedPose: left-front, left-rear, right-front, right-rear. A bear stands wide. */
export const BEAR_LEG_XZ: Array<[number, number]> = [[-.2, -.4], [-.21, .55], [.2, -.4], [.21, .55]];
export const BEAR_HEAD_AT: Vec3 = [0, .84, -.8], BEAR_JAW_AT: Vec3 = [0, -.1, -.02], BEAR_TAIL_AT: Vec3 = [0, .76, .78];
/** Eye centre relative to the head bone: on the front-facing slope where the broad forehead meets the snout. */
export const BEAR_EYE_AT: Vec3 = [.088, .058, -.229];
export const BEAR_TUBE = { trunk: 0, hump: 1, skull: 2, jaw: 3, earL: 4, earR: 5 } as const;
/** Upper-skull profile (z, centre y, half-width, half-height) relative to the head bone; the dish is the dip at z −0.25. */
export const BEAR_SKULL: number[][] = [
  [.04, 0, .2, .19], [-.07, .01, .23, .19], [-.17, 0, .18, .15], [-.25, -.035, .125, .1], [-.31, -.045, .115, .093], [-.37, -.042, .108, .088], [-.405, -.045, .098, .075],
];

/** Tube indices of each leg's foot pad and toes (wolfTubes order: 6 head/body tubes, then leg, foot pad, toes per leg). */
export const bearFootTubes = (leg: number) => ({ pad: 6 + leg * 3 + 1, toes: 6 + leg * 3 + 2 });
export const bearLimb = (i: number) => { const L = limbOf(BEAR_LEGS, i); return { hip: L.hip, upper: L.upper, lower: L.lower, foot: L.foot ?? 0, girdle: L.girdle ?? 0 }; };

export interface BearCoat { back: RGB; belly: RGB; dark: RGB; accent: RGB; grizzle: RGB | null }
/** Grizzly: dark brown with silver-blond grizzled tips; black bear: near-black with the typical brown muzzle, no grizzling. */
export function bearCoat(variant: BearVariant, seed = 1): BearCoat {
  const h = (n: number) => { const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const j = (c: RGB, a: number): RGB => c.map(v => v * (1 + (h(2) - .5) * 2 * a)) as RGB;
  return variant === 'grizzly'
    ? { back: j([.2, .13, .075], .1), belly: [.15, .1, .065], dark: [.06, .045, .035], accent: [.42, .31, .2], grizzle: [.78, .68, .52] }
    : { back: j([.075, .068, .065], .1), belly: [.09, .08, .075], dark: [.03, .03, .03], accent: [.48, .36, .24], grizzle: null };
}

export function bearTubes(coat: BearCoat, variant: BearVariant = 'grizzly'): Tube[] {
  const H = (x: number, y: number, z: number): Vec3 => [x, BEAR_HEAD_AT[1] + y, BEAR_HEAD_AT[2] + z];
  const palette = { back: coat.back, belly: coat.belly, dark: coat.dark, accent: coat.accent };
  const only = (b: number): Ring['w'] => [[b, 1]];
  const blend = (a: number, b: number, wb: number): Ring['w'] => [[a, 1 - wb], [b, wb]];
  const B = BEAR_BONE, tubes: Tube[] = [];

  // Trunk: a thick barrel from the rump to the shoulders, then a neck as wide as the shoulders (no taper) running into the head.
  tubes.push({ ...palette, radial: 16, smooth: 1, lay: [0, -.15, 1], rings: [
    { p: [0, .7, .82], rx: .17, ry: .19, w: blend(B.torso, B.tail, .2), fur: 1 },
    { p: [0, .7, .66], rx: .3, ry: .29, w: only(B.torso), fur: 1 },
    { p: [0, .68, .38], rx: .36, ry: .31, w: only(B.torso), fur: 1 },
    { p: [0, .67, .06], rx: .38, ry: .32, w: only(B.torso), fur: 1.05 },
    { p: [0, .67, -.24], rx: .36, ry: .33, w: only(B.torso), fur: 1.15 },
    { p: [0, .74, -.48], rx: .31, ry: .3, w: only(B.torso), fur: 1.3 },
    { p: [0, .78, -.64], rx: .27, ry: .25, w: blend(B.torso, B.head, .35), fur: 1.4 }, // neck ruff
    { p: [0, .82, -.76], rx: .24, ry: .23, w: blend(B.torso, B.head, .8), fur: 1.3 },
  ] });
  // Shoulder hump: the grizzly's muscle mass over the shoulder blades, highest point of the back. A black bear has none.
  const hump = variant === 'grizzly' ? 1 : 0;
  tubes.push({ ...palette, radial: 14, smooth: 1, lay: [0, -.2, 1], rings: [
    { p: [0, .85 + .07 * hump, -.6], rx: .1, ry: .06, w: only(B.torso), fur: 1.4 },
    { p: [0, .85 + .13 * hump, -.46], rx: .2, ry: .03 + .1 * hump, w: only(B.torso), fur: 1.5 },
    { p: [0, .85 + .13 * hump, -.3], rx: .22, ry: .03 + .11 * hump, w: only(B.torso), fur: 1.5 },
    { p: [0, .85 + .1 * hump, -.12], rx: .17, ry: .03 + .05 * hump, w: only(B.torso), fur: 1.3 },
  ] });

  // Skull and snout: a broad massive cranium, the dished (concave) bridge, then a wide blunt snout ending in the nose leather.
  const furAt = [.7, .65, .55, .35, .3, .25, .05], darkAt = [0, 0, 0, 0, 0, .3, 1], accentAt = [0, 0, .1, .45, .65, .7, 0];
  tubes.push({ ...palette, radial: 16, smooth: 1, rings: BEAR_SKULL.map(([z, cy, rx, ry], i) => ({
    p: H(0, cy, z), rx, ry, w: only(B.head), fur: furAt[i], dark: darkAt[i], accent: accentAt[i], sq: i >= 4 ? 2.5 : 2,
  })) });
  // Lower jaw, hinged under the rear of the skull; tan lips, closed.
  tubes.push({ ...palette, back: coat.accent, belly: coat.accent, radial: 12, rings: [
    { p: H(0, -.1, .0), rx: .15, ry: .07, w: blend(B.head, B.jaw, .5), fur: .7 },
    { p: H(0, -.11, -.14), rx: .13, ry: .055, w: only(B.jaw), fur: .45 },
    { p: H(0, -.105, -.27), rx: .095, ry: .045, w: only(B.jaw), fur: .3 },
    { p: H(0, -.095, -.36), rx: .07, ry: .035, w: only(B.jaw), fur: .2, dark: .4 },
  ] });
  // Ears: small, round and cupped, set wide on the skull, facing forward and a little out.
  for (const side of [-1, 1]) tubes.push({ ...palette, radial: 12, lay: [0, 1, 0], ref: [side * .45, 0, -.89], rings: [
    { p: H(side * .155, .15, 0), rx: .058, ry: .026, w: only(B.head), fur: .18 },
    { p: H(side * .18, .215, .005), rx: .05, ry: .022, w: only(B.head), fur: .15 },
  ] });

  // Legs: massive pillars; lower legs darker. Each foot is a flat pad on the foot bone, then toes on the paw bone.
  BEAR_LEG_XZ.forEach(([x, z], i) => {
    const b = bearLegBone(i), m = bearLimb(i), front = isFrontLeg(i);
    const Jy = m.hip, Gy = Jy + m.girdle, Ky = Jy - m.upper, Wy = Ky - m.lower, Py = Wy - m.foot;
    const at = (y: number, dz = 0): Vec3 => [x, y, z + dz];
    const r = (y: number, rx: number, ry: number, w: Ring['w'], fur: number, dark = 0): Ring => ({ p: at(y), rx, ry, w, fur, dark });
    const rings: Ring[] = front ? [
      r(Gy, .16, .2, blend(B.torso, b.girdle, .5), 1.3),
      r((Gy + Jy) / 2, .17, .2, only(b.girdle), 1.3),
      r(Jy, .155, .18, blend(b.girdle, b.leg, .5), 1.1),
      r(Jy - m.upper * .5, .135, .16, only(b.leg), 1, .1),
      r(Ky, .115, .135, blend(b.leg, b.knee, .5), .9, .25),
      r(Ky - m.lower * .5, .1, .115, only(b.knee), .8, .45),
      r(Wy + .08, .085, .085, blend(b.knee, b.wrist, .3), .7, .6),
    ] : [
      r(Jy + .1, .2, .24, only(B.torso), 1),
      r(Jy, .2, .25, blend(B.torso, b.leg, .5), 1),
      r(Jy - m.upper * .45, .17, .21, only(b.leg), 1, .1),
      r(Ky, .125, .15, blend(b.leg, b.knee, .5), .9, .3),
      r(Ky - m.lower * .5, .105, .12, only(b.knee), .8, .5),
      r(Wy + .09, .09, .09, blend(b.knee, b.wrist, .3), .7, .6),
    ];
    tubes.push({ ...palette, smooth: 1, radial: 14, lay: [0, -1, 0], rings });
    // Foot pad along the foot bone. In the bind pose the bone hangs straight down and the tube's "up" axis points forward; posed, the
    // bone lies nearly flat and that axis points up, so shifting the rings forward by their half-height puts the sole on the bone line.
    const ry = front ? .045 : .05, wide = front ? .1 : .095;
    tubes.push({ ...palette, radial: 12, lay: [0, -1, 0], rings: [
      { p: at(Wy, -ry * .6), rx: wide * .9, ry: ry * 1.3, w: blend(b.knee, b.wrist, .4), fur: .6, dark: .6 },
      { p: at((Wy + Py) / 2, -ry), rx: wide, ry, w: only(b.wrist), fur: .5, dark: .7 },
      { p: at(Py + .02, -ry), rx: wide * 1.05, ry, w: blend(b.wrist, b.paw, .4), fur: .45, dark: .7 },
    ] });
    // Toes on the paw bone (level with the ground): a broad rounded front edge where the claws come out.
    tubes.push({ ...palette, radial: 12, lay: [0, 0, -1], rings: [
      { p: at(Py + .04, .02), rx: wide * 1.05, ry: .04, w: only(b.paw), fur: .4, dark: .7 },
      { p: at(Py + .04, -.04), rx: wide * 1.08, ry: .04, w: only(b.paw), fur: .35, dark: .75 },
      { p: at(Py + .033, -.08), rx: wide * .95, ry: .032, w: only(b.paw), fur: .25, dark: .8 },
    ] });
  });
  // Short tail, nearly hidden in the rump fur.
  tubes.push({ ...palette, radial: 8, rings: [
    { p: [0, BEAR_TAIL_AT[1], BEAR_TAIL_AT[2]], rx: .05, ry: .05, w: blend(B.torso, B.tail, .5), fur: 1 },
    { p: [0, BEAR_TAIL_AT[1] - .02, BEAR_TAIL_AT[2] + .09], rx: .035, ry: .035, w: only(B.tail), fur: .9 },
  ] });
  return tubes;
}

/** Face sculpting: deep forward-facing eye sockets under a heavy brow, and cupped ears. Returns the fur clear zones (eyes). */
export function sculptBear(body: BodyData): Array<{ center: Vec3; radius: number }> {
  const clear: Array<{ center: Vec3; radius: number }> = [];
  const head = (v: Vec3): Vec3 => [BEAR_HEAD_AT[0] + v[0], BEAR_HEAD_AT[1] + v[1], BEAR_HEAD_AT[2] + v[2]];
  for (const side of [-1, 1]) {
    const eye = head([side * BEAR_EYE_AT[0], BEAR_EYE_AT[1], BEAR_EYE_AT[2]]);
    dent(body, BEAR_TUBE.skull, eye, .045, .02); // deep socket
    push(body, BEAR_TUBE.skull, [eye[0] * 1.05, eye[1] + .035, eye[2] + .01], .045, [side * .004, .006, -.012]); // brow overhang
    clear.push({ center: eye, radius: .034 });
    // Cupped ear: press the front face in.
    const tube = side < 0 ? BEAR_TUBE.earL : BEAR_TUBE.earR;
    dent(body, tube, head([side * .17, .19, -.03]), .045, .014);
  }
  return clear;
}
