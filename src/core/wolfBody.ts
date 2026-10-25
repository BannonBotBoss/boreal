import { WOLF_LEGS, limbOf, isFrontLeg } from './animalBehavior';
import { WOLF_SCALE } from './wolfModes';
import { computeNormals, dent, push, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from './body';

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
const UPPER_OUTLINE = [[.03, 0, .042, .036], [.01, .004, .049, .04], [-.022, .002, .043, .037], [-.035, -.0055, .031, .029], [-.048, -.0095, .027, .0255], [-.07, -.0155, .0215, .0175], [-.088, -.0175, .019, .0145], [-.099, -.0175, .0155, .0125]];
const LOWER_OUTLINE = [[.012, -.031, .02, .014], [-.02, -.036, .0195, .0105], [-.048, -.038, .0175, .0085], [-.068, -.038, .0135, .0075], [-.086, -.0365, .0095, .0065]];
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
    { p: [0, .30, .15], rx: .048, ry: .072, w: only(BONE.torso), fur: 1, saddle: .55 },
    { p: [0, .31, .09], rx: .048, ry: .062, w: only(BONE.torso), fur: 1, saddle: .6 },
    { p: [0, .315, .02], rx: .05, ry: .07, w: only(BONE.torso), fur: 1.05, saddle: .6 },
    { p: [0, .32, -.07], rx: .054, ry: .088, w: only(BONE.torso), fur: 1.2, saddle: .6 },
    { p: [0, .325, -.135], rx: .057, ry: .097, w: only(BONE.torso), fur: 1.05, saddle: .55 },
    { p: [0, .35, -.19], rx: .05, ry: .082, w: blend(BONE.torso, BONE.head, .2), fur: 1.75, saddle: .4 }, // shoulder guard hair ~10.5 cm (9–13 cm, Wikipedia "Wolf")
    { p: [0, .385, -.25], rx: .048, ry: .066, w: blend(BONE.torso, BONE.head, .6), fur: 1.75, saddle: .25 },
    { p: [0, .405, -.29], rx: .044, ry: .056, w: only(BONE.head), fur: 1.75 },
  ] });

  // Upper skull and muzzle: broad forehead, a stop, a straight nose bridge, then a tapered blunt muzzle. The snout is fixed to the
  // skull and its dark tip is the nose. Fur is fuller at the back of the skull (cheek ruff) and very short on the muzzle.
  const mouthRoof = [.55, .22, .26] as RGB, jawFloor = [.5, .22, .27] as RGB;
  tubes.push({ ...palette, radial: 14, smooth: 1, lining: mouthRoof, rings: [
    { p: H(0, 0, .03), rx: .042, ry: .036, w: only(BONE.head), fur: 1.2, saddle: .5 },
    { p: H(0, .004, .01), rx: .049, ry: .04, w: only(BONE.head), fur: 1.1, saddle: .35, accent: .25 },
    { p: H(0, .002, -.022), rx: .043, ry: .037, w: only(BONE.head), fur: .8, accent: .55, under: .5 },
    { p: H(0, -.0055, -.035), rx: .031, ry: .029, w: only(BONE.head), fur: .7, accent: .55, under: .7, sq: 2.3 }, // the stop: the forehead drops steeply here
    { p: H(0, -.0095, -.048), rx: .027, ry: .0255, w: only(BONE.head), fur: .85, pale: .2, accent: .55, under: .9, sq: 2.7 },
    { p: H(0, -.0155, -.07), rx: .0215, ry: .0175, w: only(BONE.head), fur: .75, pale: .4, accent: .35, under: .9, sq: 3 },
    { p: H(0, -.0175, -.088), rx: .019, ry: .0145, w: only(BONE.head), dark: .15, fur: .5, pale: .4, under: .9, sq: 3 },
    { p: H(0, -.0175, -.099), rx: .0155, ry: .0125, w: only(BONE.head), dark: .8, fur: .12, sq: 2.6 },
  ] });

  // Lower jaw: its own mesh, hinged at the rear skull base (JAW_AT), narrower than the upper muzzle, pale underside.
  tubes.push({ ...palette, back: coat.belly, dark: coat.dark, lining: jawFloor, radial: 10, rings: [
    { p: H(0, -.034, .03), rx: .024, ry: .018, w: only(BONE.head), fur: 1 }, // throat: part of the head, so the jaw tapers into the neck
    { p: H(0, -.031, .012), rx: .02, ry: .014, w: blend(BONE.head, BONE.jaw, .5), fur: .7, top: .9 },
    { p: H(0, -.036, -.02), rx: .0195, ry: .0105, w: only(BONE.jaw), fur: .55, top: .9 },
    { p: H(0, -.038, -.048), rx: .0175, ry: .0085, w: only(BONE.jaw), fur: .35, top: .9 },
    { p: H(0, -.038, -.068), rx: .0135, ry: .0075, w: only(BONE.jaw), fur: .15, dark: .3, top: .8 },
    { p: H(0, -.0365, -.086), rx: .0095, ry: .0065, w: only(BONE.jaw), fur: .08, dark: .8, top: .6 },
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
      r(Gy, .026, .04, blend(BONE.torso, b.girdle, .5), 0, 1, 0),
      r((Gy + Jy) / 2, .028, .042, only(b.girdle), 0, 1.1, 0),
      r(Jy, .027, .04, blend(b.girdle, b.leg, .5), 0, 1, .1),
      r(Jy - m.upper * .5, .022, .032, only(b.leg), 0, .8, .3),
      r(Ky, .017, .026, blend(b.leg, b.knee, .5), 0, .6, .5),
      r(Ky - m.lower * .5, .014, .02, only(b.knee), 0, .5, .6),
      r(Wy, .015, .019, blend(b.knee, b.wrist, .5), 0, .5, .6),
      r((Wy + Py) / 2, .013, .016, only(b.wrist), 0, .45, .6),
      r(Py + .014, .014, .016, blend(b.wrist, b.paw, .4), 0, .4, .6),
    ] : [
      r(Jy + .06, .03, .045, only(BONE.torso), 0, 1, 0),
      r(Jy, .033, .05, blend(BONE.torso, b.leg, .5), 0, 1, 0),
      r(Jy - m.upper * .45, .03, .052, only(b.leg), 0, .9, .15),
      r(Ky, .018, .028, blend(b.leg, b.knee, .5), 0, .6, .4),
      r(Ky - m.lower * .5, .014, .02, only(b.knee), 0, .5, .55),
      r(Wy, .014, .022, blend(b.knee, b.wrist, .5), 0, .5, .55),
      r(Wy - m.foot * .5, .011, .015, only(b.wrist), 0, .45, .6),
      r(Py + .014, .012, .015, blend(b.wrist, b.paw, .4), 0, .4, .6),
    ];
    tubes.push({ ...palette, smooth: 1, lay: [0, -1, 0], rings });
    // Paw: a long oval pointing forward, pivoting at the sole.
    const sole = (zz: number) => at(Py + .016, zz);
    tubes.push({ ...palette, radial: 8, lay: [0, -1, 0], rings: [
      { p: sole(z + .014), rx: .022 * f, ry: .016, w: only(b.paw), dark: .2, fur: .3, pale: .45 },
      { p: sole(z - .018), rx: .022 * f, ry: .016, w: only(b.paw), dark: .3, fur: .3, pale: .4 },
      { p: sole(z - .04), rx: .017 * f, ry: .012, w: only(b.paw), dark: .5, fur: .25, pale: .2 },
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
    tailRing(.06, .037, .043, { fur: 1.9, saddle: .65 }),
    tailRing(.12, .037, .043, { fur: 2.05, saddle: .65 }), // plume ~12 cm, the shoulder guard-hair range applied to the tail [verify: no separate tail-hair table]
    tailRing(.17, .029, .035, { dark: .3, fur: 1.9, saddle: .6 }),
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
