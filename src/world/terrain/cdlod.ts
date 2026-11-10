/**
 * Continuous distance-dependent terrain LOD for the ground past the chunk patch.
 *
 * Filip Strugar, "Continuous Distance-Dependent Level of Detail for Rendering Height Maps",
 * GPU Pro (A K Peters, 2010). A quadtree of fixed grids. A node of world size S is split
 * while the camera is closer than S * range, so the draw band for that size is
 * [S * range, 2S * range). In the outer half of the band each vertex morphs onto the
 * parent grid (every other vertex). On an edge shared with a coarser neighbour the morph
 * is complete, so the extra vertices lie on the coarser edge and the surface does not crack.
 * The same morph is a function of world position, so two nodes that share a vertex agree.
 *
 * The old horizon skirt was concentric rings with a radial step of about 7 m and a
 * back-face cut. This mesh is the ground from the camera out past the geometric horizon.
 * It does not drop quads, and it does not dither holes inside that horizon.
 */
import { curvatureDrop, horizonMetres } from '../globe/horizonSkirt';
import { PLANET } from '../globe/planet';

export const CDLOD = {
  /** Finest node side, metres. Eight quads on a side is Strugar's small fixed grid; 32 / 8 = 4 m. */
  leaf: 32,
  /** Quads along one node edge. */
  grid: 8,
  /**
   * Split a node of size S when the camera is closer than S * range.
   * range 2 is the paper's factor-of-two band, which keeps neighbours within one level.
   */
  range: 2,
  /** Mesh covers this multiple of the geometric horizon, so a ridge still meets the sky. */
  cover: 1.08,
};

export interface CdlodNode { x: number; z: number; size: number }

export interface GroundSample {
  y: number;
  rgb: [number, number, number];
  water?: boolean;
  photo?: boolean;
}

export interface CdlodMeshData {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  fade: Float32Array;
  water: Float32Array;
  photo: Float32Array;
  index: Uint32Array;
  triangles: number;
  outerM: number;
  nodes: number;
}

const EPS = 1e-2;

function distToBox(px: number, pz: number, x: number, z: number, size: number) {
  const dx = Math.max(x - px, 0, px - (x + size));
  const dz = Math.max(z - pz, 0, pz - (z + size));
  return Math.hypot(dx, dz);
}

/** Quadtree leaves covering the disc of `radius` around the camera. Nodes tile; they do not overlap. */
export function selectNodes(camX: number, camZ: number, radius: number, leaf = CDLOD.leaf, range = CDLOD.range): CdlodNode[] {
  let root = leaf;
  while (root < radius * 2) root *= 2;
  const nodes: CdlodNode[] = [];
  const seen = new Set<string>();
  const rec = (x: number, z: number, size: number) => {
    const id = `${x},${z},${size}`;
    if (seen.has(id)) return;
    if (distToBox(camX, camZ, x, z, size) > radius) return;
    seen.add(id);
    if (size > leaf && distToBox(camX, camZ, x, z, size) < size * range) {
      const h = size / 2;
      rec(x, z, h);
      rec(x + h, z, h);
      rec(x, z + h, h);
      rec(x + h, z + h, h);
      return;
    }
    nodes.push({ x, z, size });
  };
  const baseX = Math.floor(camX / root) * root;
  const baseZ = Math.floor(camZ / root) * root;
  for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) rec(baseX + ix * root, baseZ + iz * root, root);
  return nodes;
}

/** 0 inside the split distance, 1 at the far end of the band (where the parent would take over). */
export function vertexMorph(dist: number, size: number, range = CDLOD.range) {
  const near = size * range;
  if (dist <= near) return 0;
  const far = near * 2;
  if (dist >= far) return 1;
  return (dist - near) / (far - near);
}

export function nodesTouch(a: CdlodNode, b: CdlodNode) {
  const xTouch = Math.abs(a.x + a.size - b.x) < EPS || Math.abs(b.x + b.size - a.x) < EPS;
  const zOverlap = a.z < b.z + b.size - EPS && b.z < a.z + a.size - EPS;
  const zTouch = Math.abs(a.z + a.size - b.z) < EPS || Math.abs(b.z + b.size - a.z) < EPS;
  const xOverlap = a.x < b.x + b.size - EPS && b.x < a.x + a.size - EPS;
  return (xTouch && zOverlap) || (zTouch && xOverlap);
}

