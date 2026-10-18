/**
 * Stems -> one tapered generalized-cylinder mesh (Weber & Penn 1995 sec. 5: cross-sections joined into a mesh). Tailored
 * port (Grok Bot) of SeedThree src/core/branch-mesh.js buildBranchGeometry (MIT, @cf2eaad; vendor/seedthree): rotation-
 * minimising (parallel transport) ring frames, world-scaled bark UVs, LOD by ring stride and radial scale. Dropped: lobes,
 * tip caps, wind weights (the game's shared wind shader keys off height). Adds a vertex colour per stem.
 */
import * as THREE from 'three';
import type { Stem } from './weberPenn';

export interface TubeOpts { radialScale?: number; ringStride?: number; minSides?: number; colour: (s: Stem) => THREE.Color; keep?: (s: Stem) => boolean }
const UPV = new THREE.Vector3(0, 1, 0), XV = new THREE.Vector3(1, 0, 0);
function tangent(p: THREE.Vector3[], i: number, out: THREE.Vector3) {
  const n = p.length; if (i === 0) out.subVectors(p[1], p[0]); else if (i === n - 1) out.subVectors(p[n - 1], p[n - 2]); else out.subVectors(p[i + 1], p[i - 1]);
  return out.lengthSq() < 1e-12 ? out.set(0, 1, 0) : out.normalize();
}
export function tubes(stems: Stem[], o: TubeOpts) { const g = tubeSteps(stems, o, function* () { yield; }); let r = g.next(); while (!r.done) r = g.next(); return r.value; }
/** tubes() as a sliced job: calls `slice` every 48 stems (the caller decides how to yield). */
export function* tubeSteps(stems: Stem[], o: TubeOpts, slice: () => Generator<unknown, void>): Generator<unknown, THREE.BufferGeometry> {
  let done = 0;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const t = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), rad = new THREE.Vector3();
  let base = 0;
  for (const s of stems) {
    if (o.keep && !o.keep(s)) continue;
    if (++done % 24 === 0) yield* slice();
    const sides = Math.max(o.minSides ?? 3, Math.round(s.radialSegments * (o.radialScale ?? 1))), stride = Math.max(1, o.ringStride ?? 1);
    let P = s.points, R = s.radii;
    if (stride > 1 && P.length > 2) { const p2: THREE.Vector3[] = [], r2: number[] = []; for (let i = 0; i < P.length - 1; i += stride) { p2.push(P[i]); r2.push(R[i]); } p2.push(P[P.length - 1]); r2.push(R[R.length - 1]); P = p2; R = r2; }
    const c = o.colour(s), rings = P.length, ringV = sides + 1;
    tangent(P, 0, t); n.crossVectors(t, UPV); if (n.lengthSq() < 1e-6) n.crossVectors(t, XV); n.normalize();
    const circ = 2 * Math.PI * R[Math.min(rings - 1, Math.floor(rings * .25))], uS = Math.max(1, Math.round(circ / .5));
    let v = 0;
    for (let i = 0; i < rings; i++) {
      if (i > 0) { v += P[i].distanceTo(P[i - 1]); tangent(P, i, t); n.addScaledVector(t, -n.dot(t)); if (n.lengthSq() < 1e-8) n.crossVectors(t, UPV); n.normalize(); }
      b.crossVectors(n, t).normalize();
      for (let j = 0; j <= sides; j++) {
        const th = j / sides * Math.PI * 2; rad.copy(n).multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th));
        pos.push(P[i].x + rad.x * R[i], P[i].y + rad.y * R[i], P[i].z + rad.z * R[i]); nor.push(rad.x, rad.y, rad.z); uv.push(j / sides * uS, v / .5); col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < sides; j++) { const a = base + i * ringV + j, c2 = a + ringV; idx.push(a, c2, a + 1, a + 1, c2, c2 + 1); }
    base += rings * ringV;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
