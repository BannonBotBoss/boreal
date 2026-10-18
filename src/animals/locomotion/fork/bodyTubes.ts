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
import { computeNormals, dent, push, type BodyData, type RGB, type Ring, type Tube, type Vec3 } from '../../../core/body';
import { BONE, EYE_AT, HEAD_AT, LEG_XZ, TAIL_AT, TAIL_BONES, TAIL_SEG, TUBE, earFrame, legBone, limbModel } from '../../../core/wolfBody';
import { isFrontLeg } from '../../../core/animalBehavior';
import { random } from '../../../proc/rng';
import * as THREE from 'three';

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

  // FORK pass 5: deeper chest and barrel (belly line ~2.5 cm lower), level topline (croup raised to the withers' height), thicker neck.
  // Trunk: heavy hindquarters, a tucked-up loin behind a deep ribcage, a thick shoulder ruff, and a short massive neck
  // rising to the head. The neck end blends from torso to head so the head turns smoothly. A dark saddle runs along the
  // back; fur is longest on the neck and shoulders (the ruff).
  tubes.push({ ...palette, radial: 12, smooth: 1, lay: [0, -.3, 1], rings: [
    { p: [0, .29, .185], rx: .032, ry: .052, w: blend(BONE.torso, BONE.tail, .15), fur: .9, saddle: .5 },
    { p: [0, .307, .15], rx: .05, ry: .085, w: only(BONE.torso), fur: 1, saddle: .55 },
    { p: [0, .318, .09], rx: .05, ry: .074, w: only(BONE.torso), fur: 1, saddle: .6 },
    { p: [0, .311, .02], rx: .054, ry: .085, w: only(BONE.torso), fur: 1.05, saddle: .6 },
    { p: [0, .304, -.07], rx: .058, ry: .096, w: only(BONE.torso), fur: 1.2, saddle: .6 },
    { p: [0, .307, -.135], rx: .06, ry: .101, w: only(BONE.torso), fur: 1.05, saddle: .55 },
    { p: [0, .34, -.19], rx: .062, ry: .1, w: blend(BONE.torso, BONE.head, .2), fur: 1.28, saddle: .4 },
    { p: [0, .383, -.25], rx: .058, ry: .08, w: blend(BONE.torso, BONE.head, .6), fur: 1.2, saddle: .25 },
    { p: [0, .405, -.29], rx: .049, ry: .062, w: only(BONE.head), fur: 1.2 },
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
    // Paw: a long oval pointing forward, pivoting at the sole. (Pass 6: 8 % wider than round 2, back inside body.test's 7-11 cm.)
    const sole = (zz: number) => at(Py + .012, zz);
    tubes.push({ ...palette, radial: 8, lay: [0, -1, 0], rings: [
      { p: sole(z + .008), rx: .0173 * f, ry: .012, w: only(b.paw), dark: .2, fur: .3, pale: .45, sq: 3 },
      { p: sole(z - .012), rx: .0184 * f, ry: .012, w: only(b.paw), dark: .3, fur: .3, pale: .4, sq: 3 },
      { p: sole(z - .028), rx: .014 * f, ry: .009, w: only(b.paw), dark: .5, fur: .25, pale: .2, sq: 2.6 },
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
export function shapeBody(body: BodyData, coat: { back: RGB; belly: RGB; dark: RGB; accent?: RGB } = PHOTO_COAT, trunkInMap = false) {
  const toes: Vec3[] = [];
  LEG_XZ.forEach(([x, z], i) => {
    const m = limbModel(i), Py = m.hip - m.upper - m.lower - m.foot, sole = Py + .012, floor = sole - .01;
    for (let v = 0; v < body.tube.length; v++) {
      if (body.tube[v] !== pawTube(i) || body.position[v * 3 + 1] >= floor) continue;
      body.position[v * 3 + 1] = body.rest[v * 3 + 1] = floor; // flatten the sole
    }
    for (const t of [-1, 0, 1]) { const at: Vec3 = [x + t * .0062, sole + .008, z - .024]; dent(body, pawTube(i), at, .0045, .0032); toes.push(at); } // grooves between the toes, top front
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
  zoneCoat(body, coat, toes, trunkInMap);
  for (let v = 0; v < body.tube.length; v++) {
    const tube = body.tube[v], y = body.position[v * 3 + 1], z = body.position[v * 3 + 2], ny = body.normal[v * 3 + 1];
    if (tube >= 6 && tube < 13 && (tube - 6) % 2 === 0) { body.furLen[v] *= .45; if (toes.some(q => Math.hypot(body.position[v * 3] - q[0], body.position[v * 3 + 1] - q[1], body.position[v * 3 + 2] - q[2]) < .0058)) body.furLen[v] *= .4; } // very short paw fur so the toe grooves shape the paw; shorter still on the (darkened) grooves
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
/**
 * Coat layers (pass 6, Matthew): BASE coat (photo tones: warm flanks, buff legs, paws) → LIGHTEN mask (belly, throat/chest bib,
 * cheek and muzzle mask) → DARKEN mask multiplied over it (broad saddle, shoulder band, tail tip, toe lines; strength COAT.darken).
 * Pass 7: on the trunk the lighten and darken masks and the fine guard-hair streaks live in a seeded procedural coat texture
 * (coatTexture, built at load, no image files) mapped on the skin with derived UVs (coatSkin), and the fur cards sample the same
 * masks at their root (coatCards). Head, jaw, tail, legs and paws keep their per-vertex layers.
 */
export const COAT = {
  /** darken-mask strength, 0..2 (1 matches the photo) */ darken: 1,
  /** mean spacing between dark streaks along the spine (model units; the rig is modelled at 1/2 size) */ streakSpacing: .015,
  /** mean streak width */ streakWidth: .0035,
  /** 0..1: seeded jitter in spacing, width, length and darkness (0 = regular stripes) */ streakJitter: .6,
};
const bumpF = (a: number, b: number, cc: number, d: number, x: number) => band(a, b, x) * (1 - band(cc, d, x));
/** Trunk masks by spine position z and height v on the trunk (+1 dorsal line, 0 midline, -1 belly). */
const trunkLight = (z: number, v: number) => Math.max(.8 * band(-.15, -.55, v), z < -.15 ? .95 * band(.3, -.3, v) * band(-.15, -.2, z) : 0); // belly; throat and chest bib
const trunkDark = (z: number, v: number) => Math.max(.62 * band(-.15, .45, v) * band(-.17, -.1, z) * (1 - band(.13, .19, z)), .7 * bumpF(-.95, -.6, .2, .5, v) * bumpF(-.17, -.145, -.12, -.095, z)); // saddle, shoulder band
function zoneCoat(body: BodyData, coat: { back: RGB; belly: RGB; dark: RGB; accent?: RGB }, toes: Vec3[], trunkInMap = false) {
  const lerp = (a: RGB, b: RGB, t: number) => a.map((v, k) => v + (b[k] - v) * t) as RGB;
  const accent = coat.accent ?? coat.back, c = body.color, buff = lerp(coat.belly, accent, .2), cream = coat.belly;
  const pawTone = lerp(buff, coat.dark, .3), warm = lerp(coat.back, accent, .6), mask = lerp(coat.belly, [1, 1, 1], .15);
  let tailLen = 0; const tailD = (v: number) => Math.hypot(body.position[v * 3] - TAIL_AT[0], body.position[v * 3 + 1] - TAIL_AT[1], body.position[v * 3 + 2] - TAIL_AT[2]);
  for (let v = 0; v < body.tube.length; v++) if (body.tube[v] === TAIL_TUBE) tailLen = Math.max(tailLen, tailD(v));
  for (let v = 0; v < body.tube.length; v++) {
    const t = body.tube[v], x = body.position[v * 3], y = body.position[v * 3 + 1], z = body.position[v * 3 + 2], ny = body.normal[v * 3 + 1], hz = z - HEAD_AT[2];
    const trunk = t === TUBE.trunk, leg = t >= 5 && t < 13 && (t - 5) % 2 === 0, paw = t >= 6 && t < 13 && (t - 6) % 2 === 0;
    // 1. base coat
    if (trunk) mix3(c, v, warm, .7 * bumpF(-.95, -.6, -.05, .3, ny) * bumpF(-.13, -.08, .14, .2, z)); // warm tan flanks and lower ribs
    else if (leg) mix3(c, v, buff, .85 * band(limbModel((t - 5) / 2).hip + .03, limbModel((t - 5) / 2).hip - .06, y)); // pale legs below the body
    else if (paw) mix3(c, v, pawTone, .6);
    // 2. lighten mask
    const light = trunk ? (trunkInMap ? 0 : trunkLight(z, ny)) // belly; throat and chest bib (in the coat texture when mapped)
      : t === TUBE.skull ? (hz > -.092 ? .75 * band(.35, -.25, ny) * band(.03, -.03, hz) : 0) // cheeks and muzzle sides (top and nose stay dark)
      : t === TUBE.jaw ? .8 : t === 14 || t === 15 ? .6 : 0; // lower jaw, cheek ruffs
    mix3(c, v, light > 0 && trunk && ny < -.15 ? cream : mask, light);
    // 3. darken mask, multiplied: 1 → about the coat's dark tone
    const dark = trunk ? (trunkInMap ? 0 : trunkDark(z, ny)) // saddle, shoulder band (in the coat texture when mapped)
      : t === TAIL_TUBE ? Math.max(.35 * band(0, .7, ny), .88 * band(.72, .9, tailD(v) / tailLen)) // tail top, tail tip
      : paw && toes.some(q => Math.hypot(x - q[0], y - q[1], z - q[2]) < .0058) ? 1 : 0; // toe lines
    const f = 1 - Math.min(1, COAT.darken * dark) * .75;
    for (let k = 0; k < 3; k++) c[v * 3 + k] *= f;
  }
}
/** Trunk axis (centre height and half-depth per ring), same numbers as the trunk rings in wolfTubes: streaks are placed relative to it. */
const TRUNK_AXIS: ReadonlyArray<readonly [number, number, number]> = [[.185, .29, .052], [.15, .307, .085], [.09, .318, .074], [.02, .311, .085], [-.07, .304, .096], [-.135, .307, .101], [-.19, .34, .1], [-.25, .383, .08], [-.29, .405, .062]];
function trunkAxis(z: number) {
  for (let k = 1; k < TRUNK_AXIS.length; k++) { const a = TRUNK_AXIS[k - 1], b = TRUNK_AXIS[k]; if (z <= a[0] && z >= b[0]) { const t = (a[0] - z) / (a[0] - b[0]); return { cy: a[1] + (b[1] - a[1]) * t, ry: a[2] + (b[2] - a[2]) * t }; } }
  return undefined;
}
interface Streak { z: number; w: number; len: number; dark: number; flank: boolean; wob: number }
/** Seeded streak lists, one per side, from croup to neck: denser over the saddle and shoulders, sparser at the ends. */
function streaks(seed: number): Streak[][] {
  const { streakSpacing: sp, streakWidth: sw, streakJitter: j } = COAT;
  return [0, 1].map(side => {
    const r = random(seed * 7 + side * 131 + 11), out: Streak[] = [];
    for (let z = .17 - sp * r(); z > -.23;) {
      const zone = band(-.23, -.17, z) * (1 - band(.11, .17, z)); // saddle + shoulders
      out.push({ z, w: sw * (1 + j * (r() - .5) * 1.4), len: (.55 + .6 * zone) * (1 + j * (r() - .5)), dark: (.55 + .45 * zone) * (1 - j * .5 * r()), flank: r() < .3 + .2 * zone, wob: r() * 9 });
      z -= sp * (zone > .5 ? 1 : 1.7) * (1 + j * (r() - .5) * 1.6);
    }
    return out;
  });
}
/** Dark-streak strength 0..1 at a point: thin near-vertical slices (perpendicular to the spine) over the back and down the sides, densest
 * and darkest on the saddle and shoulders, sparse on the flanks, none on the bib, belly, legs, head or tail. */
function streakZV(z: number, v: number, side: number, list: Streak[][]) {
  if (z > .17 || z < -.23 || v < -.55) return 0; // belly, legs
  if (z < -.17 && v < .2) return 0; // throat and chest bib
  let best = 0;
  for (const s of list[side]) {
    const dz = Math.abs(z - s.z - .003 * COAT.streakJitter * (valueNoise3(s.wob, v * 2.5, 0) - .5) * 2); if (dz > s.w) continue; // gentle waviness down the streak
    const reach = s.flank ? s.len * 1.4 : Math.min(s.len, 1); // from the dorsal line (v = 1) down; flank streaks reach below the midline
    const m = (1 - band(s.w * .3, s.w * .5, dz)) * band(1 - reach - .12, 1 - reach + .05, v) * s.dark * (v < 0 ? .7 : 1);
    if (m > best) best = m;
  }
  return best;
}
/** Coat-texture layout: u runs along the spine (croup z = .185 → neck z = -.29), v around the trunk from the belly seam (left side
 * first, dorsal line at v = .5). The first NEUTRAL columns hold 1.0 for every other tube. 512 × 128 RGBA8 = 256 KB, 341 KB with mipmaps. */
const MAP_W = 512, MAP_H = 128, NEUTRAL = 8, Z0 = .185, Z1 = -.29;
const mapU = (z: number) => (NEUTRAL + Math.max(0, Math.min(1, (Z0 - z) / (Z0 - Z1))) * (MAP_W - NEUTRAL)) / MAP_W;
/** Per-channel lighten gain toward the cream belly (≤ 2, the texture's headroom). */
const lightGain = (coat: { back: RGB; belly: RGB }) => coat.back.map((b, k) => Math.min(2, Math.max(1, coat.belly[k] / Math.max(.05, b)))) as RGB;
/** Trunk coat multiplier at (z, v, side): lighten mask, then the darken mask and the streaks multiplied over it. */
function trunkMul(z: number, v: number, side: number, list: Streak[][], gain: RGB, streakShare = 1): RGB {
  const l = trunkLight(z, v), d = 1 - Math.min(1, COAT.darken * trunkDark(z, v)) * .75, s = 1 - Math.min(1, COAT.darken * streakZV(z, v, side, list)) * .92 * streakShare;
  return gain.map(g => (1 + (g - 1) * l) * d * s) as RGB;
}
/** Seeded procedural coat texture (built at load from COAT and the seed; no image files): RGB = colour multiplier / 2 over the
 * vertex-coloured skin (the skin material's colour is 2, so 128 is neutral). */
export function coatTexture(seed: number, coat: { back: RGB; belly: RGB }) {
  const list = streaks(seed), gain = lightGain(coat), data = new Uint8Array(MAP_W * MAP_H * 4).fill(128);
  for (let j = 0; j < MAP_H; j++) {
    const th = ((j + .5) / MAP_H - .5) * Math.PI * 2, v = Math.cos(th), side = th < 0 ? 0 : 1;
    for (let i = NEUTRAL; i < MAP_W; i++) {
      const z = Z0 - (i + .5 - NEUTRAL) / (MAP_W - NEUTRAL) * (Z0 - Z1), m = trunkMul(z, v, side, list, gain), o = (j * MAP_W + i) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = Math.round(Math.min(1, m[k] / 2) * 255);
    }
  }
  for (let o = 3; o < data.length; o += 4) data[o] = 255;
  const tex = new THREE.DataTexture(data, MAP_W, MAP_H, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.name = 'coat'; tex.needsUpdate = true;
  return tex;
}
/** Derived UVs for the skin: trunk vertices get (spine, around) coordinates, everything else the neutral corner. The belly seam is
 * split by duplicating the few vertices of the wrapping triangles (v + 1; the texture repeats in v). Mutates the geometry. */
export function coatSkin(g: THREE.BufferGeometry, body: BodyData) {
  const n = body.tube.length, uv = new Float32Array(n * 2), pos = body.position;
  for (let v = 0; v < n; v++) {
    if (body.tube[v] !== TUBE.trunk) { uv[v * 2] = 2 / MAP_W; uv[v * 2 + 1] = .5; continue; }
    const z = pos[v * 3 + 2], ax = trunkAxis(Math.max(Z1, Math.min(Z0, z)))!;
    uv[v * 2] = mapU(z); uv[v * 2 + 1] = Math.atan2(pos[v * 3], pos[v * 3 + 1] - ax.cy) / (Math.PI * 2) + .5;
  }
  const idx = Array.from(g.getIndex()!.array), dup = new Map<number, number>(), src: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]]; if (tri.some(v => v >= n || body.tube[v] !== TUBE.trunk)) continue;
    const vs = tri.map(v => uv[v * 2 + 1]); if (Math.max(...vs) - Math.min(...vs) < .5) continue;
    for (let k = 0; k < 3; k++) if (vs[k] < .5) {
      let d = dup.get(tri[k]); if (d === undefined) { d = n + src.length; dup.set(tri[k], d); src.push(tri[k]); }
      idx[t + k] = d;
    }
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute, w = a.itemSize, arr = new (a.array.constructor as Float32ArrayConstructor)((n + src.length) * w);
    arr.set(a.array as Float32Array); src.forEach((s, k) => { for (let c = 0; c < w; c++) arr[(n + k) * w + c] = (a.array as Float32Array)[s * w + c]; });
    g.setAttribute(name, new THREE.BufferAttribute(arr, w, a.normalized));
  }
  const uvAll = new Float32Array((n + src.length) * 2); uvAll.set(uv); src.forEach((s, k) => { uvAll[(n + k) * 2] = uv[s * 2]; uvAll[(n + k) * 2 + 1] = uv[s * 2 + 1] + 1; });
  g.setAttribute('uv', new THREE.BufferAttribute(uvAll, 2)); g.setIndex(idx);
  return g;
}
/** Fur cards sample the same coat masks at their root (cards are 5 vertices: root pair, middle pair, tip), so the streaks and zones
 * continue from the skin onto the fur. Streaks: near-black root and middle, the tip (combed back along the spine) only half, so a
 * streak stays a vertical slice instead of smearing backward. Colours only; same cards. */
export function coatCards(g: THREE.BufferGeometry, seed: number, coat: { back: RGB; belly: RGB }) {
  const pos = g.getAttribute('position'), col = g.getAttribute('color'), list = streaks(seed), gain = lightGain(coat);
  for (let card = 0; card * 5 < pos.count; card++) {
    const a = card * 5, root: P3 = [(pos.getX(a) + pos.getX(a + 1)) / 2, (pos.getY(a) + pos.getY(a + 1)) / 2, (pos.getZ(a) + pos.getZ(a + 1)) / 2];
    const ax = root[2] > Z0 || root[2] < Z1 ? undefined : trunkAxis(root[2]); if (!ax) continue;
    const v = (root[1] - ax.cy) / ax.ry; if (v < -1.15) continue; // upper legs below the trunk
    const side = root[0] < 0 ? 0 : 1, full = trunkMul(root[2], v, side, list, gain), tip = trunkMul(root[2], v, side, list, gain, .5);
    for (let k = a; k < a + 5; k++) { const m = k === a + 4 ? tip : full; col.setXYZ(k, Math.min(1, col.getX(k) * m[0]), Math.min(1, col.getY(k) * m[1]), Math.min(1, col.getZ(k) * m[2])); }
  }
  col.needsUpdate = true;
  return g;
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
/** 0..1 on the streaked sides of the trunk (saddle and shoulders, below the dorsal ridge so the topline silhouette keeps its fur). */
function streakSides(p: P3) {
  const ax = p[2] > .17 || p[2] < -.23 ? undefined : trunkAxis(p[2]); if (!ax) return 0;
  const v = (p[1] - ax.cy) / ax.ry; return band(-.5, -.2, v) * (1 - band(.55, .8, v)) * band(-.23, -.17, p[2]) * (1 - band(.11, .17, p[2]));
}
export function furStyle() {
  const leg = (p: P3) => p[1] < .21, tail = (p: P3) => p[2] > .19 && p[1] < .34, head = (p: P3) => p[2] < HEAD_AT[2] + .035 && p[1] > HEAD_AT[1] - .06;
  const ruff = (p: P3) => band(-.12, -.18, p[2]) * band(-.34, -.3, p[2]) * band(.3, .34, p[1]);
  return {
    tone: .3,
    scaleAt: (p: P3) => { const n = .75 + .5 * valueNoise3(p[0] * 55, p[1] * 55, p[2] * 55); return Math.min(1.4, n * (leg(p) ? 1 : tail(p) ? 1.2 : (1 + .3 * ruff(p)) * (1 - .12 * streakSides(p)))); },
    comb: (p: P3) => head(p) ? undefined : leg(p) ? { lay: [0, -1, .15] as P3, lean: 1 } : tail(p) ? { lay: [0, -.6, 1] as P3, lean: .8 } : { lay: [0, -.25 - .5 * ruff(p), 1] as P3, lean: 1 + .3 * ruff(p) },
    tipTint: (p: P3) => p[1] > .33 && !head(p) && COAT.darken > 0 ? { color: [.12, .1, .08] as P3, amount: .3 * Math.min(1, COAT.darken) } : undefined, // agouti guard hairs end in a black band (was a pale tip that washed the saddle out)
  };
}