/** Largest size ratio of two nodes that share an edge. 2 is one level. */
export function levelRatio(nodes: readonly CdlodNode[]) {
  let max = 1;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (!nodesTouch(nodes[i], nodes[j])) continue;
    const r = Math.max(nodes[i].size, nodes[j].size) / Math.min(nodes[i].size, nodes[j].size);
    if (r > max) max = r;
  }
  return max;
}

function qKey(x: number, z: number) {
  return `${Math.round(x * 100)},${Math.round(z * 100)}`;
}

function edgeTouch(n: CdlodNode, o: CdlodNode, side: 'w' | 'e' | 's' | 'n') {
  if (side === 'w' && Math.abs(o.x + o.size - n.x) < EPS) return o.z < n.z + n.size - EPS && o.z + o.size > n.z + EPS;
  if (side === 'e' && Math.abs(n.x + n.size - o.x) < EPS) return o.z < n.z + n.size - EPS && o.z + o.size > n.z + EPS;
  if (side === 's' && Math.abs(o.z + o.size - n.z) < EPS) return o.x < n.x + n.size - EPS && o.x + o.size > n.x + EPS;
  if (side === 'n' && Math.abs(n.z + n.size - o.z) < EPS) return o.x < n.x + n.size - EPS && o.x + o.size > n.x + EPS;
  return false;
}

/**
 * Edges against a finer neighbour stay on the raw height (morph 0): the finer grid's
 * even vertices are that height, and its odd vertices morph onto the straight edge.
 * Edges against a coarser neighbour snap (morph 1) onto that straight edge.
 * Doing both from the raw samples is what keeps the seam shut. Morphing the coarse
 * edge toward its own parent while the fine edge stays raw opens a crack.
 */
function edgeForces(nodes: readonly CdlodNode[], grid: number) {
  const have = new Set(nodes.map(n => `${n.x},${n.z},${n.size}`));
  const snap = new Set<string>();
  const raw = new Set<string>();
  for (const n of nodes) {
    const step = n.size / grid;
    const specs = [
      { side: 'w' as const, nx: n.x - n.size, nz: n.z, alongX: false, edge: n.x },
      { side: 'e' as const, nx: n.x + n.size, nz: n.z, alongX: false, edge: n.x + n.size },
      { side: 's' as const, nx: n.x, nz: n.z - n.size, alongX: true, edge: n.z },
      { side: 'n' as const, nx: n.x, nz: n.z + n.size, alongX: true, edge: n.z + n.size },
    ];
    for (const s of specs) {
      if (have.has(`${s.nx},${s.nz},${n.size}`)) continue;
      const finer = nodes.some(o => o.size < n.size - EPS && edgeTouch(n, o, s.side));
      const coarser = nodes.some(o => o.size > n.size + EPS && edgeTouch(n, o, s.side));
      const mark = finer ? raw : coarser ? snap : null;
      if (!mark) continue;
      for (let i = 0; i <= grid; i++) {
        const x = s.alongX ? n.x + i * step : s.edge;
        const z = s.alongX ? s.edge : n.z + i * step;
        mark.add(qKey(x, z));
      }
    }
  }
  return { snap, raw };
}

function crossUp(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  // Second vector cross first. +Z × +X is +Y, and the callers pass +X then +Z.
  return [by * az - bz * ay, bz * ax - bx * az, bx * ay - by * ax];
}

/**
 * One mesh. `place` returns the tangent-plane height and the linear albedo.
 * Curvature is applied here, then the morph, so a morphed vertex sits on the coarser edge.
 */
