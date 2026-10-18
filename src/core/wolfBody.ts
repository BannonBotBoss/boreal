import { WOLF_LEGS, limbOf, isFrontLeg } from './animalBehavior';
import { WOLF_SCALE } from './wolfModes';
import { computeNormals, dent, push, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from './body';
import { random } from '../proc/rng';

/**
 * The wolf's skin as tubes, in model space (feet at 0, ear tips at 0.5, before WOLF_SCALE, so ×200 gives cm) at the
 * straight bind pose. Bone order is fixed here and used by the renderer when it builds the skeleton.
 *
 * Skeleton (digitigrade): torso → cranium (head) → jaw, hinged at the rear skull base below the ears; torso → a 4-bone tail chain;
 * and per leg a 5-bone chain from the root: girdle (shoulder blade; zero length on the rear legs) → upper bone → lower bone → foot
 * bone → paw. Front: shoulder → upper arm → forearm → wrist (carpus) → paw. Rear: hip → thigh → stifle (points forward) → hock
 * (points back) → paw. Lengths come from WOLF_LEGS.
 *
 * Proportions follow published gray-wolf measurements (Wikipedia "Wolf"; adult): shoulder height 80–85 cm, skull length
 * 23–28 cm and width 13–15 cm, ear height 9–11 cm, tail 29–50 cm, hind foot 22–25 cm, guard hair 6–7 cm on the back and
 * 9–13 cm on the shoulders. A wolf is narrow-chested with a deep rib cage, a thick muscular neck, a broad forehead with a
 * long blunt muzzle, and large paws. `tests/body.test.ts` checks these ranges.
 */
export const BONE = { torso: 0, head: 1, jaw: 2, tail: 3 } as const;
/** Tail chain: four bones, root to tip. */
export const TAIL_BONES = [3, 4, 5, 6] as const;
export const TAIL_SEG = .055;
/** Per-leg bones, in order from the top. */
export const legBone = (leg: number) => { const b = 7 + leg * 5; return { girdle: b, leg: b + 1, knee: b + 2, wrist: b + 3, paw: b + 4 }; };
export const BONE_COUNT = 7 + 4 * 5;
/** Leg lengths of leg i in model units. */
export function limbModel(i: number) {
  const L = limbOf(WOLF_LEGS, i), u = (v?: number) => (v ?? 0) / WOLF_SCALE;
  return { hip: u(L.hip), upper: u(L.upper), lower: u(L.lower), foot: u(L.foot), girdle: u(L.girdle) };
}
/** Leg order matches quadrupedPose: left-front, left-rear, right-front, right-rear (−z is forward). A wolf's legs sit close under a narrow chest. */
export const LEG_XZ: Array<[number, number]> = [[-.05, -.12], [-.05, .15], [.05, -.12], [.05, .15]];
/** Cranium pivot (back of the skull, where it meets the neck), jaw hinge (rear skull base, relative to the head), tail root, eye centre (relative to the head). */
export const HEAD_AT: Vec3 = [0, .405, -.325], JAW_AT: Vec3 = [0, -.03, .008], TAIL_AT: Vec3 = [0, .28, .2], EYE_AT: Vec3 = [.025, .013, -.04];
/** Tube indices, so the sculpting and tests can name the skull. */
export const TUBE = { trunk: 0, skull: 1, jaw: 2, earL: 3, earR: 4 } as const;

/** Ear geometry: base point, direction up the ear (t), the way the cup faces (n: forward and outward) and the across-ear axis (w), cranium-relative. */
export function earFrame(side: number) {
  const base: Vec3 = [side * .04, .042, 0], tip: Vec3 = [side * .0708, .09193, -.006]; // flared ~10° further outward than upright-ish
  const d = [tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]], l = Math.hypot(...d), t: Vec3 = [d[0] / l, d[1] / l, d[2] / l];
  const nn = Math.hypot(side * .25, .97), n: Vec3 = [side * .25 / nn, 0, -.97 / nn]; // cup faces forward, turned ~15° outward
  const c: Vec3 = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]], cl = Math.hypot(...c);
  return { base, tip, t, n, w: [c[0] / cl, c[1] / cl, c[2] / cl] as Vec3, length: l };
}
/** Upper-jaw outline (z, centre y, half-width, half-height) in cranium space and lower-jaw outline in cranium space too; teeth and lips follow them. */
const UPPER_OUTLINE = [[.03, 0, .042, .036], [.01, .004, .049, .04], [-.022, .002, .043, .037], [-.035, -.0055, .031, .029], [-.048, -.0095, .0297, .0285], [-.07, -.0155, .0237, .0196], [-.088, -.0175, .0215, .0166], [-.099, -.0175, .019, .015]];
const LOWER_OUTLINE = [[.012, -.031, .02, .014], [-.02, -.036, .0205, .0126], [-.048, -.038, .0185, .0102], [-.068, -.038, .0145, .009], [-.086, -.0365, .0105, .0078]];
const outlineAt = (rings: number[][], z: number) => { for (let i = 0; i < rings.length - 1; i++) { const [a, b] = [rings[i], rings[i + 1]]; if (z <= a[0] && z >= b[0]) { const t = (a[0] - z) / (a[0] - b[0]); return a.map((v, k) => v + (b[k] - v) * t); } } return rings[rings.length - 1]; };
const LIP_FRACTION = .6; // how far out along the half-width the lips and teeth sit

