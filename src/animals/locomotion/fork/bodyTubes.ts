/**
 * FORK of Claude-owned file - do not edit the original; fold back via AGENT-NOTES.md
 * Source: src/core/wolfBody.ts @ 56506c55a2ebf881f3454265da00a618399e2996 (last commit touching it). Only wolfTubes (and the private
 * jaw outlines it needs) is copied; everything else is imported from the original. Forked by Grok Bot (Gait Builder) 2026-10-18 at
 * Matthew's request, used only by fork/playerRig.ts (?loco=1 and the locomotion lab). Changes (see fork/MERGE.patch):
 *   flatter topline with the high point over the shoulders; thicker neck base blending into the chest; shoulder and hip tops sunk
 *   and torso-weighted so they no longer bulge above the back; thicker lower legs; boxier paws, then (shapeBody) flat soles with
 *   toe grooves; blockier snout tip; fur moved off the legs and belly onto the neck and back.
 * Round 2 (fur + mesh rework against Matthew's reference photo): tapered leg profiles (thick forearm/thigh, slim pastern, defined
 *   hock), smaller paws, ears set back, blockier muzzle, photo coat zoning (PHOTO_COAT + shapeBody) and a fur style for the repo's own
 *   hair-card system (furStyle: noise length/density map, combing, agouti tips). See AGENT-NOTES.md for sources.
 */