export function buildCdlodMesh(
  camX: number, camZ: number, eyeM: number,
  place: (x: number, z: number) => GroundSample,
  radius = PLANET.radius,
): CdlodMeshData {
  const eye = Math.max(1, eyeM);
  const cover = horizonMetres(eye, radius) * CDLOD.cover;
  const grid = CDLOD.grid;
  const n = grid + 1;
  const nodes = selectNodes(camX, camZ, cover);
  const forces = edgeForces(nodes, grid);
  const vertCount = nodes.length * n * n;
  const position = new Float32Array(vertCount * 3);
  const color = new Float32Array(vertCount * 3);
  const water = new Float32Array(vertCount);
  const photo = new Float32Array(vertCount);
  const fade = new Float32Array(vertCount);
  let v = 0;
  const base: number[] = [];
  for (const node of nodes) {
    base.push(v);
    const step = node.size / grid;
    const rawY = new Float64Array(n * n);
    const rawC = new Float64Array(n * n * 3);
    for (let iz = 0; iz <= grid; iz++) for (let ix = 0; ix <= grid; ix++) {
      const x = node.x + ix * step;
      const z = node.z + iz * step;
      const s = place(x, z);
      const drop = curvatureDrop(Math.hypot(x - camX, z - camZ), radius);
      const k = iz * n + ix;
      rawY[k] = s.y - drop;
      rawC[k * 3] = s.rgb[0]; rawC[k * 3 + 1] = s.rgb[1]; rawC[k * 3 + 2] = s.rgb[2];
      const i = v + k;
      position[i * 3] = x; position[i * 3 + 2] = z;
      water[i] = s.water ? 1 : 0;
      photo[i] = s.photo === false ? 0 : 1;
      fade[i] = 1;
    }
    for (let iz = 0; iz <= grid; iz++) for (let ix = 0; ix <= grid; ix++) {
      const x = node.x + ix * step;
      const z = node.z + iz * step;
      const k = iz * n + ix;
      let y = rawY[k];
      let r = rawC[k * 3], g = rawC[k * 3 + 1], b = rawC[k * 3 + 2];
      const evenX = ix % 2 === 0, evenZ = iz % 2 === 0;
      if (!evenX || !evenZ) {
        const dist = Math.hypot(x - camX, z - camZ);
        let m = vertexMorph(dist, node.size);
        const qk = qKey(x, z);
        // A corner that is both keeps the raw height, so the finer grid's even vertex matches.
        if (forces.raw.has(qk)) m = 0;
        else if (forces.snap.has(qk)) m = 1;
        const ix0 = evenX ? ix : ix - 1, ix1 = evenX ? ix : ix + 1;
        const iz0 = evenZ ? iz : iz - 1, iz1 = evenZ ? iz : iz + 1;
        const yAt = (a: number, c: number) => rawY[c * n + a];
        const cAt = (a: number, c: number, ch: number) => rawC[(c * n + a) * 3 + ch];
        let cy: number, cr: number, cg: number, cb: number;
        if (!evenX && evenZ) {
          cy = (yAt(ix0, iz) + yAt(ix1, iz)) / 2;
          cr = (cAt(ix0, iz, 0) + cAt(ix1, iz, 0)) / 2;
          cg = (cAt(ix0, iz, 1) + cAt(ix1, iz, 1)) / 2;
          cb = (cAt(ix0, iz, 2) + cAt(ix1, iz, 2)) / 2;
        } else if (evenX && !evenZ) {
          cy = (yAt(ix, iz0) + yAt(ix, iz1)) / 2;
          cr = (cAt(ix, iz0, 0) + cAt(ix, iz1, 0)) / 2;
          cg = (cAt(ix, iz0, 1) + cAt(ix, iz1, 1)) / 2;
          cb = (cAt(ix, iz0, 2) + cAt(ix, iz1, 2)) / 2;
        } else {
          cy = (yAt(ix0, iz0) + yAt(ix1, iz0) + yAt(ix0, iz1) + yAt(ix1, iz1)) / 4;
          cr = (cAt(ix0, iz0, 0) + cAt(ix1, iz0, 0) + cAt(ix0, iz1, 0) + cAt(ix1, iz1, 0)) / 4;
          cg = (cAt(ix0, iz0, 1) + cAt(ix1, iz0, 1) + cAt(ix0, iz1, 1) + cAt(ix1, iz1, 1)) / 4;
          cb = (cAt(ix0, iz0, 2) + cAt(ix1, iz0, 2) + cAt(ix0, iz1, 2) + cAt(ix1, iz1, 2)) / 4;
        }
        y = y * (1 - m) + cy * m;
        r = r * (1 - m) + cr * m; g = g * (1 - m) + cg * m; b = b * (1 - m) + cb * m;
      }
      const i = v + k;
      position[i * 3 + 1] = y;
      color[i * 3] = r; color[i * 3 + 1] = g; color[i * 3 + 2] = b;
    }
    v += n * n;
  }
  const normal = new Float32Array(vertCount * 3);
  for (let ni = 0; ni < nodes.length; ni++) {
    const o = base[ni];
    const at = (ix: number, iz: number) => {
      const cx = Math.max(0, Math.min(grid, ix)), cz = Math.max(0, Math.min(grid, iz));
      const i = o + cz * n + cx;
      return [position[i * 3], position[i * 3 + 1], position[i * 3 + 2]];
    };
    for (let iz = 0; iz <= grid; iz++) for (let ix = 0; ix <= grid; ix++) {
      const a = at(ix + 1, iz), b = at(ix - 1, iz), c = at(ix, iz + 1), d = at(ix, iz - 1);
      const nn = crossUp(a[0] - b[0], a[1] - b[1], a[2] - b[2], c[0] - d[0], c[1] - d[1], c[2] - d[2]);
      const len = Math.hypot(nn[0], nn[1], nn[2]) || 1;
      const i = o + iz * n + ix;
      normal[i * 3] = nn[0] / len; normal[i * 3 + 1] = nn[1] / len; normal[i * 3 + 2] = nn[2] / len;
    }
  }
  const index = new Uint32Array(nodes.length * grid * grid * 6);
  let t = 0;
  for (let ni = 0; ni < nodes.length; ni++) {
    const o = base[ni];
    for (let iz = 0; iz < grid; iz++) for (let ix = 0; ix < grid; ix++) {
      const a = o + iz * n + ix;
      const b = a + n;
      const c = a + 1;
      const d = b + 1;
      index[t++] = a; index[t++] = b; index[t++] = c;
      index[t++] = c; index[t++] = b; index[t++] = d;
    }
  }
  let outer = 0;
  for (let i = 0; i < vertCount; i++) {
    const r = Math.hypot(position[i * 3] - camX, position[i * 3 + 2] - camZ);
    if (r > outer) outer = r;
  }
  return { position, normal, color, fade, water, photo, index, triangles: t / 3, outerM: outer, nodes: nodes.length };
}