export function wolfTubes(coat: { back: RGB; belly: RGB; dark: RGB; accent?: RGB }): Tube[] {
  const H = (x: number, y: number, z: number): Vec3 => [x, HEAD_AT[1] + y, HEAD_AT[2] + z];
  const T = (z: number): Vec3 => [0, TAIL_AT[1], TAIL_AT[2] + z];
  const palette = { back: coat.back, belly: coat.belly, dark: coat.dark, accent: coat.accent };
  const only = (b: number): Array<[number, number]> => [[b, 1]];
  const blend = (a: number, b: number, wb: number): Array<[number, number]> => [[a, 1 - wb], [b, wb]];
  const tubes: Tube[] = [];

  // Trunk: heavy hindquarters, a tucked-up loin behind a deep ribcage, a thick shoulder ruff, and a short massive neck
  // rising to the head. The neck end blends from torso to head so the head turns smoothly. A dark saddle runs along the
  // back; fur is longest on the neck and shoulders (the ruff).
  tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, -.3, 1], rings: [
    { p: [0, .285, .185], rx: .03, ry: .05, w: blend(BONE.torso, BONE.tail, .15), fur: .9, saddle: .5 },
    { p: [0, .304, .15], rx: .048, ry: .076, w: only(BONE.torso), fur: 1, saddle: .55 },
    { p: [0, .314, .09], rx: .048, ry: .066, w: only(BONE.torso), fur: 1, saddle: .6 },
    { p: [0, .315, .02], rx: .05, ry: .07, w: only(BONE.torso), fur: 1.05, saddle: .6 },
    { p: [0, .3135, -.07], rx: .054, ry: .0815, w: only(BONE.torso), fur: 1.2, saddle: .6 },
    { p: [0, .3165, -.135], rx: .057, ry: .0885, w: only(BONE.torso), fur: 1.05, saddle: .55 },
    { p: [0, .345, -.19], rx: .056, ry: .092, w: blend(BONE.torso, BONE.head, .2), fur: 1.28, saddle: .4 },
    { p: [0, .383, -.25], rx: .051, ry: .071, w: blend(BONE.torso, BONE.head, .6), fur: 1.2, saddle: .25 },
    { p: [0, .405, -.29], rx: .044, ry: .056, w: only(BONE.head), fur: 1.2 },
  ] });

  // Upper skull and muzzle: broad forehead, a stop, a straight nose bridge, then a tapered blunt muzzle. The snout is fixed to the
  // skull and its dark tip is the nose. Fur is fuller at the back of the skull (cheek ruff) and very short on the muzzle.
  const mouthRoof = [.55, .22, .26] as RGB, jawFloor = [.5, .22, .27] as RGB;
  tubes.push({ ...palette, radial: 14, smooth: 1, lining: mouthRoof, rings: [
    { p: H(0, 0, .03), rx: .042, ry: .036, w: only(BONE.head), fur: 1.2, saddle: .5 },
    { p: H(0, .004, .01), rx: .049, ry: .04, w: only(BONE.head), fur: 1.1, saddle: .35, accent: .25 },
    { p: H(0, .002, -.022), rx: .043, ry: .037, w: only(BONE.head), fur: .8, accent: .55, under: .5 },
    { p: H(0, -.0055, -.035), rx: .031, ry: .029, w: only(BONE.head), fur: .7, accent: .55, under: .7, sq: 2.3 }, // the stop: the forehead drops steeply here
    { p: H(0, -.0095, -.048), rx: .0297, ry: .0285, w: only(BONE.head), fur: .85, pale: .2, accent: .55, under: .9, sq: 3.2 },
    { p: H(0, -.0155, -.07), rx: .0237, ry: .0196, w: only(BONE.head), fur: .75, pale: .4, accent: .35, under: .9, sq: 3.5 },
    { p: H(0, -.0175, -.088), rx: .0215, ry: .0166, w: only(BONE.head), dark: .15, fur: .5, pale: .4, under: .9, sq: 3.8 },
    { p: H(0, -.0175, -.099), rx: .019, ry: .015, w: only(BONE.head), dark: .8, fur: .12, sq: 3.6 },
  ] });

  // Lower jaw: its own mesh, hinged at the rear skull base (JAW_AT), narrower than the upper muzzle, pale underside.
  tubes.push({ ...palette, back: coat.belly, dark: coat.dark, lining: jawFloor, radial: 10, rings: [
    { p: H(0, -.034, .03), rx: .024, ry: .018, w: only(BONE.head), fur: 1 }, // throat: part of the head, so the jaw tapers into the neck
    { p: H(0, -.031, .012), rx: .02, ry: .014, w: blend(BONE.head, BONE.jaw, .5), fur: .7, top: .9 },
    { p: H(0, -.036, -.02), rx: .0205, ry: .0126, w: only(BONE.jaw), fur: .55, top: .9 },
    { p: H(0, -.038, -.048), rx: .0185, ry: .0102, w: only(BONE.jaw), fur: .35, top: .9 },
    { p: H(0, -.038, -.068), rx: .0145, ry: .009, w: only(BONE.jaw), fur: .15, dark: .3, top: .8 },
    { p: H(0, -.0365, -.086), rx: .0105, ry: .0078, w: only(BONE.jaw), fur: .08, dark: .8, top: .6 },
  ] });

  // Ears: 10 cm tall, set well apart. Each is a flat shell facing forward and outward (EAR_N) with a rounded rim (sq > 2);
  // sculptWolf then indents the inner cup, shades it and darkens the rim.
  for (const side of [-1, 1]) tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, 1, 0], ref: earFrame(side).n, rings: [
    { p: H(side * .04, .042, .0), rx: .024, ry: .0095, w: only(BONE.head), fur: .5, sq: 2.6 },
    { p: H(side * .0554, .067, -.003), rx: .017, ry: .0085, w: only(BONE.head), dark: .15, fur: .45, accent: .3, sq: 2.6 },
    { p: H(side * .0708, .09193, -.006), rx: .006, ry: .004, w: only(BONE.head), dark: .8, fur: .3 },
  ] });

  // Legs: top blended into the torso (front: via the shoulder blade), then upper bone, middle joint, foot bone, with a separate paw.
  LEG_XZ.forEach(([x, z], i) => {
    const b = legBone(i), m = limbModel(i), front = isFrontLeg(i), f = front ? .92 : 1;
    const Jy = m.hip, Gy = Jy + m.girdle, Ky = Jy - m.upper, Wy = Ky - m.lower, Py = Wy - m.foot;
    const at = (y: number, zz = z): Vec3 => [x, y, zz];
    const r = (y: number, rx: number, ry: number, w: Ring['w'], dark?: number, fur?: number, pale?: number): Ring => ({ p: at(y), rx: rx * f, ry: ry * f, w, dark, fur, pale });
    const rings: Ring[] = front ? [
      r(Gy - .025, .024, .034, blend(BONE.torso, b.girdle, .3), 0, 1, 0), // sunk into the trunk, mostly torso-weighted
      r((Gy + Jy) / 2 - .01, .027, .04, blend(BONE.torso, b.girdle, .7), 0, 1.1, 0),
      r(Jy, .027, .04, blend(b.girdle, b.leg, .5), 0, 1, .1),
      r(Jy - m.upper * .5, .024, .034, only(b.leg), 0, .8, .3),
      r(Ky, .02, .028, blend(b.leg, b.knee, .5), 0, .6, .5),
      r(Ky - m.lower * .4, .019, .025, only(b.knee), 0, .5, .6), // forearm: the thick part
      r(Wy, .0135, .017, blend(b.knee, b.wrist, .5), 0, .5, .6),
      r((Wy + Py) / 2, .0105, .013, only(b.wrist), 0, .45, .6), // slim pastern
      r(Py + .012, .011, .013, blend(b.wrist, b.paw, .4), 0, .4, .6),
    ] : [
      r(Jy + .035, .03, .042, only(BONE.torso), 0, 1, 0), // sunk below the topline
      r(Jy, .033, .05, blend(BONE.torso, b.leg, .5), 0, 1, 0),
      r(Jy - m.upper * .45, .03, .052, only(b.leg), 0, .9, .15),
      r(Ky, .02, .03, blend(b.leg, b.knee, .5), 0, .6, .4),
      r(Ky - m.lower * .5, .016, .024, only(b.knee), 0, .5, .55),
      r(Wy, .012, .024, blend(b.knee, b.wrist, .5), 0, .5, .55), // hock: narrow, deep fore-aft (defined point)
      r(Wy - m.foot * .5, .0095, .013, only(b.wrist), 0, .45, .6),
      r(Py + .012, .0105, .013, blend(b.wrist, b.paw, .4), 0, .4, .6),
    ];
    tubes.push({ ...palette, smooth: 1, lay: [0, -1, 0], rings });
    // Paw: a long oval pointing forward, pivoting at the sole.
    const sole = (zz: number) => at(Py + .012, zz);
    tubes.push({ ...palette, radial: 8, lay: [0, -1, 0], rings: [
      { p: sole(z + .008), rx: .0166 * f, ry: .012, w: only(b.paw), dark: .2, fur: .3, pale: .45, sq: 3 },
      { p: sole(z - .012), rx: .0176 * f, ry: .012, w: only(b.paw), dark: .3, fur: .3, pale: .4, sq: 3 },
      { p: sole(z - .028), rx: .0135 * f, ry: .009, w: only(b.paw), dark: .5, fur: .25, pale: .2, sq: 2.6 },
    ] });
  });

  // Tail: a four-bone chain, each ring weighted between the two nearest bones so it bends smoothly. Bushiest in the middle, dark tip.
  const tailW = (z: number): Ring['w'] => {
    if (z < 0) return blend(BONE.torso, TAIL_BONES[0], .5 + z / .06);
    const a = Math.max(0, Math.min(TAIL_BONES.length - 1, z / TAIL_SEG - .5)), k = Math.min(TAIL_BONES.length - 2, Math.floor(a)), t = a - k;
    return blend(TAIL_BONES[k], TAIL_BONES[k + 1], t);
  };
  const tailRing = (z: number, rx: number, ry: number, extra: Partial<Ring>): Ring => ({ p: T(z), rx, ry, w: tailW(z), ...extra });
  tubes.push({ ...palette, smooth: 1, rings: [
    tailRing(-.03, .03, .036, { fur: 1, saddle: .5 }),
    tailRing(.01, .034, .04, { fur: 1.4, saddle: .6 }),
    tailRing(.06, .037, .043, { fur: 1.7, saddle: .65 }),
    tailRing(.12, .037, .043, { fur: 1.8, saddle: .65 }),
    tailRing(.17, .029, .035, { dark: .3, fur: 1.7, saddle: .6 }),
    tailRing(.215, .014, .018, { dark: .9, fur: 1.2 }),
  ] });
  // Cheek ruff: long silver tufts that make the face look broad from the front. Fur only; they sit on the head bone and flow back and down.
  const silver = coat.back.map((v, k) => (v + coat.belly[k]) / 2) as RGB;
  for (const side of [-1, 1]) tubes.push({ ...palette, radial: 8, back: silver, dark: silver, lay: [side * .1, -.75, 1], rings: [
    { p: H(side * .038, -.014, .03), rx: .014, ry: .022, w: only(BONE.head), fur: .98 },
    { p: H(side * .042, -.02, .005), rx: .016, ry: .022, w: only(BONE.head), fur: .9 },
    { p: H(side * .036, -.024, -.02), rx: .012, ry: .018, w: only(BONE.head), fur: .75 },
  ] });
  // Mouth corners (commissure): a thin cheek fold on each side joining the upper skull to the jaw, so the mouth is closed at the back
  // when it opens. Top ring rides the head, the bottom ring the jaw, the middle blends; it stretches into a triangle as the jaw drops.
  for (const side of [-1, 1]) tubes.push({ ...palette, radial: 8, smooth: 1, lay: [0, -.5, 1], rings: [
    { p: H(side * .026, -.025, -.013), rx: .0022, ry: .017, w: only(BONE.head), fur: .8, pale: .2 },
    { p: H(side * .026, -.031, -.013), rx: .0022, ry: .017, w: blend(BONE.head, BONE.jaw, .5), fur: .7, pale: .3 },
    { p: H(side * .0215, -.038, -.013), rx: .0022, ry: .016, w: only(BONE.jaw), fur: .6, pale: .4 },
  ] });
  // Tongue: lies on the floor of the lower jaw, widest in the middle with a slightly raised, rounded tip. No fur.
  tubes.push({ back: [.72, .3, .34], belly: [.82, .42, .44], dark: [.5, .18, .22], radial: 8, rings: [
    { p: H(0, -.027, .002), rx: .008, ry: .004, w: blend(BONE.head, BONE.jaw, .6), fur: 0 },
    { p: H(0, -.0255, -.022), rx: .0105, ry: .0055, w: only(BONE.jaw), fur: 0 },
    { p: H(0, -.0265, -.046), rx: .0105, ry: .005, w: only(BONE.jaw), fur: 0 },
    { p: H(0, -.0295, -.066), rx: .0075, ry: .0035, w: only(BONE.jaw), fur: 0 },
  ] });
  // Black lips (flews): a dark leathery border along both jaws that covers the tooth roots. The upper lip is a horseshoe around the
  // muzzle tip; the lower lip runs along the jaw edge. Neither carries fur.
  const leatherDark: RGB = [.07, .06, .065];
  const lipTube = (outline: number[][], bone: number, upperLip: boolean, zStart: number, zEnd: number, radius: number): Tube => {
    const edge = (z: number, side: number): Ring => {
      const o = outlineAt(outline, z), x = side * LIP_FRACTION * o[2], k = Math.sqrt(1 - LIP_FRACTION ** 2);
      return { p: H(x, o[1] + (upperLip ? -o[3] * k + .0005 : o[3] * k - .0005), z), rx: radius, ry: radius, w: only(bone), fur: 0 };
    };
    const zs: number[] = []; for (let z = zStart; z >= zEnd; z -= .012) zs.push(z);
    const front = outlineAt(outline, zEnd), fy = front[1] + (upperLip ? -front[3] * .8 : front[3] * .8);
    const tip: Ring[] = [-.6, -.3, 0, .3, .6].map(f => ({ p: H(f * front[2] * LIP_FRACTION, fy, zEnd - .002 - (1 - Math.abs(f)) * .002), rx: radius, ry: radius, w: only(bone), fur: 0 }));
    return { back: leatherDark, belly: leatherDark, dark: leatherDark, radial: 6, smooth: 1, rings: [...zs.map(z => edge(z, -1)), ...tip, ...zs.reverse().map(z => edge(z, 1))] };
  };
  tubes.push(lipTube(UPPER_OUTLINE, BONE.head, true, -.02, -.097, .0036));
  tubes.push(lipTube(LOWER_OUTLINE, BONE.jaw, false, -.02, -.085, .003));
  // A few directional tufts of pale fur rising out of each inner ear cup.
  for (const side of [-1, 1]) {
    const e = earFrame(side);
    for (const s of [-1, 0, 1]) {
      const at = (along: number, out: number, across: number): Vec3 => [0, 1, 2].map(k => e.base[k] + e.t[k] * along + e.n[k] * out + e.w[k] * across) as Vec3;
      const start = at(.012, .006, s * .008), mid = at(.0185, .007, s * .009), tip = at(.025, .0078, s * .0098);
      tubes.push({ ...palette, radial: 5, back: silver, belly: silver, dark: silver, lay: [0, 1, 0], rings: [
        { p: H(...start), rx: .0018, ry: .0013, w: only(BONE.head), fur: 0 }, { p: H(...mid), rx: .0013, ry: .001, w: only(BONE.head), fur: 0 }, { p: H(...tip), rx: .0004, ry: .0004, w: only(BONE.head), fur: 0 },
      ] });
    }
  }
  // Mouth seal: a dark plate across the back of the mouth, behind the last molars, from the upper jaw (head) to the lower jaw, so
  // the gap at the lip junction shows the dark throat instead of the hollow inside of the head.
  const throat: RGB = [.11, .055, .065];
  tubes.push({ back: throat, belly: throat, dark: throat, radial: 10, rings: [
    { p: H(0, -.023, -.03), rx: .017, ry: .0018, w: only(BONE.head), fur: 0 },
    { p: H(0, -.031, -.03), rx: .017, ry: .0018, w: blend(BONE.head, BONE.jaw, .5), fur: 0 },
    { p: H(0, -.038, -.03), rx: .016, ry: .0018, w: only(BONE.jaw), fur: 0 },
  ] });
  return tubes;
}


