/**
 * ONE plant generator (Grok Bot) for every flower and shrub row in core/flora/plants: petals → flowers → inflorescence on
 * stems → leaves by phyllotaxis → branched shrubs. PORTED from mateusdcc/plant-generator (MIT, roblox-ts, @89fe3b6;
 * baseline in vendor/plant-generator), upstream names in comments:
 *  - createBlade / createPetal (surfaces.ts): fixed-topology strips with a width profile and a normal-direction curvature;
 *    petals use upstream's sin(π t^0.7) profile and cup·t² curvature. Leaves add shape profiles (lanceolate, ovate, ...).
 *  - placePlanarPhyllotaxis (phyllotaxis.ts): Vogel 1979 golden-angle spiral, r = c√n (corymb heads, alternate leaves).
 *  - createInflorescence (inflorescences.ts): raceme / umbel / cyme / capitulum(corymb) attachment rules; 'pair' added for
 *    Linnaea's forked peduncle (Weberling 1989).
 * Changed: JS Math + three.js matrices instead of roblox-ts math/Vec3; output = ONE indexed BufferGeometry with vertex
 * colours + aFall (autumn colour) + aOrgan (0 stem/leaf, 1 flower) + aBloom (flowering window, day of year) for the shared
 * flora material; randomness = proc/rng streams; no L-system interpreter (organ counts come from the species rows).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { random, hash } from '../../proc/rng';
import type { FloraSpec, LeafShape } from '../../core/flora/plants';

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // upstream GOLDEN_ANGLE
const PROFILE: Record<LeafShape | 'petal', (t: number) => number> = {
  petal: t => Math.sin(Math.PI * t ** .7),                                  // upstream createPetal widthFunction
  lanceolate: t => Math.sin(Math.PI * t ** .55), ovate: t => Math.sin(Math.PI * t ** .75), elliptic: t => Math.sin(Math.PI * t), // upstream taperedBladeWidth
  linear: t => Math.min(1, 8 * t) * (1 - t ** 3), round: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))), needle: t => 1 - t, trifoliate: t => Math.sin(Math.PI * t ** .75),
};
const col = (hex: string) => new THREE.Color(hex); // sRGB hex → linear (three ColorManagement)
const UP = new THREE.Vector3(0, 1, 0);

class Builder {
  p: number[] = []; c: number[] = []; f: number[] = []; o: number[] = []; b: number[] = []; i: number[] = []; bare = false; // bare: no stems (far carpet clumps)
  private v(x: THREE.Vector3, c: THREE.Color, fall: THREE.Color, organ: number, bloom: [number, number]) { this.p.push(x.x, x.y, x.z); this.c.push(c.r, c.g, c.b); this.f.push(fall.r, fall.g, fall.b); this.o.push(organ); this.b.push(...bloom); return this.p.length / 3 - 1; }
  /** upstream createBlade: strip along local +y, width on x, curvature on z; placed by matrix m. */
  blade(m: THREE.Matrix4, length: number, width: number, prof: (t: number) => number, curv: (t: number) => number, segs: number, colour: (t: number) => THREE.Color, fall: THREE.Color, organ = 0, bloom: [number, number] = [0, 0]) {
    const base = this.p.length / 3, tmp = new THREE.Vector3();
    for (let k = 0; k <= segs; k++) { const t = k / segs, hw = prof(t) * width * .5, y = t * length, z = curv(t), c = colour(t);
      this.v(tmp.set(-hw, y, z).applyMatrix4(m), c, fall, organ, bloom); this.v(tmp.set(hw, y, z).applyMatrix4(m), c, fall, organ, bloom);
      if (k < segs) { const a = base + k * 2; this.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  }
  /** Stem segment: open prism from a to b (sides 3-4), tapering r0 → r1. */
  tube(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, c: THREE.Color, sides: number, organ = 0, bloom: [number, number] = [0, 0]) {
    if (this.bare) return;
    const d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), base = this.p.length / 3, tmp = new THREE.Vector3();
    for (let s = 0; s < sides; s++) { const ang = s / sides * Math.PI * 2;
      for (const [o, r] of [[a, r0], [b, r1]] as const) this.v(tmp.set(Math.cos(ang) * r, 0, Math.sin(ang) * r).applyQuaternion(q).add(o), c, c, organ, bloom); }
    for (let s = 0; s < sides; s++) { const a0 = base + s * 2, a1 = base + ((s + 1) % sides) * 2; this.i.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aFall', new THREE.Float32BufferAttribute(this.f, 3)); g.setAttribute('aOrgan', new THREE.Float32BufferAttribute(this.o, 1)); g.setAttribute('aBloom', new THREE.Float32BufferAttribute(this.b, 2));
    g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
}
/** Frame whose +y points along `dir`, rotated by `spin` about it, at `at`. */
const frame = (at: THREE.Vector3, dir: THREE.Vector3, spin = 0) => new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin)), new THREE.Vector3(1, 1, 1));
/** Direction tilted `tilt` from `axis` toward azimuth `az`. */
function tilted(axis: THREE.Vector3, tilt: number, az: number) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().normalize()), side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).applyQuaternion(q);
  return axis.clone().normalize().multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt)).normalize();
}