/** How far the ground camera must see so the mesh is not clipped before the horizon. */
export function groundFarPlane(eyeM: number, radius = PLANET.radius) {
  return Math.max(900, horizonMetres(Math.max(1, eyeM), radius) * (CDLOD.cover + 0.2));
}

function edgeKey(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  const A = `${Math.round(ax * 50)},${Math.round(ay * 50)},${Math.round(az * 50)}`;
  const B = `${Math.round(bx * 50)},${Math.round(by * 50)},${Math.round(bz * 50)}`;
  return A < B ? `${A}|${B}` : `${B}|${A}`;
}

function distPointTri(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
) {
  // Distance to the triangle, clamped to the face. Enough to tell a seam (millimetres) from a hole (metres).
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d00 = abx * abx + aby * aby + abz * abz;
  const d01 = abx * acx + aby * acy + abz * acz;
  const d11 = acx * acx + acy * acy + acz * acz;
  const d20 = apx * abx + apy * aby + apz * abz;
  const d21 = apx * acx + apy * acy + apz * acz;
  const den = d00 * d11 - d01 * d01;
  let u = 0, v = 0;
  if (Math.abs(den) > 1e-12) { u = (d11 * d20 - d01 * d21) / den; v = (d00 * d21 - d01 * d20) / den; }
  if (u >= 0 && v >= 0 && u + v <= 1) {
    const qx = ax + u * abx + v * acx, qy = ay + u * aby + v * acy, qz = az + u * abz + v * acz;
    return Math.hypot(px - qx, py - qy, pz - qz);
  }
  const seg = (sx: number, sy: number, sz: number, ex: number, ey: number, ez: number) => {
    const vx = ex - sx, vy = ey - sy, vz = ez - sz;
    const l2 = vx * vx + vy * vy + vz * vz || 1;
    let t = ((px - sx) * vx + (py - sy) * vy + (pz - sz) * vz) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (sx + vx * t), py - (sy + vy * t), pz - (sz + vz * t));
  };
  return Math.min(seg(ax, ay, az, bx, by, bz), seg(bx, by, bz, cx, cy, cz), seg(cx, cy, cz, ax, ay, az));
}