/** Tube index of leg i's paw tube (wolfTubes order: trunk, skull, jaw, ears, then leg + paw per leg). */
const pawTube = (i: number) => 6 + 2 * i;
/**
 * After buildBody: flat paw soles with toe grooves, and fur moved off the legs and belly onto the neck and back.
 * Same vertex count (no new geometry), so the fur-card budget and the perf governor see no change.
 */
export function shapeBody(body: BodyData, coat: { back: RGB; belly: RGB; dark: RGB; accent?: RGB } = PHOTO_COAT) {
  const toes: Vec3[] = [];
  LEG_XZ.forEach(([x, z], i) => {
    const m = limbModel(i), Py = m.hip - m.upper - m.lower - m.foot, sole = Py + .012, floor = sole - .01;
    for (let v = 0; v < body.tube.length; v++) {
      if (body.tube[v] !== pawTube(i) || body.position[v * 3 + 1] >= floor) continue;
      body.position[v * 3 + 1] = body.rest[v * 3 + 1] = floor; // flatten the sole
    }
    for (const t of [-1, 0, 1]) { const at: Vec3 = [x + t * .0062, sole + .008, z - .024]; dent(body, pawTube(i), at, .004, .0024); toes.push(at); } // grooves between the toes, top front
  });
  // Ears: shorter (×0.68 along the ear), broader and rounder toward the tip (in each ear's own frame), then set back and leaned
  // back from the base. Inner tufts move with them. Done after the sculpt, so the cup indent and shading come along.
  const earBase = HEAD_AT[1] + .042;
  for (let v = 0; v < body.tube.length; v++) {
    const t = body.tube[v], tuft = t >= EAR_TUFTS[0] && t <= EAR_TUFTS[1]; if (!(t === TUBE.earL || t === TUBE.earR || tuft)) continue;
    const side = t === TUBE.earL || (tuft && t < EAR_TUFTS[0] + 3) ? -1 : 1, e = earFrame(side), o = [0, 1, 2].map(k => HEAD_AT[k] + e.base[k]);
    const r = [0, 1, 2].map(k => body.position[v * 3 + k] - o[k]), along = r[0] * e.t[0] + r[1] * e.t[1] + r[2] * e.t[2];
    const across = r[0] * e.w[0] + r[1] * e.w[1] + r[2] * e.w[2], out = r[0] * e.n[0] + r[1] * e.n[1] + r[2] * e.n[2], a = Math.max(0, along / e.length);
    const nAlong = along * .68, nAcross = across * (1.2 + .6 * a * (1 - .4 * a)); // widest two-thirds up: a rounded tip
    for (let k = 0; k < 3; k++) body.position[v * 3 + k] = o[k] + e.t[k] * nAlong + e.w[k] * nAcross + e.n[k] * out;
    const dz = .01 + Math.max(0, body.position[v * 3 + 1] - earBase) * .3;
    body.position[v * 3 + 2] += dz;
    for (let k = 0; k < 3; k++) body.rest[v * 3 + k] = body.position[v * 3 + k];
  }
  // Heavier brow: push the supraorbital ridge further out and up (the sculpt already raised it a little).
  for (const side of [-1, 1]) push(body, TUBE.skull, [side * EYE_AT[0] * 1.05, HEAD_AT[1] + EYE_AT[1] + .013, HEAD_AT[2] + EYE_AT[2] + .004], .022, [side * .0012, .0018, -.004]);
  computeNormals(body);
  zoneCoat(body, coat);
  for (let v = 0; v < body.tube.length; v++) {
    const tube = body.tube[v], y = body.position[v * 3 + 1], z = body.position[v * 3 + 2], ny = body.normal[v * 3 + 1];
    if (tube >= 6 && tube < 13 && (tube - 6) % 2 === 0) { body.furLen[v] *= .6; if (toes.some(q => Math.hypot(body.position[v * 3] - q[0], body.position[v * 3 + 1] - q[1], body.position[v * 3 + 2] - q[2]) < .004)) for (let k = 0; k < 3; k++) body.color[v * 3 + k] *= .55; } // short paw fur so the toes show; dark grooves
    else if (tube >= 5 && tube < 13 && (tube - 5) % 2 === 0) { const top = limbModel((tube - 5) / 2).hip; if (y < top) body.furLen[v] *= .9 + .1 * Math.max(0, Math.min(1, (y - top + .08) / .08)); } // legs: short below the elbow / stifle
    else if (tube === TUBE.trunk) {
      if (ny < -.35) body.furLen[v] *= .6; // belly
      else if (ny > .3 || z < -.17) body.furLen[v] *= 1.15; // back, neck and ruff
    }
  }
}