/** Builds one variant of a species at detail 0 (near), 1 (mid) or 2 (far: mid without stems, leaves ×1.25 to keep the cover).
 * Sized to the species' mean height; instances scale it. */
export function buildPlant(spec: FloraSpec, variant: number, detail: number) {
  const r = random(hash(`flora:${spec.id}:${variant}`)), B = new Builder(), lo = detail > 0, grow = detail > 1 ? 1.25 : 1; B.bare = detail > 1;
  const leafSegs = lo ? 1 : 4, petalSegs = lo ? 1 : 3, sides = lo ? 3 : 4, H = spec.height.mean;
  const leafC = col(spec.leaf.colour), leafFall = col(spec.leaf.fall ?? spec.leaf.colour), stemC = col(spec.stemColour);
  const fl = spec.flower, bloom: [number, number] = fl ? fl.bloom : [0, 0];
  function leaf(at: THREE.Vector3, axis: THREE.Vector3, az: number, scale = 1) {
    const L = spec.leaf, len = L.length * scale * grow * (.85 + .3 * r()), wid = L.width * scale * grow * (lo ? 1.3 : 1);
    const dir = tilted(axis, Math.PI / 2 * (.35 + .5 * L.droop) + (r() - .5) * .3, az);
    const shade = (t: number) => leafC.clone().multiplyScalar(.75 + .35 * t);
    const curv = (t: number) => -L.droop * len * .35 * t * t;
    if (L.shape === 'trifoliate') { const tip = at.clone().addScaledVector(dir, len * 1.2); B.tube(at, tip, spec.stemRadius, spec.stemRadius * .7, stemC, 3);
      for (const a of [-.9, 0, .9]) B.blade(frame(tip, tilted(dir, a, Math.PI / 2), az), len, wid, PROFILE.trifoliate, curv, leafSegs, shade, leafFall); return; }
    B.blade(frame(at, dir, az + Math.PI / 2), len, wid, PROFILE[L.shape], curv, leafSegs, shade, leafFall);
  }
  function flower(at: THREE.Vector3, axis: THREE.Vector3, scale = 1) {
    const F = fl!, ax = F.nod ? tilted(axis, F.nod, r() * Math.PI * 2) : axis.clone(), c = col(F.colour), cc = col(F.centre), spin = r() * Math.PI;
    for (let k = 0; k < F.petals; k++) { const az = spin + k / F.petals * Math.PI * 2, d = tilted(ax, F.open + (r() - .5) * .12, az);
      B.blade(frame(at, d, az + Math.PI / 2), F.petalLength * scale, F.petalWidth * scale, PROFILE.petal, t => F.cup * scale * t * t, petalSegs, t => cc.clone().lerp(c, Math.min(1, t * 3)), c, 1, bloom); } // upstream createPetal
    if (!lo) B.tube(at, at.clone().addScaledVector(ax, F.petalLength * scale * .35), F.petalLength * scale * .12, F.petalLength * scale * .08, cc, 3, 1, bloom);
  }
  /** upstream createInflorescence, on the axis from `top` along `axis` (stem tip). */
  function inflorescence(top: THREE.Vector3, axis: THREE.Vector3, stem: THREE.Vector3[]) {
    const F = fl!, n = F.count;
    if (F.kind === 'solitary') flower(top, axis);
    else if (F.kind === 'raceme') for (let k = 0; k < n; k++) { const t = k / Math.max(1, n - 1), s = Math.min(stem.length - 2, Math.floor((.62 + .36 * t) * (stem.length - 1))), at = stem[s].clone().lerp(stem[s + 1], r());
      const d = tilted(axis, .9, k * GOLDEN_ANGLE), ped = at.clone().addScaledVector(d, .02 * H); B.tube(at, ped, spec.stemRadius * .5, spec.stemRadius * .4, stemC, 3); flower(ped, tilted(axis, .5, k * GOLDEN_ANGLE), 1 - .45 * t); }
    else if (F.kind === 'umbel' || F.kind === 'pair') for (let k = 0; k < n; k++) { const d = tilted(axis, F.kind === 'pair' ? .45 : Math.PI / 3, k / n * Math.PI * 2 + (F.kind === 'pair' ? 0 : r() * .4)), ped = top.clone().addScaledVector(d, (F.kind === 'pair' ? .25 : .12) * H);
      B.tube(top, ped, spec.stemRadius * .6, spec.stemRadius * .5, stemC, 3); flower(ped, d); }
    else if (F.kind === 'cyme') for (let k = 0; k < n; k++) { const d = tilted(axis, .4 + .3 * (k % 2), k * GOLDEN_ANGLE), ped = top.clone().addScaledVector(d, (.15 + .08 * Math.floor(k / 2)) * H);
      B.tube(top, ped, spec.stemRadius * .6, spec.stemRadius * .5, stemC, 3); flower(ped, d); }
    else for (let k = 0; k < n; k++) { const rad = .06 * H * Math.sqrt(k / n), az = k * GOLDEN_ANGLE, at = top.clone().add(new THREE.Vector3(Math.cos(az) * rad, -.04 * H * (1 - k / n), Math.sin(az) * rad)); // corymb: Vogel r = c√n, flat top
      B.tube(top, at, spec.stemRadius * .4, spec.stemRadius * .3, stemC, 3); flower(at, axis); }
  }
  /** One axis (herb stem or shrub branch): polyline with a slight lean, leaves at nodes by the arrangement. */
  function axisWith(base: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, nodes: number, leafScale: number, depth: number): THREE.Vector3[] {
    const segs = lo ? 3 : 6, pts = [base.clone()], bend = new THREE.Vector3((r() - .5) * .25, 0, (r() - .5) * .25);
    let d = dir.clone().normalize(); for (let s = 1; s <= segs; s++) { d = d.add(bend.clone().multiplyScalar(1 / segs)).normalize(); pts.push(pts[s - 1].clone().addScaledVector(d, len / segs)); }
    for (let s = 0; s < segs; s++) B.tube(pts[s], pts[s + 1], rad * (1 - s / segs * .7), rad * (1 - (s + 1) / segs * .7), stemC, sides);
    const L = spec.leaf; if (L.arrangement === 'basal') return pts;
    const step = lo && L.arrangement === 'alternate' ? 2 : 1, n0 = depth === 0 && spec.form === 'herb' && L.arrangement === 'whorled' && L.nodes === 1 ? 1 : 0;
    for (let k = 0; k < nodes; k += step) {
      const t = n0 ? .85 : L.arrangement === 'whorled' ? .25 + .6 * (k + 1) / (nodes + 1) : .15 + .8 * (k + 1) / (nodes + 1), at = pt(pts, t), ax = pts[pts.length - 1].clone().sub(pts[0]).normalize();
      const per = L.arrangement === 'alternate' ? 1 : L.perNode, az0 = L.arrangement === 'alternate' ? k * GOLDEN_ANGLE : L.arrangement === 'opposite' ? k * Math.PI / 2 : k * Math.PI / per; // decussate pairs; whorls offset
      for (let j = 0; j < per; j++) leaf(at, ax, az0 + j * Math.PI * 2 / per, leafScale * (L.perNode > 1 && L.arrangement === 'alternate' ? 1 : 1));
      if (L.arrangement === 'alternate' && L.perNode > 1) for (let j = 1; j < L.perNode; j++) leaf(at, ax, az0 + (j % 2 ? .5 : -.5) * j, leafScale * .8); // pinnate leaflets (rose) drawn as a leaf cluster
    }
    return pts;
  }
  const pt = (pts: THREE.Vector3[], t: number) => { const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); };
  const origin = new THREE.Vector3();
  if (spec.form === 'herb') {
    const L = spec.leaf, stemLen = H;
    if (L.arrangement === 'basal') for (let k = 0; k < L.perNode; k++) leaf(origin, UP, k * GOLDEN_ANGLE + r(), 1);
    const pts = axisWith(origin, tilted(UP, r() * .15, r() * 6.28), stemLen, spec.stemRadius, L.nodes, 1, 0);
    if (fl) inflorescence(pts[pts.length - 1], pts[pts.length - 1].clone().sub(pts[pts.length - 2]).normalize(), pts);
  } else {
    const mat = spec.leaf.shape === 'needle' ? 1.1 : .35; // juniper: prostrate mats; upright shrubs
    for (let s = 0; s < spec.stems; s++) {
      const len = H * (.75 + .35 * r()) / Math.cos(Math.min(1.2, mat)), d = tilted(UP, mat * (.5 + r()), s * GOLDEN_ANGLE + r());
      const pts = axisWith(origin, d, len, spec.stemRadius, Math.ceil(spec.leaf.nodes * .5), 1, 0);
      for (let b = 0; b < spec.branching; b++) { const t = .3 + .6 * (b + r() * .5) / spec.branching, at = pt(pts, t), ax = pts[pts.length - 1].clone().sub(pts[0]).normalize();
        const bd = tilted(ax, .7 + r() * .3, b * GOLDEN_ANGLE + s), bp = axisWith(at, bd, len * (.35 + .2 * r()), spec.stemRadius * .5, spec.leaf.nodes, .9, 1);
        if (fl && b % 2 === 0 && b / 2 < fl.count) flower(bp[bp.length - 1], bp[bp.length - 1].clone().sub(bp[bp.length - 2]).normalize()); }
    }
  }
  return B.geometry();
}

