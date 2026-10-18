/**
 * Weber & Penn parametric tree skeleton (Weber & Penn 1995, "Creation and rendering of realistic trees", SIGGRAPH '95).
 * Tailored port (Grok Bot) of SkyeShark/SeedThree src/core/weber-penn.js (MIT, @cf2eaad; baseline in vendor/seedthree):
 * the subset a boreal conifer needs - per-level curve/curveV, down angle, phyllotactic or whorled child placement, the
 * Shape length ratio, pipe-model radii, base flare and vertical tropism. Changes from upstream: TypeScript, randomness from
 * proc/rng (one seeded stream threaded parent-before-children, so a seed always gives the same tree), three's bare entry
 * instead of three/webgpu, and two conifer additions as data: dead self-pruned stubs below the live crown (`dead`) and a
 * denser, shorter, upturned top band (`club`, the black spruce 'club' of persistent cone-bearing shoots).
 */
import { Quaternion, Vector3 } from 'three';
import type { WPParams } from '../../core/flora/trees/forms';
export type { WPParams };

export interface Stem { level: number; points: Vector3[]; radii: number[]; length: number; radialSegments: number; dead: boolean; id: number; parentId: number; maxLevel: number }
export interface Skeleton { stems: Stem[]; height: number }

const Y = new Vector3(0, 1, 0), X = new Vector3(1, 0, 0), UP = new Vector3(0, 1, 0);
const qAround = (axis: Vector3, deg: number) => new Quaternion().setFromAxisAngle(axis, deg * Math.PI / 180);
/** Weber & Penn 1995 ShapeRatio (sec. 4.3). */
export function shapeRatio(shape: number, r: number) {
  switch (shape) {
    case 0: return .2 + .8 * r; case 1: return .2 + .8 * Math.sin(Math.PI * r); case 2: return .2 + .8 * Math.sin(.5 * Math.PI * r);
    case 3: return 1; case 4: return .5 + .5 * r; case 5: return r <= .7 ? r / .7 : (1 - r) / .3; case 6: return 1 - .8 * r;
    case 7: return r <= .7 ? .5 + .5 * r / .7 : .5 + .5 * (1 - r) / .3; default: return 1;
  }
}
function tropism(o: Quaternion, amount: number) {
  const fwd = Y.clone().applyQuaternion(o), axis = new Vector3().crossVectors(fwd, UP);
  if (axis.lengthSq() < 1e-8) return;
  o.premultiply(new Quaternion().setFromAxisAngle(axis.normalize(), Math.abs(amount) * Math.acos(Math.max(-1, Math.min(1, fwd.dot(UP))))));
}

/** Skeleton of one tree: trunk length `height` (m), base radius `radius` (m), all randomness from `rnd`. */
export function generateSkeleton(p: WPParams, height: number, radius: number, rnd: () => number): Skeleton {
  const vary = (b: number, s: number) => b + (rnd() * 2 - 1) * s, stems: Stem[] = [];
  function build(level: number, origin: Vector3, orient: Quaternion, length: number, r0: number, parentId: number, dead: boolean) {
    const res = Math.max(2, p.curveRes[level] | 0), seg = length / res, o = orient.clone(), pos = origin.clone();
    const points = [origin.clone()], radii = [r0], orients = [o.clone()];
    for (let i = 1; i <= res; i++) {
      o.multiply(qAround(X, p.curve[level] / res + vary(0, p.curveV[level] / res)));
      if (level >= 2 && p.attractionUp) tropism(o, p.attractionUp / res);
      pos.addScaledVector(Y.clone().applyQuaternion(o).normalize(), seg);
      points.push(pos.clone()); radii.push(Math.max(.0015, r0 * (1 - i / res))); orients.push(o.clone());
    }
    if (level === 0 && p.flare > 0) for (let i = 0; i < points.length; i++) { const z = i / (points.length - 1); if (z < .15) radii[i] *= 1 + p.flare * (1 - z / .15); }
    const stem: Stem = { level, points, radii, length, radialSegments: p.radialSegments[level] ?? 4, dead, id: stems.length, parentId, maxLevel: p.levels - 1 };
    stems.push(stem);
    const cl = level + 1; if (cl >= p.levels || dead) return;
    // children: trunk = whorls over the live crown (+ dead stubs below, + the club band on top); branches = per metre
    type Slot = { t: number; dead: boolean; club: boolean };
    const slots: Slot[] = [];
    if (level === 0) {
      const n = Math.round(p.branches[1]), ws = Math.max(1, p.whorlSize[1] | 0), nodes = Math.ceil(n / ws), club = p.club;
      for (let k = 0; k < nodes; k++) {
        const t = p.baseSize + (1 - p.baseSize) * (k + .5) / nodes, inClub = !!club && t > 1 - club.frac;
        const per = inClub ? Math.round(ws * club!.density) : ws;
        for (let s = 0; s < per; s++) slots.push({ t: Math.min(.995, t + (inClub ? vary(0, club!.frac / nodes) : 0)), dead: false, club: inClub });
      }
      if (p.dead) { const from = p.baseSize * p.dead.from, rows = Math.round(nodes * (p.baseSize - from) / (1 - p.baseSize));
        for (let k = 0; k < rows; k++) for (let s = 0; s < ws; s++) if (rnd() < p.dead.keep) slots.push({ t: from + (p.baseSize - from) * (k + .5) / rows, dead: true, club: false }); }
    } else {
      const n = Math.max(1, Math.round(length * p.branches[cl]));
      for (let c = 0; c < n; c++) slots.push({ t: .12 + .85 * (c + .5) / n, dead: false, club: false });
    }
    let az = rnd() * 360, lastT = -1;
    const ws = Math.max(1, p.whorlSize[cl] | 0);
    for (let c = 0; c < slots.length; c++) {
      const sl = slots[c], fs = sl.t * res, si = Math.min(res - 1, Math.floor(fs)), st = fs - si;
      const cpos = points[si].clone().lerp(points[si + 1], st), cor = orients[si].clone().slerp(orients[si + 1], st), rHere = radii[si] * (1 - st) + radii[si + 1] * st;
      if (level === 0 && ws > 1) { if (Math.abs(sl.t - lastT) > 1e-4) { az += p.rotate[cl] + vary(0, p.rotateV[cl]); lastT = sl.t; } else az += 360 / ws + vary(0, p.rotateV[cl] * .3); }
      else az += p.rotate[cl] + vary(0, p.rotateV[cl]);
      const down = sl.club ? vary(p.club!.downAngle, p.downAngleV[cl]) : vary(p.downAngle[cl], p.downAngleV[cl]);
      const co = cor.clone().multiply(qAround(Y, az)).multiply(qAround(X, down));
      const shape = level === 0 ? shapeRatio(p.shape, 1 - (sl.t - p.baseSize) / (1 - p.baseSize)) : 1;
      let len = length * Math.max(.02, p.length[cl] + vary(0, p.lengthV[cl])) * shape;
      if (level === 0 && sl.t >= p.baseSize) len *= Math.min(1, (1 - sl.t) * length / Math.max(.05, len) * 1.6); // keep the spire tip inside the cone (W&P sec 4.3: child length <= remaining parent)
      if (sl.club) len *= p.club!.length;
      if (sl.dead) len = length * p.length[cl] * p.dead!.length * (.5 + rnd() * .5);
      const cr = Math.min(r0 * Math.pow(len / length, p.ratioPower), rHere * .9);
      build(cl, cpos, co, len, cr, stem.id, sl.dead);
    }
  }
  build(0, new Vector3(), new Quaternion(), height, radius, -1, false);
  return { stems, height };
}