/** Tubes of the inner-ear tufts in wolfTubes order (trunk, skull, jaw, 2 ears, 8 leg/paw, tail, 2 cheek ruffs, 2 mouth corners, tongue, 2 lips, then 6 tufts). */
const EAR_TUFTS = [21, 26] as const;
/** Coat sampled by eye from Matthew's reference photo: brown-grey agouti back, cream belly and legs, near-black saddle and tail tip, tan accents. */
export const PHOTO_COAT = { back: [.5, .42, .32] as RGB, belly: [.86, .8, .7] as RGB, dark: [.13, .11, .09] as RGB, accent: [.68, .5, .3] as RGB }; // round 4: warmer browns
/** Seeded variety on the photo base: Claude's wolfCoat(seed) (archetype + jitter) pulls the photo coat 35 % of the way toward it, so every
 * seed stays recognisably the photo's agouti pattern but shifts toward grey, tan or black like the original's variety. */
export function photoVariant(seeded: { back: RGB; belly: RGB; dark: RGB; accent: RGB }) {
  const m = (a: RGB, b: RGB) => a.map((v, k) => v + (b[k] - v) * .35) as RGB;
  return { back: m(PHOTO_COAT.back, seeded.back), belly: m(PHOTO_COAT.belly, seeded.belly), dark: m(PHOTO_COAT.dark, seeded.dark), accent: m(PHOTO_COAT.accent, seeded.accent) };
}
const mix3 = (c: number[], v: number, to: RGB, t: number) => { for (let k = 0; k < 3; k++) c[v * 3 + k] += (to[k] - c[v * 3 + k]) * t; };
const band = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Coat zoning from the photo (vertex colours; the fur cards copy them): dark saddle over the back, pale chest, throat and belly, buff legs. */
function zoneCoat(body: BodyData, coat: { back: RGB; belly: RGB; dark: RGB; accent?: RGB }) {
  const lerp = (a: RGB, b: RGB, t: number) => a.map((v, k) => v + (b[k] - v) * t) as RGB;
  const c = body.color, saddle = lerp(coat.dark, coat.back, .3), buff = lerp(coat.belly, coat.accent ?? coat.back, .2), cream = coat.belly, pawDark = lerp(coat.dark, coat.back, .35);
  for (let v = 0; v < body.tube.length; v++) {
    const t = body.tube[v], y = body.position[v * 3 + 1], z = body.position[v * 3 + 2], ny = body.normal[v * 3 + 1];
    if (t === TUBE.trunk) {
      mix3(c, v, saddle, .82 * band(.15, .6, ny) * band(-.2, -.1, z) * (1 - band(.15, .2, z)));
      mix3(c, v, cream, .8 * band(-.15, -.55, ny)); // belly
      if (z < -.1) mix3(c, v, cream, .7 * band(.1, -.4, ny) * band(-.1, -.2, z)); // chest and throat
    } else if (t >= 5 && t < 13 && (t - 5) % 2 === 0) {
      const top = limbModel((t - 5) / 2).hip;
      mix3(c, v, buff, .85 * band(top + .03, top - .06, y)); // legs pale below the body
    } else if (t >= 6 && t < 13 && (t - 6) % 2 === 0) mix3(c, v, pawDark, .6); // darker paws
    else if (t === TAIL_TUBE) mix3(c, v, saddle, .45 * band(0, .7, ny));
  }
}
const TAIL_TUBE = 13;