/**
 * Edges used by one triangle that are neither on another triangle nor out past `radius`.
 * A T-junction from the morph is sealed: the extra vertex lies on the coarser triangle.
 * A deleted triangle leaves edges whose midpoint is metres from every other face.
 */
export function interiorGaps(mesh: CdlodMeshData, camX: number, camZ: number, radius: number, tol = 0.05) {
  const pos = mesh.position;
  const idx = mesh.index;
  const count = new Map<string, number>();
  const tris: { ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; mx: number; mz: number }[] = [];
  const cell = 64;
  const buckets = new Map<string, number[]>();
  const large: number[] = [];
  const addCell = (gx: number, gz: number, ti: number) => {
    const k = `${gx},${gz}`;
    const list = buckets.get(k);
    if (list) { if (list[list.length - 1] !== ti) list.push(ti); }
    else buckets.set(k, [ti]);
  };
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i], ib = idx[i + 1], ic = idx[i + 2];
    const ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
    const bx = pos[ib * 3], by = pos[ib * 3 + 1], bz = pos[ib * 3 + 2];
    const cx = pos[ic * 3], cy = pos[ic * 3 + 1], cz = pos[ic * 3 + 2];
    const ti = tris.length;
    tris.push({ ax, ay, az, bx, by, bz, cx, cy, cz, mx: (ax + bx + cx) / 3, mz: (az + bz + cz) / 3 });
    const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
    const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);
    if (maxX - minX > 256 || maxZ - minZ > 256) large.push(ti);
    else for (let gz = Math.floor(minZ / cell); gz <= Math.floor(maxZ / cell); gz++) {
      for (let gx = Math.floor(minX / cell); gx <= Math.floor(maxX / cell); gx++) addCell(gx, gz, ti);
    }
    for (const [p, q] of [[ia, ib], [ib, ic], [ic, ia]] as const) {
      const k = edgeKey(pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2], pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  let gaps = 0;
  const seen = new Set<string>();
  for (let i = 0; i < idx.length; i += 3) {
    const ids = [idx[i], idx[i + 1], idx[i + 2]];
    for (let e = 0; e < 3; e++) {
      const p = ids[e], q = ids[(e + 1) % 3];
      const ax = pos[p * 3], ay = pos[p * 3 + 1], az = pos[p * 3 + 2];
      const bx = pos[q * 3], by = pos[q * 3 + 1], bz = pos[q * 3 + 2];
      const k = edgeKey(ax, ay, az, bx, by, bz);
      if (seen.has(k) || (count.get(k) ?? 0) !== 1) continue;
      seen.add(k);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      const rm = Math.hypot(mx - camX, mz - camZ);
      if (rm >= radius) continue;
      let best = Infinity;
      const consider = (ti: number) => {
        const t = tris[ti];
        const owns = (edgeKey(t.ax, t.ay, t.az, t.bx, t.by, t.bz) === k)
          || (edgeKey(t.bx, t.by, t.bz, t.cx, t.cy, t.cz) === k)
          || (edgeKey(t.cx, t.cy, t.cz, t.ax, t.ay, t.az) === k);
        if (owns) return;
        const d = distPointTri(mx, my, mz, t.ax, t.ay, t.az, t.bx, t.by, t.bz, t.cx, t.cy, t.cz);
        if (d < best) best = d;
      };
      const gx = Math.floor(mx / cell), gz = Math.floor(mz / cell);
      const list = buckets.get(`${gx},${gz}`);
      if (list) for (const ti of list) { consider(ti); if (best <= tol) break; }
      if (best > tol) for (const ti of large) { consider(ti); if (best <= tol) break; }
      if (best > tol) gaps++;
    }
  }
  return gaps;
}