/** One understorey carpet clump (core/flora/plants `carpet`): ramets of a clonal mat merged into ONE geometry (three
 * BufferGeometryUtils.mergeGeometries), on a Vogel golden-angle disc of the row's radius. Detail 0: every ramet at the near LOD;
 * detail 1 (far): half the ramets, stemless (buildPlant detail 2) and 15 % larger, so the mat keeps its cover at a fraction of the vertices. */
export function buildClump(spec: FloraSpec, variant: number, detail: number) {
  const c = spec.carpet!, form = { ...spec, ...c.form }, near = detail === 0, n = near ? c.ramets : Math.ceil(c.ramets / 2), r = random(hash(`clump:${spec.id}:${variant}`));
  const parts: THREE.BufferGeometry[] = [], m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let k = 0; k < n; k++) { const rad = c.radius * Math.sqrt((k + .5) / n), az = k * GOLDEN_ANGLE + r() * .6, s = (.8 + .35 * r()) * (near ? 1 : 1.15);
    const g = buildPlant(form, (variant * 3 + k) % 4, near ? 0 : 2); g.applyMatrix4(m.compose(new THREE.Vector3(Math.cos(az) * rad, 0, Math.sin(az) * rad), q.setFromAxisAngle(UP, r() * Math.PI * 2), new THREE.Vector3(s, s, s))); parts.push(g); }
  const g = mergeGeometries(parts)!; for (const p of parts) p.dispose(); g.computeBoundingSphere(); return g;
}