/** Small 3D value noise (seeded lattice from proc/rng, smooth trilinear): the fur length/density map. */
const LATTICE = (() => { const r = random(1400); return Float32Array.from({ length: 4096 }, () => r()); })();
const hash3 = (x: number, y: number, z: number) => LATTICE[(((x * 73 + y * 1999 + z * 7919) % 4096) + 4096) % 4096];
export function valueNoise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (u: number) => u * u * (3 - 2 * u), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
type P3 = [number, number, number];
/**
 * Fur style for render/furCards (the repo's hair-card system; options it already exposes, so furCards itself is not forked):
 * a noise-driven length map (clumps ~2 cm, after the length/density maps of Lengyel et al. 2001 and GPU Gems 2 ch. 23 "Hair
 * Animation and Rendering in the Nalu Demo" texture-driven fur), longer strand cards in the silhouette zones (neck ruff, tail),
 * combing (flat down the legs, back-curving over the neck, back and tail) and agouti tips on the back (banded guard hairs).
 */
export function furStyle() {
  const leg = (p: P3) => p[1] < .21, tail = (p: P3) => p[2] > .19 && p[1] < .34, head = (p: P3) => p[2] < HEAD_AT[2] + .035 && p[1] > HEAD_AT[1] - .06;
  const ruff = (p: P3) => band(-.12, -.18, p[2]) * band(-.34, -.3, p[2]) * band(.3, .34, p[1]);
  return {
    tone: .3,
    scaleAt: (p: P3) => { const n = .75 + .5 * valueNoise3(p[0] * 55, p[1] * 55, p[2] * 55); return Math.min(1.4, n * (leg(p) ? 1 : tail(p) ? 1.2 : 1 + .3 * ruff(p))); },
    comb: (p: P3) => head(p) ? undefined : leg(p) ? { lay: [0, -1, .15] as P3, lean: 1 } : tail(p) ? { lay: [0, -.6, 1] as P3, lean: .8 } : { lay: [0, -.25 - .5 * ruff(p), 1] as P3, lean: 1 + .3 * ruff(p) },
    tipTint: (p: P3) => p[1] > .33 && !head(p) ? { color: [.12, .1, .08] as P3, amount: .3 } : undefined, // agouti guard hairs end in a black band (was a pale tip that washed the saddle out)
  };
}