export interface SkyCam {
  x: number; y: number; z: number;
  right: readonly [number, number, number];
  up: readonly [number, number, number];
  forward: readonly [number, number, number];
  fovY: number;
  aspect: number;
  near: number;
  far: number;
  /** Metres the eye is above the surface the horizon is measured from. */
  eye: number;
}

/**
 * Uncovered pixels whose view ray is below the geometric horizon.
 * The horizon elevation is −acos(R / (R + eye)) (the dip of the tangent).
 * `marginRad` ignores the limb itself, where a ridge or a valley moves the silhouette by a pixel.
 * A filled mesh scores 0. A mesh with a hole in view scores above 0.
 */
export function skyPixelsBelowHorizon(
  mesh: CdlodMeshData, cam: SkyCam, w: number, h: number,
  marginRad = 0, planetR = PLANET.radius,
) {
  const pos = mesh.position, idx = mesh.index;
  const covered = new Uint8Array(w * h);
  const f = 1 / Math.tan(cam.fovY / 2);
  const toCam = (x: number, y: number, z: number) => {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    return {
      x: dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2],
      y: dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2],
      z: dx * cam.forward[0] + dy * cam.forward[1] + dz * cam.forward[2],
    };
  };
  const project = (p: { x: number; y: number; z: number }) => ({
    x: ((p.x / p.z) * f / cam.aspect * 0.5 + 0.5) * w,
    y: (1 - ((p.y / p.z) * f * 0.5 + 0.5)) * h,
  });
  const clipNear = (pts: { x: number; y: number; z: number }[]) => {
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ain = a.z >= cam.near, bin = b.z >= cam.near;
      const hit = () => {
        const t = (cam.near - a.z) / (b.z - a.z);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: cam.near };
      };
      if (ain && bin) out.push(b);
      else if (ain && !bin) out.push(hit());
      else if (!ain && bin) { out.push(hit()); out.push(b); }
    }
    return out;
  };
  const paint = (s0: { x: number; y: number }, s1: { x: number; y: number }, s2: { x: number; y: number }) => {
    const minX = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(s0.x, s1.x, s2.x)));
    const minY = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(s0.y, s1.y, s2.y)));
    const den = (s1.y - s2.y) * (s0.x - s2.x) + (s2.x - s1.x) * (s0.y - s2.y);
    if (Math.abs(den) < 1e-8) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const u = ((s1.y - s2.y) * (px - s2.x) + (s2.x - s1.x) * (py - s2.y)) / den;
      const v = ((s2.y - s0.y) * (px - s2.x) + (s0.x - s2.x) * (py - s2.y)) / den;
      const wgt = 1 - u - v;
      if (u >= -1e-3 && v >= -1e-3 && wgt >= -1e-3) covered[y * w + x] = 1;
    }
  };
  for (let i = 0; i < idx.length; i += 3) {
    const pts = [idx[i], idx[i + 1], idx[i + 2]].map(vi => toCam(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]));
    const poly = clipNear(pts);
    if (poly.length < 3) continue;
    const s = poly.map(project);
    paint(s[0], s[1], s[2]);
    if (s.length === 4) paint(s[0], s[2], s[3]);
  }
  const dip = Math.acos(planetR / (planetR + Math.max(0, cam.eye)));
  let sky = 0, below = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ndcX = ((x + 0.5) / w) * 2 - 1;
    const ndcY = 1 - ((y + 0.5) / h) * 2;
    const cx = ndcX * cam.aspect / f, cy = ndcY / f, cz = 1;
    const len = Math.hypot(cx, cy, cz);
    const wy = (cx * cam.right[1] + cy * cam.up[1] + cz * cam.forward[1]) / len;
    const elev = Math.asin(Math.max(-1, Math.min(1, wy)));
    if (elev < -dip - marginRad) {
      below++;
      if (!covered[y * w + x]) sky++;
    }
  }
  return { sky, below };
}