import { computeNormals, dent, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from '../../../core/body';
import { BONE, HEAD_AT, LEG_XZ, TAIL_AT, TAIL_BONES, TAIL_SEG, TUBE, earFrame, legBone, limbModel } from '../../../core/wolfBody';
import { isFrontLeg } from '../../../core/animalBehavior';
import { random } from '../../../proc/rng';

/** Upper-jaw outline (z, centre y, half-width, half-height) in cranium space and lower-jaw outline in cranium space too; teeth and lips follow them. */
const UPPER_OUTLINE = [[.03, 0, .042, .036], [.01, .004, .049, .04], [-.022, .002, .043, .037], [-.035, -.0055, .031, .029], [-.048, -.0095, .027, .0255], [-.07, -.0155, .0215, .0175], [-.088, -.0175, .019, .0145], [-.099, -.0175, .0175, .0138]];
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
    { p: H(0, -.0095, -.048), rx: .027, ry: .0255, w: only(BONE.head), fur: .85, pale: .2, accent: .55, under: .9, sq: 3.2 },
    { p: H(0, -.0155, -.07), rx: .0215, ry: .0175, w: only(BONE.head), fur: .75, pale: .4, accent: .35, under: .9, sq: 3.5 },
    { p: H(0, -.0175, -.088), rx: .0195, ry: .0148, w: only(BONE.head), dark: .15, fur: .5, pale: .4, under: .9, sq: 3.8 },
    { p: H(0, -.0175, -.099), rx: .0175, ry: .0138, w: only(BONE.head), dark: .8, fur: .12, sq: 3.6 },
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
      { p: sole(z + .008), rx: .016 * f, ry: .012, w: only(b.paw), dark: .2, fur: .3, pale: .45, sq: 3 },
      { p: sole(z - .012), rx: .017 * f, ry: .012, w: only(b.paw), dark: .3, fur: .3, pale: .4, sq: 3 },
      { p: sole(z - .028), rx: .013 * f, ry: .009, w: only(b.paw), dark: .5, fur: .25, pale: .2, sq: 2.6 },
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
export function shapeBody(body: BodyData) {
  LEG_XZ.forEach(([x, z], i) => {
    const m = limbModel(i), Py = m.hip - m.upper - m.lower - m.foot, sole = Py + .012, floor = sole - .01;
    for (let v = 0; v < body.tube.length; v++) {
      if (body.tube[v] !== pawTube(i) || body.position[v * 3 + 1] >= floor) continue;
      body.position[v * 3 + 1] = body.rest[v * 3 + 1] = floor; // flatten the sole
    }
    for (const t of [-1, 0, 1]) dent(body, pawTube(i), [x + t * .0062, sole + .008, z - .024], .004, .0016); // grooves between the toes, top front
  });
  // Ears set back: shift the ear shells (and their inner tufts) rearward and lean them back from the base.
  const earBase = HEAD_AT[1] + .042;
  for (let v = 0; v < body.tube.length; v++) {
    const t = body.tube[v]; if (!(t === TUBE.earL || t === TUBE.earR || (t >= EAR_TUFTS[0] && t <= EAR_TUFTS[1]))) continue;
    const dz = .01 + Math.max(0, body.position[v * 3 + 1] - earBase) * .3;
    body.position[v * 3 + 2] += dz; body.rest[v * 3 + 2] = body.position[v * 3 + 2];
  }
  computeNormals(body);
  zoneCoat(body);
  for (let v = 0; v < body.tube.length; v++) {
    const tube = body.tube[v], y = body.position[v * 3 + 1], z = body.position[v * 3 + 2], ny = body.normal[v * 3 + 1];
    if (tube >= 5 && tube < 13 && (tube - 5) % 2 === 0) { const top = limbModel((tube - 5) / 2).hip; if (y < top) body.furLen[v] *= .7 + .3 * Math.max(0, Math.min(1, (y - top + .08) / .08)); } // legs: short below the elbow / stifle
    else if (tube === TUBE.trunk) {
      if (ny < -.35) body.furLen[v] *= .6; // belly
      else if (ny > .3 || z < -.17) body.furLen[v] *= 1.15; // back, neck and ruff
    }
  }
}

/** Tubes of the inner-ear tufts in wolfTubes order (trunk, skull, jaw, 2 ears, 8 leg/paw, tail, 2 cheek ruffs, 2 mouth corners, tongue, 2 lips, then 6 tufts). */
const EAR_TUFTS = [21, 26] as const;
/** Coat sampled by eye from Matthew's reference photo: brown-grey agouti back, cream belly and legs, near-black saddle and tail tip, tan accents. */
export const PHOTO_COAT = { back: [.46, .43, .38] as RGB, belly: [.86, .82, .74] as RGB, dark: [.14, .13, .12] as RGB, accent: [.62, .5, .36] as RGB };
const mix3 = (c: number[], v: number, to: RGB, t: number) => { for (let k = 0; k < 3; k++) c[v * 3 + k] += (to[k] - c[v * 3 + k]) * t; };
const band = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Coat zoning from the photo (vertex colours; the fur cards copy them): dark saddle over the back, pale chest, throat and belly, buff legs. */
function zoneCoat(body: BodyData) {
  const c = body.color, saddle: RGB = [.22, .2, .18], buff: RGB = [.78, .72, .62], cream: RGB = PHOTO_COAT.belly;
  for (let v = 0; v < body.tube.length; v++) {
    const t = body.tube[v], y = body.position[v * 3 + 1], z = body.position[v * 3 + 2], ny = body.normal[v * 3 + 1];
    if (t === TUBE.trunk) {
      mix3(c, v, saddle, .55 * band(.15, .6, ny) * band(-.2, -.1, z) * (1 - band(.15, .2, z)));
      mix3(c, v, cream, .8 * band(-.15, -.55, ny)); // belly
      if (z < -.1) mix3(c, v, cream, .7 * band(.1, -.4, ny) * band(-.1, -.2, z)); // chest and throat
    } else if (t >= 5 && t < 13) {
      const top = limbModel(Math.floor((t - 5) / 2)).hip;
      mix3(c, v, buff, .65 * band(top + .03, top - .06, y)); // legs pale below the body
    } else if (t === TAIL_TUBE) mix3(c, v, saddle, .45 * band(0, .7, ny));
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
    scaleAt: (p: P3) => { const n = .75 + .5 * valueNoise3(p[0] * 55, p[1] * 55, p[2] * 55); return Math.min(1.4, n * (leg(p) ? .8 : tail(p) ? 1.2 : 1 + .3 * ruff(p))); },
    comb: (p: P3) => head(p) ? undefined : leg(p) ? { lay: [0, -1, .15] as P3, lean: .75 } : tail(p) ? { lay: [0, -.6, 1] as P3, lean: .8 } : { lay: [0, -.25 - .5 * ruff(p), 1] as P3, lean: 1 + .3 * ruff(p) },
    tipTint: (p: P3) => p[1] > .33 && !head(p) ? { color: [.7, .66, .58] as P3, amount: .2 } : undefined,
  };
}