/** Sculpts the face: a socket around each eye with a raised brow above it. Returns the places fur must stay clear of. */
/** Coat colours the face gradient blends between; defaults suit the timber-grey coat. */
type FaceCoat = { back: RGB; belly: RGB; dark: RGB };
export function sculptWolf(body: BodyData, coat: FaceCoat = { back: [.42, .46, .48], belly: [.8, .79, .74], dark: [.12, .15, .18] }): Array<{ center: Vec3; radius: number }> {
  const clear: Array<{ center: Vec3; radius: number }> = [];
  for (const side of [-1, 1]) {
    const eye: Vec3 = [side * EYE_AT[0], HEAD_AT[1] + EYE_AT[1], HEAD_AT[2] + EYE_AT[2]];
    dent(body, TUBE.skull, eye, .02, .0099);
    // Supraorbital ridge: the skull's own forehead vertices above the socket are pulled forward ~12 mm and up a little, so the brow
    // is part of the head mesh, carries fur like the rest of the face and shades the eye. (Model units: 0.006 = 12 mm.)
    push(body, TUBE.skull, [eye[0] * 1.02, eye[1] + .012, eye[2] + .002], .02, [side * .0015, .0012, -.0065]); // 13 mm forward
    dent(body, TUBE.skull, [eye[0] * .45, eye[1] + .017, eye[2] + .012], .011, -.006); // the ridge runs inward and up toward the forehead
    // Dark mask, feathered: a soft shadow around the eye (wider than tall, no hard rim), blended with a band along the top of the
    // nose bridge (below) so the darker tone reads as one gradient from the eyes down the muzzle, fading out across the cheeks.
    for (let v = 0; v < body.tube.length; v++) {
      if (body.tube[v] !== TUBE.skull) continue;
      const dx = body.position[v * 3] - eye[0], dy = (body.position[v * 3 + 1] - eye[1]) * 1.3, dz = (body.position[v * 3 + 2] - eye[2]) * .7;
      const t = Math.max(0, 1 - Math.hypot(dx, dy, dz) / .045), f = t * t * (3 - 2 * t) * .4;
      for (let k = 0; k < 3; k++) body.color[v * 3 + k] += (.1 - body.color[v * 3 + k]) * f;
    }
    clear.push({ center: eye, radius: .014 });
  }
  // Ears: indent the inner cup, shade it dark and nearly bare, and darken the rim so the outer edge reads as cartilage.
  [-1, 1].forEach((side, k) => {
    const tube = k === 0 ? TUBE.earL : TUBE.earR, e = earFrame(side), mid = [0, 1, 2].map(i => HEAD_AT[i] + e.base[i] + e.t[i] * .024 + e.n[i] * .008) as Vec3;
    // Indent only the front (cup) face; denting both faces would thin the shell and fold its back forward.
    for (let v = 0; v < body.tube.length; v++) {
      if (body.tube[v] !== tube) continue;
      const facing = body.normal[v * 3] * e.n[0] + body.normal[v * 3 + 1] * e.n[1] + body.normal[v * 3 + 2] * e.n[2];
      const d = Math.hypot(...[0, 1, 2].map(i => body.position[v * 3 + i] - mid[i]));
      if (facing < .2 || d >= .018) continue;
      const f = (1 - (d / .018) ** 2) ** 2 * .0045;
      for (let k = 0; k < 3; k++) { body.position[v * 3 + k] -= e.n[k] * f; body.rest[v * 3 + k] = body.position[v * 3 + k]; }
    }
    computeNormals(body);
    for (let v = 0; v < body.tube.length; v++) {
      if (body.tube[v] !== tube) continue;
      const rel = [0, 1, 2].map(i => body.position[v * 3 + i] - HEAD_AT[i] - e.base[i]);
      const along = rel[0] * e.t[0] + rel[1] * e.t[1] + rel[2] * e.t[2], across = rel[0] * e.w[0] + rel[1] * e.w[1] + rel[2] * e.w[2], out = rel[0] * e.n[0] + rel[1] * e.n[1] + rel[2] * e.n[2];
      const half = Math.max(.003, .024 - .018 * Math.max(0, along) / e.length);
      const rim = Math.max(0, (Math.abs(across) / half - .72) / .28), cup = out > 0 ? Math.max(0, 1 - Math.hypot(...[0, 1, 2].map(i => body.position[v * 3 + i] - mid[i])) / .022) : 0;
      for (let c = 0; c < 3; c++) body.color[v * 3 + c] += ((rim > 0 ? .05 : body.color[v * 3 + c]) - body.color[v * 3 + c]) * Math.min(1, rim * .8) + (([.2, .13, .14][c]) - body.color[v * 3 + c]) * Math.min(.85, cup * 1.2);
      if (cup > .2) body.furLen[v] = Math.min(body.furLen[v], .16);
    }
  });
  // Muzzle gradient, three stops by how the skin faces: charcoal along the top of the bridge → agouti grey on the sides → cream on the
  // cheeks and lips, each stop blended with smoothstep so there is no band edge. Fades in from the stop and out at the nose leather.
  const mixc = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t) as RGB;
  const charcoal = mixc(coat.dark, coat.back, .3), agouti = mixc(coat.back, coat.belly, .35), cream = coat.belly;
  const ss = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  for (let v = 0; v < body.tube.length; v++) {
    if (body.tube[v] !== TUBE.skull) continue;
    const z = body.position[v * 3 + 2] - HEAD_AT[2], up = body.normal[v * 3 + 1];
    const along = ss((-.028 - z) / .02) * ss((z + .1) / .01);
    if (along <= 0) continue;
    const target = up > .45 ? mixc(agouti, charcoal, ss((up - .45) / .45)) : mixc(cream, agouti, ss((up + .35) / .8));
    for (let k = 0; k < 3; k++) body.color[v * 3 + k] += (target[k] - body.color[v * 3 + k]) * along * .55;
  }
  dent(body, TUBE.skull, [0, HEAD_AT[1] + .016, HEAD_AT[2] - .036], .02, .0045); // slight indent between the eyes: the canine stop
  return clear;
}

