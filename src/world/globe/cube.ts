/**
 * Cube-sphere quadtree (Grok Bot), globe milestone 1. TAILORED from SimonDev's ProceduralTerrain_Part10 `quadtree.js`
 * (github.com/simondevyoutube/ProceduralTerrain_Part10 @ 09448f7, MIT, JavaScript): six cube faces, each a quadtree, a node
 * splits when the camera is closer than k × its size (`_Insert`: distToChild < child.size.x), node centres projected onto
 * the sphere (`sphereCenter`). Changes vs upstream: integer (face, level, i, j) keys instead of Box3 objects, so nodes are
 * cheap and stable; the spherified-cube mapping of Nowell 2005 ("Mapping a cube to a sphere") instead of normalize(), so
 * cells stay closer to equal area; the split factor comes from the quality ladder; neighbour stitching (BuildNeighbours) is
 * NOT ported: tile skirts hide level cracks instead (upstream FixEdgeSkirt_ in terrain-builder-threaded-worker.js).
 */
import type { Vec3 } from './planet';

/** Face frames: normal n and the two in-face axes u, v (right-handed: u × v = n). */
export const FACES: { n: Vec3; u: Vec3; v: Vec3 }[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
/** Spherified cube (Nowell 2005): cube point (x, y, z) with max |component| = 1 → unit sphere. */
export function cubeToSphere(x: number, y: number, z: number, o: Vec3 = [0, 0, 0]): Vec3 {
  const x2 = x * x, y2 = y * y, z2 = z * z;
  o[0] = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + y2 * z2 / 3);
  o[1] = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + z2 * x2 / 3);
  o[2] = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + x2 * y2 / 3);
  return o;
}
/** Unit direction of face coordinates (a, b) ∈ [-1, 1]². */
export function faceDir(face: number, a: number, b: number, o: Vec3 = [0, 0, 0]): Vec3 {
  const { n, u, v } = FACES[face];
  return cubeToSphere(n[0] + u[0] * a + v[0] * b, n[1] + u[1] * a + v[1] * b, n[2] + u[2] * a + v[2] * b, o);
}
export interface QNode { face: number; level: number; i: number; j: number; key: string }
export const node = (face: number, level: number, i: number, j: number): QNode => ({ face, level, i, j, key: `${face}/${level}/${i}/${j}` });
export const roots = () => FACES.map((_, f) => node(f, 0, 0, 0));
export const children = (p: QNode) => [node(p.face, p.level + 1, p.i * 2, p.j * 2), node(p.face, p.level + 1, p.i * 2 + 1, p.j * 2),
  node(p.face, p.level + 1, p.i * 2, p.j * 2 + 1), node(p.face, p.level + 1, p.i * 2 + 1, p.j * 2 + 1)];
/** Face-coordinate bounds of a node. */
export function bounds(q: QNode) { const s = 2 / (1 << q.level); return { a0: -1 + q.i * s, b0: -1 + q.j * s, s }; }
/** Approximate edge length (m) of a node on a sphere of radius r (a face spans a quarter great circle). */
export const edgeMetres = (level: number, r: number) => r * Math.PI / 2 / (1 << level);
/** Centre of a node on the sphere of radius r. */
export function centre(q: QNode, r: number): Vec3 { const { a0, b0, s } = bounds(q), d = faceDir(q.face, a0 + s / 2, b0 + s / 2); return [d[0] * r, d[1] * r, d[2] * r]; }
export interface LodOpts { radius: number; maxLevel: number; split: number; /** always split above this level (orbit detail) */ minLevel?: number }
/** Distance-based split test (upstream `_Insert`): closer than split × edge length, and above the deepest level. */
export function wantsSplit(q: QNode, cam: Vec3, o: LodOpts) {
  if (q.level >= o.maxLevel) return false;
  if (q.level < (o.minLevel ?? 0)) return true;
  const c = centre(q, o.radius);
  return Math.hypot(cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]) < o.split * edgeMetres(q.level, o.radius);
}
/** The leaves of the distance-based quadtree for a camera position (all six faces); covers the sphere exactly once. */
export function selectLeaves(cam: Vec3, o: LodOpts, out: QNode[] = []) {
  const visit = (q: QNode) => { if (wantsSplit(q, cam, o)) for (const c of children(q)) visit(c); else out.push(q); };
  for (const r of roots()) visit(r);
  return out;
}