export interface Tooth { jaw: boolean; at: Vec3; h: number; r: number; tilt: number }
/** Dental arch, in cranium space (upper) and jaw-bone space (lower): two curved canines, small incisors across the front, premolars and molars along the sides. */
export function wolfTeeth(): Tooth[] {
  const upper = UPPER_OUTLINE, lower = LOWER_OUTLINE, at = outlineAt;
  const out: Tooth[] = [];
  const rows: Array<[number, number, number, number]> = [ // z, x as a fraction of the half-width, height, radius
    [-.093, .25, .005, .0017], [-.092, .55, .005, .0017], [-.079, .62, .013, .0034], // incisors, canine
    [-.067, .66, .006, .0025], [-.058, .68, .0065, .0027], [-.049, .7, .007, .003], [-.04, .72, .0055, .0032]]; // premolars, molars
  for (const [z, f, h, r] of rows) for (const side of [-1, 1]) {
    const u = at(upper, z), x = side * f * u[2] * .9, y = u[1] - u[3] * Math.sqrt(1 - (x / u[2]) ** 2) * (u[0] < 0 ? 1 : 1) + .0015;
    out.push({ jaw: false, at: [x, y, z], h, r, tilt: h > .01 ? .2 : 0 });
    const l = at(lower, z + .004), lx = side * f * .85 * l[2], ly = l[1] + l[3] * Math.sqrt(Math.max(0, 1 - (lx / l[2]) ** 2)) - .0015;
    out.push({ jaw: true, at: [lx, ly - JAW_AT[1], z + .004 - JAW_AT[2]], h: h * .88, r: r * .95, tilt: h > .01 ? .2 : 0 });
  }
  return out;
}
